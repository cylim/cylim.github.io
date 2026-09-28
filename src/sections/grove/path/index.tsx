import { Bamboo } from './Bamboo'
import { MistWall } from './MistWall'
import { StandingStones, SteppingStones } from './Stones'
import { Stream } from './Stream'

/**
 * The path from the cabin's moon gate to the grove, 572–645 jvh (design.md §8.5, §11.2).
 * Mounted by the grove Scene; everything is placed in world coordinates from layout.pathZone.
 *
 * - P0: the camera comes out of paper behind the cabin and never looks back (camera rows only).
 * - P1: the stream at z −85 drawn as painters draw water, five stepping stones, the bamboo clump.
 * - P2: the mist wall. Paper sheets turn near trees into ghosts; if the grove is not ready the fog
 *   holds at its peak through postFx.fogBoost (released on unmount or when hidden).
 * - P3: the mist parts; two curtains rise past the crest, and the standing stones mark the entrance.
 *
 * Draw calls: ripples, two stone groups and the bamboo are one each; veils show only while ahead
 * of the camera and within 18 m (13 m on low), so at most four at a time.
 */
export function GrovePath() {
  return (
    <group name="grove-path">
      <Stream />
      <SteppingStones />
      <Bamboo />
      <MistWall />
      <StandingStones />
    </group>
  )
}
