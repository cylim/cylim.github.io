import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { PlaneGeometry, Vector3, type BufferGeometry, type Camera, type Group } from 'three'
import { motionTime } from '../../core/render'
import { journey } from '../../core/store/journey'
import { exit, glints, terrainHeight } from '../../core/world/layout'
import { alpha } from '../../theme/tokens'
import { createInkMaterial, setLanternIntensity, type InkMaterial } from '../../env'
import { useDisposeOnUnmount } from '../shared/lifetime'
import { approach, flameHeight, flameLevel } from './flame'
import { buildLanternGeometry } from './lanternGeometry'
import { createFlameMaterial, createPoolMaterial, type FlameMaterial, type PoolMaterial } from './materials'

const { base, flame } = exit.lantern
const GROUND = terrainHeight(base[0], base[2])
const FLAME_SIZE = [0.12, 0.16] as const
const POOL_RADIUS = 2.6
/** How far the flame's tip bends toward the stele at full hover lean, metres. */
const LEAN = 0.035
/** The warm term rises this much with the lean: the row seems to draw the light. */
const LEAN_WARMTH = 0.1
/** Hover lean: 0 → 1 in 250 ms, like the carved row's glow. */
const LEAN_RATE = 4
/** The post glint (slot 0) fades in from this camera distance to +5 m; the flame fades out across it. */
const HANDOVER = glints.lanternMinDistance

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** The lantern's meshes and materials, and the per-frame breath, flicker and lean. */
class LanternParts {
  readonly stoneGeo: BufferGeometry = buildLanternGeometry()
  readonly stone: InkMaterial = createInkMaterial({ name: 'lantern', inkWeight: 0.6, cun: 'axe', cunClass: 'stone', cunScale: 0.1, cunStrength: 0.45 })
  readonly flame: FlameMaterial = createFlameMaterial(flame, FLAME_SIZE)
  readonly flameGeo = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0)
  readonly pool: PoolMaterial = createPoolMaterial()
  readonly poolGeo = new PlaneGeometry(POOL_RADIUS * 2, POOL_RADIUS * 2).rotateX(-Math.PI / 2)
  /** Toward the stele, in the ground plane. */
  private readonly leanDir = new Vector3(exit.stele.base[0] - flame[0], 0, exit.stele.base[2] - flame[2]).normalize()
  private lean = 0

  frame(elapsed: number, delta: number, camera: Camera): void {
    const s = journey.getState()
    const t = motionTime(elapsed, s)
    const still = s.reducedMotion
    this.lean = approach(this.lean, s.contactHover ? 1 : 0, LEAN_RATE, Math.min(delta, 0.1))
    const level = flameLevel(t, still)
    const u = this.flame.uniforms
    u.uLevel.value = level
    u.uTime.value = t
    u.uSize.value.y = FLAME_SIZE[1] * flameHeight(t, still)
    u.uLean.value.copy(this.leanDir).multiplyScalar(LEAN * this.lean)
    u.uAlpha.value = 1 - smooth(HANDOVER, HANDOVER + 5, camera.position.distanceTo(u.uCentre.value))
    this.pool.uniforms.uOpacity.value = alpha.lanternPool * level
    setLanternIntensity(level * (1 + LEAN_WARMTH * this.lean))
  }

  dispose(): void {
    for (const d of [this.stoneGeo, this.stone, this.flame, this.flameGeo, this.pool, this.poolGeo]) d.dispose()
  }
}

/**
 * The stone lantern at the exit (design.md §8.7 E0–E1): the only warm light in the ink world. The
 * stone uses the shared ink material, so the flame's warm term lights its chamber and the soffit of
 * its eave. The flame is a billboard; the ground pool is a stain; nothing is a three.js light.
 *
 * Every frame the flame breathes (3 to 5 s) and flickers (0.92 to 1.0), and the shared warm term
 * follows it through setLanternIntensity, so the E0 trunks and the stele breathe with it. A hovered
 * contact row leans the flame toward the stele.
 */
export function Lantern() {
  const parts = useMemo(() => new LanternParts(), [])
  const anchor = useRef<Group>(null)
  // Hidden or gone, the lantern stops breathing: hand the shared warm term back at full strength.
  useEffect(() => () => setLanternIntensity(1), [])
  useDisposeOnUnmount(anchor, () => [parts])
  useFrame((state, delta) => parts.frame(state.clock.elapsedTime, delta, state.camera))

  return (
    <group ref={anchor} name="lantern">
      <mesh geometry={parts.stoneGeo} material={parts.stone} position={[base[0], GROUND, base[2]]} />
      {/* The billboard's vertices are placed in the shader, so its bounds mean nothing. */}
      <mesh geometry={parts.flameGeo} material={parts.flame} frustumCulled={false} renderOrder={3} />
      <mesh geometry={parts.poolGeo} material={parts.pool} position={[base[0], GROUND + 0.02, base[2]]} renderOrder={1} />
    </group>
  )
}
