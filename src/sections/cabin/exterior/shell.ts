import { BoxGeometry, Group, InstancedMesh, Mesh, PlaneGeometry, type Object3D } from 'three'
import type { JourneyState, Tier } from '../../../core/store/journey'
import { cabin } from '../../../core/world/layout'
import { setDoorSpill, setPortalExclusion } from '../../../env'
import { DOOR_LEAF, doorAngle, doorClear, floorSpill, maskFullScreen, portalOn, spillAmount } from './door'
import { PORTAL_ID } from '../shared/portal'
import { buildDoorFrame, buildDoorLeaf, buildFringe, buildPlanks, buildRoof, buildSpillStrip, buildStone, buildTimber, leakBoxMatrix } from './geometry'
import { createExteriorMaterials, disposeMaterials, type ExteriorMaterials } from './materials'

/** Share of the thatch-end strokes each tier draws (the list is shuffled, so a prefix thins evenly). */
const FRINGE_SHARE: Record<Tier, number> = { low: 0.5, medium: 0.8, high: 1 }

/** The spill term on the frame, steps and ferns peaks below the floor decal: at full strength the leaf reads painted, not lit. */
const SPILL_LIGHT = 0.7

/** Hovering the door or the lattice raises the leak from 1.0 to 1.4 over 600 ms (design §8.3). */
export const LEAK = { rest: 1, hover: 1.4, ms: 600 } as const

/**
 * The cabin shell as plain three objects, built once: planks, timber, door, stone, roof, thatch
 * ends, the leak box, the floor spill and the chimney smoke. The component drives it per frame.
 */
export class CabinShell {
  readonly materials: ExteriorMaterials = createExteriorMaterials()
  /** Everything outside the door plane; hidden while the camera is inside. */
  readonly exterior = new Group()
  /** Hinge of the door leaf; rotation.y is the opening angle. */
  readonly doorPivot = new Group()
  readonly spill: Mesh
  readonly fringe: InstancedMesh
  readonly planks: InstancedMesh

  private angle = -1
  private spillLevel = -1
  private leak: number = LEAK.rest
  private leakTarget: number = LEAK.rest
  private inside = false
  private portal = false
  private full = -1

  constructor() {
    const m = this.materials
    this.exterior.name = 'cabin-exterior'
    this.planks = buildPlanks(m.wood)
    this.fringe = buildFringe(m.fringe)

    const leak = new Mesh(new BoxGeometry(1, 1, 1), m.leak)
    leak.name = 'cabin-leak'
    leak.matrixAutoUpdate = false
    leak.matrix.copy(leakBoxMatrix())

    const leaf = new Mesh(buildDoorLeaf(), m.door)
    leaf.name = 'cabin-door-leaf'
    this.doorPivot.name = 'cabin-door-hinge'
    this.doorPivot.position.set(...DOOR_LEAF.hinge)
    this.doorPivot.add(leaf)

    // Starts visible (and blank) so the section prewarm compiles it; frame() hides it while the door is shut.
    this.spill = new Mesh(buildSpillStrip(), m.spill)
    this.spill.name = 'cabin-spill'

    const smoke = new Mesh(new PlaneGeometry(1, 1, 1, 24).translate(0.5, 0.5, 0), m.smoke)
    smoke.name = 'cabin-smoke'
    smoke.position.set(cabin.chimney.base[0], cabin.chimney.topY, cabin.chimney.base[2])
    // The ribbon is displaced in the vertex shader, far outside its unit plane.
    smoke.frustumCulled = false

    this.exterior.add(
      this.planks,
      new Mesh(buildTimber(), m.wood),
      new Mesh(buildDoorFrame(), m.door),
      this.doorPivot,
      new Mesh(buildStone(), m.stone),
      new Mesh(buildRoof(), m.thatch),
      this.fringe,
      leak,
      this.spill,
      smoke,
    )
  }

  /** Door swing, spill, leak, the portal mask and the inside hide, from the store and the camera. */
  frame(s: JourneyState, camera: { x: number; y: number; z: number }, delta: number, mask: Object3D | null): void {
    const m = this.materials
    if (this.inside !== s.insideCabin) {
      this.inside = s.insideCabin
      this.exterior.visible = !this.inside
    }

    const angle = doorAngle(s.jvh)
    if (angle !== this.angle) {
      this.angle = angle
      this.doorPivot.rotation.y = angle
      const spill = spillAmount(angle)
      if (spill !== this.spillLevel) {
        this.spillLevel = spill
        setDoorSpill(spill * SPILL_LIGHT)
      }
      const floor = floorSpill(angle)
      m.spill.uniforms.uAmount.value = floor
      m.spill.uniforms.uClear.value = doorClear(angle)
      this.spill.visible = floor > 0.001
    }

    const portal = portalOn(s.jvh)
    if (portal !== this.portal) {
      this.portal = portal
      // Env keeps the forest and the mist out of the door opening while the mask is on.
      setPortalExclusion(portal ? PORTAL_ID : null)
    }
    if (mask) {
      if (mask.visible !== portal) mask.visible = portal
      const full = maskFullScreen(camera, s.insideCabin) ? 1 : 0
      if (full !== this.full) {
        this.full = full
        m.mask.uniforms.uFull.value = full
      }
    }

    if (this.leak !== this.leakTarget) {
      const step = s.reducedMotion ? Infinity : ((LEAK.hover - LEAK.rest) * delta * 1000) / LEAK.ms
      this.leak = this.leakTarget > this.leak ? Math.min(this.leakTarget, this.leak + step) : Math.max(this.leakTarget, this.leak - step)
      m.leak.uniforms.uLeak.value = this.leak
    }
  }

  setHovered(hovered: boolean): void {
    this.leakTarget = hovered ? LEAK.hover : LEAK.rest
  }

  setTier(tier: Tier): void {
    this.fringe.count = Math.round(this.fringe.instanceMatrix.count * FRINGE_SHARE[tier])
  }

  /**
   * Hands back the shared state (spill term, env portal exclusion). Runs whenever the exterior stops
   * drawing, including SectionHost's <Activity> hide; the next frame() re-applies it all.
   */
  release(): void {
    setDoorSpill(0)
    setPortalExclusion(null)
    this.angle = this.spillLevel = this.full = -1
    this.portal = false
  }

  /** Frees the GPU side, on a real unmount only (useDisposeOnUnmount): a hidden cabin stays warm. */
  dispose(): void {
    this.release()
    this.exterior.traverse((o) => {
      if (!(o instanceof Mesh)) return
      o.geometry.dispose()
      // The planks and the thatch ends: three frees an instance-matrix buffer only on the mesh's own dispose.
      if (o instanceof InstancedMesh) o.dispose()
    })
    disposeMaterials(this.materials)
  }
}
