import { useJourney } from '../../core/store/journey'
import { palaces as palaceGlosses } from '../../content'
import { MARKS_ZH, MOUNTAINS, PALACES, PALACE_ZH, RING, lodge } from '../../lib/qimen'
import type { OuterPalaceNo, PalaceNo, QimenChart } from '../../lib/qimen/types'
import { useChart } from './chartSource'
import { inscriptionBand } from './format'

/**
 * The album's grove leaf (design.md §14.1): the chart drawn live in SVG from the same engine, the way
 * the grove lays it out in world space (design.md §9.1–9.4), seen from above with south at the top.
 * Units are decimetres from the platform centre: SVG (x, y) = world (x, z) × 10, so east is left.
 * Rings are annuli with their carvings on text paths; palaces hold the lit glyphs, upright. Changing
 * the time redraws at once, with no rotation; compass mode turns the whole dial, with no easing.
 */

const R = {
  heaven: [67, 79],
  human: [80, 89],
  spirit: [90, 99],
  apron: [101, 113],
} as const
const HALF = 45
const SLAB = 30
const GAP = 1.2
/** Glyph sizes from design.md §9.3, in decimetres; the palace label is raised from 3 for legibility. */
const SIZE = { stem: 6, deity: 5, name: 4, mark: 3.5, ring: 5, mountain: 4.4 } as const

const rad = (deg: number) => (deg * Math.PI) / 180
/** Screen point for a compass bearing and radius: south up, east left. */
const at = (bearing: number, r: number) => [-Math.sin(rad(bearing)) * r, Math.cos(rad(bearing)) * r] as const

const PALACE_XY: Record<PalaceNo, readonly [number, number]> = {
  4: [-SLAB, -SLAB],
  9: [0, -SLAB],
  2: [SLAB, -SLAB],
  3: [-SLAB, 0],
  5: [0, 0],
  7: [SLAB, 0],
  8: [-SLAB, SLAB],
  1: [0, SLAB],
  6: [SLAB, SLAB],
}

