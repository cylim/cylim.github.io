import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, MeshBasicMaterial, RingGeometry, type Group } from 'three'
import { journey, visibleSections } from '../../core/store/journey'
import { cabin, grove } from '../../core/world/layout'
import { color } from '../../theme/tokens'
import { features } from '../../content/features'
import { createInkMaterial } from '../../env'
import { useDisposeOnUnmount } from '../shared/lifetime'
import { finaleShowing } from './finale'
import { mergeFlat } from './lanternGeometry'

/**
 * Far stand-ins for the cabin and the grove in the finale (design.md §8.7 E2–E3). SectionHost hides
 * a section once the camera is more than RIG.preloadU past its span, so by E2 neither scene draws,
 * yet the finale frame reads bottom to top: lantern, the grove's dark rings, the cabin roof with its
 * speck of cyan, the forest edge, the ridges. From 90 and 180 m these are a few dozen pixels wide,
 * so a roofed box and flat annuli carry them. Shown only while the real section is hidden. They
 * mount visible so SectionHost's prewarm compiles them (compile skips hidden objects); the first
 * frame hides them. With the grove off (content/features.ts) there is no grove stand-in: the
 * painting shows the old pines and the mist over their clearing.
 */

function cabinGeometry(): BufferGeometry {
  const { footprint: f, floorY, eavesY, ridgeY, overhang, chimney } = cabin
  const cx = (f.x0 + f.x1) / 2
  const cz = (f.zNorth + f.zSouth) / 2
  const walls = new BoxGeometry(f.x1 - f.x0, eavesY - floorY, f.zNorth - f.zSouth).translate(cx, (floorY + eavesY) / 2, cz)
  // Gables north and south, so the ridge runs north–south over x = cx.
  const slope = (ridgeY - eavesY) / ((f.x1 - f.x0) / 2)
  const ex0 = f.x0 - overhang
  const ex1 = f.x1 + overhang
  const ey = eavesY - slope * overhang
  const zn = f.zNorth + overhang
  const zs = f.zSouth - overhang
  // prettier-ignore
  const roof = new Float32Array([
    // west slope
    cx, ridgeY, zn, ex1, ey, zn, ex1, ey, zs,
    cx, ridgeY, zn, ex1, ey, zs, cx, ridgeY, zs,
    // east slope
    cx, ridgeY, zn, cx, ridgeY, zs, ex0, ey, zs,
    cx, ridgeY, zn, ex0, ey, zs, ex0, ey, zn,
    // gable ends
    f.x0, eavesY, f.zNorth, f.x1, eavesY, f.zNorth, cx, ridgeY, f.zNorth,
    f.x1, eavesY, f.zSouth, f.x0, eavesY, f.zSouth, cx, ridgeY, f.zSouth,
  ])
  const gables = new BufferGeometry()
  gables.setAttribute('position', new BufferAttribute(roof, 3))
  const stack = new BoxGeometry(0.6, chimney.topY - eavesY, 0.6).translate(chimney.base[0], (chimney.topY + eavesY) / 2, chimney.base[2])
  return mergeFlat([walls, gables, stack])
}

const flatRing = (r0: number, r1: number, y: number) =>
  new RingGeometry(r0, r1, 48, 1).rotateX(-Math.PI / 2).translate(grove.centre[0], y, grove.centre[2])

/** The dark board: the platform and the three turning rings in bluestone. */
function groveDarkGeometry(): BufferGeometry {
  const { platform, rings } = grove
  const board = new BoxGeometry(platform.size, platform.topY, platform.size).translate(platform.centre[0], platform.topY / 2, platform.centre[2])
  return mergeFlat([board, ...[rings.heaven, rings.human, rings.spirit].map((r) => flatRing(r.r0, r.r1, r.topY))])
}

/** The pale stone: the floor disc and the 24-mountain apron (R4). */
function groveStoneGeometry(): BufferGeometry {
  const { floorDisc, rings } = grove
  const disc = new CylinderGeometry(floorDisc.radius, floorDisc.radius, floorDisc.topY, 32, 1).translate(grove.centre[0], floorDisc.topY / 2, grove.centre[2])
  return mergeFlat([disc, flatRing(rings.mountains.r0, rings.mountains.r1, rings.mountains.topY)])
}

export function FinaleProxies() {
  const cabinRef = useRef<Group>(null)
  const groveRef = useRef<Group>(null)
  const parts = useMemo(
    () => ({
      cabinGeo: cabinGeometry(),
      cabinMat: createInkMaterial({ name: 'cabin-far', inkWeight: 0.9 }),
      darkGeo: groveDarkGeometry(),
      // bluestone-deep, not bluestone: 90 m of the finale's recession pales it back toward the board's own tone.
      darkMat: new MeshBasicMaterial({ color: color.bluestoneDeep }),
      stoneGeo: groveStoneGeometry(),
      stoneMat: new MeshBasicMaterial({ color: color.stone }),
    }),
    [],
  )
  useDisposeOnUnmount(cabinRef, () => Object.values(parts))

  useFrame(() => {
    const s = journey.getState()
    const on = finaleShowing(s.jvh)
    const shown = on ? visibleSections(s.u) : []
    if (cabinRef.current) cabinRef.current.visible = on && !shown.includes('cabin')
    if (groveRef.current) groveRef.current.visible = on && !shown.includes('grove')
  })

  return (
    <>
      <group ref={cabinRef} name="cabin-far">
        <mesh geometry={parts.cabinGeo} material={parts.cabinMat} />
      </group>
      {features.grove !== 'off' && (
        <group ref={groveRef} name="grove-far">
          <mesh geometry={parts.darkGeo} material={parts.darkMat} />
          <mesh geometry={parts.stoneGeo} material={parts.stoneMat} />
        </group>
      )}
    </>
  )
}
