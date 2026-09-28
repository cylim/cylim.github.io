import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CustomBlending, DoubleSide, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial, SrcAlphaFactor, ZeroFactor, type Group, type Mesh } from 'three'
import { postFx, TIERS } from '../../../core/render'
import { journey } from '../../../core/store/journey'
import { terrainHeight } from '../../../core/world/layout'
import { worldUniforms } from '../../../env'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import commonGlsl from './glsl/common.glsl'
import veilGlsl from './glsl/veil.frag.glsl'
import vertGlsl from './glsl/world.vert.glsl'
import { curtainLift, mistHoldBoost, VEIL_SPAN, veilOpacity, VEILS, type Veil } from './plan'

/** How far the curtains rise as the mist parts, metres. */
const CURTAIN_RISE = 11
/** A sheet shows only while it is ahead of the camera and this close; the fog covers the rest. */
const VEIL_REACH = 18
/** Smooth times (s) of the fog hold: it closes fast and lifts like the reveal. */
const HOLD_RISE = 0.2
const HOLD_FALL = 0.6

function createVeilMaterial(v: Veil): ShaderMaterial {
  return new ShaderMaterial({
    name: 'mist-veil',
    vertexShader: vertGlsl,
    fragmentShader: `${commonGlsl}\n${veilGlsl}`,
    uniforms: { ...worldUniforms, uLift: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: v.seed } },
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
}

/**
 * Holds the fog at the wall's peak while the grove is not ready (§8.5 P2: "the mist waits for
 * you"), through `postFx.fogBoost`. It adds and removes only its own share, eased so the hold
 * closes quickly and lifts like the reveal.
 */
class FogHold {
  private boost = 0

  update(dt: number) {
    const s = journey.getState()
    const target = mistHoldBoost(s.jvh, s.fogBase, TIERS[s.tier].fogMultiplier, s.ready.grove === true)
    if (target === this.boost) return
    const k = 1 - Math.exp(-Math.min(dt, 0.25) / (target > this.boost ? HOLD_RISE : HOLD_FALL))
    const next = Math.abs(target - this.boost) < 1e-4 ? target : this.boost + (target - this.boost) * k
    postFx.fogBoost += next - this.boost
    this.boost = next
  }

  release() {
    postFx.fogBoost = Math.max(0, postFx.fogBoost - this.boost)
    this.boost = 0
  }
}

/**
 * The mist wall (design.md §8.5 P2–P3, §11.2): sheets of paper-mist across the path that the
 * camera walks through, two curtains past the crest that rise as the fog drops and the camera tilts
 * down, and the fog hold for a late grove.
 */
export function MistWall() {
  const veils = useMemo(
    () =>
      VEILS.map((spec) => ({
        spec,
        geometry: new PlaneGeometry(spec.x1 - spec.x0, spec.height, 1, 1),
        material: createVeilMaterial(spec),
        // Sunk half a metre so the feathered foot never draws a line on the rising ground.
        position: [(spec.x0 + spec.x1) / 2, terrainHeight(0, spec.z) - 0.5 + spec.height / 2, spec.z] as const,
      })),
    [],
  )
  const meshes = useRef<(Mesh | null)[]>([])
  const anchor = useRef<Group>(null)
  const hold = useMemo(() => new FogHold(), [])
  // Runs on unmount and when the grove is hidden in <Activity>: the hold never outlives the section.
  useEffect(() => () => hold.release(), [hold])
  useDisposeOnUnmount(anchor, () => veils.flatMap((v) => [v.geometry, v.material]))

  useFrame((state, dt) => {
    hold.update(dt)
    const s = journey.getState()
    const inSpan = s.jvh >= VEIL_SPAN[0] && s.jvh <= VEIL_SPAN[1]
    const lift = curtainLift(s.jvh) * CURTAIN_RISE
    const reach = s.tier === 'low' ? VEIL_REACH * 0.7 : VEIL_REACH
    const camZ = state.camera.position.z
    veils.forEach(({ spec, material }, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      const ahead = camZ - spec.z
      const opacity = inSpan ? veilOpacity(s.jvh, spec) : 0
      mesh.visible = opacity > 0.002 && ahead > -1 && ahead < reach
      if (!mesh.visible) return
      const u = material.uniforms
      if (u.uOpacity) u.uOpacity.value = opacity
      if (u.uLift) u.uLift.value = spec.curtain ? lift : 0
    })
  })

  return (
    <group ref={anchor} name="mist-wall">
      {veils.map(({ spec, geometry, material, position }, i) => (
        <mesh
          key={spec.z}
          ref={(m) => {
            meshes.current[i] = m
          }}
          name={spec.curtain ? 'mist-curtain' : 'mist-veil'}
          geometry={geometry}
          material={material}
          position={position}
          // After env's mist planes (10) and finale belts (11).
          renderOrder={12}
          visible={false}
        />
      ))}
    </group>
  )
}
