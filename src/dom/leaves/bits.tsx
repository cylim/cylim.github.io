import { journey, useJourney } from '../../core/store/journey'
import { socials, type SocialId } from '../../content/socials'
import { SocialIcon } from '../icons'

const hoverRow = (id: SocialId | null) => {
  if (journey.getState().contactHover !== id) journey.setState({ contactHover: id })
}

/**
 * The social links (content.md §5): logo and username, the platform name for screen readers only.
 * The hero row and the contact card's rows (56 px). Hovering or focusing a contact row lights its board
 * on the signpost in 3D (`contactHover`), and hovering a board lights its link row here.
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
            data-lit={lit === s.id ? '' : undefined}
            onPointerEnter={rows ? () => hoverRow(s.id) : undefined}
            onPointerLeave={rows ? () => hoverRow(null) : undefined}
            onFocus={rows ? () => hoverRow(s.id) : undefined}
            onBlur={rows ? () => hoverRow(null) : undefined}
          >
            <SocialIcon id={s.id} />
            <span className="visually-hidden">{s.label} </span>
            <span className="social-handle">{s.display}</span>
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
