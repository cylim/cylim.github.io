import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { use, useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { journey } from '../../core/store/journey'
import { exit, terrainHeight } from '../../core/world/layout'
import { socialById, socials, type SocialId } from '../../content/socials'
import { createInkMaterial, type InkMaterial } from '../../env'
import { useDisposeOnUnmount } from '../shared/lifetime'
import { approach } from './flame'
import { createCarvedMaterial, type CarvedMaterial } from './materials'
import { boardFaces, rowAt, rowBands, type BoardFaces } from './signpostFace'
import { buildSignpost } from './signpostGeometry'

const { base } = exit.signpost
/** Hover glow: 0 → 1 in 250 ms (design.md §8.7). */
const GLOW_RATE = 4

/** The DOM anchors are the real links: a click on a board activates the matching one. */
function activate(id: SocialId): void {
  const { href } = socialById(id)
  const anchor = document.querySelector<HTMLAnchorElement>(`#contact a[href="${CSS.escape(href)}"]`)
  if (anchor) anchor.click()
  else location.assign(href)
}

/** The signpost's meshes (three draw calls), the per-board glow and the boards' pointer handling. */
class SignpostParts {
  readonly geo = buildSignpost()
  /** Post, stones and moss: the hemp-fibre strokes run up the post as its grain. */
  readonly timber: InkMaterial = createInkMaterial({
    name: 'signpost-timber',
    inkWeight: 0.8,
    cun: 'hemp',
    cunClass: 'stone',
    cunScale: 0.06,
    cunStrength: 0.9,
    // Right beside the lantern: a faint warmth on the side it faces, never brown wood.
    lanternWarmth: 0.3,
    doubleSided: false,
  })
  /** The boards: a plain wash; their grain runs along them, so it is drawn on the face overlay. */
  readonly wood: InkMaterial = createInkMaterial({ name: 'signpost-boards', inkWeight: 0.4, lanternWarmth: 0.3, doubleSided: false })
  readonly carving: CarvedMaterial
  private readonly glow = socials.map(() => 0)
  /** The board this signpost put in `contactHover`, so leaving clears only our own hover. */
  private hovered: SocialId | null = null

  constructor(readonly face: BoardFaces) {
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

  /** GPU side, on a real unmount only (the faces are redrawn on the next mount's first use). */
  dispose(): void {
    this.release()
    const { timber, boards, faces } = this.geo
    for (const d of [timber, boards, faces, this.timber, this.wood, this.carving, this.face.texture]) d.dispose()
  }
}

/**
 * The weathered wooden signpost at the end of the path (design.md §8.7 E1): where to find me next,
 * one finger board per social link pointing off into the mist beyond the ledge.
 */
export function Signpost() {
  const face = use(boardFaces())
  const parts = useMemo(() => new SignpostParts(face), [face])
  const anchor = useRef<Group>(null)
  // A hidden section lets go of its hover; its GPU resources stay warm for the way back.
  useEffect(() => parts.release, [parts])
  useDisposeOnUnmount(anchor, () => [parts])
  useFrame((_, delta) => parts.frame(delta))

  return (
    <group ref={anchor} name="signpost" position={[base[0], terrainHeight(base[0], base[2]), base[2]]}>
      <mesh geometry={parts.geo.timber} material={parts.timber} />
      <mesh geometry={parts.geo.boards} material={parts.wood} />
      <mesh
        geometry={parts.geo.faces}
        material={parts.carving}
        renderOrder={2}
        onPointerMove={parts.onMove}
        onPointerOut={parts.release}
        onClick={parts.onClick}
      />
    </group>
  )
}
