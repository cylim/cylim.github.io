import { lazy } from 'react'
import { useJourney } from '../../core/store/journey'
import { contact } from '../../content/site'
import { ui } from '../../content/ui'
import { sealSize } from '../../theme/tokens'
import { Still } from '../album/Still'
import { Client } from '../Client'
import { Seal } from '../Seal'
import { switchMode } from '../mode'
import { Leaf, LeafInscription, type Cards } from './Leaf'
import { SocialLinks } from './bits'

const Colophon = lazy(() => import('../finale/Colophon'))

/**
 * "Walk again" and "Still version", shown with the link rows once the finale is signed (design.md
 * §8.7). Rendered twice, and CSS shows at most one (the other is display: none, so out of the
 * accessibility tree): under the link rows in the contact card (album, landscape walk), or under the
 * colophon in the E3 card, where a phone's finale keeps them on the paper above the painting. Before
 * E3 the contact card's copy is out of sight but still the next Tab after the rows, and shows while it
 * has focus (walk.css), so the keyboard reaches them from E1 on.
 */
function FinaleLinks({ where }: { where: 'card' | 'colophon' }) {
  const mode = useJourney((s) => s.mode)
  return (
    <p className={`finale-links finale-links-${where}`}>
      <a href="/" data-jump="" className="walk-again">
        {contact.walkAgain}
      </a>
      {mode === 'immersive' && (
        <button type="button" className="still-version" onClick={() => switchMode('static')}>
          {ui.switchToStill}
        </button>
      )}
    </p>
  )
}

/** The finale seal: stamps once in the walk (css keys off html[data-beat=E3]); already stamped in the album. */
function FinaleSeal() {
  const stamped = useJourney((s) => s.finale.sealStamped)
  return (
    <div className="finale-seal" data-stamped={stamped ? '' : undefined} aria-hidden="true">
      <Seal placement="finale" size={sealSize.finale} />
    </div>
  )
}

const cards: Cards = {
  E1: {
    className: 'card-contact',
    body: (
      <>
        <p className="label">{contact.label}</p>
        <h2 id="contact-heading" tabIndex={-1}>
          {contact.heading}
        </h2>
        <p className="contact-line">{contact.line}</p>
        <SocialLinks variant="rows" />
        <p className="contact-resume">
          <a href={contact.resume.href}>{contact.resume.label}</a>
        </p>
        <FinaleLinks where="card" />
      </>
    ),
  },
  E3: {
    className: 'card-finale',
    body: (
      <>
        <div className="album-only">
          <Still id="E3" />
        </div>
        <Client>
          <Colophon />
        </Client>
        <FinaleLinks where="colophon" />
        <FinaleSeal />
        {/* The finale's map pins render here (Finale.tsx): inside main, in reading order before the footer. */}
        <div className="map-pins" />
      </>
    ),
  },
}

export function ContactSection() {
  return (
    <Leaf
      id="contact"
      art={
        <>
          <LeafInscription id="contact" />
          <Still id="E1" />
        </>
      }
      cards={cards}
    />
  )
}
