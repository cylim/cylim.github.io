import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CustomBlending, DoubleSide, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial, SrcAlphaFactor, Vector4, ZeroFactor, type Mesh } from 'three'
import { motionTime, TIERS } from '../../../core/render'
import { journey } from '../../../core/store/journey'
import { pathZone } from '../../../core/world/layout'
import { worldUniforms } from '../../../env'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import commonGlsl from './glsl/common.glsl'
import rippleGlsl from './glsl/ripple.frag.glsl'
import vertGlsl from './glsl/world.vert.glsl'
import { steppingStones } from './plan'

/** West, with the flow (§5.1), in metres per second of motion time. */
const FLOW_SPEED = 0.12
/** Ink amount of the ripple lines: 淡 to 重 after the ink pass, lighter than any silhouette. */
const RIPPLE_INK = 0.55
/** The ripples span this much of the stream; beyond it the fog has taken the water anyway. */
const SPAN: readonly [x0: number, x1: number] = [-38, 42]
const LANES = 4

/** The ripple plane's geometry and material, and the flow that drifts its lines. */
class Ripples {
  readonly geometry = new PlaneGeometry(SPAN[1] - SPAN[0], pathZone.stream.width + 0.2, 1, 1)
  /** centre z, half width, flow offset along +X (m), ink amount. */
  private readonly stream = new Vector4(pathZone.stream.centreZ, pathZone.stream.width / 2, 0, RIPPLE_INK)
  readonly material = new ShaderMaterial({
    name: 'stream-ripples',
    vertexShader: vertGlsl,
    fragmentShader: `${commonGlsl}\n${rippleGlsl}`,
    defines: { STONES: steppingStones().length, LANES },
    uniforms: {
      ...worldUniforms,
      uLift: { value: 0 },
      uStream: { value: this.stream },
      uStones: { value: steppingStones().map((s) => new Vector4(s.pos[0], s.pos[2], (s.size[0] + s.size[2]) / 4, 0)) },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    // Keep the destination alpha: the ink pass reads alpha < 0.5 as cabin interior (§7.3).
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  })

  /** Still water on low tier and under reduced motion; frozen with the e2e clock. */
  flow(elapsed: number) {
    const s = journey.getState()
    this.stream.z = TIERS[s.tier].streamRipples ? motionTime(elapsed, s) * FLOW_SPEED : 0
  }
}

/**
 * The stream at z −85 (design.md §8.5 P1): env's ground leaves it blank paper; this draws the few
 * ink ripple lines (水纹) on top, drifting west on medium and high tiers and still on low.
 */
export function Stream() {
  const ripples = useMemo(() => new Ripples(), [])
  const mesh = useRef<Mesh>(null)
  useDisposeOnUnmount(mesh, () => [ripples.geometry, ripples.material])
  useFrame((state) => ripples.flow(state.clock.elapsedTime))
  // The ground is flat here (y 0); a centimetre up keeps the lines clear of it at grazing angles.
  return (
    <mesh
      ref={mesh}
      name="stream-ripples"
      geometry={ripples.geometry}
      material={ripples.material}
      rotation-x={-Math.PI / 2}
      position={[(SPAN[0] + SPAN[1]) / 2, 0.012, pathZone.stream.centreZ]}
    />
  )
}
