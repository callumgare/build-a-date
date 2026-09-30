import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'
import styles from './Button.module.css'

type Look = {
  // Solid is the accent-filled button for the main thing to do; text reads as
  // a link, with a faint underline that firms up on hover
  // (docs/ui-components.md § "Links and buttons").
  variant?: 'solid' | 'text'
  // A quieter text link, in cream rather than the accent until hovered, as in
  // the site's header.
  tone?: 'subtle'
}

type AsButton = Look & ComponentPropsWithoutRef<'button'> & { href?: undefined }
type AsLink = Look &
  Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
    href: string
    // A plain <a>, which the browser follows itself, rather than Next's Link.
    native?: boolean
  }

export type ButtonProps = AsButton | AsLink

// A button, or a link when it has an href, in one of the site's two looks.
export default function Button({ variant = 'solid', tone, className, ...props }: ButtonProps) {
  const classes = [styles[variant], tone && styles[tone], className].filter(Boolean).join(' ')

  if (props.href !== undefined) {
    const { native, ...link } = props as AsLink
    if (native) {
      const { prefetch: _prefetch, replace: _replace, scroll: _scroll, ...anchor } = link
      return <a className={classes} data-variant={variant} {...(anchor as ComponentPropsWithoutRef<'a'>)} />
    }
    return <Link className={classes} data-variant={variant} {...link} />
  }
  const { type = 'button', ...button } = props as AsButton
  return <button className={classes} data-variant={variant} type={type} {...button} />
}
