/**
 * Feature switches: the one place to pause a part of the site. Pure data with no imports, so every
 * layer can read it (content, dom, core, env, sections, audio, the e2e specs and scripts/prerender).
 *
 * `grove`: the Qimen grove (design.md §8.6, §9), paused while it is being refined. With it off the
 * walk goes threshold → cabin → moon gate → the path and the mist wall → the lantern, and the jvh
 * after the grove move up by its length (core/world/beats.ts `afterGrove`): no Grove nav item, no
 * #grove section (a #grove link lands on #contact), no stone board, no chart copy, no grove pin in the
 * finale. The engine (lib/qimen), the grove scene and their tests stay; flip this to bring it back.
 * Copy that mentions the grove keeps both variants next to each other (content/site.ts `hero`,
 * content/meta.ts, content/stills.ts, content/terminalCommands.ts).
 */
export const features: { readonly grove: boolean } = {
  grove: false,
}
