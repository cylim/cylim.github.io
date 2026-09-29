import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, CircleGeometry, type Group, PlaneGeometry, SRGBColorSpace, type Texture, Vector2 } from 'three'
import { seals } from '../../../content'
import { hall } from '../../../core/world/layout'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { pickTwin, usePortalTwins } from '../shared/portal'
import { paneScreen } from '../terminal/paneScreen'
import { PAPER, WELL } from './frame'
import { paperMaterial, wellMaterial } from './materials'

/** The base 朱文 seal file; the desk decal rests at −0.8° (public/seals/seals.json `desk`). */
const SEAL_SRC = '/seals/lin-zhuwen.svg'
const SEAL_ANGLE_DEG = -0.8
const SEAL_SIDE = 0.045

let seal: Promise<Texture> | null = null

/** The seal SVG rasterised once into a texture; its alpha is the carved coverage. */
export function sealTexture(): Promise<Texture> {
  seal ??= new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    if (!seals.lin.enabled) {
      resolve(texture)
      return
    }
    const img = new Image()
    img.decoding = 'async'
    img.addEventListener('load', () => {
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      texture.needsUpdate = true
      resolve(texture)
    })
    img.addEventListener('error', () => resolve(texture))
    img.src = SEAL_SRC
  })
  return seal
}

/**
 * The desk's two surfaces (its line work is in Timber): one sheet of paper, the only
 * paper-coloured surface in the room, with the 朱文 林 seal in its lower left corner (cinnabar is
 * the only red inside); and the inkstone's well, faintly mirroring the terminal.
 */
export function Desk({ inside, sealMap }: { inside: boolean; sealMap: Texture }) {
  const screen = paneScreen()
  const paper = usePortalTwins(() =>
    paperMaterial(sealMap, {
      sheet: PAPER.size.clone(),
      sealCentre: new Vector2(0.2, 0.14),
      sealSize: SEAL_SIDE,
      sealRotDeg: SEAL_ANGLE_DEG,
    }),
  )
  const well = usePortalTwins(() => wellMaterial(screen.texture))
  const anchor = useRef<Group>(null)
  const geo = useMemo(() => ({ sheet: new PlaneGeometry(PAPER.size.x, PAPER.size.y), well: new CircleGeometry(1, 32) }), [])
  useDisposeOnUnmount(anchor, () => [geo.sheet, geo.well, paper.outside, paper.inside, well.outside, well.inside])

  useEffect(() => {
    screen.retain()
    return () => screen.release()
  }, [screen])

  const [x, y, z] = hall.desk.pos
  return (
    <group ref={anchor} name="hall-desk" position={[x, y, z]}>
      <mesh
        geometry={geo.sheet}
        material={pickTwin(paper, inside)}
        position={PAPER.centre}
        rotation={[-Math.PI / 2, 0, (PAPER.yawDeg * Math.PI) / 180]}
      />
      <mesh
        geometry={geo.well}
        material={pickTwin(well, inside)}
        position={WELL.centre}
        rotation-x={-Math.PI / 2}
        scale={[WELL.rx, WELL.rz, 1]}
      />
    </group>
  )
}
