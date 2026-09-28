/**
 * Dev only; the app never imports it. Renders every cue with the runtime's own graphs on an
 * OfflineAudioContext and measures it against the cue sheet (design.md §12), then renders the
 * whole engine at a few beats for loudness. In a page served by the Vite dev server:
 *
 *   const cal = await import('/src/audio/calibrate.ts')
 *   console.table(await cal.measureCues())
 *   console.table(await cal.measureScenes())
 *
 * A cue whose reading drifts from its target needs its TRIM in voices.ts scaled by the difference.
 */

import { initialJourneyState, type JourneyState } from '../core/store/journey'
import { MARKS } from '../core/world/beats'
import { CUTOFF, GRIND_FULL_SPEED, LEVEL, SEED, dbToGain } from './cues'
import { seeded } from './dsp'
import { Engine } from './engine'
import type { MixState } from './mix'
import { integratedLufs, maxMomentaryLufs, momentaryLufs, peakDb, rmsDb } from './meter'
import { renderSamples } from './samples'
import { createDetents, createTriggers } from './triggers'
import {
  createBeds,
  makeBuffers,
  playChime,
  playCreak,
  playDetent,
  playGuqin,
  playIgnition,
  playKey,
  playSeal,
  playWhoosh,
  type Beds,
  type Buffers,
} from './voices'

export const SAMPLE_RATE = 48000

export interface Reading {
  name: string
  /** What the sheet's level means for this cue: loudness (beds), sample peak (one-shots), or a whole-engine scene. */
  measure: 'lufs' | 'peak' | 'mix'
  targetDb: number | null
  rmsDb: number
  peakDb: number
  lufs: number
  /** Loudest 400 ms. */
  momentary: number
  /** Share of samples the limiter's knee touched, percent. */
  limited: number
}

type BedCue = keyof Beds
type OneShot = 'creak' | 'ignition' | 'keys' | 'whoosh' | 'guqin' | 'detent' | 'chime' | 'seal'

const BED_TARGET: Record<BedCue, number> = {
  wind: LEVEL.wind,
  pine: LEVEL.pine,
  stream: LEVEL.stream,
  hum: LEVEL.humInside,
  crackle: LEVEL.crackle[1],
  grind: LEVEL.grind,
}

const ONE_SHOTS: Record<OneShot, { seconds: number; play: (ctx: BaseAudioContext, b: Buffers, out: AudioNode) => void }> = {
  creak: { seconds: 1.6, play: (ctx, b, out) => playCreak(ctx, b, out, 0.05) },
  ignition: { seconds: 4, play: (ctx, _b, out) => playIgnition(ctx, out, 0.05) },
  keys: {
    seconds: 1.2,
    play: (ctx, b, out) => {
      const r = seeded(7)
      for (let i = 0; i < 10; i++) playKey(ctx, b, out, 0.05 + i * 0.1, r)
    },
  },
  whoosh: { seconds: 2, play: (ctx, b, out) => playWhoosh(ctx, b, out, 0.05, 0.45, 0.8) },
  guqin: { seconds: 4.5, play: (ctx, b, out) => playGuqin(ctx, b, out, 0.05) },
  detent: { seconds: 0.3, play: (ctx, b, out) => playDetent(ctx, b, out, 0.05) },
  chime: { seconds: 6, play: (ctx, _b, out) => playChime(ctx, out, 0.05) },
  seal: { seconds: 0.8, play: (ctx, b, out) => playSeal(ctx, b, out, 0.05) },
}

const ONE_SHOT_TARGET: Record<OneShot, number> = {
  creak: LEVEL.creak,
  ignition: LEVEL.ignition,
  keys: LEVEL.keys,
  whoosh: LEVEL.whoosh,
  guqin: LEVEL.guqin,
  detent: LEVEL.detent,
  chime: LEVEL.chime,
  seal: LEVEL.seal,
}

const round = (x: number) => Math.round(x * 10) / 10
/** Where the master limiter's shoulder starts (engine.ts). */
const KNEE = dbToGain(LEVEL.ceiling - 3)
const channels = (b: AudioBuffer) => Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i))

function read(name: string, measure: Reading['measure'], targetDb: number | null, buffer: AudioBuffer, skipSeconds = 0): Reading {
  const ch = channels(buffer)
  const from = Math.round(skipSeconds * buffer.sampleRate)
  const tail = ch.map((c) => c.subarray(from))
  let over = 0
  for (const c of tail) for (const v of c) if (Math.abs(v) > KNEE) over++
  return {
    name,
    measure,
    targetDb,
    rmsDb: round(rmsDb(tail)),
    peakDb: round(peakDb(tail)),
    lufs: round(integratedLufs(tail, buffer.sampleRate)),
    momentary: round(maxMomentaryLufs(tail, buffer.sampleRate)),
    limited: Math.round((over / Math.max(1, tail.length * (tail[0]?.length ?? 0))) * 1e5) / 1e3,
  }
}

