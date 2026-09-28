import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { use, useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, ExtrudeGeometry, PlaneGeometry, Shape, type BufferGeometry, type Group } from 'three'
import { journey } from '../../core/store/journey'
import { exit, terrainHeight } from '../../core/world/layout'
import { socialById, socials, type SocialId } from '../../content/socials'
import { createInkMaterial, type InkMaterial } from '../../env'
import { useDisposeOnUnmount } from '../shared/lifetime'
import { approach } from './flame'
import { mergeFlat } from './lanternGeometry'
import { createCarvedMaterial, type CarvedMaterial } from './materials'
import { FACE, carvedFace, rowAt, rowBands, type CarvedFace } from './steleFace'

const { base, width, height, depth, plinth } = exit.stele
/** Rise of the round head (圆首) above its shoulders. */
const HEAD_RISE = 0.4
const BEVEL = 0.012
/** The carving floats this far proud of the face, with a polygon offset on top. */
const FACE_LIFT = 0.003
/** Hover glow: 0 → 1 in 250 ms (design.md §8.7). */
const GLOW_RATE = 4

/**
 * The Han round-headed stele (圆首碑, design.md §8.7 E1): a 0.9 × 2.6 × 0.28 m tablet on a plain
 * 0.4 m base, no turtle, no dragons, its face to the north. The tablet's foot sits in the base.
 */
function buildSteleGeometry(): BufferGeometry {
  const w = width / 2 - BEVEL
  const shoulder = height - HEAD_RISE
  const outline = new Shape()
  outline.moveTo(-w, 0)
  outline.lineTo(w, 0)
  outline.lineTo(w, shoulder)
  outline.absellipse(0, shoulder, w, HEAD_RISE - BEVEL, 0, Math.PI, false)
  outline.lineTo(-w, 0)
  const slab = depth - 2 * BEVEL
  const tablet = new ExtrudeGeometry(outline, {
    depth: slab,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 1,
    curveSegments: 14,
  })
  tablet.translate(0, plinth, -slab / 2)
  const foot = new BoxGeometry(width + 0.4, plinth, depth + 0.34)
  foot.translate(0, plinth / 2, 0)
  return mergeFlat([tablet, foot])
}

/** The DOM anchors are the real links: a click on a carved row activates the matching one. */
function activate(id: SocialId): void {
  const { href } = socialById(id)
  const anchor = document.querySelector<HTMLAnchorElement>(`#contact a[href="${CSS.escape(href)}"]`)
  if (anchor) anchor.click()
  else location.assign(href)
}

/** The stele's meshes, the per-row glow and the carved rows' pointer handling. */
class SteleParts {
  readonly geometry = buildSteleGeometry()
  readonly plane = new PlaneGeometry(FACE.width, FACE.height)
  readonly stone: InkMaterial = createInkMaterial({
    name: 'stele',
    inkWeight: 0.5,
    cun: 'axe',
    cunClass: 'stone',
    cunScale: 0.24,
    // A dressed face: the strokes gather on the shaded flanks and barely touch the inscription.
    cunStrength: 0.3,
    doubleSided: false,
  })
  readonly carving: CarvedMaterial
  private readonly glow = socials.map(() => 0)
  /** The row this stele put in `contactHover`, so leaving clears only our own hover. */
  private hovered: SocialId | null = null

  constructor(readonly face: CarvedFace) {
    const bands = rowBands(face.layout)
    this.carving = createCarvedMaterial(face.texture, [1 / face.layout.width, 1 / face.layout.height], bands.v0, bands.v1)
  }

  frame(delta: number): void {
    const lit = journey.getState().contactHover
    const g = this.carving.uniforms.uGlow.value
    const dt = Math.min(delta, 0.1)
    socials.forEach((s, i) => {
      const v = approach(this.glow[i] ?? 0, lit === s.id ? 1 : 0, GLOW_RATE, dt)
      this.glow[i] = v
      g.setComponent(i, v)
    })
  }

  readonly onMove = (e: ThreeEvent<PointerEvent>): void => {
    const id = e.uv ? rowAt(this.face.layout, e.uv.y) : null
    if (id === this.hovered) return
    if (!id) return this.release()
    this.hovered = id
    document.body.style.cursor = 'pointer'
    journey.setState({ contactHover: id })
  }

  readonly onClick = (e: ThreeEvent<MouseEvent>): void => {
    const id = e.uv ? rowAt(this.face.layout, e.uv.y) : null
    if (!id) return
    e.stopPropagation()
    activate(id)
  }

  readonly release = (): void => {
    const mine = this.hovered
    if (!mine) return
    this.hovered = null
    document.body.style.cursor = ''
    if (journey.getState().contactHover === mine) journey.setState({ contactHover: null })
  }

  /** GPU side, on a real unmount only (the carved face is redrawn on the next mount's first use). */
  dispose(): void {
    this.release()
    for (const d of [this.geometry, this.plane, this.stone, this.carving, this.face.texture]) d.dispose()
  }
}

export function Stele() {
  const face = use(carvedFace())
  const parts = useMemo(() => new SteleParts(face), [face])
  const anchor = useRef<Group>(null)
  // A hidden section lets go of its hover; its GPU resources stay warm for the way back.
  useEffect(() => parts.release, [parts])
  useDisposeOnUnmount(anchor, () => [parts])
  useFrame((_, delta) => parts.frame(delta))

  return (
    <group ref={anchor} name="stele" position={[base[0], terrainHeight(base[0], base[2]), base[2]]}>
      <mesh geometry={parts.geometry} material={parts.stone} />
      <mesh
        geometry={parts.plane}
        material={parts.carving}
        position={[0, plinth + FACE.bottom + FACE.height / 2, depth / 2 + FACE_LIFT]}
        renderOrder={2}
        onPointerMove={parts.onMove}
        onPointerOut={parts.release}
        onClick={parts.onClick}
      />
    </group>
  )
}
