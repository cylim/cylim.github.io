import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialJourneyState, journey } from '../core/store/journey'
import { motion } from '../theme/tokens'
import { introDone, introProgress, startIntro } from './intro'

const at = (stage: 'none' | 'loading' | 'benchmark' | 'live') => introProgress({ mode: 'immersive', stage })

describe('intro progress', () => {
  it('fills with the stage phase and is full in the album', () => {
    expect(at('none')).toBeLessThan(at('loading'))
    expect(at('loading')).toBeLessThan(at('benchmark'))
    expect(at('benchmark')).toBeLessThan(at('live'))
    expect(at('live')).toBe(1)
    expect(introProgress({ mode: 'static', stage: 'none' })).toBe(1)
    expect(introDone({ mode: 'immersive', stage: 'benchmark' })).toBe(false)
    expect(introDone({ mode: 'immersive', stage: 'live' })).toBe(true)
    expect(introDone({ mode: 'static', stage: 'none' })).toBe(true)
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

  it('holds the brushwork for its minimum on the first load, then lifts when the stage is live', () => {
    stop = startIntro(html, now)
    journey.setState({ stage: 'live' })
    expect(html.getAttribute('data-intro')).toBe('')
    advance(motion.intro.min)
    expect(html.getAttribute('data-intro')).toBe('out')
    advance(motion.intro.out)
    expect(html.hasAttribute('data-intro')).toBe(false)
  })

  it('lifts as soon as the stage is live on a later load in the same tab', () => {
    sessionStorage.setItem('cy.introSeen', '1')
    stop = startIntro(html, now)
    advance(100)
    journey.setState({ stage: 'live' })
    expect(html.getAttribute('data-intro')).toBe('out')
  })

  it('never waits past the maximum, and any input lifts it at once', () => {
    stop = startIntro(html, now)
    journey.setState({ stage: 'benchmark' })
    advance(motion.intro.max)
    expect(html.getAttribute('data-intro')).toBe('out')

    stop?.()
    html.setAttribute('data-intro', '')
    stop = startIntro(html, now)
    dispatchEvent(new Event('wheel'))
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
