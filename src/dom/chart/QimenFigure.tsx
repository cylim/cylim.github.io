import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { glossFor, glossForMark, grove } from '../../content'
import type { GlossaryTerm } from '../../content/types'
import { palaceAt } from '../../lib/compass'
import { MARKS_ZH, PALACE_ZH } from '../../lib/qimen'
import type { PalaceNo, QimenChart } from '../../lib/qimen/types'
import { romanize } from '../gloss/detail'
import { GlossText } from '../gloss/GlossText'
import { LangText } from '../gloss/LangText'
import { Zh } from '../gloss/Zh'
import { figcaption, headerParts, inscriptionBand, palaceGloss } from './format'
import { READING_ORDER, gridArea, moveInGrid } from './grid'
import { revealInPanel, selectFromGrid, selectedInScene } from './selection'

type Lookup = (zh: string) => GlossaryTerm | undefined

const gloss: Lookup = (zh) => glossFor(zh)
/** The marks row, the duty line and their meanings: 值符 there is the duty mark ("Duty Chief"), not the deity (CD-2). */
const markGloss: Lookup = (zh) => glossForMark(zh)

function Glyph({ zh, mark, lookup = gloss }: { zh: string; mark?: 'plate' | 'ring'; lookup?: Lookup }) {
  const t = lookup(zh)
  const cls = mark ? `qm-glyph qm-${mark}` : 'qm-glyph'
  return t ? (
    <Zh term={t} focusable={false} className={cls} />
  ) : (
    <span className={cls} lang="zh-Hans">
      {zh}
    </span>
  )
}

/** "九天 Nine Heaven" as a dd: glossed glyph plus the English, always visible. */
function Term({ zh, mark, lookup = gloss }: { zh: string; mark?: 'plate' | 'ring'; lookup?: Lookup }) {
  return (
    <>
      <Glyph zh={zh} mark={mark} lookup={lookup} /> <span className="qm-en">{lookup(zh)?.en ?? ''}</span>
    </>
  )
}

function Meaning({ zh, lookup = gloss }: { zh: string; lookup?: Lookup }) {
  const t = lookup(zh)
  if (!t?.meaning) return null
  return (
    <p className="qm-meaning">
      <span lang="zh-Hans">{t.zh}</span> {t.en}: <GlossText text={t.meaning} lookup={gloss} focusable={false} />
    </p>
  )
}

interface PalaceProps {
  chart: QimenChart
  n: PalaceNo
  tabStop: boolean
  expanded: boolean
  selected: boolean
  /** Under the compass's top thread (design.md §9.9). */
  facing: boolean
  onFocus: () => void
  onToggle: () => void
  buttonRef: (el: HTMLButtonElement | null) => void
}

function Palace({ chart, n, tabStop, expanded, selected, facing, onFocus, onToggle, buttonRef }: PalaceProps) {
  const p = chart.palaces[n]
  const pg = palaceGloss(n)
  const f = grove.fields
  const nameZh = PALACE_ZH[n]
  const marks: string[] = []
  if (p.flags.zhiFu) marks.push(MARKS_ZH.zhiFu)
  if (p.flags.zhiShi) marks.push(MARKS_ZH.zhiShi)
  if (p.flags.hourVoid) marks.push(MARKS_ZH.void)
  if (p.flags.horse) marks.push(MARKS_ZH.horse)
  const all: { zh: string; lookup: Lookup }[] = [...p.stars, ...p.heaven, p.earth].map((zh) => ({ zh, lookup: gloss }))
  all.push(...marks.map((zh) => ({ zh, lookup: markGloss })))
  if (p.deity) all.unshift({ zh: p.deity, lookup: gloss })
  if (p.door) all.push({ zh: p.door, lookup: gloss })
  if (p.lodgedEarth) all.push({ zh: p.lodgedEarth, lookup: gloss })

  return (
    <li
      data-palace={n}
      style={{ gridArea: gridArea(n) }}
      data-selected={selected ? '' : undefined}
      data-facing={facing ? '' : undefined}
      data-duty={p.flags.zhiFu || p.flags.zhiShi ? '' : undefined}
    >
      <h4>
        {/* The key hint rides on the button: with a roving tab stop, focus lands here, never on the list. */}
        <button ref={buttonRef} type="button" tabIndex={tabStop ? 0 : -1} aria-expanded={expanded} aria-describedby="qimen-grid-hint" onFocus={onFocus} onClick={onToggle}>
          <Glyph zh={nameZh} /> {pg ? `${romanize(pg.pinyin)} ${n}, ${pg.directionEn}` : n}
        </button>
      </h4>
      <dl>
        {p.deity && (
          <div>
            <dt>{f.deity}</dt>
            <dd>
              <Term zh={p.deity} mark={p.deity === MARKS_ZH.zhiFu ? 'plate' : undefined} />
            </dd>
          </div>
        )}
        {p.stars.length > 0 && (
          <div>
            <dt>{f.star}</dt>
            <dd>
              {p.stars.map((s, i) => (
                <span key={s} className="qm-multi">
                  {i > 0 && ' · '}
                  <Term zh={s} mark={p.flags.zhiFu && s === chart.zhiFu.star ? 'plate' : undefined} />
                </span>
              ))}
            </dd>
          </div>
        )}
        {p.heaven.length > 0 && (
          <div>
            <dt>{f.heavenStem}</dt>
            <dd>
              {p.heaven.map((s, i) => (
                <span key={`${s}${i}`} className="qm-multi">
                  {i > 0 && ' · '}
                  <Term zh={s} />
                </span>
              ))}
            </dd>
          </div>
        )}
        {p.door && (
          <div>
            <dt>{f.door}</dt>
            <dd>
              <Term zh={p.door} mark={p.flags.zhiShi ? 'ring' : undefined} />
            </dd>
          </div>
        )}
        <div>
          <dt>{f.earthStem}</dt>
          <dd>
            <Term zh={p.earth} />
          </dd>
        </div>
        {p.lodgedEarth && (
          <div>
            <dt>{f.lodgedEarth}</dt>
            <dd>
              <Term zh={p.lodgedEarth} />
            </dd>
          </div>
        )}
      </dl>
      {n === 5 && (
        <p className="qm-note">
          <Glyph zh={MARKS_ZH.lodged} />
        </p>
      )}
      {marks.length > 0 && (
        <p className="qm-marks">
          {marks.map((m, i) => (
            <span key={m}>
              {i > 0 && ' · '}
              <Term zh={m} lookup={markGloss} />
            </span>
          ))}
        </p>
      )}
      {expanded && (
        <div className="qm-meanings">
          {pg && <Meaning zh={pg.zh} />}
          {all.map(({ zh, lookup }, i) => (
            <Meaning key={`${zh}${i}`} zh={zh} lookup={lookup} />
          ))}
        </div>
      )}
    </li>
  )
}

