import { generatePaperGrain } from '../core/render/textures/paperGrain'
import { planForest } from './pines/forest'
import { paintNeedleAtlas } from './pines/needleAtlas'
import type { PrepareJob, PrepareResult } from './prepare'

/**
 * The stage's procedural data, built off the main thread (QM-P3): one job per worker, so they run
 * side by side on separate cores. Texel buffers are transferred, not copied. A job this thread
 * can't do (no OffscreenCanvas for the needle atlas) answers null and the page builds it itself.
 */
const post = (result: PrepareResult, transfer: Transferable[] = []) => self.postMessage(result, { transfer })

self.addEventListener('message', (e: MessageEvent<PrepareJob>) => {
  try {
    switch (e.data) {
      case 'forest':
        return post({ job: 'forest', forest: planForest() })
      case 'needles': {
        if (typeof OffscreenCanvas === 'undefined') return post({ job: 'needles', texels: null })
        const texels = paintNeedleAtlas()
        return post({ job: 'needles', texels }, [texels.buffer])
      }
      case 'grain': {
        const texels = generatePaperGrain()
        return post({ job: 'grain', texels }, [texels.buffer])
      }
    }
  } catch {
    post(e.data === 'forest' ? { job: 'forest', forest: null } : { job: e.data, texels: null })
  }
})
