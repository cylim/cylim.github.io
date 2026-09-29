/**
 * Feature switches: the one place to pause a part of the site. Pure data with no imports, so every
 * layer can read it (content, dom, core, env, sections, audio, the e2e specs and scripts/prerender).
 *
 * `grove`: the Qimen grove (design.md §8.6, §9), in one of three modes.
 *
 * - `'walk'`: on the scroll walk, threshold → cabin → moon gate → path → grove → lantern.
 * - `'detour'`: on the map but off the walk. A plain scroll goes threshold → cabin → moon gate →
 *   the path and the mist wall → the lantern, and the jvh after the grove move up by its length
 *   (core/world/beats.ts `afterGrove`). The nav, the terminal's `grove` and `qimen`, the finale's map
 *   pin and a /#grove link still go there: the dive joins the full walk under paper
 *   (core/world/walk.ts `joinGroveWalk`), and the visit stays on it until the next load.
 * - `'off'`: paused. The groveless walk with nothing pointing at the grove: no Grove nav item, a
 *   #grove link lands on #contact, no chart copy, no grove pin in the finale.
 *
 * The engine (lib/qimen), the grove scene and their tests stay in every mode. Copy that mentions the
 * grove keeps both variants next to each other (content/site.ts `hero`, content/meta.ts,
 * content/stills.ts, content/terminalCommands.ts) and follows "reachable", `grove !== 'off'`.
 */
export type GroveMode = 'walk' | 'detour' | 'off'

export const features: { readonly grove: GroveMode } = {
  grove: 'detour',
}
