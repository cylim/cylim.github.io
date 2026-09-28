import { useEffect, useMemo } from 'react'
import { Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { TIERS } from '../../core/render/quality'
import { useJourney, type Tier } from '../../core/store/journey'
import { inDynamicKeepOut, subscribeKeepOuts } from '../keepOuts'
import { createInkMaterial, type InkMaterial } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { forestPlan, PINE_VARIANTS, variantPrefixCount, type PineInstance, type PineVariant } from './forest'
import { buildPine, FIELD_SPECS } from './pineGeometry'

/** Portrait screens halve the near layer so trunks don't cross the bottom card (design §8.2 mobile). */
const NEAR_LAYER = 8

interface VariantMesh {
  mesh: InstancedMesh
  list: PineInstance[]
  variant: PineVariant
  far: boolean
}

const m = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const pos = new Vector3()
const scl = new Vector3()
const ZERO = new Matrix4().makeScale(0, 0, 0)

/**
 * The instanced forest: one InstancedMesh per variant and LOD (8 draw calls), all sharing one ink
 * material. Tiers take a prefix of the plan's draw order through `mesh.count`; hidden instances
 * (runtime keep-outs, the portrait near layer) get a zero matrix, so nothing is ever rebuilt.
 */
class PineForest {
  readonly material: InkMaterial = envMaterial(createInkMaterial({ name: 'pine', inkWeight: 1, sway: true, ragged: true, needles: true }))
  readonly pines = forestPlan().pines
  readonly parts: VariantMesh[] = PINE_VARIANTS.flatMap((variant) =>
    [false, true].map((far) => {
      const list = this.pines.filter((p) => p.variant === variant && p.far === far)
      const geo = buildPine(FIELD_SPECS[variant] ?? FIELD_SPECS[0]!, far ? 'far' : 'field')
      geo.setAttribute('iInk', new InstancedBufferAttribute(Float32Array.from(list, (p) => p.ink), 1))
      geo.setAttribute('iSeed', new InstancedBufferAttribute(Float32Array.from(list, (p) => p.seed), 1))
      const mesh = new InstancedMesh(geo, this.material, Math.max(list.length, 1))
      mesh.name = `pines-${variant}${far ? '-far' : ''}`
      // One mesh spans the whole walk, so its bounds are always in view; skip the per-frame test.
      mesh.frustumCulled = false
      return { mesh, list, variant, far }
    }),
  )

  setTier(tier: Tier) {
    const n = TIERS[tier].pines
    for (const p of this.parts) p.mesh.count = variantPrefixCount(this.pines, p.variant, n, p.far)
  }

  applyMask(portrait: boolean) {
    for (const part of this.parts) {
      part.list.forEach((p, i) => {
        const hidden = inDynamicKeepOut(p.x, p.z, 1) || (portrait && p.dWalk < NEAR_LAYER && i % 2 === 1)
        if (hidden) {
          part.mesh.setMatrixAt(i, ZERO)
          return
        }
        e.set(p.tiltX, p.yaw, p.tiltZ)
        q.setFromEuler(e)
        part.mesh.setMatrixAt(i, m.compose(pos.set(p.x, p.y, p.z), q, scl.setScalar(p.scale)))
      })
      part.mesh.instanceMatrix.needsUpdate = true
    }
  }

  dispose() {
    for (const p of this.parts) p.mesh.geometry.dispose()
    this.material.dispose()
  }
}

/** The pine field (design §7.2): Poisson-scattered painted pines along the walk. */
export function PineField() {
  const tier = useJourney((s) => s.tier)
  const portrait = useJourney((s) => s.portrait)
  const forest = useMemo(() => new PineForest(), [])

  useEffect(() => {
    forest.applyMask(portrait)
    return subscribeKeepOuts(() => forest.applyMask(portrait))
  }, [forest, portrait])
  useEffect(() => forest.setTier(tier), [forest, tier])
  useEffect(() => () => forest.dispose(), [forest])

  return (
    <group name="pine-field">
      {forest.parts.map((p) => (
        <primitive key={p.mesh.name} object={p.mesh} />
      ))}
    </group>
  )
}
