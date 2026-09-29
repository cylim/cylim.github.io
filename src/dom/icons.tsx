import type { SocialId } from '../content/socials'
import { BRAND_GRID, BRAND_PATHS } from '../content/brandMarks'

export function SocialIcon({ id }: { id: SocialId }) {
  return (
    <svg className="social-icon" viewBox={`0 0 ${BRAND_GRID} ${BRAND_GRID}`} width="20" height="20" aria-hidden="true" focusable="false">
      <path d={BRAND_PATHS[id]} />
    </svg>
  )
}

/** Sound: one guqin string. Flat when off; a slow sine when on (animated in CSS). */
export function SoundIcon() {
  return (
    <svg className="sound-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path className="sound-flat" d="M3 12H21" />
      <path className="sound-wave" d="M3 12C4.5 10.5 6 10.5 7.5 12S10.5 13.5 12 12 15 10.5 16.5 12 19.5 13.5 21 12" />
    </svg>
  )
}

/** Settings: three ink dots with tapered brush ends. */
export function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M5.5 10.6c.9-.2 1.9.5 1.9 1.5S6.5 13.7 5.4 13.5c-1-.2-1.5-1.1-1.3-2 .2-.5.7-.8 1.4-.9Zm6.4-.1c1 0 1.8.7 1.8 1.6 0 .9-.8 1.5-1.8 1.5-1 0-1.7-.7-1.7-1.6 0-.8.8-1.5 1.7-1.5Zm6.6.1c1 .1 1.7.8 1.6 1.7-.1.8-.9 1.4-1.8 1.3-1-.1-1.6-.8-1.5-1.7.1-.8.8-1.4 1.7-1.3Z" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M6.2 5.2c.3-.3.8-.3 1.1 0L12 10l4.7-4.8c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1L13.1 11l4.8 4.8c.3.3.3.8 0 1.1-.3.3-.8.3-1.1 0L12 12.2l-4.8 4.8c-.3.3-.8.3-1.1 0-.3-.3-.3-.8 0-1.1l4.8-4.8-4.7-4.8c-.3-.3-.3-.8 0-1.1Z" />
    </svg>
  )
}
