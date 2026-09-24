import { z } from 'zod'
import { NotFoundError } from '../decks'
import { fail, ok } from './result'

describe('fail', () => {
  it('turns bad input into its first message', () => {
    const { error } = z.object({ name: z.string().min(1, 'Give it a name') }).safeParse({ name: '' })
    expect(fail(error)).toEqual({ ok: false, error: 'Give it a name' })
  })

  it("turns a missing, or someone else's, deck into its message", () => {
    expect(fail(new NotFoundError('Deck not found'))).toEqual({ ok: false, error: 'Deck not found' })
  })

  it('lets anything unexpected surface as a real error', () => {
    const error = new Error('D1 is down')
    expect(() => fail(error)).toThrow(error)
  })
})

describe('ok', () => {
  it('wraps the data', () => {
    expect(ok({ id: 'a' })).toEqual({ ok: true, data: { id: 'a' } })
  })
})
