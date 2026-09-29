import { Color, DoubleSide, MeshBasicMaterial, type Material } from 'three'
import { textMaterial } from '../../../core/text/configure'
import { createInkMaterial, type InkMaterial } from '../../../env'
import { color } from '../../../theme/tokens'

/**
 * Board materials. Stone is the ink world's material (painter's light, 皴 on the shaded side, the
 * lantern term); the carvings, marks and overlays are flat colours the ink pass tones. Cinnabar is
 * saturated enough that the ink pass leaves it red (§2.5: the only red on the chart).
 */
export interface BoardMaterials {
  bluestone: InkMaterial
  stone: InkMaterial
  ink: MeshBasicMaterial
  moss: MeshBasicMaterial
  paper: MeshBasicMaterial
  voidMark: MeshBasicMaterial
  faintLine: MeshBasicMaterial
  plate: MeshBasicMaterial
  seal: MeshBasicMaterial
  arc: MeshBasicMaterial
  brush: MeshBasicMaterial
  wash: MeshBasicMaterial
  needle: MeshBasicMaterial
  hit: MeshBasicMaterial
  text: { carve: MeshBasicMaterial; lit: MeshBasicMaterial; thin: MeshBasicMaterial; latin: MeshBasicMaterial }
}

const overlay = (hex: string, opacity = 1) =>
  new MeshBasicMaterial({ color: hex, transparent: true, opacity, depthWrite: false, side: DoubleSide })

export function createBoardMaterials(): BoardMaterials {
  return {
    // Grove stones draw their axe-cut strokes on every tier (design.md §13.3).
    bluestone: createInkMaterial({ name: 'grove-bluestone', inkWeight: 1, cun: 'axe', cunClass: 'hero', cunScale: 0.28, cunStrength: 0.6, doubleSided: false }),
    stone: createInkMaterial({ name: 'grove-stone', inkWeight: 0.55, cun: 'axe', cunClass: 'hero', cunScale: 0.3, cunStrength: 0.45, doubleSided: false }),
    ink: new MeshBasicMaterial({ color: color.inkJiao, side: DoubleSide }),
    moss: new MeshBasicMaterial({ color: color.inkJiao, side: DoubleSide }),
    paper: new MeshBasicMaterial({ color: color.paper, side: DoubleSide }),
    voidMark: overlay(color.inkDan),
    faintLine: overlay(color.paper, 0.35),
    plate: overlay(color.cinnabar),
    seal: overlay(color.cinnabar),
    arc: overlay(color.cinnabar),
    brush: overlay(color.paper),
    wash: new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }),
    needle: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
    hit: new MeshBasicMaterial({ visible: false }),
    text: { carve: textMaterial(color.paper), lit: textMaterial(color.paper), thin: textMaterial(color.paper), latin: textMaterial(color.paper) },
  }
}

export function disposeBoardMaterials(m: BoardMaterials): void {
  const all: Material[] = [m.bluestone, m.stone, m.ink, m.moss, m.paper, m.voidMark, m.faintLine, m.plate, m.seal, m.arc, m.brush, m.wash, m.needle, m.hit, ...Object.values(m.text)]
  for (const mat of all) mat.dispose()
}

/**
 * A member colour for a troika BatchedText. The batch packs each member's colour with
 * `Color.getHex()`, which encodes to sRGB, and its shader reads those bytes back as linear. Going
 * through sRGB → linear twice here makes the packed bytes the linear value the shader expects.
 */
export function batchColor(hex: string, out = new Color()): Color {
  return out.set(hex).convertSRGBToLinear()
}
