import { useEffect, useMemo } from 'react'
import { DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial } from 'three'
import { useJourney, type Tier } from '../../core/store/journey'
import fragGlsl from '../glsl/stroke.frag.glsl'
import vertGlsl from '../glsl/stroke.vert.glsl'
import { baseDefines, inkPrelude } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { worldUniforms } from '../materials/uniforms'
import { forestPlan } from '../pines/forest'
import { rockMossPoints } from '../rock/Rock'
import { planMoss, planStrokes, type Dot, type Stroke } from './placement'

/** Share of the brush marks each tier draws (the lists are shuffled, so a prefix thins evenly). */
const SHARE: Record<Tier, number> = { low: 0.45, medium: 0.75, high: 1 }

function createStrokeMaterial(dot: boolean): ShaderMaterial {
  return envMaterial(new ShaderMaterial({
    name: dot ? 'moss' : 'grass',
    vertexShader: vertGlsl,
    fragmentShader: `${inkPrelude()}\n${fragGlsl}`,
    defines: { ...baseDefines(), ...(dot ? { STROKE_DOT: '' } : {}) },
    uniforms: { ...worldUniforms },
    side: DoubleSide,
  }))
}

function buildMesh(items: readonly (Stroke | Dot)[], dot: boolean): InstancedMesh {
  const geo = dot ? new PlaneGeometry(1, 1, 1, 1).translate(0.5, 0.5, 0) : new PlaneGeometry(1, 1, 1, 4).translate(0.5, 0.5, 0)
  const shape = new Float32Array(items.length * 4)
  items.forEach((s, i) => {
    if ('height' in s) shape.set([s.height, s.width, s.bend, s.lean], i * 4)
    else shape.set([s.size, 0, 0, 0], i * 4)
  })
  geo.setAttribute('iShape', new InstancedBufferAttribute(shape, 4))
  geo.setAttribute('iInk', new InstancedBufferAttribute(Float32Array.from(items, (s) => s.ink), 1))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(Float32Array.from(items, (s) => s.seed), 1))
  const mesh = new InstancedMesh(geo, createStrokeMaterial(dot), Math.max(items.length, 1))
  const m = new Matrix4()
  items.forEach((s, i) => mesh.setMatrixAt(i, m.makeTranslation(s.x, s.y, s.z)))
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  mesh.name = dot ? 'moss-dots' : 'grass-strokes'
  return mesh
}

/** Both brush-mark meshes; a tier draws a share of each (a prefix of a shuffled list). */
class BrushMarks {
  readonly meshes: InstancedMesh[]

  constructor() {
    const strokes = planStrokes()
    const rockDots: Dot[] = rockMossPoints(22).map((p, i) => ({ x: p.x, y: p.y + 0.02, z: p.z, size: 0.07 + (i % 3) * 0.02, ink: 1, seed: i / 22 }))
    const dots = [...rockDots, ...planMoss(forestPlan().pines)]
    this.meshes = [buildMesh(strokes, false), buildMesh(dots, true)]
  }

  setTier(tier: Tier) {
    for (const mesh of this.meshes) mesh.count = Math.round(mesh.instanceMatrix.count * SHARE[tier])
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose()
      ;(mesh.material as ShaderMaterial).dispose()
    }
  }
}

/** Grass and fern strokes along the meadow and path edges, and 点苔 moss dots near trunks (design §8.1–8.2). */
export function GroundStrokes() {
  const tier = useJourney((s) => s.tier)
  const marks = useMemo(() => new BrushMarks(), [])
  useEffect(() => marks.setTier(tier), [marks, tier])
  useEffect(() => () => marks.dispose(), [marks])
  return (
    <group name="ground-strokes">
      {marks.meshes.map((mesh) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
    </group>
  )
}
