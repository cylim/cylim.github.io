import { readPrefs, writePrefs } from '../core/boot/prefs'
import { CY_EVENT, emit, type QualityChoice } from '../core/events'
import { journey, type RenderMode, type Tier } from '../core/store/journey'

/**
 * Switch between the walk and the album. The choice persists in `cy.prefs` and index.html's head
 * script applies it before first paint, so the switch is a reload: three never loads in the album,
 * and the walk starts clean. A `?mode=` in the URL would override the saved choice, so it goes.
 */
export function switchMode(mode: RenderMode): void {
  writePrefs({ mode })
  const url = new URL(location.href)
  url.searchParams.delete('mode')
  location.replace(url.toString())
}

export const webgl2Available = (): boolean => typeof window !== 'undefined' && 'WebGL2RenderingContext' in window

export type { QualityChoice }

export function currentQuality(): QualityChoice {
  const q = readPrefs().quality
  return q === 'low' || q === 'high' ? q : 'auto'
}

/**
 * Settings → Quality. An explicit Low or High is the visitor's decision, like `?tier=`, so it sets
 * the tier at once; Auto hands control back to the QualityController through CY_EVENT.quality.
 */
export function setQuality(choice: QualityChoice): void {
  writePrefs({ quality: choice })
  if (choice !== 'auto') journey.setState({ tier: choice satisfies Tier })
  emit(CY_EVENT.quality, choice)
}

export function setSound(on: boolean): void {
  writePrefs({ sound: on })
  journey.setState({ soundOn: on })
}
