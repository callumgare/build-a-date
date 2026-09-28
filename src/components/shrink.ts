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
