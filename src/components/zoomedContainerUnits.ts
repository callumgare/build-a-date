// Safari multiplies container units inside an element with CSS zoom by the
// zoom a second time: 10cqw of a 250px container under zoom 0.2 comes out as
// 5px, where it should be 25px (in the container's own units, like every
// other length there). The shrunk column on a narrow screen is zoomed, so its
// cards' text and its grid's columns come out far too small. Rather than guess
// from the browser's name, this measures it once, and marks the page for
// styles.css to put it right (docs/card-layout.md § "Narrow screens").
const zoomedContainerUnitsAttribute = 'data-zoomed-container-units'

let checked = false

export function markZoomedContainerUnits() {
  if (checked) return
  checked = true
  const zoomed = document.createElement('div')
  zoomed.style.cssText = 'position:absolute;visibility:hidden;zoom:0.5;width:200px;container-type:inline-size'
  const probe = document.createElement('div')
  probe.style.width = '50cqw'
  zoomed.appendChild(probe)
  document.body.appendChild(zoomed)
  // offsetWidth is in the zoomed element's own units: 100 when right, 50
  // when the zoom has been applied twice, and 0 with no layout at all.
  const width = probe.offsetWidth
  const scaled = width > 0 && width < 75
  zoomed.remove()
  document.documentElement.toggleAttribute(zoomedContainerUnitsAttribute, scaled)
}
