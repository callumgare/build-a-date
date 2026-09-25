/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import ForgetPlanEdits from './ForgetPlanEdits'

const key = 'build-a-date:picks:plan:plan42'

beforeEach(() => sessionStorage.clear())

/** @see docs/plans.md § "Editing a plan" - coming back to the plan drops unsaved changes */
describe('ForgetPlanEdits', () => {
  it("forgets the plan's unsaved changes when the page shows, and only that plan's", () => {
    sessionStorage.setItem(key, '["picnic"]')
    sessionStorage.setItem('build-a-date:picks:plan:other', '["hike"]')
    render(<ForgetPlanEdits planId="plan42" />)
    expect(sessionStorage.getItem(key)).toBeNull()
    expect(sessionStorage.getItem('build-a-date:picks:plan:other')).not.toBeNull()
  })

  it('forgets them again when the page comes back from the back-forward cache', () => {
    render(<ForgetPlanEdits planId="plan42" />)
    sessionStorage.setItem(key, '["picnic"]')
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    expect(sessionStorage.getItem(key)).toBeNull()
  })
})
