import { useEffect, useMemo } from 'react'
import { Matrix4, Vector3, type BufferGeometry } from 'three'
import { threshold, terrainHeight } from '../../core/world/layout'
import { createInkMaterial } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { rng } from '../random'
import { buildRock } from './rockGeometry'

const { pos, height } = threshold.rock

interface RockPart {
  geometry: BufferGeometry
  matrix: Matrix4
}

let parts: RockPart[] | null = null
/** The rock and the small stone beside it, built once and shared with the moss dots. */
function rockParts(): RockPart[] {
  if (parts) return parts
  const y = terrainHeight(pos[0], pos[2])
  const place = (x: number, z: number, yaw: number) => new Matrix4().makeRotationY(yaw).setPosition(x, y, z)
  parts = [
    { geometry: buildRock(31, [2.5, height, 1.9], 14), matrix: place(pos[0], pos[2], 0.5) },
    { geometry: buildRock(37, [0.9, 0.6, 0.8], 7), matrix: place(pos[0] + 1.5, pos[2] + 0.9, 1.9) },
  ]
  return parts
}

/** World points on the rock's upward-facing facets, where painters put moss dots (点苔). */
export function rockMossPoints(count: number, seed = 5): Vector3[] {
  const rand = rng(seed)
  const tops: Vector3[] = []
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const n = new Vector3()
  for (const part of rockParts()) {
    const p = part.geometry.getAttribute('position')
    for (let i = 0; i + 2 < p.count; i += 3) {
      a.fromBufferAttribute(p, i).applyMatrix4(part.matrix)
      b.fromBufferAttribute(p, i + 1).applyMatrix4(part.matrix)
      c.fromBufferAttribute(p, i + 2).applyMatrix4(part.matrix)
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize()
      if (Math.abs(n.y) > 0.55) tops.push(a.clone().add(b).add(c).divideScalar(3))
    }
  }
  const out: Vector3[] = []
  for (let i = 0; i < count && tops.length > 0; i++) out.push((tops[Math.floor(rand() * tops.length)] as Vector3).clone())
  return out
}

/** The axe-cut rock by the path at (2.8, 0, −30) (design §5.1, §8.2), with a small stone beside it. */
export function Rock() {
  // A hero rock: its strokes draw on every tier (design §13.3).
  const material = useMemo(() => envMaterial(createInkMaterial({ name: 'rock', inkWeight: 0.97, cun: 'axe', cunClass: 'hero', cunScale: 0.42, cunStrength: 0.9, doubleSided: false })), [])
  useEffect(() => () => material.dispose(), [material])
  return (
    <group name="rock">
      {rockParts().map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={material} matrix={p.matrix} matrixAutoUpdate={false} />
      ))}
    </group>
  )
}
