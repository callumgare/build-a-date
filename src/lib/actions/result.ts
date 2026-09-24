import { z } from 'zod'
import { NotFoundError } from '../decks'

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

// Turns expected failures (bad input, missing or someone else's deck) into a
// message for the form, and lets anything else surface as a real error.
export function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Invalid input' }
  if (error instanceof NotFoundError) return { ok: false, error: error.message }
  throw error
}
