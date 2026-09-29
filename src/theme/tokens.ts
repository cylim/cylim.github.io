/**
 * Design tokens: design.md §2 (palette), §3 (type), §4 (chrome), §11 (transitions).
 *
 * The one place colours, type sizes, timings and stacking live. Nothing else hard-codes them.
 * `tokens.css` mirrors the CSS-facing subset as custom properties; `cssVars()` is the
 * expected mirror and tokens.test.ts fails if the two drift.
 *
 * Colours are sRGB hex. In three.js, `new Color(hex)` converts to linear for you.
 */

export const color = {
  // §2.1 Paper and ink (墨分五色)
  paper: '#EEE8DB',
  paperLight: '#F4F0E6',
  paperShade: '#E3DBC9',
  paperMount: '#D3C9B4',
  inkJiao: '#141517',
  inkNong: '#2A2C2E',
  inkZhong: '#4B4D4E',
  inkDan: '#85867F',
  inkQing: '#B9B6AB',

  // §2.2 Stone
  stone: '#A7A297',
  bluestone: '#3A3E40',
  bluestoneDeep: '#26292B',

  // §2.3 Accents. Cinnabar never glows and never changes hue, even in the cabin.
  cinnabar: '#A8322A',
  cinnabarDeep: '#862720',
  lanternCore: '#FFE7B0',
  lanternFlame: '#F2A93B',
  lanternHalo: '#F6C877',

  // §2.4 Cabin, the inverted painting.
  // `night` is the exact RGB inverse of `paper` (255 − each channel: EE E8 DB → 11 17 24).
  // It is not a tuning choice; the cabin is the painting turned inside out. Do not "fix" it.
  night: '#111724',
  nightPanel: '#172231',
  cyanLine: '#5CEBDF',
  cyanBright: '#8FF7EE',
  cyanSoft: '#9FC9C4',
  cyanDim: '#2AA7A3',
  cyanGhost: '#1E5E66',

  // §8.4 CircuitWood base tones; they read as near-black under the cabin grade.
  woodDark: '#2A1E16',
  woodLight: '#3B2A1F',
} as const

export type ColorToken = keyof typeof color

/** The five inks, darkest first: 焦 浓 重 淡 清. `ink[0]` is the contour colour. */
export const ink = [color.inkJiao, color.inkNong, color.inkZhong, color.inkDan, color.inkQing] as const

/** Luminance → ink ramp stops for the post pass (stack.md §5 `makeInkRamp`). Ends on paper, the fog colour. */
export const inkRamp: readonly (readonly [stop: number, hex: string])[] = [
  [0, color.inkJiao],
  [0.18, color.inkNong],
  [0.4, color.inkZhong],
  [0.65, color.inkDan],
  [0.85, color.inkQing],
  [1, color.paper],
]

/** Opacities that are part of the look, not per-component tweaks (§4). */
export const alpha = {
  headerScrim: 0.88,
  bottomBar: 0.92,
  tooltip: 0.96,
  nightPanel: 0.88,
  terminalGlass: 0.88,
  mistPocket: 0.85,
  inscription: 0.85,
  lanternPool: 0.35,
  terminalGlow: 0.35,
} as const

// ---------------------------------------------------------------------------- type (§3)