/** A circle traversed clockwise on screen, starting `startDeg` clockwise from the top. */
function circlePath(r: number, startDeg: number): string {
  const [x0, y0] = [Math.sin(rad(startDeg)) * r, -Math.cos(rad(startDeg)) * r]
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 1 1 ${(-x0).toFixed(2)} ${(-y0).toFixed(2)}A${r} ${r} 0 1 1 ${x0.toFixed(2)} ${y0.toFixed(2)}`
}

/** startOffset (%) of a bearing on a clockwise circle that starts `startDeg` from the top (south). */
const offsetOf = (bearing: number, startDeg: number) => ((((bearing - 180 - startDeg) % 360) + 360) % 360) / 3.6

function annulus(r0: number, r1: number) {
  return `M0 ${-r1}A${r1} ${r1} 0 1 1 0 ${r1}A${r1} ${r1} 0 1 1 0 ${-r1}ZM0 ${-r0}A${r0} ${r0} 0 1 0 0 ${r0}A${r0} ${r0} 0 1 0 0 ${-r0}Z`
}

const f = (p: readonly [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`

/** A wedge of the apron between two bearings. */
function wedge(b0: number, b1: number, r0: number, r1: number) {
  const [a, b, c, d] = [at(b0, r1), at(b1, r1), at(b1, r0), at(b0, r0)]
  return `M${f(a)}A${r1} ${r1} 0 0 1 ${f(b)}L${f(c)}A${r0} ${r0} 0 0 0 ${f(d)}Z`
}

function RingText({ id, r, start, items, className, size }: { id: string; r: number; start: number; items: readonly { bearing: number; text: string; className?: string }[]; className: string; size: number }) {
  return (
    <>
      <path id={id} d={circlePath(r, start)} fill="none" />
      <text className={className} fontSize={size} dominantBaseline="central">
        {items.map((it) => (
          <textPath key={`${it.bearing}-${it.text}`} href={`#${id}`} startOffset={`${offsetOf(it.bearing, start)}%`} textAnchor="middle" className={it.className}>
            {it.text}
          </textPath>
        ))}
      </text>
    </>
  )
}

/** Trigram bars, bottom line at the bottom, beside the palace name (design.md §4.5: bars, never ☰–☷). */
function Trigram({ p, x, y }: { p: OuterPalaceNo; x: number; y: number }) {
  const lines = palaceGlosses.find((g) => g.number === p)?.trigram
  if (!lines) return null
  const L = 5.6
  const gap = L * 0.28
  const h = 0.9
  return (
    <g className="ac-trigram">
      {lines.map((solid, i) => {
        const yy = y + 1.7 - i * 1.7 - h / 2
        return solid ? (
          <rect key={i} x={x - L / 2} y={yy} width={L} height={h} />
        ) : (
          <g key={i}>
            <rect x={x - L / 2} y={yy} width={(L - gap) / 2} height={h} />
            <rect x={x + gap / 2} y={yy} width={(L - gap) / 2} height={h} />
          </g>
        )
      })}
    </g>
  )
}

const ROW = { top: -11.2, upper: -3.4, lower: 4.2, name: 11.4 } as const
const COL = { stem: -7.6, star: 4.4 } as const

function Glyph({ x, y, zh, size, className = 'ac-lit' }: { x: number; y: number; zh: string; size: number; className?: string }) {
  return (
    <text x={x} y={y} fontSize={size} className={className} textAnchor="middle" dominantBaseline="central">
      {zh}
    </text>
  )
}

function Palace({ chart, n, spin, selected }: { chart: QimenChart; n: PalaceNo; spin: number; selected: boolean }) {
  const p = chart.palaces[n]
  const [cx, cy] = PALACE_XY[n]
  const s = SLAB / 2 - GAP / 2
  const [star, extraStar] = p.stars
  const [heaven, extraHeaven] = p.heaven
  // The 值符 star's plate goes on the 值符 star: the small 禽 when 天禽 is the 值符 riding with 天芮 (qimen-spec D14).
  const platedExtra = p.flags.zhiFu && extraStar !== undefined && extraStar === chart.zhiFu.star
  const extraAt = { x: cx + COL.star + 8.4, y: cy + ROW.upper + 1.4, size: SIZE.stem * 0.55 }
  return (
    <g data-palace={n} data-selected={selected ? '' : undefined}>
      <rect className="ac-slab" x={cx - s} y={cy - s} width={s * 2} height={s * 2} rx={0.8} />
      <g transform={`rotate(${-spin} ${cx} ${cy})`}>
        {p.flags.hourVoid && <circle className="ac-void" cx={cx - 11} cy={cy + ROW.top} r={1.4} />}
        {p.flags.horse && <Glyph x={cx + 11} y={cy + ROW.top} zh={MARKS_ZH.horseMark} size={SIZE.mark} className="ac-faint" />}
        {p.deity === MARKS_ZH.zhiFu && <rect className="ac-plate" x={cx - 5.8} y={cy + ROW.top - 3.1} width={11.6} height={6.2} rx={0.6} />}
        {p.deity && <Glyph x={cx} y={cy + ROW.top} zh={p.deity} size={SIZE.deity} />}
        {n === 5 && <Glyph x={cx} y={cy + ROW.top} zh={MARKS_ZH.lodged} size={SIZE.mark} className="ac-faint" />}
        {heaven && <Glyph x={cx + COL.stem} y={cy + ROW.upper} zh={heaven} size={SIZE.stem} />}
        {extraHeaven && <Glyph x={cx + COL.stem - 5.6} y={cy + ROW.upper + 1.2} zh={extraHeaven} size={SIZE.stem * 0.55} />}
        {star && p.flags.zhiFu && !platedExtra && <rect className="ac-plate" x={cx + COL.star - 6.8} y={cy + ROW.upper - 3.6} width={13.6} height={7.2} rx={0.6} />}
        {star && <Glyph x={cx + COL.star} y={cy + ROW.upper} zh={star} size={SIZE.stem} />}
        {platedExtra && (
          <rect className="ac-plate" x={extraAt.x - extraAt.size / 2 - 0.8} y={extraAt.y - extraAt.size / 2 - 0.6} width={extraAt.size + 1.6} height={extraAt.size + 1.2} rx={0.4} />
        )}
        {extraStar && <Glyph x={extraAt.x} y={extraAt.y} zh={extraStar.slice(1)} size={extraAt.size} />}
        {p.door && p.flags.zhiShi && <ellipse className="ac-ring" cx={cx + COL.star} cy={cy + ROW.lower} rx={7.6} ry={4.6} />}
        {p.door && <Glyph x={cx + COL.star} y={cy + ROW.lower} zh={p.door} size={SIZE.stem} />}
        <Glyph x={cx + COL.stem} y={cy + ROW.lower} zh={p.earth} size={SIZE.stem} className="ac-carved" />
        <Glyph x={cx - 2} y={cy + ROW.name} zh={n === 5 ? PALACE_ZH[5] : `${PALACE_ZH[n]}${n}`} size={SIZE.name} className="ac-name" />
        {n !== 5 && <Trigram p={n} x={cx + 8.6} y={cy + ROW.name} />}
      </g>
    </g>
  )
}

/** The 值符 arc: from where the 旬首 hides on the earth plate to where the 值符 star lands (design.md §9.4). */
function DutyArc({ chart }: { chart: QimenChart }) {
  const from = PALACE_XY[lodge(chart.xunShou.palace)]
  const to = PALACE_XY[chart.zhiFu.palace]
  if (from === to) return null
  const [mx, my] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  // Bow the stroke sideways by a third of its length.
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]]
  const [qx, qy] = [mx - dy / 3, my + dx / 3]
  return <path className="ac-arc" d={`M${from[0]} ${from[1]}Q${qx} ${qy} ${to[0]} ${to[1]}`} />
}

