import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import styles from './Form.module.css'

// Its fields and buttons in a column, full width, with a text button (like
// Cancel) centred under the rest.
export function Form({ className, ...props }: ComponentPropsWithoutRef<'form'>) {
  return <form className={`${styles.form} ${className ?? ''}`} {...props} />
}

// The same column, for a group of buttons that isn't a form.
export function FormStack({ children }: { children: ReactNode }) {
  return <div className={styles.form}>{children}</div>
}

// A form's buttons, side by side: Save, then the text buttons like Cancel.
export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>
}

// A field with its label above it, and a hint beside the label.
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is its children
    <label className={styles.field}>
      <span>
        {label}
        {hint && (
          <>
            {' '}
            <small>{hint}</small>
          </>
        )}
      </span>
      {children}
    </label>
  )
}

// A text box. It has a background of its own, so its text has no halo.
export function Input({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return <input className={`${styles.input} ${className ?? ''}`} {...props} />
}

export function TextArea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={`${styles.input} ${styles.textArea} ${className ?? ''}`} {...props} />
}

// Why something didn't work. Nothing when there's nothing to say.
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  )
}

// A note on how something went, like an email being sent.
export function FormNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note} role="status">
      {children}
    </p>
  )
}

export function ChoiceGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className={styles.choiceGroup}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  )
}

// One of a set of radio buttons, with its title and a line saying more.
export function Choice({
  title,
  hint,
  ...input
}: { title: string; hint: string } & Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'title'>) {
  return (
    <label className={styles.choice}>
      <input type="radio" {...input} />
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
    </label>
  )
}
