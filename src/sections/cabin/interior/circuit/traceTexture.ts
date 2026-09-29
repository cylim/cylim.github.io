import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three'
import { TRACE_SPEC, generateTraceField } from './traceField'

/** Worker first; if workers are unavailable or the worker fails, the same generator on this thread. */
function texels(): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const fallback = () => resolve(generateTraceField(TRACE_SPEC).data)
    let worker: Worker
    try {
      worker = new Worker(new URL('./traceWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      fallback()
      return
    }
    worker.addEventListener('message', (e: MessageEvent<Uint8Array>) => {
      worker.terminate()
      resolve(e.data)
    })
    worker.addEventListener('error', () => {
      worker.terminate()
      fallback()
    })
    worker.postMessage(TRACE_SPEC, [])
  })
}

function toTexture(data: Uint8Array): DataTexture {
  const tex = new DataTexture(data, TRACE_SPEC.width, TRACE_SPEC.height, RGBAFormat, UnsignedByteType)
  tex.colorSpace = NoColorSpace
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  // The floor is seen at grazing angles; three clamps this to what the GPU supports.
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

let pending: Promise<DataTexture> | null = null

/**
 * The shared CircuitWood texture, built once per page (the cabin chunk starts it on import, so it
 * is usually ready long before the door opens). Scenes suspend on it with React's `use`.
 */
export function traceTexture(): Promise<DataTexture> {
  pending ??= texels().then(toTexture)
  return pending
}
