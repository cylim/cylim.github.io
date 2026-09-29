import { Suspense, lazy, useCallback, useId, useRef, useState } from 'react'
import { useJourney } from '../../core/store/journey'
import { ui } from '../../content/ui'
import { MoreIcon } from '../icons'
import { webgl2Available } from '../mode'
import { useHydrated } from '../hooks'
import { SoundButton } from './SoundButton'

const loadSettings = () => import('./Settings')
const Settings = lazy(loadSettings)
const prefetch = () => void loadSettings()

/**
 * Bottom-right cluster (design.md §4.1): sound and settings, 44 px each. On phones the settings
 * button moves top-right and its panel becomes a bottom sheet holding Sound too (§4.2).
 * Sound is hidden in the album, where ambience over a still page feels like a bug (§12).
 * The panel is its own chunk, fetched on intent (hover, focus or press) so it opens at once.
 */
export function Cluster() {
  const hydrated = useHydrated()
  const mode = useJourney((s) => s.mode)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) button.current?.focus()
  }, [])

  return (
    <div className="cluster">
      <SoundButton className="sound-toggle cluster-sound" />
      <button
        ref={button}
        type="button"
        className="settings-toggle"
        hidden={hydrated && mode === 'static' && !webgl2Available()}
        aria-label={ui.settings}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onPointerEnter={prefetch}
        onPointerDown={prefetch}
        onFocus={prefetch}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreIcon />
      </button>
      {hydrated && open && (
        <Suspense fallback={null}>
          <Settings id={panelId} onClose={close} />
        </Suspense>
      )}
    </div>
  )
}
