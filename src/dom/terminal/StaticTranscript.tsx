import { contactOutput, terminal, whoamiOutput } from '../../content/terminal'
import { linkIn } from './links'

/** One output line; known URLs become real links (design.md §10.3). */
export function TermText({ text }: { text: string }) {
  const link = linkIn(text)
  if (!link) return <>{text || '\u00a0'}</>
  return (
    <>
      {link.before}
      <a href={link.href} rel="me">
        {link.display}
      </a>
      {link.after}
    </>
  )
}

export function PromptLine({ input }: { input: string }) {
  return (
    <p className="term-line term-input">
      <span className="term-prompt">{terminal.prompt}</span> {input}
    </p>
  )
}

const OUTPUTS: Record<string, readonly string[]> = { whoami: whoamiOutput, contact: contactOutput }

/**
 * What the terminal shows before its code loads, and all it shows with JavaScript off: the banner and
 * a transcript of `whoami` and `contact` (design.md §10.3).
 */
export function StaticTranscript() {
  return (
    <div className="term-screen">
      <div className="term-log">
        {terminal.banner.map((l) => (
          <p key={l} className="term-line term-hint">
            {l}
          </p>
        ))}
        {terminal.staticTranscript.map((cmd) => (
          <div key={cmd}>
            <PromptLine input={cmd} />
            {(OUTPUTS[cmd] ?? []).map((l, i) => (
              <p key={i} className="term-line">
                <TermText text={l} />
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
