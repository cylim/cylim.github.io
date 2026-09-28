/**
 * Plank dimensions shared by the cabin's outside walls and the honest near room inside (design.md
 * §8.3 "instanced horizontal planks 0.22 m high, 6 to 10 mm gaps"; §8.4 "the same instanced plank
 * geometry as outside"). Metres.
 */
export const PLANK = {
  /** Wall plank height. */
  rowHeight: 0.22,
  /** Gap between planks and at joints: 6 to 10 mm. */
  gap: 0.008,
  gapMin: 0.006,
  gapMax: 0.01,
  wallThickness: 0.03,
  floorWidth: 0.28,
  floorThickness: 0.04,
  /** One CircuitWood texture (1024 × 256) covers this much plank: a joint pad at each end. */
  textureLength: 2.4,
  textureWidth: 0.6,
} as const
