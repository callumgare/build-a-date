import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test'

// Gives the page a platform authenticator that says yes to every passkey
// prompt, like a user touching their fingerprint reader. Passkeys it makes
// live as long as the page.
export async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send('WebAuthn.enable')
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  return { client, authenticatorId }
}

// How many emails each address had when a link was last read from it.
const emailsRead = new Map<string, number>()

// Reads the link from the next email sent to an address, from the dev-only
// outbox (emails aren't really sent without a Resend key). It waits for an
// email newer than the one it last returned for that address. Otherwise,
// straight after a click that sends a second email, it could return the
// first email's link before the new one lands, and a sign-in link that has
// already been used is turned away.
export async function latestSignInLink(request: APIRequestContext, email: string) {
  const alreadyRead = emailsRead.get(email) ?? 0
  let link: string | undefined
  await expect(async () => {
    const response = await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)
    const emails: { text: string }[] = await response.json()
    expect(emails.length).toBeGreaterThan(alreadyRead)
    link = emails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0]
    expect(link).toBeTruthy()
    emailsRead.set(email, emails.length)
  }).toPass({ timeout: 30_000 })
  return link as string
}

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

// How many emails have been sent to an address so far.
export async function outboxCount(request: APIRequestContext, email: string) {
  const response = await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)
  const emails: unknown[] = await response.json()
  return emails.length
}

// Makes an account with an email link and skips the passkey. Returns the
// address it signed up with.
export async function signUp(page: Page, request: APIRequestContext, name: string) {
  const email = uniqueEmail(name.toLowerCase())
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.goto(await latestSignInLink(request, email))
  await page.getByRole('link', { name: 'Skip for now' }).click()
  await expect(page).toHaveURL(/\/decks$/)
  return email
}

// Makes a deck, from the suggestions unless it's asked to be empty, from an
// empty /decks page. Returns its share link.
export async function createDeck(page: Page, name: string, { empty = false } = {}) {
  await page.getByRole('button', { name: 'Make your first deck' }).click()
  await page.getByLabel('Name').fill(name)
  if (empty) await page.getByLabel('An empty deck').check()
  await page.getByRole('button', { name: 'Create deck' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  return page.getByLabel('Share link').inputValue()
}

// Save plan and Update Plan land on the plan's page with its share dialog open
// (docs/plans.md § "Sharing a plan"). Checks that, and closes it.
export async function closeShareDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Share this date plan' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/p\/[a-z0-9]+$/)
  await dialog.getByRole('button', { name: 'View' }).click()
  await expect(dialog).toBeHidden()
}

// Presses one of a card's options (Add to plan, Discard, Notes, Edit) from the
// keyboard, as someone tabbing to it would; the card shows its options while
// one has focus (docs/card-notes.md § "When the options show"). A mouse click
// would hover the card first, which tilts it, and Playwright waits for the
// card to hold still. On a busy machine that can take longer than the test
// has, as each frame moves Motion's spring only a little way, and each retry
// nudges the card again (docs/testing.md § "End-to-end tests").
export async function pressOption(option: Locator) {
  await option.press('Enter')
}

// Waits until nothing in the builder is moving: no switch between columns
// under way, no CSS transition or animation running in it or on a card flying
// over the page, and every card in the same place for several frames (Motion
// runs its springs and slides itself, so they're only seen by where things
// are). Rather than sleeping for as long as that usually takes, which on a
// busy machine is sometimes not long enough (docs/testing.md § "Checking
// animation").
export async function expectStill(page: Page) {
  await expect(page.locator('.builder')).not.toHaveAttribute('data-switching')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const running = document.getAnimations().some((animation) => {
              const target = (animation.effect as KeyframeEffect | null)?.target
              return target instanceof Element && Boolean(target.closest('.builder, body > [aria-hidden="true"]'))
            })
            if (running) return resolve(false)
            const places = () =>
              [...document.querySelectorAll('[data-card-id], [data-deck-card-id], body > [aria-hidden="true"]')]
                .map((element) => {
                  const box = element.getBoundingClientRect()
                  return `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}`
                })
                .join(' ')
            const first = places()
            let frames = 0
            requestAnimationFrame(function check() {
              if (places() !== first) return resolve(false)
              if (++frames < 5) requestAnimationFrame(check)
              else resolve(true)
            })
          }),
      ),
    )
    .toBe(true)
}
