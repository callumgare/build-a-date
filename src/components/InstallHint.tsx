'use client'

import { useEffect, useState } from 'react'
import styles from './InstallHint.module.css'

const dismissedKey = 'install-hint-dismissed'

// iPadOS reports itself as a Mac, so a touch screen gives it away.
function isIos() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

function isSavedApp() {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function wasDismissed() {
  try {
    return localStorage.getItem(dismissedKey) !== null
  } catch {
    return false
  }
}

// iOS has no install prompt of its own, so point Safari users at the manual
// route, until they save it or wave the hint away.
export default function InstallHint() {
  // Decided after the first render, since the server can't see the device.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(isIos() && !isSavedApp() && !wasDismissed())
  }, [])

  if (!visible) return null

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(dismissedKey, '1')
    } catch {
      // Without storage it just comes back next visit.
    }
  }

  return (
    <aside className={styles.hint} aria-label="Save as an app">
      <p className={styles.message}>
        Save this as an app: tap{' '}
        <span className={styles.share}>
          <ShareIcon />
          Share
        </span>
        , then <strong>Add to Home Screen</strong>.
      </p>
      <button className={styles.dismiss} type="button" onClick={dismiss} aria-label="Dismiss">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4 L12 12 M12 4 L4 12" />
        </svg>
      </button>
    </aside>
  )
}

// The iOS share glyph: an arrow rising out of an open-topped box.
function ShareIcon() {
  return (
    <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 9.5 H7 A1.5 1.5 0 0 0 5.5 11 V19.5 A1.5 1.5 0 0 0 7 21 H17 A1.5 1.5 0 0 0 18.5 19.5 V11 A1.5 1.5 0 0 0 17 9.5 H15.5" />
      <path d="M12 3 V14.5 M8.75 6.25 L12 3 L15.25 6.25" />
    </svg>
  )
}
