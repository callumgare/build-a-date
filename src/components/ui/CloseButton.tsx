import styles from './CloseButton.module.css'

type CloseButtonProps = {
  label: string
  onClick: () => void
  className?: string
}

// A small cross, for closing a dialog or putting a notice away.
export default function CloseButton({ label, onClick, className }: CloseButtonProps) {
  return (
    <button className={`${styles.close} ${className ?? ''}`} type="button" aria-label={label} onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4 L12 12 M12 4 L4 12" />
      </svg>
    </button>
  )
}
