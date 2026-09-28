import { useState } from 'react'
import { CustomBlending, EqualStencilFunc, KeepStencilOp, ShaderMaterial, type Material } from 'three'
import { markInterior, type InteriorMode } from '../../../core/render'
import { useJourney } from '../../../core/store/journey'

/**
 * The cabin door portal (design.md §8.3–8.4, wave1-status §8.2–8.3).
 *
 * The exterior draws a drei `<Mask id={PORTAL_ID}>` in the door opening. Until the camera crosses
 * the door plane, every interior mesh draws with a stencil-tested twin of its material, so the
 * hall shows only through the door. Past the plane (`insideCabin`) the same meshes switch to a
 * no-stencil twin. Stencil state is not part of three's program key, so both twins share one
 * compiled program and the switch never recompiles.
 */

/** Stencil reference the exterior's door-opening Mask writes. */
export const PORTAL_ID = 1

export interface PortalTwins<T extends Material> {
  /** Draws only where the door mask wrote PORTAL_ID (drei `useMask(PORTAL_ID)` semantics). */
  outside: T
  /** Draws everywhere; used once the camera is inside. */
  inside: T
}

/** Makes `material` draw only through the door: stencil test Equal PORTAL_ID, stencil buffer untouched. */
export function portalStencil<M extends Material>(material: M): M {
  material.stencilWrite = true
  material.stencilRef = PORTAL_ID
  material.stencilFunc = EqualStencilFunc
  material.stencilFail = KeepStencilOp
  material.stencilZFail = KeepStencilOp
  material.stencilZPass = KeepStencilOp
  return material
}

/**
 * Switches one material between the two sides in place, for materials a twin can't replace:
 * troika Text derives its shader material from the one it is given and re-derives on every swap,
 * but its derived material inherits stencil state from the base through the prototype.
 */
export function setPortalStencil(material: Material, throughDoor: boolean): void {
  if (throughDoor) portalStencil(material)
  else material.stencilWrite = false
}

/**
 * Builds the twins outside React (module scope or a class). `make` runs twice. Both results get the
 * interior alpha flag: `mode` if given, otherwise whatever `make` already set with markInterior,
 * otherwise 'opaque'. ShaderMaterial twins share one `uniforms` object, so animating
 * `twins.outside.uniforms.x.value` drives both; other properties (colour, opacity) must be set on both.
 */
export function makePortalTwins<T extends Material>(make: () => T, mode?: InteriorMode): PortalTwins<T> {
  const flag = (m: T): T => (mode ? markInterior(m, mode) : m.blending === CustomBlending ? m : markInterior(m, 'opaque'))
  const outside = portalStencil(flag(make()))
  const inside = flag(make())
  if (outside instanceof ShaderMaterial && inside instanceof ShaderMaterial) inside.uniforms = outside.uniforms
  return { outside, inside }
}

/** `makePortalTwins`, built once per component instance. */
export function usePortalTwins<T extends Material>(make: () => T, mode?: InteriorMode): PortalTwins<T> {
  const [twins] = useState(() => makePortalTwins(make, mode))
  return twins
}

/** Picks the twin for the camera's side of the door. */
export const pickTwin = <T extends Material>(twins: PortalTwins<T>, inside: boolean): T => (inside ? twins.inside : twins.outside)

/** store.insideCabin, as a coarse React subscription (re-renders only when the camera crosses the door plane). */
export function useInsideCabin(): boolean {
  return useJourney((s) => s.insideCabin)
}
