// Stand-ins for the parts of Next that only work inside a request. Load them
// with `vi.mock('next/navigation', () => import('@/test/next'))` (and the
// same for 'next/headers' and 'next/cache').
//
// Like Next's own, redirect() and notFound() throw, so nothing after them
// runs. The error says where it was going, for `rejects.toThrow`.

export class RedirectError extends Error {
  constructor(readonly path: string) {
    super(`Redirected to ${path}`)
  }
}

export class NotFoundPage extends Error {
  constructor() {
    super('Not found')
  }
}

export const redirect = vi.fn((path: string): never => {
  throw new RedirectError(path)
})

export const notFound = vi.fn((): never => {
  throw new NotFoundPage()
})

export const revalidatePath = vi.fn()

export const headers = vi.fn(async () => new Headers())

export const connection = vi.fn(async () => {})
