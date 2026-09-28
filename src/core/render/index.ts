/**
 * What env and the sections may use from core/render. Stage and mountStage stay out of this
 * barrel: they are entry points, and importing them from a scene would be a cycle.
 */
export {
  TIERS,
  BENCHMARK,
  PERF_MONITOR,
  stepTier,
  startDpr,
  dprRange,
  clampDpr,
  guessTier,
  type TierSettings,
  type DeviceHints,
  type DprRange,
} from './quality'
export { glintSlots, setGlint, resetGlints, type GlintSlot, type GlintState, type GlintPatch } from './post/glints'
export { postFx, resetPostFx, autoFlatten, POST, type PostFx, type ScissorRect } from './post/postFx'
export { markInterior, type InteriorMode } from './post/interior'
export { wake, holdAwake } from './frameGovernor'
export { shaderTime, motionTime } from './time'
