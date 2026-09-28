import { Fragment } from 'react'
import { journey, useJourney } from '../../core/store/journey'
import { socials, type SocialId } from '../../content/socials'
import { SocialIcon } from '../icons'

/** A narrow tile wraps a "shown as" URL after a slash (linkedin.com/in/ · cylim226), not mid-word. */
function breakAfterSlashes(text: string) {
  const parts = text.split('/')
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ))
}

const hoverRow = (id: SocialId | null) => {
  if (journey.getState().contactHover !== id) journey.setState({ contactHover: id })
}

/**
 * The four social links (content.md §5): the hero row (icon + short label) and the stele rows
 * (icon + label + "shown as", 56 px). Hovering or focusing a stele row lights its carved row in 3D
 * (`contactHover`), and hovering a carved row lights its link row here.
 */
export function SocialLinks({ variant }: { variant: 'row' | 'rows' }) {
  const rows = variant === 'rows'
  const lit = useJourney((s) => (rows ? s.contactHover : null))
  return (
    <ul className={`socials socials-${variant}`}>
      {socials.map((s) => (
        <li key={s.id}>
          <a
            href={s.href}
            rel={s.rel}
            data-gloss-host={s.id === 'blog' ? '' : undefined}
            data-lit={lit === s.id ? '' : undefined}
            onPointerEnter={rows ? () => hoverRow(s.id) : undefined}
            onPointerLeave={rows ? () => hoverRow(null) : undefined}
            onFocus={rows ? () => hoverRow(s.id) : undefined}
            onBlur={rows ? () => hoverRow(null) : undefined}
          >
            <SocialIcon id={s.id} />
            <span className="social-label">{s.label}</span>
            {variant === 'rows' && s.display !== s.label && <span className="social-display">{breakAfterSlashes(s.display)}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Copy with `code` spans marked by backticks, e.g. "Type `help`." */
export function InlineCode({ text }: { text: string }) {
  const parts = text.split('`')
  return <>{parts.map((p, i) => (i % 2 ? <code key={i}>{p}</code> : p))}</>
}
