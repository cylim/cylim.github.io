import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, ShaderMaterial, Vector3, Vector4, type Mesh } from 'three'
import { TIERS } from '../../core/render/quality'
import { useJourney } from '../../core/store/journey'
import fragGlsl from '../glsl/mountain.frag.glsl'
import vertGlsl from '../glsl/mountain.vert.glsl'
import { baseDefines, inkPrelude } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { worldUniforms } from '../materials/uniforms'
import { mountains } from '../../core/world/layout'
import { buildCabinPeak, buildMainPeak, buildRing, RING_LAYERS } from './mountainGeometry'

interface MountainLook {
  tone: number
  seed: number
  fade: number
  /** Axe-cut strokes on the shaded flanks, or over the whole face ('all', Fan Kuan's dense texture). */
  axe: boolean | 'all'
  miDots: boolean
  strokeScale: number
  /** Camera distance (m) over which the card pales, and by how much (0 = never). */
  farFade?: readonly [number, number, number]
  /** Leave holes where the wash has faded to paper (a card with ends, over the ring behind it). */
  cutFoot?: boolean
  /** A belt of cloud across the card: centre y and half height, metres. */
  belt?: readonly [number, number]
  /** Camera z over which the card condenses and dissolves again (see mountain.frag.glsl uGate). */
  gate?: readonly [number, number, number, number]
}

function createMountainMaterial(look: MountainLook): ShaderMaterial {
  return envMaterial(new ShaderMaterial({
    name: 'mountain',
    vertexShader: vertGlsl,
    fragmentShader: `${inkPrelude()}\n${fragGlsl}`,
    defines: baseDefines(),
    uniforms: {
      ...worldUniforms,
      uLayerTone: { value: look.tone },
      uSeed: { value: look.seed },
      uFade: { value: look.fade },
      uAxe: { value: look.axe === 'all' ? 2 : look.axe ? 1 : 0 },
      uMiDots: { value: look.miDots ? 1 : 0 },
      uStrokeScale: { value: look.strokeScale },
      uFarFade: { value: new Vector3(...(look.farFade ?? [0, 1, 0])) },
      uCutFoot: { value: look.cutFoot ? 1 : 0 },
      uBelt: { value: new Vector3(look.belt?.[0] ?? 0, look.belt?.[1] ?? 1, look.belt ? 1 : 0) },
      uGate: { value: new Vector4(...(look.gate ?? [0, 0, 0, 0])) },
    },
    side: DoubleSide,
  }))
}

/**
 * The ridge ring on every side (r 160, 230, 320 around (0, 0, −90), further out in the south; tier
 * shows 1, 2 or 3 layers), the main peak card (design §5.1, §7.2) and the cabin's peak (§8.3 C1),
 * which only the cabin approach sees. Opaque, so the ink pass fogs them by real depth.
 */
export function Mountains() {
  const tier = useJourney((s) => s.tier)
  const parts = useMemo(() => {
    const rings = RING_LAYERS.map((layer, i) => ({
      geometry: buildRing(layer),
      material: createMountainMaterial({ tone: layer.tone, seed: layer.seed, fade: 0.75, axe: false, miDots: i > 0, strokeScale: 5 }),
    }))
    const peak = {
      geometry: buildMainPeak(),
      material: createMountainMaterial({ tone: 0.08, seed: 41, fade: 0.62, axe: true, miDots: false, strokeScale: 3.2, farFade: [300, 360, 0.6], cutFoot: true }),
    }
    const { belt, gate } = mountains.cabinPeak
    const cabinPeak = {
      geometry: buildCabinPeak(),
      material: createMountainMaterial({ tone: -0.45, seed: 53, fade: 0.85, axe: 'all', miDots: false, strokeScale: 3.0, cutFoot: true, belt, gate }),
    }
    return { rings, peak, cabinPeak }
  }, [])
  useEffect(
    () => () => {
      for (const p of [...parts.rings, parts.peak, parts.cabinPeak]) {
        p.geometry.dispose()
        p.material.dispose()
      }
    },
    [parts],
  )
  // The cabin's peak costs a draw call only on its own stretch of the walk.
  const cabinPeak = useRef<Mesh>(null)
  useFrame(({ camera }) => {
    const m = cabinPeak.current
    const [zIn, , , zOut] = mountains.cabinPeak.gate
    const on = camera.position.z < zIn + 1 && camera.position.z > zOut - 1
    if (m && m.visible !== on) m.visible = on
  })
  const layers = TIERS[tier].ridgeLayers
  return (
    <group name="mountains">
      {parts.rings.map((r, i) => (
        <mesh key={i} name={`ridge-${i}`} geometry={r.geometry} material={r.material} visible={i < layers} frustumCulled={false} />
      ))}
      <mesh name="main-peak" geometry={parts.peak.geometry} material={parts.peak.material} />
      <mesh ref={cabinPeak} name="cabin-peak" geometry={parts.cabinPeak.geometry} material={parts.cabinPeak.material} />
    </group>
  )
}
