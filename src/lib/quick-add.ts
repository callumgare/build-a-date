import { z } from 'zod'
import type { DateCard } from '@/types'

// Turns a few lines someone typed (and whatever pages they link to) into the
// fields of a new card, using a model on OpenRouter (docs/quick-add.md).

type QuickAddEnv = {
  OPENROUTER_API_KEY?: string
  // Any OpenRouter model slug; DEFAULT_MODEL when unset.
  OPENROUTER_MODEL?: string
}

export const DEFAULT_MODEL = 'google/gemini-2.5-flash'

// Links past the first few are left for the person to follow themselves.
const MAX_URLS = 3
const PAGE_TIMEOUT_MS = 8000
// A slow or overloaded model shouldn't leave the dialog spinning forever.
const MODEL_TIMEOUT_MS = 45_000
const PAGE_TEXT_LIMIT = 6000
const MAX_EXAMPLES = 40

// Something went wrong that the person can do something about, or at least
// should be told about, so the action shows its message rather than throwing.
export class QuickAddError extends Error {}

const unreachable = 'Couldn’t reach the helper just now. Try again in a moment.'

export type CardDraft = { title: string; description: string; tags: string[]; date: string }
export type ExampleCard = Pick<DateCard, 'title' | 'description' | 'tags' | 'date'>

export function findUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? []
  // Trailing punctuation is almost always the end of a sentence, not the URL.
  const urls = matches.map((url) => url.replace(/[.,;:!?]+$/, ''))
  return [...new Set(urls)].slice(0, MAX_URLS)
}

function decodeEntities(text: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x?[\da-f]+|\w+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity
    }
    return named[code.toLowerCase()] ?? entity
  })
}

function metaContent(html: string, name: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]
    if (key?.toLowerCase() !== name) continue
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i)
    const value = content?.[1] ?? content?.[2]
    if (value) return decodeEntities(value).trim()
  }
  return undefined
}

// The parts of a page a model needs to describe the place: its title, its
// own summary of itself, and the visible text, without scripts or markup.
export function pageText(html: string, limit = PAGE_TEXT_LIMIT): string {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()
  const summary = [
    title && `Title: ${title}`,
    ...['og:title', 'og:site_name', 'description', 'og:description'].map((name) => {
      const value = metaContent(html, name)
      return value && `${name}: ${value}`
    }),
  ].filter(Boolean)
  const body = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
  return [...summary, '', body].join('\n').slice(0, limit)
}

// Fetches a page for the model to read. A page that can't be read is noted
// rather than failing the whole request, since the typed text may be enough.
async function readPage(url: string, fetcher: typeof fetch): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return '(not a valid URL)'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '(not a web page)'
  try {
    const response = await fetcher(parsed.href, {
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; Build-a-Date/1.0; +https://build-a-date.cals.cafe)',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    })
    if (!response.ok) return `(the page answered ${response.status})`
    const type = response.headers.get('content-type') ?? ''
    if (type && !/html|text\/plain|xml/i.test(type)) return `(not a web page: ${type})`
    return pageText(await response.text())
  } catch {
    return "(couldn't load the page)"
  }
}

function exampleCard(card: ExampleCard) {
  return {
    title: card.title,
    description: card.description,
    tags: card.tags,
    ...(card.date ? { date: card.date } : {}),
  }
}

export function buildPrompt({
  text,
  pages,
  examples,
  tags,
}: {
  text: string
  pages: { url: string; content: string }[]
  examples: ExampleCard[]
  tags: string[]
}) {
  const system = `You help someone add a date idea to their deck of date idea cards. From what they typed, and the web pages they linked to, write one card in the same style as the cards already in their deck.

A card has:
- "title": a short name for the idea, in Title Case, at most 80 characters. Usually the activity or the place, e.g. "Boat Hire at Fairfield Boathouse".
- "description": at most 1000 characters of Markdown. Match the length and tone of the example cards: usually one plain sentence saying what it is, where, and anything notable, then any link they gave as "[More info](<url>)". Don't invent facts that neither the text nor the pages support; if there's nothing useful to say, the description can be just the link, or empty.
- "tags": up to 8 short lowercase tags. Strongly prefer tags from the deck's existing tags; only add a new tag if none of them fit and it would clearly be useful for sorting the deck.
- "date": when it's on or open, at most 80 characters, e.g. "Open daily", "First Wednesday of the month", "Every Friday until 2 October". Use an empty string if nothing says when.

Reply with only a JSON object with exactly the keys "title", "description", "tags" and "date".`

  const pageSection = pages.length
    ? pages.map((page) => `<page url="${page.url}">\n${page.content}\n</page>`).join('\n\n')
    : '(no links given)'
  const user = `Tags already used in the deck: ${tags.length ? tags.join(', ') : '(none yet)'}

Cards already in the deck, as examples of the style:
${JSON.stringify(examples.slice(0, MAX_EXAMPLES).map(exampleCard), null, 1)}

What they typed:
<typed>
${text}
</typed>

Linked pages:
${pageSection}`

  return { system, user }
}

const modelReply = z.object({
  title: z.string().catch(''),
  description: z.string().catch(''),
  tags: z.array(z.string()).catch([]),
  date: z.string().nullish().catch(''),
})

// Models sometimes wrap JSON in a code fence or a sentence despite being told
// not to, so this takes the outermost object it can find.
export function parseReply(content: string): CardDraft {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  const unreadable = new QuickAddError('Couldn’t make sense of that. Try adding a little more detail.')
  if (start === -1 || end < start) throw unreadable
  let raw: unknown
  try {
    raw = JSON.parse(content.slice(start, end + 1))
  } catch {
    throw unreadable
  }
  const reply = modelReply.parse(raw)
  // Trimmed to fit the card form, which checks the same limits on save
  // (cardInput in src/lib/validation.ts).
  const tags = [...new Set(reply.tags.map((tag) => tag.trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 8)
  return {
    title: reply.title.trim().slice(0, 80),
    description: reply.description.trim().slice(0, 1000),
    tags,
    date: (reply.date ?? '').trim().slice(0, 80),
  }
}

export async function extractIdea(
  env: QuickAddEnv,
  { text, examples, tags }: { text: string; examples: ExampleCard[]; tags: string[] },
  fetcher: typeof fetch = fetch,
): Promise<CardDraft> {
  if (!env.OPENROUTER_API_KEY) throw new QuickAddError('Quick Add isn’t set up on this server yet.')

  const urls = findUrls(text)
  const pages = await Promise.all(urls.map(async (url) => ({ url, content: await readPage(url, fetcher) })))
  const { system, user } = buildPrompt({ text, pages, examples, tags })

  let content: string
  try {
    const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://build-a-date.cals.cafe',
        'X-Title': 'Build-a-Date',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`OpenRouter answered ${response.status}: ${await response.text()}`)
    const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] }
    const message = body.choices?.[0]?.message?.content
    if (typeof message !== 'string') throw new Error(`OpenRouter sent no message: ${JSON.stringify(body)}`)
    content = message
  } catch (error) {
    // Down, slow, out of credits or rate limited: all worth a retry later.
    console.error('Quick Add could not get an answer from OpenRouter', error)
    throw new QuickAddError(unreachable)
  }
  return parseReply(content)
}
