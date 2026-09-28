/**
 * The exterior's materials. Every surface is a createInkMaterial (painter's light, 皴, lantern and
 * door-spill terms); the leak, the floor spill, the smoke and the portal mask are small shaders
 * on the same world uniforms.
 */

import {
  Color,
  CustomBlending,
  DoubleSide,
  KeepStencilOp,
  NotEqualStencilFunc,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Vector3,
  ZeroFactor,
  type IUniform,
  type Material,
} from 'three'
import { cabin } from '../../../core/world/layout'
import { baseDefines, createInkMaterial, inkNoiseGlsl as noiseGlsl, inkPrelude, worldUniforms, type InkMaterial } from '../../../env'
import { color } from '../../../theme/tokens'
import { PORTAL_ID } from '../shared/portal'
import leakFrag from './glsl/leak.frag.glsl'
import maskFrag from './glsl/mask.frag.glsl'
import maskVert from './glsl/mask.vert.glsl'
import plankRim from './glsl/plankRim.glsl'
import smokeFrag from './glsl/smoke.frag.glsl'
import smokeVert from './glsl/smoke.vert.glsl'
import spillFrag from './glsl/spill.frag.glsl'
import worldVert from './glsl/world.vert.glsl'

/** Where plankRim.glsl goes into env's ink.frag.glsl. */
export const PLANK_RIM_ANCHORS = { main: 'void main() {', out: 'gl_FragColor = vec4(col, 1.0);' } as const

/**
 * Adds the leak's edge light to the plank material (see plankRim.glsl). It shares the leak's
 * uniforms, so the hover brightening reaches the lines too. If env's shader ever loses an anchor,
 * the planks simply go without the rim.
 */
function withPlankRim(wood: InkMaterial, leak: ExteriorMaterials['leak']): void {
  wood.onBeforeCompile = (shader) => {
    const { main, out } = PLANK_RIM_ANCHORS
    if (!shader.fragmentShader.includes(main) || !shader.fragmentShader.includes(out)) return
    shader.uniforms.uLeak = leak.uniforms.uLeak
    shader.uniforms.uLeakColor = leak.uniforms.uColor
    shader.fragmentShader = shader.fragmentShader
      .replace(main, `uniform float uLeak;\nuniform vec3 uLeakColor;\n${main}`)
      .replace(out, `${plankRim}\n  ${out}`)
  }
  wood.customProgramCacheKey = () => 'cabin-plank-rim'
}

/**
 * Keeps an outdoor material out of the door opening once the portal mask has written PORTAL_ID:
 * the hall draws there instead. The cabin's own back walls, roof and leak box would otherwise hide
 * it, and so would the forest behind the cabin (env excludes its own materials through
 * `setPortalExclusion`, which the shell calls on the portal edges).
 */
export function outsidePortal<M extends Material>(material: M): M {
  material.stencilWrite = true
  material.stencilRef = PORTAL_ID
  material.stencilFunc = NotEqualStencilFunc
  material.stencilFail = KeepStencilOp
  material.stencilZFail = KeepStencilOp
  material.stencilZPass = KeepStencilOp
  return material
}

export interface ExteriorMaterials {
  /** Wall planks and timber: dark ink. */
  wood: InkMaterial
  /** Door leaf, frame and iron. Not portal-masked: the open leaf is seen through the doorway. */
  door: InkMaterial
  /** Footings, steps and chimney: stone with Voronoi cracks (the 鳞皴 cells) and axe-cut 皴. */
  stone: InkMaterial
  /** Thatch slabs with dense hemp-fibre strokes. */
  thatch: InkMaterial
  /** The hanging thatch ends along the eaves and barges: the dark eave line. */
  fringe: InkMaterial
  leak: ShaderMaterial & { uniforms: { uColor: IUniform<Color>; uLeak: IUniform<number> } }
  spill: ShaderMaterial & { uniforms: { uColor: IUniform<Color>; uAmount: IUniform<number>; uDoor: IUniform<Vector3>; uClear: IUniform<number> } }
  smoke: ShaderMaterial
  mask: ShaderMaterial & { uniforms: { uFull: IUniform<number> } }
}

export function createExteriorMaterials(): ExteriorMaterials {
  const { door } = cabin
  const wood = outsidePortal(createInkMaterial({ name: 'cabin-wood', inkWeight: 1.2, doubleSided: false }))
  const doorMat = createInkMaterial({ name: 'cabin-door', inkWeight: 0.9, doubleSided: false })
  const stone = outsidePortal(
    createInkMaterial({ name: 'cabin-stone', inkWeight: 0.62, cun: 'axe', cunClass: 'stone', cunScale: 0.6, cunStrength: 0.25, bark: true, doubleSided: false }),
  )
  // Hero class: the thatch strokes are what makes the roof read as thatch, so every tier draws them.
  const thatch = outsidePortal(
    createInkMaterial({ name: 'cabin-thatch', inkWeight: 0.8, cun: 'hemp', cunClass: 'hero', cunScale: 0.09, cunStrength: 1, doubleSided: false }),
  )
  const fringe = outsidePortal(createInkMaterial({ name: 'cabin-thatch-ends', inkWeight: 1 }))

  const leak = outsidePortal(
    new ShaderMaterial({
      name: 'cabin-leak',
      vertexShader: worldVert,
      fragmentShader: leakFrag,
      uniforms: { uColor: { value: new Color(color.cyanLine) }, uLeak: { value: 1 } },
      side: DoubleSide,
    }),
  ) as ExteriorMaterials['leak']
  withPlankRim(wood, leak)

  const spill = new ShaderMaterial({
    name: 'cabin-spill',
    vertexShader: worldVert,
    fragmentShader: spillFrag,
    uniforms: {
      uColor: { value: new Color(color.cyanLine) },
      uAmount: { value: 0 },
      uDoor: { value: new Vector3(door.centre[0] - door.width / 2, door.centre[0] + door.width / 2, door.planeZ) },
      uClear: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    // Keep destination alpha: the ink pass reads alpha < 0.5 as cabin interior.
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  }) as ExteriorMaterials['spill']

  const smoke = new ShaderMaterial({
    name: 'cabin-smoke',
    vertexShader: `${noiseGlsl}\n${smokeVert}`,
    fragmentShader: `${inkPrelude()}\n${smokeFrag}`,
    defines: baseDefines(),
    uniforms: { ...worldUniforms, uHeight: { value: 5 }, uInk: { value: 0.5 } },
    side: DoubleSide,
  })

  const mask = new ShaderMaterial({
    name: 'cabin-portal-mask',
    vertexShader: maskVert,
    fragmentShader: maskFrag,
    uniforms: { uFull: { value: 0 } },
    depthTest: false,
  }) as ExteriorMaterials['mask']

  return { wood, door: doorMat, stone, thatch, fringe, leak, spill, smoke, mask }
}

export function disposeMaterials(m: ExteriorMaterials): void {
  for (const mat of Object.values(m)) mat.dispose()
}
