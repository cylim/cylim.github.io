import { LostStill } from '../album/LostStill'
import { Finale } from '../finale/Finale'
import { Inscriptions } from './Inscriptions'
import { TitleCard } from './TitleCard'

/**
 * Chrome only the walk uses (design.md §4.1, §4.3, §8.7, §13.3): section inscriptions, the fog-dive
 * title card, the finale's mounts and map pins, and the still that replaces a lost canvas. None of
 * it is on the first screen and none of it means anything in the album, so it loads after hydration,
 * in immersive mode only, as its own chunk.
 */
export default function WalkChrome() {
  return (
    <>
      <LostStill />
      <Inscriptions />
      <Finale />
      <TitleCard />
    </>
  )
}
