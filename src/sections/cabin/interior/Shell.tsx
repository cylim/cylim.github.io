import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, type Group, Mesh, type Object3D, type PerspectiveCamera, Points, type ShaderMaterial } from 'three'
import { TIERS } from '../../../core/render'
import type { Tier } from '../../../core/store/journey'
import { hall } from '../../../core/world/layout'
import { color } from '../../../theme/tokens'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { makePortalTwins, pickTwin, type PortalTwins } from '../shared/portal'
import { pointsMaterial, shellMaterial } from './materials'
import { shellStars } from './stars'

/** Dust by tier is 0 / 300 / 800; the buffer holds the most and the draw range shows the tier's share. */
const DUST_MAX = Math.max(...Object.values(TIERS).map((t) => t.dust))

interface PointSpec {
  position: readonly number[]
  size: number
  seed: readonly number[]
}

function pointGeometry(points: readonly PointSpec[]): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(points.flatMap((p) => [...p.position])), 3))
  g.setAttribute('aSize', new BufferAttribute(new Float32Array(points.map((p) => p.size)), 1))
  g.setAttribute('aSeed', new BufferAttribute(new Float32Array(points.flatMap((p) => [...p.seed])), 4))
  g.computeBoundingSphere()
  return g
}

function dustPoints(): PointSpec[] {
  let a = 0x0d05
  const rand = () => {
    a = (Math.imul(a, 1103515245) + 12345) >>> 0
    return a / 4294967296
  }
  const f = hall.floor
  return Array.from({ length: DUST_MAX }, () => ({
    position: [f.x0 + 1 + rand() * (f.x1 - f.x0 - 2), f.y + rand() * 6.5, f.zNorth - 2 - rand() * (f.zNorth - f.zSouth - 3)],
    size: 0.012 + rand() * 0.014,
    seed: [rand(), rand(), rand(), rand()],
  }))
}

class NightShell {
  private readonly box: Mesh
  private readonly stars: Points
  private readonly dust: Points
  private readonly mats: { box: PortalTwins<ShaderMaterial>; stars: PortalTwins<ShaderMaterial>; dust: PortalTwins<ShaderMaterial> }
  private scale = 0

  constructor() {
    this.mats = {
      box: makePortalTwins(shellMaterial),
      stars: makePortalTwins(() => pointsMaterial(false, new Color(color.cyanLine).multiplyScalar(0.85)), 'additive'),
      dust: makePortalTwins(() => pointsMaterial(true, new Color(color.cyanSoft).multiplyScalar(0.55)), 'additive'),
    }
    const s = hall.nightShell
    const geo = new BoxGeometry(s.x1 - s.x0, s.y1 - s.y0, s.zNorth - s.zSouth)
    geo.translate((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.zNorth + s.zSouth) / 2)
    this.box = new Mesh(geo, this.mats.box.outside)
    this.stars = new Points(pointGeometry(shellStars()), this.mats.stars.outside)
    this.dust = new Points(pointGeometry(dustPoints()), this.mats.dust.outside)
  }

  get objects(): Object3D[] {
    return [this.box, this.stars, this.dust]
  }

  setInside(inside: boolean): void {
    this.box.material = pickTwin(this.mats.box, inside)
    this.stars.material = pickTwin(this.mats.stars, inside)
    this.dust.material = pickTwin(this.mats.dust, inside)
  }

  /** A tier change only moves the dust's draw range (design.md §13.3 runtime rules). */
  setTier(tier: Tier): void {
    const count = TIERS[tier].dust
    this.dust.geometry.setDrawRange(0, count)
    this.dust.visible = count > 0
  }

  /** Point sizes are in metres; this turns them into pixels for the current viewport and lens. */
  frame(camera: PerspectiveCamera, heightPx: number): void {
    const scale = heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360))
    if (scale === this.scale) return
    this.scale = scale
    for (const m of [this.mats.stars.outside, this.mats.dust.outside]) {
      const u = m.uniforms.uPointScale
      if (u) u.value = scale
    }
  }

  dispose(): void {
    for (const o of [this.box, this.stars, this.dust]) o.geometry.dispose()
    for (const t of Object.values(this.mats)) {
      t.outside.dispose()
      t.inside.dispose()
    }
  }
}

/**
 * The night shell (design.md §8.4): an inward box in `night` round the whole hall, so the door
 * never shows paper where the hall has no geometry, with irregular cyan points 20 m and more away.
 * Also the dust drifting up through the hall.
 */
export function Shell({ inside, tier }: { inside: boolean; tier: Tier }) {
  const anchor = useRef<Group>(null)
  const [shell] = useState(() => new NightShell())
  useDisposeOnUnmount(anchor, () => [shell])
  useLayoutEffect(() => shell.setInside(inside), [shell, inside])
  useLayoutEffect(() => shell.setTier(tier), [shell, tier])
  useFrame(({ camera, size, viewport }) => shell.frame(camera as PerspectiveCamera, size.height * viewport.dpr))
  return (
    <group ref={anchor} name="hall-shell">
      {shell.objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </group>
  )
}
