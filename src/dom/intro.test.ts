import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialJourneyState, journey, visibleSections } from '../core/store/journey'
import { motion } from '../theme/tokens'
import { introDone, introProgress, startIntro } from './intro'

/** Every section in view at the top of the walk, ready. */
const READY = Object.fromEntries(visibleSections(0).map((id) => [id, true]))

const walk = (stage: 'none' | 'loading' | 'benchmark' | 'live' | 'lost', ready: Record<string, boolean> = READY) =>
  ({ mode: 'immersive', stage, u: 0, ready }) as const
const at = (stage: 'none' | 'loading' | 'benchmark' | 'live', ready?: Record<string, boolean>) => introProgress(walk(stage, ready))

describe('intro progress', () => {
  it('fills with the stage phase and is full in the album', () => {
    expect(at('none')).toBeLessThan(at('loading'))
    expect(at('loading')).toBeLessThan(at('benchmark'))
    expect(at('benchmark')).toBeLessThan(at('live', {}))
    expect(at('live', {})).toBeLessThan(at('live'))
    expect(at('live')).toBe(1)
    expect(introProgress({ mode: 'static', stage: 'none', u: 0, ready: {} })).toBe(1)
  })

  it('is done only once the stage is live and the scenes in view are ready', () => {
    expect(introDone(walk('benchmark'))).toBe(false)
    expect(introDone(walk('live', {}))).toBe(false)
    expect(introDone(walk('live'))).toBe(true)
    expect(introDone(walk('lost', {}))).toBe(true)
    expect(introDone({ mode: 'static', stage: 'none', u: 0, ready: {} })).toBe(true)
  })
})

describe('startIntro', () => {
  const html = document.documentElement
  let clock = 0
  let stop: (() => void) | undefined
  const now = () => clock
  const advance = (ms: number) => {
    clock += ms
    vi.advanceTimersByTime(ms)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    clock = 0
    sessionStorage.clear()
    journey.setState(initialJourneyState())
    journey.setState({ mode: 'immersive', stage: 'none' })
    document.body.innerHTML = '<div id="intro"></div>'
    html.setAttribute('data-intro', '')
  })
  afterEach(() => {
    stop?.()
    vi.useRealTimers()
    html.removeAttribute('data-intro')
  })

  it('holds the brushwork for its minimum on the first load, then lifts when the forest is ready', () => {
    stop = startIntro(html, now)
    expect(html.getAttribute('data-intro')).toBe('app')
    journey.setState({ stage: 'live', ready: READY })
    expect(html.getAttribute('data-intro')).toBe('app')
    advance(motion.intro.min)
    expect(html.getAttribute('data-intro')).toBe('out')
    advance(motion.intro.out)
    expect(html.hasAttribute('data-intro')).toBe(false)
  })

  it('lifts as soon as the stage is live on a later load in the same tab', () => {
    sessionStorage.setItem('cy.introSeen', '1')
    stop = startIntro(html, now)
    advance(100)
    journey.setState({ stage: 'live', ready: READY })
    expect(html.getAttribute('data-intro')).toBe('out')
  })

  it('stays up while the scenes in view load, whatever the visitor does', () => {
    sessionStorage.setItem('cy.introSeen', '1')
    stop = startIntro(html, now)
    journey.setState({ stage: 'live' })
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) dispatchEvent(new Event(type))
    advance(motion.intro.max - 1)
    expect(html.getAttribute('data-intro')).toBe('app')
    journey.setState({ ready: READY })
    expect(html.getAttribute('data-intro')).toBe('out')
  })

  it('lifts at the maximum only if the load hangs', () => {
    stop = startIntro(html, now)
    journey.setState({ stage: 'benchmark' })
    advance(motion.intro.max)
    expect(html.getAttribute('data-intro')).toBe('out')
  })

  it('does nothing when the head script did not raise the screen', () => {
    html.removeAttribute('data-intro')
    stop = startIntro(html, now)
    journey.setState({ stage: 'live' })
    advance(motion.intro.max)
    expect(html.hasAttribute('data-intro')).toBe(false)
  })
})
