import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { SectionSceneProps } from '../../core/sections/types'
import { terrainHeight, threshold, type Vec2 } from '../../core/world/layout'
import { buildPine, createInkMaterial, fieldBranches, registerKeepOut, type PineSpec } from '../../env'
import { useDisposeOnUnmount } from '../shared/lifetime'

interface NearTrunk {
  id: string
  /** Base on the ground (x, z), from layout.threshold.nearTrunks. */
  base: Vec2
  spec: PineSpec
}

const nearSpec = (seed: number, height: number, lean: readonly [number, number]): PineSpec => ({
  seed,
  height,
  trunkRadius: 0.36,
  lean,
  bend: 0.35,
  // Branches start above the frame: from the path only the trunk reads, the crown is in the canopy.
  branches: fieldBranches(seed, 4, 0.58, [1.4, 2.6], [1.1, 1.6]),
  crown: 1.7,
  padThickness: 0.9,
  detail: 'hero',
})

/**
 * The 焦 plane of the forest walk (design §8.2: "焦 trunks … partly out of frame"). The scatter keeps
 * every field pine 3 m off the path, so without these the nearest layer is already 浓. One trunk
 * for each copy hold, by the path on the right, so the dark mass stays out of zone L: it enters the
 * frame's right edge and slides out of it as the hold walks past, which is the depth cue. Both stay
 * clear of the paper strip and of the K0 lantern sightline.
 */
const [f1, f3] = threshold.nearTrunks
const NEAR_TRUNKS: readonly NearTrunk[] = [
  // F1 (100–142): at the right edge mid-hold, 2 m right of the camera, gone by the hold's end.
  { id: 'near-trunk-f1', base: [f1.base[0], f1.base[2]], spec: nearSpec(7401, 13, [0.35, -0.2]) },
  // F3 (175–215): past the rock, at the right edge by the end of the hold.
  { id: 'near-trunk-f3', base: [f3.base[0], f3.base[2]], spec: nearSpec(7402, 14, [-0.45, 0.25]) },
]

/** Pines of the field that would stand inside a near trunk are hidden while the scene is mounted. */
const KEEP_OUT_RADIUS = 1.2

/**
 * Threshold and forest walk (design §8.1–8.2). The shared forest is env's (hero pines A and B, the
 * rock, grass, fern and moss, the pine field, ridges and mist) and the lantern glint is the ink
 * pass's; this scene adds only the near 焦 trunks.
 */
export default function ThresholdScene(_props: SectionSceneProps) {
  const parts = useMemo(
    () => ({
      // A painted trunk keeps its lit side pale; the 焦 plane is ink almost to the edge of the brush.
      material: createInkMaterial({ name: 'near-trunk', inkWeight: 2.1, sway: true, ragged: true, needles: true, bark: true }),
      geometries: NEAR_TRUNKS.map((t) => buildPine(t.spec)),
    }),
    [],
  )
  useEffect(() => {
    const release = NEAR_TRUNKS.map((t) => registerKeepOut({ id: t.id, kind: 'circle', centre: t.base, r: KEEP_OUT_RADIUS }))
    return () => release.forEach((r) => r())
  }, [])
  const anchor = useRef<Group>(null)
  useDisposeOnUnmount(anchor, () => [...parts.geometries, parts.material])
  return (
    <group ref={anchor} name="threshold">
      {NEAR_TRUNKS.map((t, i) => (
        <mesh key={t.id} name={t.id} geometry={parts.geometries[i]} material={parts.material} position={[t.base[0], terrainHeight(t.base[0], t.base[1]), t.base[1]]} />
      ))}
    </group>
  )
}
