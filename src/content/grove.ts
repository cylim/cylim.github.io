/**
 * Grove copy (content.md §4, design.md §8.6, §9.6–9.9) and the chart conventions the site casts with.
 * Glosses for every chart glyph live in glossary.ts.
 */

import type { QimenOptions } from '../lib/qimen/types'

/**
 * Chart conventions. Passed to computeChart() everywhere: grove, DOM chart, album SVG, terminal.
 * Owner-confirmed: 白虎/玄武 in both cycles, 23:00 starts the next day (zi23), visitor clock time (civil).
 */
export const chartOptions = {
  timeBasis: 'civil',
  ziHour: 'zi23',
  deityNames: 'huXuan',
} as const satisfies QimenOptions

/** The date picker's range (design.md §9.6). The term table covers it. */
export const chartYearRange = [1930, 2100] as const
/** Past this year a one-line note says solar-term times are predictions. */
export const predictionFromYear = 2035

export const grove = {
  heading: 'The Grove',
  subheading: 'Fengshui and Qimen Dunjia',
  intro: [
    'I practise fengshui and Qimen Dunjia.',
    // TODO(owner): two or three sentences in your own voice. How you came to it,
    // how long you've studied, what you use it for. Not drafted on purpose.
  ],
  // The "hover or tap" instruction is glossHint's alone (design.md §8.6, first visit only): said here
  // too, it doubled on first visits and misled no-JS readers, whose glosses can't open (CP-11, A11Y-11).
  chartLead:
    'The stones below hold a live Qimen Dunjia chart for the hour you arrived, cast in your local time with the 时家奇门 转盘 拆补法 method.',
  whatIsAChart:
    '奇门遁甲 (Qimen Dunjia) is a Chinese system for reading time and direction. Each chart lays four layers over the nine palaces: the heavenly stems, eight doors, nine stars and eight deities. Practitioners read how they combine in each palace.',
  luopan:
    'The rings around the platform are a luopan, the fengshui compass. On a phone, it can turn with your heading.',
  // TODO(owner): design.md §8.6 asks the copy to say the platform is a design built on the Han
  // divination board and the luopan, not a traditional instrument. Draft wording, needs a yes.
  boardNote:
    'The platform is a design built on the Western Han nine-palace board found at Shuanggudui and on the luopan. It is not a traditional instrument.',
  /** {localDateTime}, {timeZone} */
  castLabel: 'Cast for {localDateTime}, {timeZone}',
  /** {nextTurnTime} */
  turnNotice: 'The chart turns every two hours. Next turn at {nextTurnTime}.',
  readChart: 'Read the chart',
  /** First visit only. */
  glossHint: 'Hover or tap any character for its meaning.',
  // design.md §9.6 honesty line, shown under the controls.
  honesty: "Cast for your local clock time. Some practitioners correct to true solar time. This chart doesn't.",
  methodNote: '时家奇门 · 转盘 · 拆补法: a new chart every two-hour 时辰, rotating plates, and the 元 read from the 符头.',
  disclaimer: 'Shown for reflection and cultural interest. Nothing here is advice.',
  noscript: 'The live chart needs JavaScript.',
  /** Live-region announcement. {range} e.g. "19:00 to 20:59"; {branch} e.g. 戌. */
  recastAnnouncement: 'Chart recast for {range}, {branch} hour.',
  /** DOM <figcaption>; the chart engine fills the braces. South is always at the top. */
  figcaption: 'Qimen chart cast for {localDateTime}. South is at the top. 值符 {zhifu} in {zhifuPalace}, 值使 {zhishi} in {zhishiPalace}.',
  controls: {
    live: 'Live · this hour',
    earlier: 'Earlier',
    later: 'Later',
    pickMoment: 'Pick a moment',
    backToNow: 'Back to now',
    showEnglish: 'Show English',
    // TODO(owner): wording for the post-2035 note (design.md §9.6).
    predictionNote: 'Solar-term times after 2035 are predictions.',
    hourSlider: 'Hour of the chart',
    /** aria-valuetext, e.g. "Monday 28 September, 戌 hour, 19:00 to 20:59, yin dun structure 4". */
    hourValueText: '{date}, {branch} hour, {range}, {dun} dun structure {ju}',
    rotateLuopan: 'Rotate luopan',
  },
  /** Mobile bottom-sheet tabs (design.md §8.6). */
  tabs: { chart: 'Chart', time: 'Time', compass: 'Compass' },
  palaceDetails: 'Palace details',
  // TODO(owner): drafted panel strings (not in content.md).
  panelHeading: "This hour's chart",
  /** The prerendered glossary under the chart (design.md §14.2). */
  glossaryHeading: 'Glossary',
  glossaryTerms: {
    chart: 'Chart terms',
    method: 'Method',
    luopan: 'Luopan',
    solarTerms: 'Solar terms',
  },
  /** Shown if the engine can't cast (outside the 1930–2100 term table). */
  chartUnavailable: 'The chart could not be cast for that moment. Pick a time between 1930 and 2100.',
  /** Mobile sheet toggle (design.md §8.6). */
  sheetExpand: 'Expand the chart panel',
  sheetCollapse: 'Collapse the chart panel',
  /** Orientation label above the palace grid; the figcaption says it in full. */
  southUp: 'South',
  /** Screen-reader hint on the palace grid (roving focus). */
  gridHint: 'Arrow keys move between palaces. Enter shows every meaning.',
  /** Palace detail labels (design.md §9.8 <dl>). */
  fields: {
    deity: 'Deity',
    star: 'Star',
    heavenStem: 'Heaven stem',
    door: 'Door',
    earthStem: 'Earth stem',
    lodgedEarth: 'Lodged earth stem',
  },
  compass: {
    button: 'Follow compass',
    stop: 'Stop following',
    denied: 'Compass access is off, so the luopan stays pointed north.',
    unsupported: "This device doesn't report a heading.",
    // TODO(owner): new lines from design.md §9.9, drafted here.
    hold: 'Hold the phone flat, away from metal.',
    facingSouth: 'You are facing south. This is how the chart is printed in books.',
    /** {mountain} e.g. 丙; {deg}; {palace}; {trigram} e.g. 离 Li; {door}, {star}, {deity} with English. */
    facing: 'Facing {mountain}, {deg}°, palace {palace} {trigram}. This hour: {door}, {star}, {deity}.',
    counterRotateNote: 'Glyphs turn to stay upright. A real luopan would not; this one does, for reading.',
  },
  /** Chart markers in the DOM palace list. */
  marks: {
    zhiFu: 'Duty Chief',
    zhiShi: 'Duty Envoy',
    hourVoid: 'Void',
    horse: 'Post Horse',
    lodged: '禽寄坤',
  },
} as const
