import { AlwaysStencilFunc, KeepStencilOp, NotEqualStencilFunc, type Material } from 'three'

/**
 * Keeps the ink world out of the cabin door while the portal is on (design.md §8.3, §7.3).
 *
 * The hall behind the door is 15 to 45 m deep and overlaps the forest behind the cabin in world
 * space, and so do the mist planes. Seen through the open door, a pine or a mist plane nearer than
 * the hall's geometry would draw over it. The hall draws only where the door mask wrote the portal
 * id, so every env material does the opposite while the portal is on: stencil test NotEqual id,
 * which passes everywhere else (the stencil clears to 0 every frame). Stencil state is not part of
 * three's program key, so switching it never recompiles.
 *
 * Every material env draws goes through `envMaterial`, so one created after the portal switched on
 * (a tier change, a remount) starts with the right state. The cabin exterior switches it with
 * `setPortalExclusion` on the portal's edges and on dispose.
 */

const owned = new Set<Material>()
let portalRef: number | null = null

function apply(m: Material): void {
  if (portalRef === null) {
    m.stencilWrite = false
    m.stencilRef = 0
    m.stencilFunc = AlwaysStencilFunc
  } else {
    // stencilWrite is what turns three's stencil test on; the Keep ops leave the buffer untouched.
    m.stencilWrite = true
    m.stencilRef = portalRef
    m.stencilFunc = NotEqualStencilFunc
  }
  m.stencilFail = KeepStencilOp
  m.stencilZFail = KeepStencilOp
  m.stencilZPass = KeepStencilOp
}

/** Registers a material env draws, so it follows the portal exclusion for as long as it lives. */
export function envMaterial<M extends Material>(m: M): M {
  if (!owned.has(m)) {
    owned.add(m)
    m.addEventListener('dispose', () => owned.delete(m))
  }
  apply(m)
  return m
}

/**
 * Stencil id the cabin's door mask writes while the portal is on, or null when it is off. Every env
 * material then fails the stencil test inside the door opening, so the hall seen through it is never
 * covered by the forest or the mist. Writer: the cabin exterior.
 */
export function setPortalExclusion(ref: number | null): void {
  if (ref === portalRef) return
  portalRef = ref
  for (const m of owned) apply(m)
}

/** The id currently excluded, or null (tests and debugging). */
export const portalExclusion = (): number | null => portalRef
