/**
 * The ink world (owner: env). Stage mounts <Environment/>; sections may use the rest.
 * Everything here is read-only for sections except the setters and the keep-out hooks.
 */

export { Environment } from './Environment'

// Materials: build ink props with the same light, strokes, lantern and spill as the forest.
export { createInkMaterial, type CunClass, type InkMaterial, type InkMaterialOptions, type InkMaterialUniforms } from './materials/createInkMaterial'
export { useInkMaterial } from './materials/useInkMaterial'
export { setDoorSpill, setLanternIntensity, worldUniforms, type WorldUniforms } from './materials/uniforms'
// Building blocks for a section's own ink-world shader (smoke, spill): the shared uniforms and
// helpers every ink fragment starts with, their defines, and the noise functions.
export { baseDefines, inkPrelude } from './materials/createInkMaterial'
export { default as inkNoiseGlsl } from './glsl/noise.glsl'

// The cabin door portal: env materials fail the stencil test inside the door while it is on.
export { setPortalExclusion } from './materials/portal'

// Keep pines out of a spot a section adds at runtime.
export { registerKeepOut, useKeepOut } from './keepOuts'

// Paths: the sampled splines the ground paints as 留白, and their centre by z.
export { PATH_CURVES, PATH_HALF_WIDTH, pathCentreX, sampleCentripetal, WALK_LINE } from './paths'

// Seeded random for placement that must match across reloads.
export { rng } from './random'

// Geometry builders a section may reuse (stepping stones, standing stones, a stray pine).
export { buildRock } from './rock/rockGeometry'
export { buildPine, fieldBranches, FIELD_SPECS, type BranchSpec, type PineDetail, type PineSpec } from './pines/pineGeometry'
