import { passkeyClient } from '@better-auth/passkey/client'
import { magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [passkeyClient(), magicLinkClient()],
})

// A default label for a new passkey. The settings list shows when each was
// made alongside it.
export function passkeyName() {
  const agent = navigator.userAgent
  return /iPhone/.test(agent)
    ? 'iPhone'
    : /iPad/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(agent)
        ? 'Android'
        : /Mac/.test(agent)
          ? 'Mac'
          : /Windows/.test(agent)
            ? 'Windows'
            : 'This device'
}

// Closing the browser's passkey prompt isn't worth an error message. The
// browser reports it as NotAllowedError, which reaches us as a passthrough.
const cancelCodes = new Set(['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'])

export function wasCancelled(error: object) {
  return 'code' in error && typeof error.code === 'string' && cancelCodes.has(error.code)
}
