// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initialJourneyState, journey } from '../store/journey'
import { scrollToJvh, scrollYAtJvh, startScrollDriver } from './ScrollDriver'

/**
 * jsdom has no layout: give the document a scroll length and make scrollTo move scrollY without
 * firing 'scroll', the way the event only arrives a frame later in a browser.
 */
let y = 0
let stop: () => void = () => {}

beforeEach(() => {
  y = 0
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => 8800 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y })
  window.scrollTo = ((opts: ScrollToOptions) => {
    y = opts.top ?? y
  }) as typeof window.scrollTo
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  journey.setState({ ...initialJourneyState(), mode: 'immersive', e2e: true })
  stop = startScrollDriver()
})

afterEach(() => stop())

describe('scrollToJvh (QM-10)', () => {
  it('resolves with the store already at the new position, before any scroll event', async () => {
    expect(journey.getState().jvh).toBe(0)
    await expect(scrollToJvh(360)).resolves.toBe(true)
    expect(window.scrollY).toBe(scrollYAtJvh(360))
    expect(journey.getState().jvh).toBeCloseTo(360, 6)
    expect(journey.getState().active).toBe('cabin')
  })
})