export function AlbumChartSvg({ chart, dial, selected, hourBranch }: { chart: QimenChart; dial: number; selected: PalaceNo | null; hourBranch: string }) {
  const outer = RING.map((p) => ({ p, bearing: PALACES[p].azimuth ?? 0 }))
  const hourIdx = MOUNTAINS.indexOf(hourBranch)
  return (
    // Every glyph and the label (the inscription band) are Chinese: the lang makes screen readers voice them so.
    <svg className="album-chart" viewBox="-118 -118 236 236" role="img" lang="zh-Hans" aria-label={inscriptionBand(chart)} data-selecting={selected ? '' : undefined}>
      <g transform={`rotate(${dial})`}>
        <path className="ac-stone" d={annulus(R.apron[0], R.apron[1])} fillRule="evenodd" />
        {MOUNTAINS.map((m, k) => (
          <path key={m} className="ac-divider" d={wedge(k * 15 - 7.5, k * 15 + 7.5, R.apron[0], R.apron[1])} />
        ))}
        {hourIdx >= 0 && <path className="ac-hour" d={wedge(hourIdx * 15 - 7.5, hourIdx * 15 + 7.5, R.apron[0], R.apron[1] - 2)} />}
        {Array.from({ length: 72 }, (_, i) => {
          const [a, b] = [at(i * 5, R.apron[1] - 2), at(i * 5, R.apron[1])]
          return <line key={i} className="ac-tick" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        })}
        <RingText
          id="ac-mountains"
          r={(R.apron[0] + R.apron[1]) / 2 - 1}
          start={7.5}
          size={SIZE.mountain}
          className="ac-mountain"
          items={MOUNTAINS.map((m, k) => ({
            bearing: k * 15,
            text: m,
            className: [k % 6 === 0, k % 6 === 3].some(Boolean) ? (k === hourIdx ? 'ac-big ac-inverse' : 'ac-big') : k === hourIdx ? 'ac-inverse' : undefined,
          }))}
        />
        {[R.spirit, R.human, R.heaven].map(([r0, r1]) => (
          <path key={r0} className="ac-bluestone" d={annulus(r0, r1)} fillRule="evenodd" />
        ))}
        {outer.flatMap(({ bearing }) =>
          [R.heaven, R.human, R.spirit].map(([r0, r1]) => {
            const [a, b] = [at(bearing + 22.5, r0), at(bearing + 22.5, r1)]
            return <line key={`${bearing}-${r0}`} className="ac-divider-line" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          }),
        )}
        <RingText
          id="ac-spirit"
          r={(R.spirit[0] + R.spirit[1]) / 2}
          start={22.5}
          size={SIZE.ring}
          className="ac-carving"
          items={outer.map(({ p, bearing }) => ({ bearing, text: chart.palaces[p].deity ?? '' }))}
        />
        <RingText
          id="ac-human"
          r={(R.human[0] + R.human[1]) / 2}
          start={22.5}
          size={SIZE.ring}
          className="ac-carving"
          items={outer.map(({ p, bearing }) => ({ bearing, text: chart.palaces[p].door ?? '' }))}
        />
        <RingText
          id="ac-heaven"
          r={(R.heaven[0] + R.heaven[1]) / 2}
          start={22.5}
          size={SIZE.ring}
          className="ac-carving"
          items={outer.map(({ p, bearing }) => ({ bearing, text: `${chart.palaces[p].stars.map((s) => s.slice(1)).join('·')} ${chart.palaces[p].heaven.join('')}` }))}
        />
        <rect className="ac-platform" x={-HALF} y={-HALF} width={HALF * 2} height={HALF * 2} rx={1.2} />
        {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => (
          <Palace key={n} chart={chart} n={n} spin={dial} selected={selected === n} />
        ))}
        <DutyArc chart={chart} />
        <g className="ac-needle">
          <line x1={0} y1={6} x2={0} y2={0} />
          <line className="ac-needle-south" x1={0} y1={0} x2={0} y2={-6} />
        </g>
      </g>
      <text className="ac-band" x={0} y={HALF + 14} fontSize={3.4} textAnchor="middle" dominantBaseline="central">
        {inscriptionBand(chart)}
      </text>
    </svg>
  )
}

/** Lazy entry for the album leaf: reads the chart, the dial and the compass from the store. */
export default function AlbumChart() {
  const snap = useChart()
  const dialDeg = useJourney((s) => s.dialDeg)
  const heading = useJourney((s) => (s.compass.status === 'active' ? s.compass.heading : null))
  const selected = useJourney((s) => s.selectedPalace)
  const chart = snap?.chart
  if (!chart) return null
  // Compass: the direction the phone's top points goes to the top of the screen, where south sits at rest.
  const dial = heading === null ? dialDeg : 180 - heading
  return <AlbumChartSvg chart={chart} dial={dial} selected={selected} hourBranch={chart.pillars.hour.branch} />
}