/** Render one cue on its own, straight from voices.ts (no master chain). */
export async function renderCue(cue: BedCue | OneShot): Promise<AudioBuffer> {
  // 16 s covers the wind's 14 s cutoff LFO and more than one pine loop.
  const seconds = cue in ONE_SHOTS ? ONE_SHOTS[cue as OneShot].seconds : 16
  const ctx = new OfflineAudioContext(2, Math.round(seconds * SAMPLE_RATE), SAMPLE_RATE)
  const buffers = makeBuffers(ctx, renderSamples(SAMPLE_RATE, SEED))
  if (cue in ONE_SHOTS) ONE_SHOTS[cue as OneShot].play(ctx, buffers, ctx.destination)
  else {
    const beds = createBeds(ctx, buffers, ctx.destination)
    beds[cue as BedCue].level.value = dbToGain(BED_TARGET[cue as BedCue])
    // The hum's level is the inside one, with its low-pass open.
    beds.hum.cutoff.value = 1200 * Math.log2(CUTOFF.humOpen / CUTOFF.humClosed)
  }
  return ctx.startRendering()
}

/** Every bed at its full level (after the first 2 s) and every one-shot. */
export async function measureCues(): Promise<Reading[]> {
  const out: Reading[] = []
  for (const bed of Object.keys(BED_TARGET) as BedCue[]) {
    out.push(read(bed, bed === 'crackle' ? 'peak' : 'lufs', BED_TARGET[bed], await renderCue(bed), 2))
  }
  for (const shot of Object.keys(ONE_SHOTS) as OneShot[]) out.push(read(shot, 'peak', ONE_SHOT_TARGET[shot], await renderCue(shot)))
  return out
}

interface Scene {
  name: string
  state: Partial<MixState>
  seconds: number
  /** Timed actions, seconds from the start. */
  events?: readonly { at: number; run: (engine: Engine) => void }[]
}

const SCENES: readonly Scene[] = [
  { name: 'T0 hero, 20', state: { jvh: 20 }, seconds: 10 },
  { name: 'F1 forest, 120', state: { jvh: 120 }, seconds: 10 },
  { name: 'C1 cabin door, 260', state: { jvh: 260 }, seconds: 10 },
  {
    name: 'C2 door creak, 277',
    state: { jvh: 277 },
    seconds: 4,
    events: [{ at: 0.5, run: (e) => e.play('creak') }],
  },
  {
    name: 'I1 hall, 360, with ignition',
    state: { jvh: 360, insideCabin: true },
    seconds: 10,
    events: [{ at: 0.5, run: (e) => e.play('ignition') }],
  },
  {
    name: 'I3 terminal typing, 500',
    state: { jvh: 500, insideCabin: true },
    seconds: 6,
    events: Array.from({ length: 24 }, (_, i) => ({ at: 1 + i * 0.12, run: (e: Engine) => e.key() })),
  },
  { name: 'P1 stream, 595', state: { jvh: 595 }, seconds: 10 },
  {
    name: 'P2 mist wall, 622, guqin',
    state: { jvh: 622 },
    seconds: 6,
    events: [{ at: 0.5, run: (e) => e.play('guqin') }],
  },
  {
    name: 'G1 casting, 680, rings turning',
    state: { jvh: 680, ringSpeed: GRIND_FULL_SPEED },
    seconds: 6,
    events: Array.from({ length: 6 }, (_, i) => ({ at: 0.5 + i * 0.33, run: (e: Engine) => e.detent() })),
  },
  {
    name: 'G3 hour chime, 780',
    state: { jvh: 780 },
    seconds: 8,
    events: [{ at: 0.5, run: (e) => e.chime() }],
  },
  { name: 'E1 lantern, 900', state: { jvh: 900 }, seconds: 10 },
  {
    name: 'dive from 120',
    state: { jvh: 120 },
    seconds: 4,
    events: Array.from({ length: 12 }, (_, i) => ({
      at: 0.5 + i * 0.1,
      run: (e: Engine) => {
        if (i === 0) e.play('whoosh')
        e.apply(stateAt({ jvh: 120, dive: { phase: 'in', amount: Math.min(1, i / 4.5), to: 'grove', waiting: false } }))
      },
    })),
  },
  {
    name: 'E3 seal, 990',
    state: { jvh: 990 },
    seconds: 5,
    events: [
      {
        at: 0.5,
        run: (e) => {
          e.play('seal')
          e.apply(stateAt({ jvh: 990, finale: { mountOpen: true, sealStamped: true, colophonShown: false } }))
        },
      },
    ],
  },
]

