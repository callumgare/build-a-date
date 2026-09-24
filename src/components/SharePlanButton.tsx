'use client'

import { useRef, useState } from 'react'

export default function SharePlanButton({ title }: { title: string }) {
  const dialogReference = useRef<HTMLDialogElement>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    setLinkCopied(false)
    dialogReference.current?.showModal()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

  return (
    <>
      <button className="done-button" type="button" onClick={share}>
        Share
      </button>
      <dialog className="share-dialog" ref={dialogReference} onClose={() => setLinkCopied(false)}>
        <p>Share this date plan</p>
        <div className="share-dialog-actions">
          <button className="done-button" type="button" onClick={copyLink}>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
          <button className="text-action" type="button" onClick={() => dialogReference.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  )
}
