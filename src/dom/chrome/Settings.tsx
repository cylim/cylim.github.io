import { useEffect, useId, useRef, useState } from 'react'
import { useJourney } from '../../core/store/journey'
import { ui } from '../../content/ui'
import { CloseIcon } from '../icons'
import { currentQuality, setQuality, switchMode, webgl2Available, type QualityChoice } from '../mode'
import { usePendingToastAction } from '../toast'
import { SoundButton } from './SoundButton'

const QUALITIES: readonly QualityChoice[] = ['auto', 'low', 'high']

/**
 * Settings (design.md §4.1, §4.2): Quality (Auto, Low, High), "Still version", and Sound on phones.
 * A popover above the cluster on desktop, a bottom sheet on phones. Its own chunk: nobody needs it
 * on the first screen.
 */
export default function Settings({ id, onClose }: { id: string; onClose: (restoreFocus: boolean) => void }) {
  const mode = useJourney((s) => s.mode)
  // After a lost WebGL context the restart stays here once its toast is gone (design.md §13.3).
  const lost = useJourney((s) => s.stage === 'lost')
  const restart = usePendingToastAction()
  const [quality, setQ] = useState<QualityChoice>(currentQuality)
  const ref = useRef<HTMLDivElement>(null)
  const name = useId()

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input:checked, button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true)
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (!ref.current?.contains(t) && !t.closest('.settings-toggle')) onClose(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  return (
    <div ref={ref} id={id} className="settings" role="dialog" aria-label={ui.settings}>
      <button type="button" className="settings-close" aria-label={ui.closeSettings} onClick={() => onClose(true)}>
        <CloseIcon />
      </button>
      {mode === 'immersive' && (
        <>
          <div className="settings-row settings-sound">
            <span className="settings-label" aria-hidden="true">
              {ui.sound}
            </span>
            <SoundButton className="sound-toggle" />
          </div>
          <fieldset className="settings-quality">
            <legend className="settings-label">{ui.quality}</legend>
            {QUALITIES.map((q) => (
              <label key={q}>
                <input
                  type="radio"
                  name={name}
                  value={q}
                  checked={quality === q}
                  onChange={() => {
                    setQ(q)
                    setQuality(q)
                  }}
                />
                <span>{ui.qualityOptions[q]}</span>
              </label>
            ))}
          </fieldset>
          {lost && restart && (
            <button
              type="button"
              className="settings-mode"
              onClick={() => {
                restart.run()
                onClose(true)
              }}
            >
              {restart.message}
            </button>
          )}
          <button type="button" className="settings-mode" onClick={() => switchMode('static')}>
            {ui.switchToStill}
          </button>
        </>
      )}
      {mode === 'static' && webgl2Available() && (
        <button type="button" className="settings-mode" onClick={() => switchMode('immersive')}>
          {ui.switchToForest}
        </button>
      )}
    </div>
  )
}
