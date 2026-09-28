import { postFx, wake } from '../../core/render'
import { journey, type JourneyState } from '../../core/store/journey'
import { exit } from '../../core/world/layout'
import { motion } from '../../theme/tokens'
import { registerKeepOut } from '../../env'
import { FINALE, finaleShowing, mountOpenAt, scissorRect, signedAt } from './finale'

type FinaleFlag = keyof JourneyState['finale']
type Timer = ReturnType<typeof setTimeout>

const setFlag = (flag: FinaleFlag, on: boolean) => {
  const s = journey.getState()
  if (s.finale[flag] !== on) journey.setState({ finale: { ...s.finale, [flag]: on } })
}

/**
 * The finale's store flags and the renderer scissor (design.md §8.7 E2–E3). Driven by store
 * changes and timers, not frames, because a stage that has gone idle runs no frames.
 *
 * - `finale.mountOpen` follows the scroll from FINALE.mountOpenAt. Once the DOM has slid the mounts
 *   in (FINALE.mountSlideMs), `postFx.scissor` crops the render to the window; it clears at once
 *   when the mounts leave, before they slide out.
 * - E3 plays once per visit, when the camera has arrived (no dive, no catch-up fog): the colophon
 *   writes itself, then the 林 seal stamps. Leaving E3 early cancels what is still pending; coming
 *   back resumes it. Reduced motion and e2e sign at once.
 * - From E2 on, the pines in layout `exit.finaleOpening` stand aside so the painting shows the
 *   grove's rings; they go and come back while the camera faces away from them.
 */
export class FinaleFlags {
  private scissorTimer: Timer | undefined
  private scissorOn = false
  private e3: Timer[] = []
  private unsubscribe: (() => void) | null = null
  private closeOpening: (() => void) | null = null
  private width = 0
  private height = 0

  start(): void {
    this.apply(journey.getState())
    this.unsubscribe = journey.subscribe((s, prev) => {
      if (s.jvh !== prev.jvh || s.dive !== prev.dive || s.lagFog !== prev.lagFog || s.mode !== prev.mode) this.apply(s)
    })
  }

  /** The canvas size in CSS px; moves the scissor with the window. */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.scissor(journey.getState().finale.mountOpen)
  }

  /** Hidden or unmounted: close the mounts, drop the scissor and the pins, keep what was signed. */
  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.cancelE3()
    this.opening(false)
    clearTimeout(this.scissorTimer)
    this.scissorTimer = undefined
    this.scissorOn = false
    postFx.scissor = null
    setFlag('mountOpen', false)
    if (Object.keys(journey.getState().pins).length > 0) journey.setState({ pins: {} })
  }

  private apply(s: JourneyState): void {
    this.opening(finaleShowing(s.jvh))
    const open = s.mode === 'immersive' && mountOpenAt(s.jvh)
    if (s.finale.mountOpen !== open) setFlag('mountOpen', open)
    this.scissor(open)

    const arrived = signedAt(s.jvh) && s.dive.phase === 'idle' && s.lagFog < 0.05
    if (!arrived) return this.cancelE3()
    const done = s.finale.colophonShown && s.finale.sealStamped
    if (!done && this.e3.length === 0) this.startE3(s)
  }

  private opening(on: boolean): void {
    if (on && !this.closeOpening) this.closeOpening = registerKeepOut({ id: 'finale-opening', kind: 'corridor', ...exit.finaleOpening })
    else if (!on && this.closeOpening) {
      this.closeOpening()
      this.closeOpening = null
    }
  }

  private scissor(open: boolean): void {
    const rect = open ? scissorRect(this.width, this.height) : null
    if (!rect) {
      clearTimeout(this.scissorTimer)
      this.scissorTimer = undefined
      this.scissorOn = false
      if (postFx.scissor) postFx.scissor = null
      return
    }
    if (this.scissorOn) {
      postFx.scissor = rect
      return
    }
    if (this.scissorTimer) return
    this.scissorTimer = setTimeout(() => {
      this.scissorTimer = undefined
      this.scissorOn = true
      postFx.scissor = scissorRect(this.width, this.height)
      wake()
    }, FINALE.mountSlideMs)
  }

  private startE3(s: JourneyState): void {
    if (s.reducedMotion || s.e2e) {
      journey.setState((cur) => ({ finale: { ...cur.finale, colophonShown: true, sealStamped: true } }))
      return
    }
    const written = s.finale.colophonShown
    const lead = written ? FINALE.colophonAfterMs : 0
    if (!written) this.e3.push(setTimeout(() => setFlag('colophonShown', true), FINALE.colophonAfterMs))
    this.e3.push(setTimeout(() => setFlag('sealStamped', true), FINALE.sealAfterMs - lead))
    wake(FINALE.sealAfterMs - lead + motion.seal.total + motion.seal.bleed)
  }

  private cancelE3(): void {
    for (const t of this.e3) clearTimeout(t)
    this.e3 = []
  }
}
