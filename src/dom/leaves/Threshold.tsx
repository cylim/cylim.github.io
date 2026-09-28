import { serviceById } from '../../content/services'
import { forest, hero } from '../../content/site'
import { sealSize } from '../../theme/tokens'
import { Still } from '../album/Still'
import { Seal } from '../Seal'
import { accentGloss } from '../gloss/lookup'
import { Zh } from '../gloss/Zh'
import { Leaf, type Cards } from './Leaf'
import { SocialLinks } from './bits'

function ServiceCard({ index }: { index: 0 | 1 }) {
  const card = forest.cards[index]
  return (
    <>
      {index === 0 && <h2 className="services-heading">{forest.servicesHeading}</h2>}
      {card.serviceIds.map((id) => {
        const s = serviceById(id)
        return (
          <article key={id} className="service">
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </article>
        )
      })}
    </>
  )
}

const cards: Cards = {
  // design.md §8.1, zone L in reading order.
  T0: {
    className: 'card-hero',
    body: (
      <>
        <div className="hero-mark">
          <Zh term={accentGloss(hero.accent)} className="hero-accent">
            <span className="hero-glyph" aria-hidden="true" />
            <span className="visually-hidden">{hero.accent.zh}</span>
          </Zh>
          <Seal placement="hero" size={sealSize.hero} className="hero-seal" />
        </div>
        <h1 id="threshold-heading" tabIndex={-1}>
          {hero.name}
        </h1>
        <p className="hero-role">{hero.role}</p>
        <p className="hero-positioning">{hero.positioning}</p>
        <p className="hero-subline">{hero.subline}</p>
        {hero.availability && <p className="hero-availability">{hero.availability}</p>}
        {hero.showSocialRow && <SocialLinks variant="row" />}
      </>
    ),
    extra: (
      <p className="scroll-cue" aria-hidden="true">
        <span>{hero.scrollHint}</span>
      </p>
    ),
  },
  F1: { body: <ServiceCard index={0} /> },
  F3: { body: <ServiceCard index={1} /> },
}

export function ThresholdSection() {
  return <Leaf id="threshold" art={<Still id="T0" priority />} cards={cards} />
}
