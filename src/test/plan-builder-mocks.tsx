// Stand-ins for everything PlanBuilder reaches outside itself: its server
// actions, Next's router and Link, and drawing the plan's link preview, which
// jsdom can't do. A vi.mock call only applies to the file it's in, so each
// PlanBuilder test file loads these itself:
//
//   vi.mock('@/lib/actions/plans', () => import('@/test/plan-builder-mocks'))
//
// and the same for '@/lib/actions/decks', '@/lib/actions/preferences',
// '@/lib/og/client', 'next/navigation' and 'next/link'. They're apart from
// '@/test/plan-builder', which renders PlanBuilder, since a mock that loaded
// PlanBuilder would be waiting on itself. resetPlanBuilder() there resets them.
import type { ComponentProps } from 'react'

export const savePlan = vi.fn()
export const updatePlan = vi.fn()
export const deletePlan = vi.fn()
export const saveCardNotes = vi.fn()

export const saveCard = vi.fn()
export const deleteCard = vi.fn()
export const quickAddCard = vi.fn()

export const saveDeckSort = vi.fn()

export const drawPreview = vi.fn()
export const preloadPreview = vi.fn()

export const router = { push: vi.fn(), refresh: vi.fn() }

export function useRouter() {
  return router
}

// Next's Link goes to the next page without the browser loading it, so this
// one stops the browser's own navigation, which jsdom can't do anyway.
export default function Link({ href, onClick, ...props }: ComponentProps<'a'>) {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    />
  )
}
