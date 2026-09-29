import { useJourney } from '../../core/store/journey'
import { ui } from '../../content/ui'
import { SoundIcon } from '../icons'
import { setSound } from '../mode'

/** The sound toggle (design.md §4.1): a guqin string, flat when off, a slow sine when on. */
export function SoundButton({ className }: { className: string }) {
  const soundOn = useJourney((s) => s.soundOn)
  return (
    <button type="button" className={className} aria-pressed={soundOn} aria-label={ui.sound} onClick={() => setSound(!soundOn)}>
      <SoundIcon />
    </button>
  )
}