export const font = {
  display: "'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif",
  body: "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif",
  cjk: "'LXGW WenKai', 'Kaiti SC', STKaiti, KaiTi, serif",
  cjkDisplay: "'Ma Shan Zheng', 'LXGW WenKai', 'Kaiti SC', KaiTi, serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const

/**
 * Self-hosted subset font files under public/fonts/, written by scripts/subset-fonts.mjs.
 * troika reads woff, not woff2, so faces drawn in 3D ship both.
 */
export const fontFiles = {
  display600: { woff2: '/fonts/cormorant-garamond-600.woff2', woff: '/fonts/cormorant-garamond-600.woff' },
  body400: { woff2: '/fonts/source-serif-4-400.woff2', woff: '/fonts/source-serif-4-400.woff' },
  body600: { woff2: '/fonts/source-serif-4-600.woff2', woff: '/fonts/source-serif-4-600.woff' },
  cjk: { woff2: '/fonts/wenkai-subset.woff2', woff: '/fonts/wenkai-subset.woff' },
  cjkDisplay: { woff2: '/fonts/mashanzheng-subset.woff2', woff: '/fonts/mashanzheng-subset.woff' },
  mono: { woff2: '/fonts/jetbrains-mono-400.woff2', woff: '/fonts/jetbrains-mono-400.woff' },
} as const

/**
 * §3.1 type scale. Sizes are CSS lengths in rem so 200% text zoom reflows (§15).
 * `desktop` applies at `breakpoint.desktop` and up. 13 px (0.8125rem) is the hard floor.
 */
export const typeScale = {
  heroCjk: { size: 'clamp(88px, 11vw, 176px)', lineHeight: 1 },
  display: { size: 'clamp(2.75rem, 1.6rem + 5vw, 6.5rem)', lineHeight: 1, tracking: '-0.01em' },
  h2: { size: 'clamp(1.75rem, 1.3rem + 2vw, 2.75rem)', lineHeight: 1.1 },
  sectionCjk: { size: 'clamp(3.5rem, 2.8rem + 3vw, 6rem)', lineHeight: 1 },
  h3: { size: '1.25rem', desktop: '1.375rem', lineHeight: 1.25 },
  body: { size: '1.0625rem', desktop: '1.125rem', lineHeight: 1.55, measure: '34em' },
  bodySmall: { size: '0.9375rem', lineHeight: 1.5 },
  label: { size: '0.8125rem', lineHeight: 1.3, tracking: '0.08em' },
  glossCjk: { size: '1.15em', lineHeight: 1.3 },
  mono: { size: '0.8125rem', desktop: '0.9375rem', lineHeight: 1.45 },
  homeMark: { size: '1.25rem', lineHeight: 1 },
  navLabel: { size: '0.9375rem', lineHeight: 1.2 },
  navCjk: { size: '0.8125rem', lineHeight: 1.2 },
  // §4.2 asks for 12 px in the mobile bar; the §3.1 floor wins, so it is 13 px.
  barLabel: { size: '0.8125rem', lineHeight: 1.2 },
  titleCardCjk: { size: '7.5rem', lineHeight: 1 },
} as const

/** Seal sizes in CSS px (§4.4). */
export const sealSize = { nav: 28, hero: 44, finale: 64 } as const

/** 3D glyph heights in metres (§9.3, §9.6). */
export const glyph3d = {
  palaceStem: 0.6,
  star: 0.6,
  door: 0.6,
  deity: 0.5,
  palaceName: 0.3,
  voidHorse: 0.25,
  english: 0.22,
} as const

// ---------------------------------------------------------------------------- motion (§4, §11)

/** Durations in milliseconds. */
export const motion = {
  dive: {
    in: 450,
    out: 700,
    outCabin: 900,
    reduced: 150,
    e2e: 50,
    /** Give up waiting for a chunk and emerge anyway. */
    giveUp: 5000,
    /** "Grinding ink…" appears if the target is still loading this long into the hold. */
    loadingHint: 400,
    titleCardIn: 250,
    titleCardOut: 500,
    cardFade: 200,
  },
  chromeCrossfade: 300,
  navUnderline: 300,
  inscription: 600,
  hashDebounce: 300,
  tooltipDelay: 120,
  toast: 4000,
  /** Post-group crossfade when the camera crosses the door plane (§8.4). */
  doorPostBlend: 400,
  canvas: { reveal: 1800, revealSkip: 300, revealReduced: 800, fadeIn: 800 },
  seal: { total: 220, press: 120, bleed: 400 },
  scrollCue: 3000,
  /**
   * First-load loading screen (intro.ts): 林 brushes in over `brush`, one 木 at a time. It
   * holds at least `min` (first load per tab) and lifts when the forest and the scenes in view are
   * ready. `max` only guards against a load that hangs.
   */
  intro: { brush: 1100, min: 1400, max: 30000, out: 600 },
  /** Earlier/Later long-press: repeat after `delay`, then every `interval` (4 per second). */
  longPress: { delay: 400, interval: 250 },
  /** Terminal output lines settle from a 2 px blur; the caret breathes instead of blinking. */
  terminalSettle: 120,
  caretBreath: 1200,
  /** Gloss tooltip stays open this long after the pointer leaves, so it can be hovered (WCAG 1.4.13). */
  tooltipLinger: 150,
  /** Sound icon: a guqin string at 2 Hz when on. */
  soundWave: 500,
  /** Wait on the P2 mist wall before the section chip says "Grinding ink…" (design.md §8.5). */
  mistWaitHint: 1500,
  nearJump: { duration: 1200 },
  soundFadeIn: 2000,
  /** Tier changes wait for fog cover (density > 0.12) or this long, whichever comes first. */
  tierQueueMaxWait: 10000,
  dprStepMinInterval: 2000,
  idle: { throttleAfter: 5000, stopAfter: 30000 },
} as const

/** CSS easing curves, matching the JS functions below. */
export const easingCss = {
  inCubic: 'cubic-bezier(0.32, 0, 0.67, 0)',
  outCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
  inOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const

export const easing = {
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
} as const

// ---------------------------------------------------------------------------- stacking and layout (§4)

/** z-index scale. The stage sits under everything; the veil covers content but not the nav (§1 rule 3). */
export const z = {
  stage: 0,
  content: 10,
  mapPins: 15,
  chrome: 20,
  terminalOverlay: 22,
  veil: 30,
  titleCard: 31,
  /** First-load loading screen: over #root (header included), passing clicks through to it. */
  intro: 35,
  header: 40,
  bottomBar: 40,
  sheet: 45,
  popover: 50,
  toast: 60,
  tooltip: 70,
  skipLink: 100,
} as const

export const breakpoint = {
  /** §4.1 desktop chrome from here up; below is the §4.2 mobile bottom bar. */
  desktop: 768,
} as const

/** Chrome dimensions in CSS px unless the value is a string. */
export const layout = {
  headerHeight: 56,
  bottomBarHeight: 56,
  headerScrimAfter: 40,
  minTarget: 44,
  navSlotMin: 48,
  contactRowMin: 56,
  zoneWidth: '30rem',
  zoneInset: '6vw',
  zoneBWidth: '92vw',
  zoneBMaxHeight: '45%',
  progressInset: 20,
  progressTop: '20vh',
  progressBottom: '80vh',
  progressMark: 6,
  tooltipMaxWidth: 280,
  tooltipRadius: 8,
  cabinCardRadius: 2,
  focusRing: 2,
  focusOffset: 2,
  mistPocketFeather: 48,
  mountBorderPortrait: 12,
  sheetPeek: '30%',
  sheetOpen: '85%',
  terminalSheet: '60%',
} as const

export const tokens = {
  color,
  ink,
  inkRamp,
  alpha,
  font,
  fontFiles,
  typeScale,
  sealSize,
  glyph3d,
  motion,
  easingCss,
  easing,
  z,
  breakpoint,
  layout,
} as const

// ---------------------------------------------------------------------------- CSS mirror

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * The custom properties tokens.css must declare on :root, with their exact values.
 * Colour `paperLight` becomes `--paper-light`; a type token `h2` becomes `--fs-h2` and `--lh-h2`.
 */
export function cssVars(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(color)) out[`--${kebab(k)}`] = v
  for (const [k, v] of Object.entries(font)) out[`--font-${kebab(k)}`] = v
  for (const [k, v] of Object.entries(typeScale)) {
    out[`--fs-${kebab(k)}`] = v.size
    out[`--lh-${kebab(k)}`] = String(v.lineHeight)
  }
  for (const [k, v] of Object.entries(z)) out[`--z-${kebab(k)}`] = String(v)
  for (const [k, v] of Object.entries(alpha)) out[`--alpha-${kebab(k)}`] = String(v)
  for (const [k, v] of Object.entries(easingCss)) out[`--ease-${kebab(k)}`] = v
  out['--dur-dive-in'] = `${motion.dive.in}ms`
  out['--dur-dive-out'] = `${motion.dive.out}ms`
  out['--dur-dive-out-cabin'] = `${motion.dive.outCabin}ms`
  out['--dur-dive-reduced'] = `${motion.dive.reduced}ms`
  out['--dur-card-fade'] = `${motion.dive.cardFade}ms`
  out['--dur-chrome'] = `${motion.chromeCrossfade}ms`
  out['--dur-nav-underline'] = `${motion.navUnderline}ms`
  out['--dur-inscription'] = `${motion.inscription}ms`
  out['--dur-tooltip-delay'] = `${motion.tooltipDelay}ms`
  out['--dur-title-card-out'] = `${motion.dive.titleCardOut}ms`
  out['--dur-seal'] = `${motion.seal.total}ms`
  out['--dur-seal-press'] = `${motion.seal.press}ms`
  out['--dur-seal-bleed'] = `${motion.seal.bleed}ms`
  out['--dur-scroll-cue'] = `${motion.scrollCue}ms`
  out['--dur-intro-brush'] = `${motion.intro.brush}ms`
  out['--dur-intro-out'] = `${motion.intro.out}ms`
  out['--dur-terminal-settle'] = `${motion.terminalSettle}ms`
  out['--dur-caret'] = `${motion.caretBreath}ms`
  out['--dur-sound-wave'] = `${motion.soundWave}ms`
  out['--header-h'] = `${layout.headerHeight}px`
  out['--bar-h'] = `${layout.bottomBarHeight}px`
  out['--min-target'] = `${layout.minTarget}px`
  out['--zone-w'] = layout.zoneWidth
  out['--zone-inset'] = layout.zoneInset
  out['--zone-b-w'] = layout.zoneBWidth
  out['--zone-b-max-h'] = layout.zoneBMaxHeight
  out['--nav-slot-min'] = `${layout.navSlotMin}px`
  out['--contact-row-min'] = `${layout.contactRowMin}px`
  out['--progress-inset'] = `${layout.progressInset}px`
  out['--progress-top'] = layout.progressTop
  out['--progress-bottom'] = layout.progressBottom
  out['--progress-mark'] = `${layout.progressMark}px`
  out['--tooltip-max-w'] = `${layout.tooltipMaxWidth}px`
  out['--tooltip-radius'] = `${layout.tooltipRadius}px`
  out['--cabin-card-radius'] = `${layout.cabinCardRadius}px`
  out['--focus-ring'] = `${layout.focusRing}px`
  out['--focus-offset'] = `${layout.focusOffset}px`
  out['--mist-pocket-feather'] = `${layout.mistPocketFeather}px`
  out['--mount-border-portrait'] = `${layout.mountBorderPortrait}px`
  out['--sheet-peek'] = layout.sheetPeek
  out['--sheet-open'] = layout.sheetOpen
  out['--terminal-sheet'] = layout.terminalSheet
  out['--seal-nav'] = `${sealSize.nav}px`
  out['--seal-hero'] = `${sealSize.hero}px`
  out['--seal-finale'] = `${sealSize.finale}px`
  out['--measure'] = typeScale.body.measure
  out['--tracking-label'] = typeScale.label.tracking
  out['--tracking-display'] = typeScale.display.tracking
  return out
}
