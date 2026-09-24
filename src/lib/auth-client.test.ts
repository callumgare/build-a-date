import { passkeyName, wasCancelled } from './auth-client'

function onDevice(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('passkeyName', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 0, 'iPhone'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, 'iPad'],
    // iPadOS reports itself as a Mac, so a touch screen gives it away.
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, 'iPad'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, 'Mac'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5, 'Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 0, 'This device'],
  ])('names a passkey made on %s (%i touch points) "%s"', (userAgent, touchPoints, name) => {
    onDevice(userAgent, touchPoints)
    expect(passkeyName()).toBe(name)
  })
})

describe('wasCancelled', () => {
  it('recognises the browser prompt being closed', () => {
    for (const code of ['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'])
      expect(wasCancelled({ code, message: 'x' })).toBe(true)
  })

  it('treats anything else as a real error', () => {
    expect(wasCancelled({ code: 'INVALID_CREDENTIAL', message: 'x' })).toBe(false)
    expect(wasCancelled({ message: 'no code' })).toBe(false)
    expect(wasCancelled({ code: 42 })).toBe(false)
  })
})
