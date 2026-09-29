/**
 * The starting tier guess (stack.md §5), in its own module so the boot chunk (core/boot/mode.ts)
 * can import it without pulling in the TIERS table. quality.ts re-exports it. Owner: core-render.
 */

import type { Tier } from '../store/journey'

export interface DeviceHints {
  coarsePointer: boolean
  cores: number | undefined
  deviceMemory: number | undefined
  /** UNMASKED_RENDERER_WEBGL, if readable. */
  renderer: string | undefined
}

const WEAK_GPU = /Mali-G5\d|Adreno \(TM\) 5\d\d|Adreno 5\d\d|PowerVR|SwiftShader/i

/** stack.md §5 starting guess, before the hidden benchmark corrects it. */
export function guessTier(h: DeviceHints): Tier {
  if (h.renderer && WEAK_GPU.test(h.renderer)) return 'low'
  if (h.coarsePointer) {
    const weak = (h.cores !== undefined && h.cores <= 4) || (h.deviceMemory !== undefined && h.deviceMemory <= 3)
    return weak ? 'low' : 'medium'
  }
  return 'high'
}
