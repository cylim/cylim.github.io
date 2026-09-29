/**
 * Which walk this visit is on: with the grove, or without it (content/features.ts `grove`). Ships in
 * the boot chunk and imports nothing but the switch.
 *
 * `'walk'` starts with the grove, `'off'` never has it, and `'detour'` starts without it and joins
 * the full walk once, when a dive heads for the grove (core/scroll/dive.ts, under full paper). The walk
 * tables are module-level (core/world/beats.ts, journey.ts, the registry, cards, cues and the rest):
 * each module that builds one registers a rebuild here, and `joinGroveWalk` runs them all. A module
 * imports what its tables read, so its dependencies evaluated and registered first and the rebuilds
 * run dependency-first. Chunks that load after the switch build from the new walk directly.
 *
 * There is no way back within a visit: a reload starts on the groveless walk again.
 */

import { features } from '../../content/features'

let groveOn = features.grove === 'walk'
const rebuilds: (() => void)[] = []

/** The grove is on this walk. */
export const groveOnWalk = (): boolean => groveOn

/** The grove can be reached at all: a nav item, a map pin, the terminal (features.grove isn't 'off'). */
export const groveReachable = (): boolean => features.grove !== 'off'

/** Register a module's table rebuild. Call it at module load, after building the tables once. */
export function onWalkChange(rebuild: () => void): void {
  rebuilds.push(rebuild)
}

/**
 * Detour only: put the grove on the walk and rebuild every registered table. Returns false when
 * nothing changed (already on the walk, or the grove is off). The caller moves the store, the DOM
 * and the scroll map over (core/scroll/dive.ts `joinWalk`).
 */
export function joinGroveWalk(): boolean {
  if (groveOn || features.grove !== 'detour') return false
  groveOn = true
  for (const rebuild of rebuilds) rebuild()
  return true
}
