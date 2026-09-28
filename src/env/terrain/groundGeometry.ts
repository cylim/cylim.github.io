import { BufferGeometry, Float32BufferAttribute } from 'three'
import { CREST_SADDLE, sightlineAt, terrainHeight } from '../../core/world/layout'

/** Rows (z) north to south from a list of runs [from, to, step]. */
function rows(runs: readonly (readonly [from: number, to: number, step: number])[]): number[] {
  const zs: number[] = []
  for (const [from, to, step] of runs) for (let z = from; z > to + 1e-6; z -= step) zs.push(z)
  const last = runs[runs.length - 1]
  if (last) zs.push(last[1])
  return zs
}

const FAR = [-620, -420, -260, -190, -130, -90, -60, -42, -30, -21, -14, -9, -5.5, -3, -1.5]
const FAR_WEST = [2.2, 3.5, 5.5, 8.5, 13, 20, 29, 41, 58, 85, 125, 180, 260, 420, 620]

/** The crest saddle follows the lantern sightline (x ≈ 0.68): bracket it so the notch is in the mesh. */
function saddleCols(): number[] {
  const sx = sightlineAt(-120)[0]
  const { flat, edge } = CREST_SADDLE
  return [sx - edge - 0.05, sx - flat, sx - flat / 2, sx, sx + flat / 2, sx + flat, sx + edge + 0.05]
}

/** Every 3 to 5 m across the walk, so the wandering ledge (layout.ledgeWobble) is in the mesh. */
const LEDGE_COLS = [-66, -56, -48, -42, -37, -33, -29, -25, -21, -17.5, -14, -11.5, -9, -7, -5.5, -3, -1.5, 0, 1.5, 3, 5.5, 7.5, 9.5, 11.5, 14, 17, 20.5, 24, 28, 32, 36.5, 41, 46, 52, 58, 68]

/**
 * Three patches, split on rows where the ground is flat (z −95 and −130), so their seams can't
 * crack and fine columns are paid for only where the saddle and the ledge need them.
 */
const PATCHES: readonly { zs: number[]; xs: number[] }[] = [
  // The meadow and the flat forest floor: the path strip is per pixel, so the mesh can be coarse.
  { zs: rows([[320, 60, 20], [60, -95, 5]]), xs: [...FAR, 0, ...FAR_WEST] },
  // The crest and its saddle.
  { zs: rows([[-95, -130, 0.75]]), xs: [...FAR, ...saddleCols(), ...FAR_WEST] },
  // The grove floor, the ledge and the lowland beyond it.
  { zs: rows([[-130, -188, 6], [-188, -197, 0.5], [-197, -260, 9], [-260, -620, 60]]), xs: [...new Set([...FAR, ...LEDGE_COLS, ...FAR_WEST])] },
]

function patch(zs: readonly number[], xsIn: readonly number[], pos: number[], uv: number[], idx: number[]) {
  const xs = xsIn.toSorted((a, b) => a - b)
  const base = pos.length / 3
  for (const z of zs) {
    for (const x of xs) {
      pos.push(x, terrainHeight(x, z), z)
      uv.push(x, z)
    }
  }
  const w = xs.length
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = base + j * w + i
      const b = a + 1
      const c = a + w
      const d = c + 1
      // Rows run north to south (z decreasing); this winding faces up.
      idx.push(a, b, c, b, d, c)
    }
  }
}

/** The ground from the northern meadow to the lowland beyond the ledge, following `terrainHeight` exactly. */
export function buildGround(): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (const p of PATCHES) patch(p.zs, p.xs, pos, uv, idx)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
