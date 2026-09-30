'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import CloseButton from './CloseButton'
import styles from './Dialog.module.css'

type DialogProps = {
  // Shown as a modal while true. Closing it any other way (Escape, the cross)
  // calls onClose, which should set this back to false.
  open: boolean
  onClose: () => void
  // Small is centred, for a message and a few buttons; form and wide are for
  // forms, and wide has room for a preview beside one.
  size?: 'small' | 'form' | 'wide'
  // A cross in the top corner.
  closeButton?: boolean
  className?: string
  children: ReactNode
  'aria-label'?: string
  'aria-labelledby'?: string
}

// A modal dialog over the page (docs/ui-components.md § "Dialog").
export default function Dialog({
  open,
  onClose,
  size = 'small',
  closeButton = false,
  className,
  children,
  ...labels
}: DialogProps) {
  const reference = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = reference.current
    if (open && !dialog?.open) dialog?.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])

  return (
    <dialog
      className={`${styles.dialog} ${styles[size]} ${className ?? ''}`}
      ref={reference}
      onClose={onClose}
      {...labels}
    >
      {closeButton && <CloseButton className={styles.close} label="Close" onClick={onClose} />}
      {children}
    </dialog>
  )
}
