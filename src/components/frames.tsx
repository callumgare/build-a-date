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
        <circle cx="43" cy="16" r="1.3" className="fill" />
        <circle cx="157" cy="16" r="1.3" className="fill" />
      </>
    ),
  },
  bottom: {
    height: 40,
    art: (
      <>
        <path d="M 1 0 V 39 H 199 V 0" />
        <path d="M 14 0 V 28 H 90 M 110 28 H 186 V 0" />
        <path className="fill" d={moon(96, 28, 6, 'right', 0.6)} transform="rotate(90 100 28)" />
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
        <path d="M 16 110 V 100 A 119 119 0 0 1 100 26 A 119 119 0 0 1 184 100 V 110" />
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
        <path d="M 84 48 A 16 16 0 0 1 116 48" />
        <path d="M 89 48 A 11 11 0 0 1 111 48" />
        <path d={rays(100, 48, 12, 20, 32, 26, 195, 345)} />
        <path d="M 26 48 H 72 M 84 48 H 116 M 128 48 H 174" />
        <g className="fill">
          <path d="M 95 48 A 5 5 0 0 1 105 48 Z" />
          <path d="M 22 48 L 26 44 L 30 48 L 26 52 Z" />
          <path d="M 170 48 L 174 44 L 178 48 L 174 52 Z" />
          <path d="M 76 48 L 78 46 L 80 48 L 78 50 Z" />
          <path d="M 120 48 L 122 46 L 124 48 L 122 50 Z" />
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
  inset: { top: 62, bottom: 30, side: 22 },
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
          <path d={moon(100, 33, 8, 'right', 0.6)} transform="rotate(90 100 33)" />
          <path d={sparkle(6.5, 38.5, 4)} />
          <path d={sparkle(193.5, 38.5, 4)} />
        </g>
      </>
    ),
  },
  rails: [1, 8, 192, 199],
  inset: { top: 60, bottom: 18, side: 20 },
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
        <g className="fill">
          <path d={moon(86, 26, 4, 'right', 0.3)} />
          <circle cx="100" cy="26" r="5" />
          <path d={moon(114, 26, 4, 'left', 0.3)} />
        </g>
      </>
    ),
  },
  rails: [1, 12, 188, 199],
  inset: { top: 68, bottom: 24, side: 22 },
}

