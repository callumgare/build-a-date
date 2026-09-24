import { devOutbox, type Email, signInEmail } from '@/lib/email'
import { resetEnv } from '@/test/cloudflare'
import { GET } from './route'

vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))

function outbox(query = '') {
  return GET(new Request(`http://localhost:3000/api/dev/outbox${query}`))
}

async function emails(query = '') {
  return (await outbox(query).json()) as Email[]
}

beforeEach(() => {
  resetEnv()
  devOutbox.length = 0
  devOutbox.push(
    signInEmail('sam@example.com', 'http://localhost:3000/a'),
    signInEmail('jo@example.com', 'http://localhost:3000/b'),
  )
})

describe('the dev outbox route', () => {
  it('hands back the emails that were kept instead of sent', async () => {
    expect((await emails()).map((email) => email.to)).toEqual(['sam@example.com', 'jo@example.com'])
  })

  it('hands back only the emails to one address when asked', async () => {
    const toJo = await emails('?to=jo%40example.com')
    expect(toJo).toHaveLength(1)
    expect(toJo[0].text).toContain('http://localhost:3000/b')
  })

  // Otherwise it would hand anyone every sign-in link.
  it("doesn't exist anywhere the outbox isn't standing in for Resend", async () => {
    resetEnv({ RESEND_API_KEY: 're_test' })
    expect((await outbox()).status).toBe(404)

    resetEnv({ BETTER_AUTH_URL: 'https://build-a-date.example', RESEND_API_KEY: 're_test' })
    const response = await outbox()
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('sam@example.com')
  })
})
