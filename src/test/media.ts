// A matchMedia where only the given queries match, with the rest of a
// MediaQueryList too. Motion listens for changes to prefers-reduced-motion
// the first time it's asked, once per file, so a stand-in without
// addEventListener breaks whichever test happens to render first.
export function mediaMatching(...queries: string[]) {
  return (query: string) =>
    ({
      matches: queries.includes(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