// Three equilateral lancets, each arc centred on the opposite springing so
// it meets the upright tangentially.
const threeLancets: Frame = {
  name: 'three-lancets',
  top: {
    height: 100,
    art: (
      <>
        <path d="M 1 100 V 1 H 199 V 100" />
        <path d="M 10 100 V 74 A 60 60 0 0 1 40 22.04 A 60 60 0 0 1 70 74 V 62 A 60 60 0 0 1 100 10.04 A 60 60 0 0 1 130 62 V 74 A 60 60 0 0 1 160 22.04 A 60 60 0 0 1 190 74 V 100" />
        <circle cx="100" cy="44" r="10" />
        <g className="fill">
          <circle cx="100" cy="44" r="6.5" />
          <path d={moon(40, 54, 6, 'left', 0.5)} />
          <path d={moon(160, 54, 6, 'right', 0.5)} />
          <path d={sparkle(100, 25, 4)} />
          <path d={sparkle(40, 38, 3)} />
          <path d={sparkle(160, 38, 3)} />
          <path d={sparkle(70, 28, 3.5)} />
          <path d={sparkle(130, 28, 3.5)} />
          <path d={sparkle(14, 14, 4)} />
          <path d={sparkle(186, 14, 4)} />
          <circle cx="30" cy="9" r="1.3" />
          <circle cx="170" cy="9" r="1.3" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 34,
    art: (
      <>
        <path d="M 1 0 V 33 H 199 V 0" />
        <path d="M 10 0 V 26 H 84 M 116 26 H 190 V 0" />
        <g className="fill">
          <path d={sparkle(91, 26, 2.5)} />
          <path d={sparkle(100, 26, 5)} />
          <path d={sparkle(109, 26, 2.5)} />
        </g>
      </>
    ),
  },
  rails: [1, 10, 190, 199],
  inset: { top: 80, bottom: 18, side: 20 },
}

const crescentCradle: Frame = {
  name: 'crescent-cradle',
  top: {
    height: 78,
    art: (
      <>
        <path d="M 1 78 V 1 H 199 V 78" />
        <path d="M 8 78 V 16 L 16 8 H 184 L 192 16 V 78" />
        <path d="M 24 40 H 72 M 128 40 H 176 M 44 45 H 76 M 124 45 H 156" />
        <g className="fill">
          <path d={moon(100, 40, 15, 'right', 0.6)} transform="rotate(90 100 40)" />
          <path d={sparkle(100, 31, 7)} />
          <path d="M 16 40 L 20 36 L 24 40 L 20 44 Z" />
          <path d="M 176 40 L 180 36 L 184 40 L 180 44 Z" />
          {Array.from({ length: 9 }, (_, index) => {
            const angle = ((200 + index * 17.5) * Math.PI) / 180
            return <circle key={index} cx={100 + Math.cos(angle) * 25} cy={40 + Math.sin(angle) * 25} r={index === 4 ? 1.6 : 1.1} />
          })}
        </g>
      </>
    ),
  },
  bottom: {
    height: 40,
    art: (
      <>
        <path d="M 1 0 V 39 H 199 V 0" />
        <path d="M 8 0 V 24 L 16 32 H 88 M 112 32 H 184 L 192 24 V 0" />
        <g className="fill">
          <path d={moon(100, 30, 6, 'right', 0.6)} transform="rotate(90 100 30)" />
          <circle cx="100" cy="28" r="1.5" />
        </g>
      </>
    ),
  },
  rails: [1, 8, 192, 199],
  inset: { top: 64, bottom: 22, side: 20 },
}

const decoFan: Frame = {
  name: 'deco-fan',
  top: {
    height: 72,
    art: (
      <>
        <path d="M 1 72 V 1 H 199 V 72" />
        <path d="M 10 72 V 34 H 44 V 26 H 64 V 18 H 136 V 26 H 156 V 34 H 190 V 72" />
        <path d="M 76 52 A 24 24 0 0 1 124 52 Z" />
        <path d={rays(100, 52, 8, 9, 24, 24, 180, 360)} />
        <path d="M 30 52 H 70 M 130 52 H 170 M 48 46 H 70 M 130 46 H 152 M 48 58 H 70 M 130 58 H 152" />
        <g className="fill">
          <path d="M 94 52 A 6 6 0 0 1 106 52 Z" />
          <path d={sparkle(100, 10, 5)} />
          <circle cx="88" cy="10" r="1.3" />
          <circle cx="112" cy="10" r="1.3" />
          <path d={sparkle(27, 17, 4)} />
          <path d={sparkle(173, 17, 4)} />
        </g>
      </>
    ),
  },
  bottom: {
    height: 40,
    art: (
      <>
        <path d="M 1 0 V 39 H 199 V 0" />
        <path d="M 10 0 V 18 H 44 V 24 H 64 V 30 H 136 V 24 H 156 V 18 H 190 V 0" />
        <path d="M 90 30 A 10 10 0 0 1 110 30" />
        <path className="fill" d="M 95 30 A 5 5 0 0 1 105 30 Z" />
      </>
    ),
  },
  rails: [1, 10, 190, 199],
  inset: { top: 64, bottom: 24, side: 20 },
}

// An eye in a triangle, rising over the horizon that tops the inner frame.
const risingEye: Frame = {
  name: 'rising-eye',
  top: {
    height: 80,
    art: (
      <>
        <path d="M 1 80 V 1 H 199 V 80" />
        <path d="M 10 80 V 62 H 190 V 80" />
        <path d="M 72 62 L 100 16 L 128 62" />
        <path d="M 86 48 Q 100 36 114 48 Q 100 60 86 48 Z" />
        <path d={rays(100, 46, 16, 35, 41, 38, 180, 360)} />
        <g className="fill">
          <circle cx="100" cy="48" r="4.5" />
          <path d={sparkle(38, 40, 4.5)} />
          <path d={sparkle(162, 40, 4.5)} />
          <path d={sparkle(16, 12, 3.5)} />
          <path d={sparkle(184, 12, 3.5)} />
          <circle cx="54" cy="24" r="1.3" />
          <circle cx="146" cy="24" r="1.3" />
          <circle cx="22" cy="52" r="1.3" />
          <circle cx="178" cy="52" r="1.3" />
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
        <path d="M 92 26 L 100 14 L 108 26" />
        <circle className="fill" cx="100" cy="21.5" r="1.4" />
      </>
    ),
  },
  rails: [1, 10, 190, 199],
  inset: { top: 70, bottom: 22, side: 22 },
}

const hangingStars: Frame = {
  name: 'hanging-stars',
  top: {
    height: 66,
    art: (
      <>
        <path d="M 1 66 V 1 H 199 V 66" />
        <path d="M 8 66 V 8 H 192 V 66" />
        <path className="faint" d="M 28 8 V 24 M 46 8 V 18.5 M 64 8 V 29 M 82 8 V 21 M 100 8 V 33 M 118 8 V 21 M 136 8 V 29 M 154 8 V 18.5 M 172 8 V 24" />
        <g className="fill">
          <path d={sparkle(28, 28, 4)} />
          <circle cx="46" cy="20" r="1.5" />
          <path d={moon(66, 32, 5, 'left', 0.5)} />
          <path d={sparkle(82, 24, 3)} />
          <circle cx="100" cy="40" r="7" />
          <path d={sparkle(118, 24, 3)} />
          <path d={moon(134, 32, 5, 'right', 0.5)} />
          <circle cx="154" cy="20" r="1.5" />
          <path d={sparkle(172, 28, 4)} />
        </g>
      </>
    ),
  },
  bottom: {
    height: 30,
    art: (
      <>
        <path d="M 1 0 V 29 H 199 V 0" />
        <path d="M 8 0 V 22 H 92 M 108 22 H 192 V 0" />
        <path className="fill" d={sparkle(100, 22, 4)} />
      </>
    ),
  },
  rails: [1, 8, 192, 199],
  inset: { top: 56, bottom: 16, side: 18 },
}

const orbit: Frame = {
  name: 'orbit',
  top: {
    height: 76,
    art: (
      <>
        <path d="M 1 76 V 1 H 199 V 76" />
        <path d="M 8 76 V 20 A 12 12 0 0 1 20 8 H 180 A 12 12 0 0 1 192 20 V 76" />
        <circle className="faint" cx="100" cy="38" r="20" />
        <circle cx="100" cy="38" r="9" />
        <ellipse cx="100" cy="38" rx="34" ry="9" transform="rotate(-18 100 38)" />
        <g className="fill">
          <path d={moon(100, 38, 9, 'left', 0)} />
          <circle cx="132.3" cy="27.5" r="2.2" />
          <circle cx="67.7" cy="48.5" r="1.5" />
          <path d={sparkle(42, 28, 4.5)} />
          <path d={sparkle(158, 28, 4.5)} />
          <circle cx="26" cy="46" r="1.3" />
          <circle cx="174" cy="46" r="1.3" />
          <circle cx="60" cy="16" r="1.3" />
          <circle cx="140" cy="16" r="1.3" />
        </g>
      </>
    ),
  },
  bottom: {
    height: 38,
    art: (
      <>
        <path d="M 1 0 V 37 H 199 V 0" />
        <path d="M 8 0 V 18 A 12 12 0 0 0 20 30 H 88 M 112 30 H 180 A 12 12 0 0 0 192 18 V 0" />
        <circle className="fill" cx="100" cy="30" r="3.5" />
        <ellipse cx="100" cy="30" rx="9" ry="2.5" transform="rotate(-18 100 30)" />
      </>
    ),
  },
  rails: [1, 8, 192, 199],
  inset: { top: 62, bottom: 20, side: 20 },
}

export const frames: Frame[] = [
  moonArch,
  gothicWindow,
  decoSunrise,
  sunAndMoon,
  constellation,
  eclipsePortal,
  threeLancets,
  crescentCradle,
  decoFan,
  risingEye,
  hangingStars,
  orbit,
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
