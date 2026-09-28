import '@testing-library/jest-dom/vitest'

// Motion's animations jump straight to their end, so a test doesn't sit
// waiting out a fade or a flip in real time. Everything still runs as it
// would with motion allowed; only the time it takes is gone. How things move
// is checked in a real browser, in e2e/. Only for jsdom, as nothing else
// renders.
if (typeof window !== 'undefined') {
  const { MotionGlobalConfig } = await import('motion/react')
  MotionGlobalConfig.skipAnimations = true
}

// jsdom lacks the layout APIs the cards and animations reach for.
if (typeof window !== 'undefined') {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true })
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false
  }
}
