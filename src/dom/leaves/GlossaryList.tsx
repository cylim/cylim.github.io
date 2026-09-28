import { chartTerms, methodTerms } from '../../content/accents'
import {
  branches,
  deities,
  doors,
  glossaryGroups,
  luopanTerms,
  palaces,
  solarTerms,
  stars,
  stemGroups,
  stems,
} from '../../content/glossary'
import { grove } from '../../content/grove'
import type { GlossaryTerm } from '../../content/types'
import { LangText } from '../gloss/LangText'

function Group({ title, terms }: { title: GlossaryTerm | string; terms: readonly GlossaryTerm[] }) {
  return (
    <section className="glossary-group">
      <h4>
        {typeof title === 'string' ? (
          title
        ) : (
          <>
            <span lang="zh-Hans">{title.zh}</span> {title.pinyin} · {title.en}
          </>
        )}
      </h4>
      <dl>
        {terms.map((t) => (
          <div key={t.zh}>
            <dt>
              <span lang="zh-Hans">{t.zh}</span> {t.pinyin} · {t.en}
            </dt>
            {t.meaning && (
              <dd>
                <LangText text={t.meaning} />
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * The whole glossary as plain HTML (design.md §14.2): crawlers and no-JS visitors get every term.
 * Rendered on the server only; the client keeps the prerendered markup untouched (see Grove.tsx).
 */
export function GlossaryList() {
  const g = glossaryGroups
  return (
    <details className="glossary">
      <summary>{grove.glossaryHeading}</summary>
      <Group title={g.palaces} terms={palaces} />
      <Group title={g.doors} terms={doors} />
      <Group title={g.stars} terms={stars} />
      <Group title={g.deities} terms={deities} />
      <Group title={g.stems} terms={[...stemGroups, ...stems]} />
      <Group title={g.branches} terms={branches} />
      <Group title={grove.glossaryTerms.chart} terms={chartTerms} />
      <Group title={grove.glossaryTerms.method} terms={methodTerms} />
      <Group title={grove.glossaryTerms.luopan} terms={luopanTerms} />
      <Group title={grove.glossaryTerms.solarTerms} terms={solarTerms} />
    </details>
  )
}
