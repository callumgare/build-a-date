import { buildPrompt, DEFAULT_MODEL, extractIdea, findUrls, pageText, parseReply, QuickAddError } from './quick-add'

const env = { OPENROUTER_API_KEY: 'test-key' }
const examples = [
  {
    title: 'Berlin Bar',
    description: 'A Cold War themed bar. [More info](https://berlinbar.com.au/)',
    tags: ['food & drink', 'night'],
  },
  { title: 'Stargazing Drive', description: '', tags: ['free', 'night'], date: 'Clear nights' },
]

function reply(card: object) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(card) } }] })
}

// A stand-in for fetch: web pages by URL, and OpenRouter's reply.
function fakeFetch(pages: Record<string, Response | Error>, answer: Response = reply({})) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url === 'https://openrouter.ai/api/v1/chat/completions') return answer
    const page = pages[url]
    if (!page) throw new Error(`Unexpected fetch of ${url}`)
    if (page instanceof Error) throw page
    return page
  })
}

function html(body: string) {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function sentPrompt(fetcher: ReturnType<typeof fakeFetch>) {
  const call = fetcher.mock.calls.find(([url]) => String(url).startsWith('https://openrouter.ai'))
  return JSON.parse(String(call?.[1]?.body)) as {
    model: string
    messages: { role: string; content: string }[]
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe('findUrls', () => {
  /** @see docs/quick-add.md § "Links" */
  it('finds each link once, without the punctuation that ends a sentence', () => {
    expect(findUrls('Boat hire https://a.com/x, or http://b.com. Again https://a.com/x')).toEqual([
      'https://a.com/x',
      'http://b.com',
    ])
  })

  /** @see docs/quick-add.md § "Links" - only the first three links are read */
  it('stops after three links', () => {
    expect(findUrls('https://1.com https://2.com https://3.com https://4.com')).toHaveLength(3)
  })

  it('finds nothing in plain text', () => {
    expect(findUrls('Stargazing somewhere dark')).toEqual([])
  })
})

describe('pageText', () => {
  it('keeps the title, the summary and the visible text, without scripts or markup', () => {
    const text = pageText(`<html><head><title>Fairfield Boathouse &amp; Tea Garden</title>
      <meta name="description" content="Row boats on the Yarra">
      <meta property='og:site_name' content='Fairfield Boathouse'>
      <script>var hidden = 1</script><style>p { color: red }</style></head>
      <body><h1>Boat hire</h1><p>Open Wednesday&nbsp;to Sunday</p><!-- a comment --></body></html>`)
    expect(text).toContain('Title: Fairfield Boathouse & Tea Garden')
    expect(text).toContain('description: Row boats on the Yarra')
    expect(text).toContain('og:site_name: Fairfield Boathouse')
    expect(text).toContain('Boat hire\nOpen Wednesday to Sunday')
    expect(text).not.toMatch(/hidden|color|comment|</)
  })

  it('cuts long pages short', () => {
    expect(pageText(`<p>${'a'.repeat(10_000)}</p>`, 100)).toHaveLength(100)
  })
})

describe('buildPrompt', () => {
  /** @see docs/quick-add.md § "Matching the deck's style" */
  it("gives the model the deck's tags and cards as examples, with what was typed and the pages", () => {
    const { user } = buildPrompt({
      text: 'Boat hire',
      pages: [{ url: 'https://boats.example', content: 'Row boats' }],
      examples,
      tags: ['food & drink', 'free', 'night'],
    })
    expect(user).toContain('Tags already used in the deck: food & drink, free, night')
    expect(user).toContain('"title": "Berlin Bar"')
    expect(user).toContain('"date": "Clear nights"')
    expect(user).toContain('<typed>\nBoat hire\n</typed>')
    expect(user).toContain('<page url="https://boats.example">\nRow boats\n</page>')
  })
})

describe('parseReply', () => {
  it('reads the JSON even when the model wraps it in a code fence', () => {
    expect(parseReply('```json\n{"title":"Golf","description":"","tags":["games"],"date":null}\n```')).toEqual({
      title: 'Golf',
      description: '',
      tags: ['games'],
      date: '',
    })
  })

  /** @see docs/quick-add.md § "What comes back" - trimmed to what the card form accepts */
  it('trims what comes back to fit the card form', () => {
    const draft = parseReply(
      JSON.stringify({
        title: 'T'.repeat(100),
        description: 'D'.repeat(1200),
        tags: [' Night ', 'night', 'x'.repeat(30), '', 'a', 'b', 'c', 'd', 'e', 'f', 'g'],
        date: 'W'.repeat(90),
      }),
    )
    expect(draft.title).toHaveLength(80)
    expect(draft.description).toHaveLength(1000)
    expect(draft.date).toHaveLength(80)
    expect(draft.tags).toEqual(['night', 'x'.repeat(24), 'a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('fills in anything missing or of the wrong type with blanks', () => {
    expect(parseReply('{"title": 3}')).toEqual({ title: '', description: '', tags: [], date: '' })
  })

  it('says it could not make sense of a reply that is not JSON', () => {
    expect(() => parseReply('Sorry, I cannot help')).toThrow(QuickAddError)
    expect(() => parseReply('{not json}')).toThrow('Couldn’t make sense of that')
  })
})

describe('extractIdea', () => {
  /** @see docs/quick-add.md § "Links" */
  it('reads the linked pages and hands them to the model with what was typed', async () => {
    const card = {
      title: 'Boat Hire at Fairfield Boathouse',
      description: 'Row a boat along the Yarra. [More info](https://boats.example/)',
      tags: ['outside', 'relaxed'],
      date: 'Wednesdays',
    }
    const fetcher = fakeFetch(
      { 'https://boats.example/': html('<title>Fairfield Boathouse</title><p>Row boats on the Yarra</p>') },
      reply(card),
    )

    const draft = await extractIdea(
      env,
      { text: 'open on wednesdays https://boats.example/', examples, tags: ['outside', 'relaxed'] },
      fetcher,
    )

    expect(draft).toEqual(card)
    const body = sentPrompt(fetcher)
    expect(body.model).toBe(DEFAULT_MODEL)
    expect(body.messages[1].content).toContain('Row boats on the Yarra')
    expect(body.messages[1].content).toContain('open on wednesdays')
  })

  it('works from the text alone when there are no links', async () => {
    const fetcher = fakeFetch({}, reply({ title: 'Stargazing', description: '', tags: [], date: '' }))
    expect((await extractIdea(env, { text: 'Stargazing', examples, tags: [] }, fetcher)).title).toBe('Stargazing')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  /** @see docs/quick-add.md § "Links" - a page that can't be read doesn't stop the rest */
  it("carries on when a page can't be read, and says so to the model", async () => {
    const fetcher = fakeFetch({
      'https://down.example/': new Error('network'),
      'https://missing.example/': new Response('Not found', { status: 404 }),
      'https://file.example/menu.pdf': new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    })

    await extractIdea(
      env,
      { text: 'https://down.example https://missing.example https://file.example/menu.pdf', examples, tags: [] },
      fetcher,
    )

    const prompt = sentPrompt(fetcher).messages[1].content
    expect(prompt).toContain("(couldn't load the page)")
    expect(prompt).toContain('(the page answered 404)')
    expect(prompt).toContain('(not a web page: application/pdf)')
  })

  /** @see docs/quick-add.md § "Setting it up" */
  it('uses OPENROUTER_MODEL when it is set', async () => {
    const fetcher = fakeFetch({})
    await extractIdea({ ...env, OPENROUTER_MODEL: 'some/model' }, { text: 'Golf', examples, tags: [] }, fetcher)
    expect(sentPrompt(fetcher).model).toBe('some/model')
  })

  /** @see docs/quick-add.md § "Setting it up" */
  it('says Quick Add is not set up when there is no key, without calling anything', async () => {
    const fetcher = fakeFetch({})
    await expect(extractIdea({}, { text: 'Golf', examples, tags: [] }, fetcher)).rejects.toThrow(
      'Quick Add isn’t set up on this server yet.',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('says the helper could not be reached when OpenRouter fails', async () => {
    const failing = fakeFetch({}, new Response('rate limited', { status: 429 }))
    await expect(extractIdea(env, { text: 'Golf', examples, tags: [] }, failing)).rejects.toThrow(
      'Couldn’t reach the helper just now',
    )

    const empty = fakeFetch({}, Response.json({ choices: [] }))
    await expect(extractIdea(env, { text: 'Golf', examples, tags: [] }, empty)).rejects.toThrow(QuickAddError)

    // What a slow model looks like once the timeout gives up on it.
    const slow = vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))
    await expect(extractIdea(env, { text: 'Golf', examples, tags: [] }, slow)).rejects.toThrow(QuickAddError)
    expect(slow.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)

    const offline = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(extractIdea(env, { text: 'Golf', examples, tags: [] }, offline)).rejects.toThrow(QuickAddError)
  })
})
