import { ui, type AlbumReason } from '../../content/ui'
import { switchMode } from '../mode'

const REASONS = Object.keys(ui.albumReasons) as AlbumReason[]

/**
 * Album banner (design.md §14.1): why this is the still version, and "Walk the forest" when the
 * browser can draw it. Prerendered with every reason's line, and CSS shows the one index.html's head
 * script wrote to `<html data-static-reason>` (chrome.css), so the banner is in the first paint and
 * nothing shifts when the page hydrates (QM-P4: it used to mount after hydration and push the album
 * down, CLS 0.23 on phones). Without a reason (no JS, or the walk) it stays hidden. The button is hidden
 * for the reasons that mean there is no WebGL2 to walk with.
 */
export function AlbumBanner() {
  return (
    <aside className="album-banner" aria-label={ui.switchToStill}>
      {REASONS.map((r) => (
        <p key={r} data-reason={r}>
          {ui.albumReasons[r]}
        </p>
      ))}
      <button type="button" className="album-walk" onClick={() => switchMode('immersive')}>
        {ui.switchToForest}
      </button>
    </aside>
  )
}
