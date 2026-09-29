// How much smaller than it's laid out an element in the builder is drawn: a
// fifth in a column shrunk on a narrow screen, part way while a column grows
// or shrinks, and 1 anywhere else (docs/card-layout.md § "Narrow screens").
// Measured on the column's section, which is what's scaled, rather than on
// the element itself, which may be tilting or part way through a layout
// animation.
export function shrinkOf(element: Element) {
  const section = element.closest<HTMLElement>('.deck-section, .plan-section, .plan-heading')
  if (!section?.offsetWidth) return 1
  return section.getBoundingClientRect().width / section.offsetWidth || 1
}

// Once a column has finished growing or shrinking: when the CSS transitions
// that do it (the builder's column widths, and each section's --shrink) have
// finished, rather than after as long as they take. A transition starts when
// the browser next works out the page's styles, which on a busy device can be
// a good while after the change, so a timer could end the switch before the
// columns had even started to move. Asking for a style starts them now, so
// they can be waited on. Straight away when nothing moves (reduced motion, or
// no change).
export function switchOver(builder: HTMLElement): Promise<void> {
  // Nothing animates without Web Animations (as in jsdom).
  if (typeof builder.getAnimations !== 'function') return Promise.resolve()
  getComputedStyle(builder).gridTemplateColumns
  const moving = builder.getAnimations({ subtree: true }).filter((animation) => {
    const property = (animation as Partial<CSSTransition>).transitionProperty
    return property === 'grid-template-columns' || property === '--shrink'
  })
  return Promise.allSettled(moving.map((animation) => animation.finished)).then(() => undefined)
}
