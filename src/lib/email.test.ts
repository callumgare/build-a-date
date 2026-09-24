import { devOutbox, editRequestEmail, sendEmail, signInEmail, usesOutbox } from './email'

const email = signInEmail('sam@example.com', 'https://build-a-date.example/api/auth/magic-link/verify?token=abc')
const production = { BETTER_AUTH_URL: 'https://build-a-date.example', EMAIL_FROM: 'Dates <hi@example.com>' }
const local = { BETTER_AUTH_URL: 'http://localhost:3000', EMAIL_FROM: 'Dates <hi@example.com>' }

// Stands in for Resend's API. No test here ever makes a real request.
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  devOutbox.length = 0
  fetchMock.mockReset().mockResolvedValue(Response.json({ id: 'email_1' }))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendEmail through Resend', () => {
  it('posts the email with the API key and sender', async () => {
    await sendEmail({ ...production, RESEND_API_KEY: 're_test' }, email)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer re_test')
    expect(JSON.parse(String(init?.body))).toEqual({ from: 'Dates <hi@example.com>', ...email })
    expect(devOutbox).toEqual([])
  })

  it('throws with Resend’s reason when it refuses', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Invalid `to` field"}', { status: 422 }))
    await expect(sendEmail({ ...production, RESEND_API_KEY: 're_test' }, email)).rejects.toThrow(
      /Resend rejected the email \(422\).*Invalid `to` field/,
    )
  })

  it('refuses to run in production without a key rather than dropping the email', async () => {
    await expect(sendEmail(production, email)).rejects.toThrow('RESEND_API_KEY is not set')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the outbox', () => {
  it('stands in for Resend when asked to, even with a key', async () => {
    await sendEmail({ ...local, RESEND_API_KEY: 're_test', EMAIL_DELIVERY: 'outbox' }, email)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(devOutbox).toEqual([email])
  })

  it('is used locally when there is no key', async () => {
    await sendEmail(local, email)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(devOutbox).toEqual([email])
  })

  it('is never used anywhere but localhost', () => {
    expect(usesOutbox({ ...production, RESEND_API_KEY: 're_test' })).toBe(false)
    expect(() => usesOutbox({ ...production, EMAIL_DELIVERY: 'outbox' })).toThrow('only works on localhost')
  })
})

describe('signInEmail', () => {
  it('escapes the link in the HTML version', () => {
    const { html, text } = signInEmail('sam@example.com', 'https://x.example/?a=1&b="2"')
    expect(html).toContain('href="https://x.example/?a=1&#38;b=&#34;2&#34;"')
    expect(text).toContain('https://x.example/?a=1&b="2"')
  })
})

describe('editRequestEmail', () => {
  it('says who is asking and links to the deck, escaping both in the HTML', () => {
    const { to, subject, text, html } = editRequestEmail('owner@example.com', {
      requester: { name: 'Sam <3', email: 'sam@example.com' },
      deckName: 'Dates & "more"',
      url: 'https://x.example/decks/abc',
    })
    expect(to).toBe('owner@example.com')
    expect(subject).toBe('Sam <3 wants to help edit Dates & "more"')
    expect(text).toContain('Sam <3 (sam@example.com)')
    expect(text).toContain('https://x.example/decks/abc')
    expect(html).toContain('Sam &#60;3')
    expect(html).toContain('Dates &#38; &#34;more&#34;')
    expect(html).not.toContain('<3')
  })

  it('names the requester by email when they have no name', () => {
    const { subject, text } = editRequestEmail('owner@example.com', {
      requester: { name: '', email: 'sam@example.com' },
      deckName: 'Dates',
      url: 'https://x.example/decks/abc',
    })
    expect(subject).toBe('sam@example.com wants to help edit Dates')
    expect(text).toMatch(/^sam@example\.com asked to edit/)
  })
})
