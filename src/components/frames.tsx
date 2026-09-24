import type { ReactElement } from 'react'

// Frame art is drawn on a 200-unit-wide canvas. The top and bottom pieces
// scale uniformly with the card's width, while the rails (vertical lines at
// the given x positions) stretch to fill whatever height the card ends up.
export type Frame = {
  name: string
  top: { height: number; art: ReactElement }
  bottom: { height: number; art: ReactElement }
  rails: number[]
  // Where the text sits, in canvas units from the top, bottom and sides.
  inset: { top: number; bottom: number; side: number }
}

function sparkle(cx: number, cy: number, r: number) {
  const k = r * 0.16
  return `M ${cx} ${cy - r} Q ${cx + k} ${cy - k} ${cx + r} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + r} Q ${cx - k} ${cy + k} ${cx - r} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - r} Z`
}

// A lit moon shape. `shadow` runs from 1 (thin crescent) through 0 (half)
// to -1 (nearly full).
function moon(cx: number, cy: number, r: number, lit: 'left' | 'right', shadow: number) {
  const outerSweep = lit === 'right' ? 1 : 0
  const innerSweep = (shadow > 0) === (lit === 'right') ? 0 : 1
  const rx = Math.abs(shadow) * r
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`
}

function rays(cx: number, cy: number, count: number, inner: number, long: number, short: number, from = 0, to = 360) {
  const step = (to - from) / count
  return Array.from({ length: count + (to - from === 360 ? 0 : 1) }, (_, index) => {
    const angle = ((from + index * step) * Math.PI) / 180
    const outer = index % 2 === 0 ? long : short
    return `M ${cx + Math.cos(angle) * inner} ${cy + Math.sin(angle) * inner} L ${cx + Math.cos(angle) * outer} ${cy + Math.sin(angle) * outer}`
  }).join(' ')
}

const moonArch: Frame = {
  name: 'moon-arch',
  top: {
    height: 90,
    art: (
      <>
        <path d="M 1 90 V 1 H 199 V 90" />
        <path d="M 14 90 V 82 A 86 52 0 0 1 186 82 V 90" />
        <g className="fill">
          <path d={moon(62, 16, 4.5, 'left', 0.55)} />
          <path d={moon(81, 16, 4.5, 'left', 0)} />
          <circle cx="100" cy="16" r="6" />
          <path d={moon(119, 16, 4.5, 'right', 0)} />
          <path d={moon(138, 16, 4.5, 'right', 0.55)} />
          <path d={sparkle(8, 60, 4)} />
          <path d={sparkle(192, 60, 4)} />
        </g>
        <circle cx="41" cy="16" r="1.3" className="fill" />
        <circle cx="159" cy="16" r="1.3" className="fill" />
      </>
    ),
  },
  bottom: {
    height: 40,
    art: (
      <>
        <path d="M 1 0 V 39 H 199 V 0" />
        <path d="M 14 0 V 28 H 90 M 110 28 H 186 V 0" />
        <path className="fill" d={moon(100, 28, 6, 'right', 0.6)} transform="rotate(90 100 28)" />
      </>
    ),
  },
  rails: [1, 14, 186, 199],
  inset: { top: 50, bottom: 20, side: 24 },
}

const gothicWindow: Frame = {
  name: 'gothic-window',
  top: {
    height: 110,
    art: (
      <>
        <path d="M 1 110 V 1 H 199 V 110" />
        <path d="M 10 110 V 100 A 125 125 0 0 1 100 20 A 125 125 0 0 1 190 100 V 110" />
        <path d="M 16 110 V 100 A 118 118 0 0 1 100 28 A 118 118 0 0 1 184 100 V 110" />
        <circle cx="100" cy="58" r="13" />
        <path d={rays(100, 58, 12, 13, 17, 15.5)} />
        <g className="fill">
          <path d={moon(100, 58, 8, 'right', 0.5)} />
          <path d={sparkle(100, 10, 6)} />
          <path d={sparkle(20, 22, 5)} />
          <path d={sparkle(180, 22, 5)} />
          <circle cx="40" cy="12" r="1.3" />
          <circle cx="160" cy="12" r="1.3" />
          <circle cx="12" cy="50" r="1.3" />
          <circle cx="188" cy="50" r="1.3" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 34,
    art: (
      <>
        <path d="M 1 0 V 33 H 199 V 0" />
        <path d="M 10 0 V 26 H 190 V 0" />
        <path d="M 16 0 V 20 H 184 V 0" />
        <g className="fill">
          <circle cx="92" cy="29.5" r="1.2" />
          <circle cx="100" cy="29.5" r="1.6" />
          <circle cx="108" cy="29.5" r="1.2" />
        </g>
      </>
    ),
  },
  rails: [1, 10, 16, 184, 190, 199],
  inset: { top: 82, bottom: 20, side: 26 },
}

const decoSunrise: Frame = {
  name: 'deco-sunrise',
  top: {
    height: 64,
    art: (
      <>
        <path d="M 1 64 V 14 H 7 V 7 H 14 V 1 H 186 V 7 H 193 V 14 H 199 V 64" />
        <path d="M 10 64 V 22 L 22 10 H 178 L 190 22 V 64" />
        <path d="M 84 40 A 16 16 0 0 1 116 40" />
        <path d="M 89 40 A 11 11 0 0 1 111 40" />
        <path d={rays(100, 40, 12, 20, 32, 26, 180, 360)} />
        <path d="M 26 40 H 72 M 128 40 H 174" />
        <g className="fill">
          <circle cx="100" cy="40" r="5" />
          <path d="M 22 40 L 26 36 L 30 40 L 26 44 Z" />
          <path d="M 170 40 L 174 36 L 178 40 L 174 44 Z" />
          <path d="M 76 40 L 78 38 L 80 40 L 78 42 Z" />
          <path d="M 120 40 L 122 38 L 124 40 L 122 42 Z" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 40,
    art: (
      <>
        <path d="M 1 0 V 26 H 7 V 33 H 14 V 39 H 186 V 33 H 193 V 26 H 199 V 0" />
        <path d="M 10 0 V 18 L 22 30 H 178 L 190 18 V 0" />
        <path d="M 84 24 L 100 16 L 116 24 M 90 24 L 100 19 L 110 24" />
        <path className="fill" d="M 100 25 L 105 30 L 100 35 L 95 30 Z" />
      </>
    ),
  },
  rails: [1, 10, 190, 199],
  inset: { top: 58, bottom: 30, side: 22 },
}

const sunAndMoon: Frame = {
  name: 'sun-and-moon',
  top: {
    height: 70,
    art: (
      <>
        <path d="M 1 70 V 1 H 199 V 70" />
        <path d="M 8 70 V 20 A 12 12 0 0 0 20 8 H 180 A 12 12 0 0 0 192 20 V 70" />
        <circle cx="100" cy="34" r="10" />
        <path d={rays(100, 34, 24, 13, 23, 18)} />
        <g className="fill">
          <circle cx="100" cy="34" r="3.5" />
          <path d={sparkle(6.5, 6.5, 4)} />
          <path d={sparkle(193.5, 6.5, 4)} />
          <path d={sparkle(52, 26, 4)} />
          <path d={sparkle(148, 26, 4)} />
          <circle cx="68" cy="44" r="1.3" />
          <circle cx="132" cy="44" r="1.3" />
          <circle cx="36" cy="40" r="1.3" />
          <circle cx="164" cy="40" r="1.3" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 46,
    art: (
      <>
        <path d="M 1 0 V 45 H 199 V 0" />
        <path d="M 8 0 V 26 A 12 12 0 0 1 20 38 H 88 M 112 38 H 180 A 12 12 0 0 1 192 26 V 0" />
        <g className="fill">
          <path d={moon(100, 36, 8, 'right', 0.6)} transform="rotate(90 100 36)" />
          <path d={sparkle(6.5, 38.5, 4)} />
          <path d={sparkle(193.5, 38.5, 4)} />
        </g>
      </>
    ),
  },
  rails: [1, 8, 192, 199],
  inset: { top: 56, bottom: 18, side: 20 },
}

const constellation: Frame = {
  name: 'constellation',
  top: {
    height: 60,
    art: (
      <>
        <path d="M 1 60 V 1 H 199 V 60" />
        <path d="M 7 60 V 7 H 193 V 60" />
        <path className="faint" d="M 30 36 L 52 24 L 74 32 L 100 20 L 126 32 L 148 24 L 170 36 M 74 32 L 88 44 M 126 32 L 112 44" />
        <g className="fill">
          <path d={sparkle(100, 20, 8)} />
          <path d={sparkle(52, 24, 4.5)} />
          <path d={sparkle(148, 24, 4.5)} />
          <circle cx="30" cy="36" r="1.8" />
          <circle cx="170" cy="36" r="1.8" />
          <circle cx="74" cy="32" r="1.8" />
          <circle cx="126" cy="32" r="1.8" />
          <circle cx="88" cy="44" r="1.3" />
          <circle cx="112" cy="44" r="1.3" />
          <circle cx="7" cy="7" r="2.5" />
          <circle cx="193" cy="7" r="2.5" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 36,
    art: (
      <>
        <path d="M 1 0 V 35 H 199 V 0" />
        <path d="M 7 0 V 29 H 90 M 110 29 H 193 V 0" />
        <g className="fill">
          <path d={sparkle(100, 29, 5.5)} />
          <circle cx="7" cy="29" r="2.5" />
          <circle cx="193" cy="29" r="2.5" />
        </g>
      </>
    ),
  },
  rails: [1, 7, 193, 199],
  inset: { top: 54, bottom: 16, side: 18 },
}

const eclipsePortal: Frame = {
  name: 'eclipse-portal',
  top: {
    height: 86,
    art: (
      <>
        <path d="M 1 86 V 1 H 199 V 86" />
        <path d="M 12 86 V 52 H 40 A 70 70 0 0 1 160 52 H 188 V 86" />
        <circle cx="100" cy="46" r="11" />
        <path d={rays(100, 46, 32, 15, 19, 17)} />
        <g className="fill">
          <path d={moon(100, 46, 11, 'left', 0.35)} />
          <path d={moon(26, 30, 7, 'right', 0.5)} />
          <path d={moon(174, 30, 7, 'left', 0.5)} />
          <path d={sparkle(26, 12, 3.5)} />
          <path d={sparkle(174, 12, 3.5)} />
          <circle cx="26" cy="44" r="1.3" />
          <circle cx="174" cy="44" r="1.3" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 40,
    art: (
      <>
        <path d="M 1 0 V 39 H 199 V 0" />
        <path d="M 12 0 V 26 H 78 M 122 26 H 188 V 0" />
        <circle cx="86" cy="26" r="4" />
        <g className="fill">
          <circle cx="100" cy="26" r="5" />
          <path d={moon(114, 26, 4, 'left', 0.5)} />
        </g>
      </>
    ),
  },
  rails: [1, 12, 188, 199],
  inset: { top: 68, bottom: 24, side: 22 },
}

export const frames: Frame[] = [
  moonArch,
  gothicWindow,
  decoSunrise,
  sunAndMoon,
  constellation,
  eclipsePortal,
]

function hash(text: string) {
  let value = 2166136261
  for (const character of text) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  }
  return value >>> 0
}

// Picks a frame from the card's id alone, so a card keeps its frame between
// visits, however the deck is shuffled, and in shared links.
export function frameFor(id: string) {
  return frames[hash(id) % frames.length]
}
