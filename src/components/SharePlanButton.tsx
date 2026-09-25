'use client'

import { useEffect, useId, useRef, useState } from 'react'

// The plan's own address, without ?share or anything else added to it.
function planUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

type SharePlanButtonProps = {
  title: string
  // Straight after Done or Update Plan, the dialog is already open
  // (docs/plans.md § "Sharing a plan").
  openOnLoad?: boolean
}

export default function SharePlanButton({ title, openOnLoad = false }: SharePlanButtonProps) {
  const dialogReference = useRef<HTMLDialogElement>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  // Only known in the browser, so the first render matches the server's.
  const [canShare, setCanShare] = useState(false)
  const headingId = useId()

  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
    if (!openOnLoad) return
    dialogReference.current?.showModal()
    // So a reload, or the address bar copied by hand, doesn't open it again.
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [openOnLoad])

  // The device's share sheet, where there is one, and the dialog otherwise
  // or if the sheet fails. The sheet only opens from a press, so it's a
  // button in the dialog too, rather than opening by itself after Done.
  async function share({ fromDialog = false } = {}) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: planUrl() })
        if (fromDialog) dialogReference.current?.close()
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    setLinkCopied(false)
    if (!dialogReference.current?.open) dialogReference.current?.showModal()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(planUrl())
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

  return (
    <>
      <button className="done-button" type="button" onClick={() => share()}>
        Share
      </button>
      <dialog
        className="share-dialog"
        ref={dialogReference}
        aria-labelledby={headingId}
        onClose={() => setLinkCopied(false)}
      >
        <p id={headingId}>Share this date plan</p>
        <div className="share-dialog-actions">
          <button className="done-button" type="button" onClick={copyLink}>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
          {canShare && (
            <button className="text-action" type="button" onClick={() => share({ fromDialog: true })}>
              Share…
            </button>
          )}
          <button className="text-action" type="button" onClick={() => dialogReference.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  )
}
