import type { EffectComposer, Pass } from 'postprocessing'
import { BufferGeometry, Mesh, Scene, WebGLRenderTarget, type Camera, type Material, type Object3D, type WebGLRenderer } from 'three'

/**
 * Shader programs compiled before they are first drawn (QM-P3).
 *
 * three links a program on first use and then asks for its link status, which blocks the main
 * thread until the driver is done: the stage's first frame used to stall for 100–500 ms while every
 * environment and post program compiled in a row. `compileAsync` starts the same compiles and,
 * where KHR_parallel_shader_compile exists, waits for them without blocking. Stage parks R3F's loop
 * until `precompileStage` settles, so the first frame finds every program ready.
 */

const unpatched = new WeakMap<WebGLRenderer, WebGLRenderer['compile']>()

/**
 * Every frame renders into the composer's buffers, never straight to the canvas, and three keys a
 * program on the target's output colour space (linear for a render target, sRGB for the canvas).
 * A compile with no target bound would build the canvas variant and the real one would still
 * compile, blocking, on first use. So compile against an offscreen target whenever none is bound.
 * The last post pass is the exception: it does draw to the canvas (`compileToScreen`).
 */
export function compileForComposer(gl: WebGLRenderer): void {
  if (unpatched.has(gl)) return
  const target = new WebGLRenderTarget(1, 1)
  const compile = gl.compile.bind(gl)
  unpatched.set(gl, compile)
  gl.compile = (scene, camera, targetScene) => {
    if (gl.getRenderTarget() !== null) return compile(scene, camera, targetScene)
    gl.setRenderTarget(target)
    try {
      return compile(scene, camera, targetScene)
    } finally {
      gl.setRenderTarget(null)
    }
  }
}

/** compileAsync for a pass that renders to the canvas: the canvas variant of its program. */
function compileToScreen(gl: WebGLRenderer, scene: Object3D, camera: Camera): Promise<unknown> {
  const patched = gl.compile
  gl.compile = unpatched.get(gl) ?? patched
  try {
    // compileAsync calls compile synchronously, then only polls.
    return gl.compileAsync(scene, camera)
  } finally {
    gl.compile = patched
  }
}

/** A pass's own fullscreen scene and camera (postprocessing keeps them as plain fields). */
const passScene = (pass: Pass) => pass as unknown as { scene?: Object3D | null; camera?: Camera | null }

let composer: EffectComposer | null = null

/** PostStack hands its composer over as it mounts, so the stage can compile the post passes too. */
export function registerComposer(next: EffectComposer | null): void {
  composer = next
}

const effectPasses = () => composer?.passes.filter((p) => 'effects' in p).length ?? 0

const isMaterial = (v: unknown): v is Material => typeof v === 'object' && v !== null && (v as Material).isMaterial === true

/**
 * Materials effects draw with internally, outside the composer's pass list: Bloom's luminance pass
 * and its mipmap blur's down- and upsampling materials. Found by shape, one pass deep.
 */
function effectMaterials(): Set<Material> {
  const found = new Set<Material>()
  for (const pass of composer?.passes ?? []) {
    for (const effect of (pass as { effects?: unknown[] }).effects ?? []) {
      for (const v of Object.values(effect as object)) {
        if (isMaterial(v)) found.add(v)
        else if (typeof v === 'object' && v !== null && 'fullscreenMaterial' in v) {
          // fullscreenMaterial is an accessor on Pass.prototype, so Object.values misses it.
          const own = (v as { fullscreenMaterial: unknown }).fullscreenMaterial
          if (isMaterial(own)) found.add(own)
          for (const w of Object.values(v)) if (isMaterial(w)) found.add(w)
        }
      }
    }
  }
  return found
}

/** A throwaway scene with one mesh per material, so compileAsync reaches them. */
function sceneOf(materials: Iterable<Material>): Scene {
  const scene = new Scene()
  const geometry = new BufferGeometry()
  for (const m of materials) scene.add(new Mesh(geometry, m))
  return scene
}

/**
 * @react-three/postprocessing builds the composer in an effect and its EffectPasses over a few
 * renders after that. Resolves once the effect passes exist and stopped changing, or after `ms`.
 */
function postPassesSettled(ms = 1500): Promise<void> {
  return new Promise((resolve) => {
    const end = performance.now() + ms
    let last = -1
    const poll = () => {
      const n = effectPasses()
      if ((n > 0 && n === last) || performance.now() > end) return resolve()
      last = n
      setTimeout(poll, 16)
    }
    poll()
  })
}

/** Past this the first frame goes ahead anyway; a driver that never reports completion can't hold the stage. */
const LIMIT_MS = 8000

/**
 * Once `mounted` resolves (the environment's staggered mount), compiles the scene (every material,
 * visible or not) and the post passes' programs, the cabin group's included, without blocking
 * where the driver allows it. Never rejects.
 */
export async function precompileStage(gl: WebGLRenderer, scene: Object3D, camera: Camera, mounted: Promise<void> = Promise.resolve()): Promise<void> {
  await Promise.all([mounted, postPassesSettled()])
  const jobs: Promise<unknown>[] = []
  const attempt = (job: () => Promise<unknown>) => {
    try {
      jobs.push(job().catch(() => undefined))
    } catch {
      // A material that fails to compile shows up (and is reported) on first use instead.
    }
  }
  attempt(() => gl.compileAsync(scene, camera))
  for (const pass of composer?.passes ?? []) {
    const { scene: s, camera: c } = passScene(pass)
    if (!s || !c || s === scene) continue
    attempt(() => (pass.renderToScreen ? compileToScreen(gl, s, c) : gl.compileAsync(s, c)))
  }
  const extra = effectMaterials()
  if (extra.size) attempt(() => gl.compileAsync(sceneOf(extra), camera))
  let timer = 0
  const limit = new Promise<void>((resolve) => {
    timer = window.setTimeout(resolve, LIMIT_MS)
  })
  return Promise.race([Promise.all(jobs).then(() => undefined), limit]).finally(() => window.clearTimeout(timer))
}
