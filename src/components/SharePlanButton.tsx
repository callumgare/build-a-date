'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { celebrate } from './galaxy/sparkle'
import styles from './SharePlanButton.module.css'
import Button from './ui/Button'
import Dialog from './ui/Dialog'

// The plan's own address, without ?share or anything else added to it.
function planUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

type SharePlanButtonProps = {
  title: string
  // Straight after Save plan or Update Plan, the dialog is already open
  // (docs/plans.md § "Sharing a plan").
  openOnLoad?: boolean
}

export default function SharePlanButton({ title, openOnLoad = false }: SharePlanButtonProps) {
  const [open, setOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  // Only known in the browser, so the first render matches the server's.
  const [canShare, setCanShare] = useState(false)
  const headingId = useId()

  const router = useRouter()
  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
    if (!openOnLoad) return
    setOpen(true)
    // Just saved (docs/background.md § "Bursts").
    celebrate()
    // So a reload, or the address bar copied by hand, doesn't open it again.
    // Through Next's router rather than the browser's history: on a slow
    // device this page can show before Next has finished going to it, and
    // Next then sets the address it went to, ?share and all. Its router does
    // one navigation after another, so this one comes after that.
    router.replace(window.location.pathname, { scroll: false })
  }, [openOnLoad, router])

  // The device's share sheet, where there is one, and the dialog otherwise
  // or if the sheet fails. The sheet only opens from a press, so it's a
  // button in the dialog too, rather than opening by itself after Save plan.
  async function share({ fromDialog = false } = {}) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: planUrl() })
        celebrate()
        if (fromDialog) setOpen(false)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    setLinkCopied(false)
    setOpen(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(planUrl())
      setLinkCopied(true)
      celebrate()
    } catch {
      setLinkCopied(false)
    }
  }

  function close() {
    setOpen(false)
    setLinkCopied(false)
  }

  return (
    <>
      <Button onClick={() => share()}>Share</Button>
      <Dialog open={open} onClose={close} closeButton aria-labelledby={headingId}>
        <p className={styles.heading} id={headingId}>
          Share this date plan
        </p>
        <div className={styles.actions}>
          <Button onClick={copyLink}>{linkCopied ? 'Copied!' : 'Copy link'}</Button>
          {canShare && (
            <Button variant="text" onClick={() => share({ fromDialog: true })}>
              Share…
            </Button>
          )}
          {/* Closes it, onto the plan behind (docs/plans.md § "Sharing a plan"). */}
          <Button variant="text" onClick={close}>
            View
          </Button>
        </div>
      </Dialog>
    </>
  )
}
