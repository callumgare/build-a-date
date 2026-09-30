import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// Component styles live in each component's CSS module, and the only global
// classes are the few in src/styles.css that every page shares.
const src = join(import.meta.dirname, '..')
const globalClasses = new Set(['app-root', 'visually-hidden'])
// The frame art's fill and faint classes are read by the link preview's
// drawing as well as styled by the card (src/lib/og/card.tsx).
const allowedFiles = new Set(['components/frames.tsx'])

function components(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return components(path)
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : []
  })
}

/** @see docs/ui-components.md § "Where styles live" - there's no other global class */
it('uses no global class names outside src/styles.css', () => {
  const found = components(src).flatMap((file) => {
    if (allowedFiles.has(relative(src, file))) return []
    return [...readFileSync(file, 'utf8').matchAll(/className="([^"]*)"/g)]
      .flatMap((match) => match[1].split(/\s+/))
      .filter((name) => name && !globalClasses.has(name))
      .map((name) => `${relative(src, file)}: ${name}`)
  })
  expect(found).toEqual([])
})
