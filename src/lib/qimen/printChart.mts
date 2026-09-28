#!/usr/bin/env node
// Debug CLI: print the chart for an instant. Not imported by the app.
//
//   node src/lib/qimen/printChart.mts 2026-09-28T19:30+08:00
//   node src/lib/qimen/printChart.mts now --tz Europe/London --zi split
//   node src/lib/qimen/printChart.mts 2026-03-15T10:20+08:00 --basis trueSolar --lon 100.3288 --json
//
// Options: --tz <IANA> | --offset <minutes east>, --basis civil|standard|trueSolar, --lon <deg E>,
// --zi zi23|split|midnight, --deities huXuan|gouQue, --json (the chart plus ring offsets).

import { registerHooks } from 'node:module'

// src/ uses extensionless relative imports (bundler resolution); plain Node needs the .ts.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        // not a sibling .ts file: fall through to the default resolution
      }
    }
    return nextResolve(specifier, context)
  },
})

const { computeChart, ringOffsets, LUO_SHU_GRID } = await import('./index.ts')
const { inscription, PALACE_ZH } = await import('./labels.ts')
type Options = import('./types.ts').QimenOptions

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const input = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'now'
const instant = input === 'now' ? Date.now() : Date.parse(input)
if (Number.isNaN(instant)) {
  process.stderr.write(`cannot parse instant: ${input}\n`)
  process.exit(2)
}

const opts: Options = {}
const tz = flag('tz')
const offset = flag('offset')
const basis = flag('basis')
const lon = flag('lon')
const zi = flag('zi')
const deities = flag('deities')
if (tz) opts.timeZone = tz
if (offset) opts.utcOffsetMinutes = Number(offset)
if (basis === 'civil' || basis === 'standard' || basis === 'trueSolar') opts.timeBasis = basis
if (lon) opts.longitude = Number(lon)
if (zi === 'zi23' || zi === 'split' || zi === 'midnight') opts.ziHour = zi
if (deities === 'huXuan' || deities === 'gouQue') opts.deityNames = deities

const c = computeChart(instant, opts)
if (args.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ ...c, ringOffsets: ringOffsets(c) })}\n`)
  process.exit(0)
}

const ins = inscription(c)
const out: string[] = [
  `${c.instantUtc}  basis ${c.basis.local} (${c.basis.timeBasis}, UTC${c.basis.offsetMinutes >= 0 ? '+' : ''}${(c.basis.offsetMinutes / 60).toFixed(2)})`,
  `${ins.pillars}`,
  `${ins.line}  符头 ${c.fuTou.name}  (${c.solarTerm.name} from ${c.solarTerm.startUtc})`,
  `值符 ${c.zhiFu.star} ${c.zhiFu.homePalace}→${c.zhiFu.palaceRaw === c.zhiFu.palace ? '' : `${c.zhiFu.palaceRaw}→`}${c.zhiFu.palace}` +
    `  值使 ${c.zhiShi.door} ${c.zhiShi.homePalace}→${c.zhiShi.palaceRaw === c.zhiShi.palace ? '' : `${c.zhiShi.palaceRaw}→`}${c.zhiShi.palace}` +
    `  rotation ★${c.rotation.stars} 门${c.rotation.doors}  rings ${JSON.stringify(ringOffsets(c))}`,
  `旬空 ${c.void.hour.join('')} ${JSON.stringify(c.void.hourPalaces)}  日空 ${c.void.day.join('')}  驿马 ${c.horse.branch}${c.horse.palace}` +
    `${c.fuYin.stars ? '  星伏吟' : ''}${c.fuYin.doors ? '  门伏吟' : ''}${c.fanYin.stars ? '  星反吟' : ''}${c.fanYin.doors ? '  门反吟' : ''}`,
  `next change ${c.nextChangeUtc}`,
  '',
]
// South-up grid, one cell per palace: deity / stars / heaven over earth / door.
const cell = (p: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9): string[] => {
  const s = c.palaces[p]
  const mark = `${s.flags.zhiFu ? '符' : '  '}${s.flags.zhiShi ? '使' : '  '}${s.flags.hourVoid ? '空' : '  '}${s.flags.horse ? '马' : '  '}`
  return [
    `${PALACE_ZH[p]}${p === 5 ? '' : p} ${mark}`,
    s.deity ?? '',
    s.stars.join('') || '',
    `${s.heaven.join('') || '  '} / ${s.earth}${s.lodgedEarth ? `+${s.lodgedEarth}` : ''}  暗${s.hidden}`,
    s.door ?? '',
  ]
}
const width = 22
const pad = (t: string) => t + ' '.repeat(Math.max(0, width - [...t].reduce((n, ch) => n + (/[　-鿿]/.test(ch) ? 2 : 1), 0)))
for (const row of LUO_SHU_GRID) {
  const cells = row.map(cell)
  for (let line = 0; line < 5; line++) out.push(cells.map((cl) => pad(cl[line] ?? '')).join('│ '))
  out.push('─'.repeat(width * 3 + 4))
}
process.stdout.write(`${out.join('\n')}\n`)