/**
 * The DOM chart (design.md §9.8): the accessible, crawlable and album chart, and the reading panel on
 * every tier. Screen readers go 1 to 9; CSS places the palaces south-up. The grid is one tab stop with
 * roving focus: arrow keys move in visual positions, Enter shows every term's meaning. Focusing a
 * palace selects it in 3D too.
 */
export function QimenFigure({ chart, controls }: { chart: QimenChart; controls?: ReactNode }) {
  const selected = useJourney((s) => s.selectedPalace)
  const facing = useJourney((s) => (s.compass.status === 'active' && s.compass.heading !== null ? palaceAt(s.compass.heading) : null))
  const [stop, setStop] = useState<PalaceNo>(1)
  const [expanded, setExpanded] = useState<PalaceNo | null>(null)
  const buttons = useRef(new Map<PalaceNo, HTMLButtonElement>())
  const h = headerParts(chart)

  // A palace clicked in 3D opens its details here and becomes the grid's tab stop (design.md §9.7).
  useEffect(
    () =>
      journey.subscribe((s, prev) => {
        const n = s.selectedPalace
        if (n === prev.selectedPalace || !selectedInScene(n)) return
        setStop(n)
        setExpanded(n)
        requestAnimationFrame(() => {
          const li = buttons.current.get(n)?.closest('li')
          if (li) revealInPanel(li)
        })
      }),
    [],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const next = moveInGrid(stop, e.key)
    if (next === null || !(e.target instanceof HTMLButtonElement)) return
    e.preventDefault()
    setStop(next)
    buttons.current.get(next)?.focus()
  }

  return (
    <figure id="qimen" aria-labelledby="qimen-title">
      <figcaption id="qimen-title" className="visually-hidden">
        <LangText text={figcaption(chart)} />
      </figcaption>
      <p className="qm-header">
        <span>
          <GlossText text={h.when} lookup={gloss} focusable={false} />
        </span>
        <span>
          <GlossText text={h.pillars} lookup={gloss} focusable={false} />
        </span>
        <span>
          <GlossText text={h.term} lookup={gloss} focusable={false} />
        </span>
        <span>
          <GlossText text={h.structure} lookup={gloss} focusable={false} />
        </span>
        <span>
          <GlossText text={h.duty} lookup={markGloss} focusable={false} />
        </span>
      </p>
      <p className="qm-band" aria-hidden="true" lang="zh-Hans">
        {inscriptionBand(chart)}
      </p>
      {controls}
      <p id="qimen-grid-hint" className="visually-hidden">
        {grove.gridHint}
      </p>
      <p className="qm-south" aria-hidden="true">
        {grove.southUp}
      </p>
      <ol className="qm-palaces" onKeyDown={onKeyDown}>
        {READING_ORDER.map((n) => (
          <Palace
            key={n}
            chart={chart}
            n={n}
            tabStop={stop === n}
            expanded={expanded === n}
            selected={selected === n}
            facing={facing === n}
            buttonRef={(el) => {
              if (el) buttons.current.set(n, el)
              else buttons.current.delete(n)
            }}
            onFocus={() => {
              setStop(n)
              selectFromGrid(n)
            }}
            onToggle={() => setExpanded((x) => (x === n ? null : n))}
          />
        ))}
      </ol>
    </figure>
  )
}
