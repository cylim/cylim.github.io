import { useEffect, useMemo } from 'react'
import { CustomBlending, DoubleSide, Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, RingGeometry, ShaderMaterial, SrcAlphaFactor, Vector2, Vector3, Vector4, ZeroFactor } from 'three'
import { TIERS } from '../../core/render/quality'
import { useJourney, type Tier } from '../../core/store/journey'
import { cabin, exit, grove, mountains } from '../../core/world/layout'
import fragGlsl from '../glsl/mist.frag.glsl'
import vertGlsl from '../glsl/mist.vert.glsl'
import { baseDefines, inkPrelude } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { worldUniforms } from '../materials/uniforms'

type Hole = readonly [x: number, z: number, clear: number, full: number]

interface MistSpec {
  name: string
  /** Camera distance over which the plane fades in (see mist.frag.glsl). */
  nearFade?: readonly [number, number]
  y: number
  opacity: number
  scale: number
  threshold: number
  rect?: readonly [x0: number, x1: number, z0: number, z1: number]
  ring?: { centre: readonly [x: number, z: number]; r0: number; r1: number; soft: number }
  holes?: readonly Hole[]
  /** Only drawn when the eye is above it: seen from below, a horizontal veil cuts every crown it crosses. */
  aboveOnly?: boolean
}

const G: Hole = [grove.centre[0], grove.centre[2], 22, 34]
const E: Hole = [exit.orbitCentre[0], exit.orbitCentre[2], 14, 26]
const C: Hole = [cabin.centre[0], cabin.centre[2], 9, 18]
const peak = mountains.mainPeak

/**
 * In tier order: TIERS.mistPlanes takes a prefix (low 2, medium 3, high 4).
 *
 * Every plane is drawn only from above. Seen from below, a horizontal veil hides everything past
 * the line where the eye ray crosses it, which draws a hard horizon through every trunk and ridge
 * (the walk's "fog curtain", and the flat ridge bands at the stele). From the walk the ink pass's
 * fog layers the forest instead; from the grove seat and the finale these planes lie over the
 * forest the way painters lay mist between crowns.
 */
const PLANES: readonly MistSpec[] = [
  // Low mist over the forest floor: from above, crowns stand out of it. Clear over the grove and at the stele.
  { name: 'mist-forest', y: 3.4, opacity: 0.7, scale: 0.035, threshold: 0.34, rect: [-70, 72, 4, -196], holes: [G, E], nearFade: [24, 60], aboveOnly: true },
  // 山腰云: the belt that cuts the ridge ring at the waist.
  { name: 'mist-ridge-waist', y: 17, opacity: 0.78, scale: 0.012, threshold: 0.3, ring: { centre: [mountains.ridgeRing.centre[0], mountains.ridgeRing.centre[2]], r0: 138, r1: 390, soft: 30 }, aboveOnly: true },
  // The main peak's base, dissolved (§5.1); from below, the peak's own shader dissolves it.
  { name: 'mist-peak', y: 38, opacity: 0.8, scale: 0.014, threshold: 0.28, rect: [peak.centre[0] - 150, peak.centre[0] + 150, peak.centre[2] + 48, peak.centre[2] - 60], aboveOnly: true },
  // A higher layer through the canopy; clear over the grove and the cabin roof for the finale view.
  { name: 'mist-canopy', y: 9.5, opacity: 0.45, scale: 0.028, threshold: 0.45, rect: [-60, 64, 0, -196], holes: [G, C], nearFade: [20, 50], aboveOnly: true },
]

interface MistLook {
  opacity: number
  scale: number
  threshold: number
  rect: Vector4
  ring: Vector3
  ringCentre: Vector2
  holes: readonly Hole[]
  nearFade?: readonly [number, number] | undefined
  aboveOnly?: boolean | undefined
}

const holeUniform = (h: Hole | undefined) => (h ? new Vector4(h[0], h[1], h[2], h[3]) : new Vector4(0, 0, 0, 0))

function createMistMaterial(spec: MistLook): ShaderMaterial {
  return envMaterial(new ShaderMaterial({
    name: 'mist',
    vertexShader: vertGlsl,
    fragmentShader: `${inkPrelude()}\n${fragGlsl}`,
    defines: baseDefines(),
    uniforms: {
      ...worldUniforms,
      uOpacity: { value: spec.opacity },
      uScale: { value: spec.scale },
      uThreshold: { value: spec.threshold },
      uRect: { value: spec.rect },
      uRing: { value: spec.ring },
      uRingCentre: { value: spec.ringCentre },
      uHoleA: { value: holeUniform(spec.holes[0]) },
      uHoleB: { value: holeUniform(spec.holes[1]) },
      uNearFade: { value: new Vector2(...(spec.nearFade ?? [0, 1])) },
      uAboveOnly: { value: spec.aboveOnly ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    // Keep destination alpha: the ink pass reads alpha < 0.5 as cabin interior (design §7.3).
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  }))
}

function buildPlane(spec: MistSpec): Mesh {
  let mesh: Mesh
  if (spec.ring) {
    const { centre, r0, r1, soft } = spec.ring
    const geo = new RingGeometry(r0, r1, 96, 1)
    const mat = createMistMaterial({ ...spec, rect: new Vector4(), ring: new Vector3(r0, r1, soft), ringCentre: new Vector2(...centre), holes: spec.holes ?? [] })
    mesh = new Mesh(geo, mat)
    mesh.position.set(centre[0], spec.y, centre[1])
  } else {
    const [x0, x1, z0, z1] = spec.rect ?? [-1, 1, 1, -1]
    const geo = new PlaneGeometry(x1 - x0, Math.abs(z1 - z0), 1, 1)
    const rect = new Vector4(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1))
    const mat = createMistMaterial({ ...spec, rect, ring: new Vector3(), ringCentre: new Vector2(), holes: spec.holes ?? [] })
    mesh = new Mesh(geo, mat)
    mesh.position.set((x0 + x1) / 2, spec.y, (z0 + z1) / 2)
  }
  mesh.rotation.x = -Math.PI / 2
  mesh.name = spec.name
  mesh.renderOrder = 10
  mesh.frustumCulled = false
  return mesh
}

/**
 * The mist planes. Tiers show a prefix. The finale's belts (§8.7 E2) are the ink pass's, not planes:
 * core/render/post draws them from layout.exit.mistBelts.
 */
class MistLayers {
  readonly planes = PLANES.map(buildPlane)

  setTier(tier: Tier) {
    const n = TIERS[tier].mistPlanes
    this.planes.forEach((m, i) => (m.visible = i < n))
  }

  dispose() {
    for (const m of this.planes) {
      m.geometry.dispose()
      ;(m.material as ShaderMaterial).dispose()
    }
  }
}

export function Mist() {
  const tier = useJourney((s) => s.tier)
  const layers = useMemo(() => new MistLayers(), [])
  useEffect(() => layers.setTier(tier), [layers, tier])
  useEffect(() => () => layers.dispose(), [layers])
  return (
    <group name="mist">
      {layers.planes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </group>
  )
}
