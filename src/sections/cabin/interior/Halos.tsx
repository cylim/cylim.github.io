import { useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type Group, Mesh, Vector3 } from 'three'
import { TIERS } from '../../../core/render'
import type { Tier } from '../../../core/store/journey'
import { hall } from '../../../core/world/layout'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { pickTwin, usePortalTwins } from '../shared/portal'
import { BRACKET_HEIGHT, POST_TOP } from './frame'
import { IGNITE_FULL_S } from './hallUniforms'
import { haloMaterial } from './materials'

interface Halo {
  at: Vector3
  size: number
  gain: number
  arrive: number
}

/** Where bloom would have caught: bracket sets, each scroll's mount and hanging rod, the moon gate. */
function halos(): Halo[] {
  const out: Halo[] = []
  for (const z of hall.postPairs.z) {
    for (const x of hall.postPairs.x) out.push({ at: new Vector3(x, POST_TOP + BRACKET_HEIGHT / 2, z), size: 0.8, gain: 1, arrive: IGNITE_FULL_S - 0.3 })
  }
  for (const s of hall.scrolls) {
    const [x, y, z] = s.centre
    out.push({ at: new Vector3(x, y, z), size: 1.2, gain: 0.3, arrive: -1 })
    out.push({ at: new Vector3(x, y + hall.scrollSize.height / 2 + 0.55, z), size: 0.45, gain: 0.8, arrive: -1 })
  }
  const [gx, gy, gz] = hall.moonGate.centre
  out.push({ at: new Vector3(gx, gy, gz + 0.2), size: hall.moonGate.radius * 1.8, gain: 0.45, arrive: -1 })
  return out
}

function haloGeometry(list: readonly Halo[]): BufferGeometry {
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1]
  const position: number[] = []
  const centre: number[] = []
  const size: number[] = []
  const gain: number[] = []
  const arrive: number[] = []
  const index: number[] = []
  list.forEach((h, i) => {
    for (let c = 0; c < 4; c++) {
      position.push(corners[c * 2] ?? 0, corners[c * 2 + 1] ?? 0, 0)
      centre.push(h.at.x, h.at.y, h.at.z)
      size.push(h.size)
      gain.push(h.gain)
      arrive.push(h.arrive)
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(position), 3))
  g.setAttribute('aCentre', new BufferAttribute(new Float32Array(centre), 3))
  g.setAttribute('aSize', new BufferAttribute(new Float32Array(size), 1))
  g.setAttribute('aGain', new BufferAttribute(new Float32Array(gain), 1))
  g.setAttribute('aArrive', new BufferAttribute(new Float32Array(arrive), 1))
  g.setIndex(index)
  return g
}

/**
 * Low tier has no bloom, so additive halo sprites fake the glow on the brackets, the scrolls and
 * the gate (design.md §7.4, §13.3). Shown only when the tier has no bloom levels.
 */
export function Halos({ inside, tier }: { inside: boolean; tier: Tier }) {
  const mat = usePortalTwins(haloMaterial, 'additive')
  const anchor = useRef<Group>(null)
  const mesh = useMemo(() => {
    const m = new Mesh(haloGeometry(halos()), mat.outside)
    // The quads grow in the vertex shader; the raw geometry's bounds say nothing.
    m.frustumCulled = false
    return m
  }, [mat])
  useDisposeOnUnmount(anchor, () => [mesh.geometry, mat.outside, mat.inside])
  return (
    <group ref={anchor} name="hall-halos">
      <primitive object={mesh} material={pickTwin(mat, inside)} visible={TIERS[tier].bloomLevels === 0} />
    </group>
  )
}
