type EmailEnv = {
  RESEND_API_KEY?: string
  EMAIL_FROM: string
  BETTER_AUTH_URL: string
  // "outbox" keeps emails in memory instead of sending them, even with a
  // Resend key. The e2e tests set it (.dev.vars.e2e).
  EMAIL_DELIVERY?: string
}

export type Email = {
  to: string
  subject: string
  text: string
  html: string
}

// Emails that weren't really sent are printed and kept here, so the
// dev-only outbox route can hand them back. It hangs off globalThis because
// `next dev` can load this module once per route.
const outboxHolder = globalThis as typeof globalThis & { devOutbox?: Email[] }
outboxHolder.devOutbox ??= []
export const devOutbox = outboxHolder.devOutbox

// The outbox stands in for Resend when asked to, or locally when there's no
// key to send with. Never anywhere but localhost, where it would silently
// swallow real people's sign-in emails.
export function usesOutbox(env: EmailEnv) {
  const local = new URL(env.BETTER_AUTH_URL).hostname === 'localhost'
  if (env.EMAIL_DELIVERY === 'outbox') {
    if (!local) throw new Error('EMAIL_DELIVERY=outbox only works on localhost')
    return true
  }
  return local && !env.RESEND_API_KEY
}

export async function sendEmail(env: EmailEnv, email: Email) {
  if (usesOutbox(env)) {
    devOutbox.push(email)
    console.log(`\n[email] to ${email.to}: ${email.subject}\n${email.text}\n`)
    return
  }
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...email }),
  })
  if (!response.ok) {
    throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`)
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

export function signInEmail(to: string, url: string): Email {
  return {
    to,
    subject: 'Your Build-a-Date sign-in link',
    text: `Use this link to sign in to Build-a-Date. It expires in 5 minutes.\n\n${url}\n\nIf you didn't ask for it, you can ignore this email.`,
    html: `<p>Use this link to sign in to Build-a-Date. It expires in 5 minutes.</p>
<p><a href="${escapeHtml(url)}">Sign in to Build-a-Date</a></p>
<p>If you didn't ask for it, you can ignore this email.</p>`,
  }
}

export function editRequestEmail(
  to: string,
  { requester, deckName, url }: { requester: { name: string; email: string }; deckName: string; url: string },
): Email {
  const who = requester.name ? `${requester.name} (${requester.email})` : requester.email
  return {
    to,
    subject: `${requester.name || requester.email} wants to help edit ${deckName}`,
    text: `${who} asked to edit your Build-a-Date deck "${deckName}". Accept or decline on the deck's page:\n\n${url}\n\nIf you don't know them, decline it and they won't be able to change anything.`,
    html: `<p>${escapeHtml(who)} asked to edit your Build-a-Date deck <strong>${escapeHtml(deckName)}</strong>.</p>
<p><a href="${escapeHtml(url)}">Accept or decline the request</a></p>
<p>If you don't know them, decline it and they won't be able to change anything.</p>`,
  }
}
