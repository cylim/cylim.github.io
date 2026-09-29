import { renderToString } from 'react-dom/server'
import { ContentLayer } from './dom/ContentLayer'

/** The feature switches the page was built with, for scripts/prerender.mjs's checks. */
export { features } from './content/features'

/**
 * Prerender entry (stack.md §10). `vite build --ssr src/entry-server.tsx --outDir dist-ssr`, then
 * scripts/prerender.mjs replaces `<!--content-->` in dist/index.html with `render()`.
 * Owner: dom.
 */
export function render(): string {
  return renderToString(<ContentLayer />)
}
