/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InstallHint from './InstallHint'

const iPhone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'

function device(userAgent: string, { maxTouchPoints = 0, standalone = false } = {}) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true })
}

function hint() {
  return screen.queryByRole('complementary', { name: 'Save as an app' })
}

beforeEach(() => localStorage.clear())

afterEach(() => {
  for (const key of ['userAgent', 'maxTouchPoints', 'standalone']) Reflect.deleteProperty(navigator, key)
  vi.restoreAllMocks()
})

describe('InstallHint', () => {
  it('shows on an iPhone', () => {
    device(iPhone)
    render(<InstallHint />)
    expect(hint()).toBeInTheDocument()
  })

  it('shows on an iPad, which calls itself a Mac', () => {
    device(mac, { maxTouchPoints: 5 })
    render(<InstallHint />)
    expect(hint()).toBeInTheDocument()
  })

  it('stays hidden on a Mac', () => {
    device(mac)
    render(<InstallHint />)
    expect(hint()).not.toBeInTheDocument()
  })

  it('stays hidden on other devices', () => {
    device(android, { maxTouchPoints: 5 })
    render(<InstallHint />)
    expect(hint()).not.toBeInTheDocument()
  })

  it('stays hidden once saved as an app', () => {
    device(iPhone, { standalone: true })
    render(<InstallHint />)
    expect(hint()).not.toBeInTheDocument()
  })

  it('stays hidden when running standalone by display mode', () => {
    device(iPhone)
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches: query === '(display-mode: standalone)', media: query }) as MediaQueryList,
    )
    render(<InstallHint />)
    expect(hint()).not.toBeInTheDocument()
  })

  it('goes away when dismissed, and stays away next time', async () => {
    device(iPhone)
    const user = userEvent.setup()
    const { unmount } = render(<InstallHint />)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(hint()).not.toBeInTheDocument()

    unmount()
    render(<InstallHint />)
    expect(hint()).not.toBeInTheDocument()
  })

  it('still shows, and can be dismissed, without storage', async () => {
    device(iPhone)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    const user = userEvent.setup()
    render(<InstallHint />)

    expect(hint()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(hint()).not.toBeInTheDocument()
  })
})
