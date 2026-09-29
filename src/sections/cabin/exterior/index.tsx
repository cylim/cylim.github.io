import { Mask } from '@react-three/drei/core/Mask'
import { useCursor } from '@react-three/drei/web/useCursor'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'
import { wake } from '../../../core/render'
import { scrollToJvh } from '../../../core/scroll'
import { journey, useJourney } from '../../../core/store/journey'
import { MARKS } from '../../../core/world/journey'
import { cabin } from '../../../core/world/layout'
import { useKeepOut } from '../../../env'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { PORTAL_ID } from '../shared/portal'
import { doorInteractive } from './door'
import { CabinShell, LEAK } from './shell'

const { door, latticeWindow } = cabin

/**
 * The yard behind the cabin: no pine crowns in the C1 sightline over the roof, so the main peak
 * rises behind the ridge (§8.3, 高远). The close trunks are env's hero trunks and stay.
 */
const YARD = { id: 'cabin-yard', kind: 'corridor', points: [[4, -70], [0.5, -100]], halfWidth: 4.5 } as const

const canInteract = () => {
  const s = journey.getState()
  return doorInteractive(s.jvh, s.insideCabin) && s.dive.phase === 'idle'
}

/** Clicking the door or the lattice glides to just inside the door: a local scroll, not a fog-dive (§8.3). */
function enter(e: ThreeEvent<MouseEvent>) {
  if (!canInteract()) return
  e.stopPropagation()
  scrollToJvh(MARKS.doorClickTarget, { smooth: true })
}

/**
 * The cabin exterior and the door portal (design.md §8.3, §11.2, §16.1): the plank shell on stone
 * footings, the thatched 悬山 roof, the door that scroll swings open, the cyan leak and spill, the
 * chimney smoke, and the drei Mask in the door opening that the hall draws through.
 */
export function Exterior() {
  const [shell] = useState(() => new CabinShell())
  const tier = useJourney((s) => s.tier)
  const [hovered, setHovered] = useState(false)
  const mask = useRef<Mesh>(null)
  const anchor = useRef<Group>(null)
  useCursor(hovered, 'pointer', '')
  useKeepOut(YARD)

  // A hidden cabin hands back the shared spill and portal state but keeps its GPU resources warm.
  useEffect(() => () => shell.release(), [shell])
  useDisposeOnUnmount(anchor, () => [shell])
  useEffect(() => shell.setTier(tier), [shell, tier])
  useEffect(() => {
    shell.setHovered(hovered)
    wake(LEAK.ms + 100)
  }, [shell, hovered])

  useFrame(({ camera }, delta) => {
    const s = journey.getState()
    shell.frame(s, camera.position, delta, mask.current)
    // Scrolling on through the door without moving the pointer never fires pointerout.
    if (hovered && !doorInteractive(s.jvh, s.insideCabin)) setHovered(false)
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (!canInteract()) return
    e.stopPropagation()
    setHovered(true)
  }
  const out = () => setHovered(false)

  const [dx, sill, dz] = door.centre
  const [wx, wy, wz] = latticeWindow.centre
  return (
    <group ref={anchor} name="cabin-exterior-root">
      <primitive object={shell.exterior} dispose={null} />
      <Mask id={PORTAL_ID} ref={mask} position={[dx, sill + door.height / 2, dz]} material={shell.materials.mask}>
        <planeGeometry args={[door.width, door.height]} />
      </Mask>
      {/* Hit targets: the lattice bars are too thin to hover, and the door leaf moves. */}
      <mesh visible={false} position={[dx, sill + door.height / 2, dz + 0.05]} onPointerOver={over} onPointerOut={out} onClick={enter}>
        <planeGeometry args={[door.width + 0.16, door.height + 0.08]} />
      </mesh>
      <mesh visible={false} position={[wx, wy, wz + 0.05]} onPointerOver={over} onPointerOut={out} onClick={enter}>
        <planeGeometry args={[latticeWindow.size + 0.1, latticeWindow.size + 0.1]} />
      </mesh>
    </group>
  )
}