function stateAt(patch: Partial<MixState>): MixState {
  const s = initialJourneyState()
  return { jvh: s.jvh, insideCabin: s.insideCabin, dive: s.dive, paper: s.paper, ringSpeed: s.ringSpeed, finale: s.finale, ...patch }
}

/** The whole engine at a few beats: integrated loudness, RMS and peak of the output. */
export async function measureScenes(): Promise<Reading[]> {
  const out: Reading[] = []
  for (const scene of SCENES) {
    const ctx = new OfflineAudioContext(2, Math.round(scene.seconds * SAMPLE_RATE), SAMPLE_RATE)
    const engine = new Engine(ctx)
    await engine.build()
    engine.apply(stateAt(scene.state), true)
    engine.fade(1, 0)
    for (const ev of scene.events ?? []) {
      void ctx.suspend(ev.at).then(() => {
        ev.run(engine)
        return ctx.resume()
      })
    }
    out.push(read(scene.name, 'mix', null, await ctx.startRendering(), 0.5))
  }
  return out
}

type WalkState = Pick<JourneyState, 'jvh' | 'insideCabin' | 'dive' | 'paper' | 'ringSpeed' | 'ignitionPlayed' | 'finale'>

/** The cabin records the ignition as played when its 2.5 s run ends. */
const IGNITION_RUN_S = 2.5

/**
 * The store as a steady forward scroll would leave it at `jvh`, with the scenes' writes: inside the
 * cabin past the door plane, the moon-gate paper, ignition recorded when its run ends, the rings
 * turning for 1.2 s after the casting starts, the seal at E3.
 */
function walkState(jvh: number, jvhPerSecond: number): WalkState {
  const s = initialJourneyState()
  const [gate, swap] = MARKS.moonGate
  const paper = jvh < gate ? 0 : jvh < swap - 1 ? (jvh - gate) / (swap - 1 - gate) : jvh < swap ? 1 : Math.max(0, 1 - (jvh - swap) / 6)
  const turn = (jvh - MARKS.castStart) / jvhPerSecond - 1.5
  return {
    jvh,
    insideCabin: jvh >= MARKS.doorPlane && jvh < swap,
    dive: s.dive,
    paper,
    ringSpeed: turn > 0 && turn < 1.2 ? 5 * Math.sin((Math.PI * turn) / 1.2) : 0,
    ignitionPlayed: jvh >= MARKS.doorPlane + IGNITION_RUN_S * jvhPerSecond,
    finale: { mountOpen: jvh >= MARKS.sealStamp, sealStamped: jvh >= MARKS.sealStamp + 1, colophonShown: false },
  }
}

export interface WalkReading {
  reading: Reading
  /** Momentary loudness every 100 ms, LUFS. */
  momentary: number[]
  /** Cues the triggers fired, seconds from the start. */
  fired: { at: number; jvh: number; cue: string }[]
  seconds: number
  jvhPerSecond: number
}

/** Scroll the whole walk at a steady pace through the real triggers, detents and mix, with some typing at the terminal. */
export async function measureWalk(jvhPerSecond = 10): Promise<WalkReading> {
  const seconds = 1000 / jvhPerSecond + 6
  const ctx = new OfflineAudioContext(2, Math.round(seconds * SAMPLE_RATE), SAMPLE_RATE)
  const engine = new Engine(ctx)
  await engine.build()
  let prev = walkState(0, jvhPerSecond)
  const triggers = createTriggers(prev)
  const detents = createDetents()
  const fired: WalkReading['fired'] = []
  engine.apply(prev, true)
  engine.fade(1, 0)
  const step = 0.05
  for (let i = 1; i * step < seconds; i++) {
    const t = i * step
    void ctx.suspend(t).then(() => {
      const jvh = Math.min(1000, t * jvhPerSecond)
      const next = walkState(jvh, jvhPerSecond)
      for (const cue of triggers.step(prev, next)) {
        engine.play(cue)
        fired.push({ at: t, jvh, cue })
      }
      engine.apply(next)
      if (detents.step(next.ringSpeed, t, step)) {
        engine.detent()
        fired.push({ at: t, jvh, cue: 'detent' })
      }
      if (jvh >= 495 && jvh < 505 && i % 3 === 0) engine.key()
      prev = next
      return ctx.resume()
    })
  }
  const buffer = await ctx.startRendering()
  return {
    reading: read(`walk at ${jvhPerSecond} jvh/s`, 'mix', null, buffer),
    momentary: momentaryLufs(channels(buffer), buffer.sampleRate).map(round),
    fired,
    seconds,
    jvhPerSecond,
  }
}
