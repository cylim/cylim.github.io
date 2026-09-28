import { renderToString } from 'react-dom/server'
import { ContentLayer } from './dom/ContentLayer'

/**
 * Prerender entry (stack.md §10). `vite build --ssr src/entry-server.tsx --outDir dist-ssr`, then
 * scripts/prerender.mjs replaces `<!--content-->` in dist/index.html with `render()`.
 * Owner: dom.
 */
export function render(): string {
  return renderToString(<ContentLayer />)
}
