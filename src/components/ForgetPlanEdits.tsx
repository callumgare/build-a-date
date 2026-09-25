'use client'

import { useEffect } from 'react'
import { forgetPlanEdits } from './keptPicks'

// Coming back to a plan without pressing Update Plan or Cancel drops the
// changes, so Edit plan starts from the saved plan again (docs/plans.md
// § "Editing a plan"). Runs whenever the page shows, including coming back
// to it from the browser's back-forward cache.
export default function ForgetPlanEdits({ planId }: { planId: string }) {
  useEffect(() => {
    forgetPlanEdits(planId)
    function shown(event: PageTransitionEvent) {
      if (event.persisted) forgetPlanEdits(planId)
    }
    window.addEventListener('pageshow', shown)
    return () => window.removeEventListener('pageshow', shown)
  }, [planId])

  return null
}
