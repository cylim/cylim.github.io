# cy.my design spec (final)

Status: the single source of truth for implementers, 2026-09-28. It replaces `design-cinematic.md`, `design-usable.md` and `design-craft.md`. Those three stay in the repo as background reading only. Where they disagree with this file, this file wins.

Precedence with the sibling docs:

- `content.md` and `content.draft.ts` own all wording, glosses and terminal output. This doc says where and when copy appears. Section 18 lists the few places where this doc proposes a copy change. Those need the owner's yes before they ship.
- `stack.md` owns versions, build, deploy, module layout and render plumbing. Section 18 lists the few places where this doc overrides it, with the reason.
- `calendar.md` owns solar terms and pillars (tyme4ts behind `src/grove/calendar.ts`).

The backbone is the usability spec: DOM first, native scroll, stencil door, tier gate, real fallbacks. Onto it I grafted the cinematic spec's camera grammar, pacing and signature shots, and the craft spec's palette discipline, cultural rules and the "cabin is an inverted ink painting" idea. Appendix A has the scores. Appendix B lists every conflict and how it was settled.

---

## 0. Conventions

- Units are metres. +Y is up.
- The world is compass-true. **North is +Z, south is −Z, east is −X, west is +X.** This is the same frame as `stack.md` §3, whose zone anchors run along −Z.
- The walk heads south, along −Z, which is three.js's default camera forward. Facing south, screen-right is west (+X) and screen-left is east (−X). That is the traditional Chinese map orientation, which the grove relies on.
- A compass bearing `b`, in degrees clockwise from north, points along `(−sin b, 0, cos b)`.
- To turn an object clockwise as seen from above by Δb, set `rotation.y −= Δb` in radians.
- Scroll is measured in journey vh, written **jvh**. The journey is J = 1000 jvh. The document is J + 100 svh tall. Progress `u = scrollY / (documentHeight − innerHeight)`, so a beat at 345 jvh sits at u = 0.345.
- Keyframes give camera position, look-at point and vertical FOV. "Hold" means a scroll range where the camera barely moves so DOM text can be read.
- Fog density means the `uFog.x` value of the ink pass (`stack.md` §5, exp² distance fog), before the tier multiplier.
- Colours are sRGB hex. Outdoors renders with `NoToneMapping`. The cabin uses AgX inside its own post group.
- Chinese is Simplified. 林 is the same in seal script and needs no traditional form.

---

## 1. Concept and arc

林 is two trees. It is also the character for Lim. The site is the owner's surname as a place: you step out of blank paper into an ink-wash forest, find a small cabin where the software gets made, go deeper to a clearing where the stones turn to your hour, and leave by the light of a lantern you could see from the first frame.

The site has one rule it never breaks. It is a single take. Every scene change happens inside mist, and in an ink painting mist is blank paper, so the paper does the editing.

The arc follows Guo Xi's three distances (三远, from 林泉高致) as shot grammar, so the walk reads as shan shui and not as a game level.

| Stretch | jvh | Distance | Feeling | Colour | What a client learns |
|---|---|---|---|---|---|
| Threshold | 0–90 | 平远 level | Hush, curiosity | Paper, pale ink, one warm pinprick | Name, role, pitch, links |
| Forest walk | 90–245 | 深远 deep | Layered, enclosing | Ink planes, darker as you go | What he builds (services) |
| Cabin exterior | 245–322 | 高远 high: small hut, big peak | Intrigue | First cold colour: cyan leaking from the planks | Setup for the door |
| Cabin interior | 322–572 | inverted world | Surprise, then focus | Night and cyan line work | Proof: work, terminal, timeline |
| Path | 572–645 | 深远, into the densest mist | Exhale, then doubt | Ink returns, then white | Bridge to the practice |
| Grove | 645–862 | plan view, the only top-down shot | Stillness, a little awe | Dark stone, paper light, cinnabar | A live Qimen chart, honestly explained |
| Exit | 862–1000 | 高远, then the whole walk as one painting | Warmth, closure | Lantern amber, red seal | Links again, and a signature |

Three threads run the whole length:

- **The lantern.** A warm pinprick sits in the mist near the centre of the first frame. It is the stone lantern at the exit, 211 m due south, in the 午 mountain of the 离 (fire) palace. It is the only warm light in the ink world, and the walk ends at it.
- **The seal.** A cinnabar 林 seal marks the site in the nav, signs the hero, sits on a sheet of paper on the cabin desk and stamps the finale. Cinnabar never changes colour, even in the cabin.
- **The inversion.** The cabin interior breaks the style on purpose, but it breaks it by inverting the painting, not by switching to stock sci-fi. Paper becomes night. Ink becomes light. Every cyan line grows out of a grain line, a joint or a knot.

The six rules from the usability spec still hold, and they outrank every effect in this file:

1. Name, role, pitch and the four social links are in prerendered HTML and on screen before any script runs.
2. Nothing gates reading. No preloader, no "click to enter", no scroll lock.
3. The jump nav is always on screen and uses plain words first.
4. Every sentence drawn in 3D also exists in the DOM. The canvas is `aria-hidden`, and every 3D interaction has a DOM twin.
5. 3D is progressive enhancement. If WebGL fails or runs slowly, the visitor loses atmosphere and nothing else.
6. Native scroll everywhere. The camera follows the scrollbar, never the reverse.

---

## 2. Palette tokens

Put these in `src/theme/tokens.ts` and mirror them in `tokens.css`. Contrast ratios are WCAG 2.x and were computed for this doc.

### 2.1 Paper and ink (墨分五色)

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `paper` 宣纸 | `#EEE8DB` | Page background, fog colour, renderer clear colour, 留白 | base |
| `paper-light` | `#F4F0E6` | Cards, tooltips, header scrim, fog-dive peak | base |
| `paper-shade` | `#E3DBC9` | Alternate card fill, paper mottling low end | ink-nong on it 10.2:1 |
| `paper-mount` | `#D3C9B4` | Finale mount panels, album margins | ink-jiao on it 11.1:1 |
| `ink-jiao` 焦 | `#141517` | Nearest silhouettes, h1, icons | 15.0:1 on paper |
| `ink-nong` 浓 | `#2A2C2E` | Body text, near trunks | 11.5:1 |
| `ink-zhong` 重 | `#4B4D4E` | Secondary text. The lightest tone allowed for text under 24 px | 7.0:1 |
| `ink-dan` 淡 | `#85867F` | Far layers, hairlines, progress line. Text only at 24 px and up | 3.0:1 |
| `ink-qing` 清 | `#B9B6AB` | Farthest ridges, rules. Never text | 1.7:1 |

### 2.2 Stone

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `stone` | `#A7A297` | Stele face, luopan apron (R4), stepping stones, rocks | ink-jiao carving on it 7.2:1 |
| `bluestone` 青石 | `#3A3E40` | Grove platform and the three turning rings | paper glyph on it 8.9:1 |
| `bluestone-deep` | `#26292B` | Carved recesses on bluestone, unlit ring carvings | decorative |

The dark platform is deliberate. From above it reads like a stele rubbing (拓片): white characters on black ink, laid on paper. It is the darkest mass in the grove, so the eye goes there first.

### 2.3 Accents

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `cinnabar` 朱砂 | `#A8322A` | Seals, 值符 and 值使 plates, active nav marker, focus ring on paper | 5.5:1 on paper. Paper text on cinnabar is 5.5:1 |
| `cinnabar-deep` | `#862720` | Pressed edge of seals | decorative |
| `lantern-core` | `#FFE7B0` | Flame centre, glint core | emissive only |
| `lantern-flame` | `#F2A93B` | Flame body, halo | emissive only |
| `lantern-halo` | `#F6C877` | Ground light pool, warm tint on nearby trunks | emissive only |

### 2.4 Cabin (the inverted painting)

`night` is the exact RGB inverse of `paper` (255 − each channel). Say so in a code comment, because someone will "fix" it otherwise.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `night` 夜 | `#111724` | Cabin background and distance fade, terminal glass | base |
| `night-panel` | `#172231` | DOM cards inside the cabin, at 88% opacity | base |
| `cyan-line` | `#5CEBDF` | Line work, headings, terminal text | 12.3:1 on night, 11.0:1 on night-panel |
| `cyan-bright` | `#8FF7EE` | Caret, focus ring, pulse peaks, links | 14.3:1 on night |
| `cyan-soft` | `#9FC9C4` | Body text on cabin cards | 9.9:1 on night, 8.9:1 on night-panel |
| `cyan-dim` | `#2AA7A3` | Tags, secondary terminal text | 6.1:1 on night |
| `cyan-ghost` | `#1E5E66` | Idle traces, grain. Never text | 2.4:1 |

### 2.5 Colour rules

- The ink world has paper, the five inks, stone, one warm light and cinnabar. Nothing else.
- One warm emitter. The exit lantern is the only warm light in the ink world. There is no porch lantern and no second lantern.
- Cyan lives inside the cabin, in the plank gaps and door gap of the cabin exterior, and in one pinprick glint in the finale. Nowhere else.
- Cinnabar is the invariant: seals, the two duty marks, the 值符 arc, the active-nav marker and the cabin-desk seal. It never glows and never changes hue.
- No saturated green. Pines are ink. Moss is ink dots (点苔).
- No red inside the cabin except the desk seal. Terminal errors stay cyan.
- Focus rings: 2 px `cinnabar` with a 2 px `paper-light` offset on paper; 2 px `cyan-bright` in the cabin. Never removed, never colour-only.

---

## 3. Typography

All fonts are SIL OFL 1.1, self-hosted from `public/fonts/`, subset at build time by `scripts/subset-fonts.mjs` (`stack.md` §7). Nothing is fetched from Google Fonts at runtime. troika reads `.woff`, not `.woff2`, so every face used in 3D ships twice: `.woff2` for CSS, `.woff` for troika.

| Role | Family | Source | Weights | Files and budget | Loaded |
|---|---|---|---|---|---|
| Latin display: name, section titles, scroll titles in 3D | Cormorant Garamond | github.com/CatharsisFonts/Cormorant | 600 | Latin subset, about 18 KB woff2, plus a woff for troika | woff2 preloaded; woff with the cabin chunk |
| Latin body and UI | Source Serif 4 (static text cut) | github.com/adobe-fonts/source-serif | 400, 600 | Latin subset plus pinyin tone vowels (ā á ǎ à … ǖ ǘ ǚ ǜ ü), about 20 KB each | 400 preloaded, 600 on swap |
| CJK text: nav accents, glosses, chart glyphs, stele, terminal grid | LXGW WenKai 霞鹜文楷 Regular | github.com/lxgw/LxgwWenKai (v1.522 measured in `stack.md`) | 400 | Subset from `glossary.json` and content, about 140–200 glyphs. 29 KB woff2, 33 KB woff | woff2 after first paint with `font-display: swap`; woff with the grove and cabin chunks |
| CJK display: hero accent, section inscriptions, fog-dive title cards | Ma Shan Zheng | github.com/google/fonts/tree/main/ofl/mashanzheng | 400 | 8 glyphs: 入 林 木 屋 九 宫 石 灯. About 10 KB woff2 | lazy; the hero 入林 is inline SVG outlined from this font at build time, so first paint needs no CJK font |
| Mono: terminal, stack tags, scroll text zones | JetBrains Mono | github.com/JetBrains/JetBrainsMono | 400 | Latin subset, about 20 KB woff2 plus woff | with the cabin chunk |

Why this set. Kai script (楷书) reads as brushwork and stays legible at 13 px, and Kai inscriptions are common on real steles, so one CJK family covers glosses and carving. Cormorant is the brush-contrast display face and falls apart below 24 px, so it is never used below that. Source Serif 4 carries body text and pinyin. Latin fonts total about 58 KB, under the 60 KB budget in `stack.md` §4. Fallback metrics come from `fontaine` (`size-adjust`, `ascent-override`) so the swap moves nothing. CLS budget 0.02.

`scripts/check-glyphs.mjs` fails CI if content uses a CJK character missing from the WenKai or Ma Shan Zheng subset.

### 3.1 Type scale

| Token | Size | Line height | Face |
|---|---|---|---|
| `hero-cjk` | `clamp(88px, 11vw, 176px)` | 1 | Ma Shan Zheng, vertical, inline SVG |
| `display` (h1) | `clamp(2.75rem, 1.6rem + 5vw, 6.5rem)` | 1.0 | Cormorant 600, tracking −0.01em |
| `h2` | `clamp(1.75rem, 1.3rem + 2vw, 2.75rem)` | 1.1 | Cormorant 600 |
| `section-cjk` | `clamp(3.5rem, 2.8rem + 3vw, 6rem)` | 1 | Ma Shan Zheng, vertical |
| `h3` | 1.25rem mobile, 1.375rem desktop | 1.25 | Source Serif 4 600 |
| `body` | 17 px mobile, 18 px desktop | 1.55, measure 34em | Source Serif 4 400 |
| `label` | 13 px | 1.3 | Source Serif 4 600, all-small-caps, tracking 0.08em |
| `gloss-cjk` | 1.15 × the adjacent Latin size | 1.3 | WenKai |
| `mono` | 13 px mobile, 15 px desktop | 1.45 | JetBrains Mono |

13 px is the hard floor everywhere. Every CJK span has `lang="zh-Hans"`.

3D text uses troika through `BatchedText` (`stack.md` §7), with `characters` preset to the full chart glyph list so the SDF atlas builds once during a fog cover. `sdfGlyphSize` 64 for labels, 128 for glyphs with thin strokes (螣, 蓬). Every text material has `depthWrite: false`, or the ink pass draws boxes around the glyphs.

---

## 4. UI chrome

Everything fixed is DOM. It is drawn in ink on the ink world and in cyan on night inside the cabin. The chrome swaps palettes with a 300 ms crossfade at the two door crossings (u ≈ 0.316 going in, 0.572 at the moon gate).

### 4.1 Desktop, 768 px and wider

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [林] CY Lim                                   木屋      九宫      石灯   │
│                                               Work      Grove    Contact │
│ 木                                                                     │ │
│ 屋   section inscription (TL)                                          ▪ │  progress hairline
│ The Cabin                                                              │ │
│                                                                        │ │
│ ┌ zone L ─────────┐                                                      │
│ │ copy card       │                                                      │
│ └─────────────────┘                                          [~] [⋯]    │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Skip link.** First focusable element, "Skip to content", targets `#content`. Visible on focus.
- **Header.** Fixed, 56 px tall, transparent at the top. After 40 px of scroll it gets `paper-light` at 88% with a 1 px `ink-qing` bottom rule. `backdrop-filter: blur(6px)` on medium and high tiers only. In the cabin: `night` at 88% with a `cyan-ghost` rule.
- **Home mark.** Top-left. The 林 seal in 朱文 style at 28 px plus "CY Lim" in Cormorant 600 at 20 px. Links to the top with a fog-dive. Accessible name "CY Lim, back to the edge of the forest".
- **Jump nav.** Top-right, `<nav aria-label="Jump to a place">`, three real anchors with `data-jump`:

  | CJK accent (WenKai 13 px, `ink-zhong`, `aria-hidden`) | Label (Source Serif 4 600, 15 px) | href |
  |---|---|---|
  | 木屋 | Work | `#cabin` |
  | 九宫 | Grove | `#grove` |
  | 石灯 | Contact | `#contact` |

  The plain word carries the accessible name, for example "Work, the cabin". Hovering or focusing an item shows the gloss for its accent, for example "木屋 mù wū · wooden hut". Each item is at least 44 × 44 px. The active item gets `aria-current="location"`, a 6 px cinnabar square to the left of its label, and an ink underline drawn in with a dry-brush SVG stroke over 300 ms.
- **Progress hairline.** Right edge, 20 px in. A 1 px `ink-dan` line from 20vh to 80vh that fills with `ink-nong` from the top as u grows. Small ink ticks mark the four arrivals (u 0, 0.345, 0.666, 0.886). The current position is a 6 px cinnabar square, a tiny seal. `aria-hidden`, not clickable, since the nav already does that job.
- **Section inscription (题款).** When a section's first hold begins, its accent appears at top-left under the header, 6vw from the edge. It is a vertical column (`writing-mode: vertical-rl`) in `section-cjk`, `ink-nong` at 85% opacity, with the English section name in `label` type beside it. Ink appears with a top-to-bottom feathered mask plus a blur-to-sharp settle over 600 ms. It fades out when the section's last hold ends. `aria-hidden`, because the h2 says the same thing. In the cabin it is `cyan-line`.
- **Bottom-right cluster.** Two 44 px buttons:
  - Sound. The icon is a single guqin string: a flat line when off, a slow sine (2 Hz, 1.5 px amplitude) when on. `aria-pressed`, accessible name "Sound". Off by default.
  - Settings (⋯). Opens a popover with Quality (Auto, Low, High as a radio group) and a "Still version" link. Choices persist in `localStorage` under `cy.prefs`.

### 4.2 Mobile, under 768 px

- **Bottom bar.** Fixed, 56 px plus `env(safe-area-inset-bottom)`, never hides. Four slots of 25% width, each at least 48 px tall: 林 seal icon over "Top", 木屋 over "Work", 九宫 over "Grove", 石灯 over "Contact". CJK at 12 px `ink-zhong`, label at 12 px Source Serif 4 600, always visible because touch has no hover. Background `paper-light` at 92% with a 1 px `ink-qing` top rule; `night` at 92% with `cyan-line` labels in the cabin. The active slot gets `aria-current="location"` and a 6 px cinnabar square.
- **Progress.** A 2 px `ink-nong` line along the top edge of the bottom bar, filling left to right, with a 4 px cinnabar marker.
- **Settings.** A 40 px round button top-right inside the safe area. Opens a bottom sheet with Sound, Quality and "Still version".
- **Section chip.** Instead of the vertical inscription, a horizontal chip under the top safe area on the left: `木屋 · Work`. `aria-hidden`.

### 4.3 Shared pieces

- **Gloss tooltip.** Every CJK accent is `<span class="zh" lang="zh-Hans" tabindex="0" aria-describedby="g-…">` with a visually hidden gloss next to it, so screen readers get the gloss inline and never need the tooltip. The visible tooltip is a `paper-light` card at 96%, 1 px `ink-dan` border, 8 px radius, max 280 px. Line one: `{zh} {pinyin} · {English}` in `gloss-cjk` and `label`. Line two: the one-line meaning in `body` at 15 px. Opens after 120 ms of hover or on focus, toggles on tap, closes on Esc, stays open while hovered (WCAG 1.4.13), flips sides so it never covers what it explains. The trigger has a 1 px dotted `ink-dan` underline at 4 px offset. All strings come from `content.draft.ts` and `glossary.json`. Components never contain gloss text.
- **Fog-dive title card.** During the whiteout of a jump, the destination accent appears centred in Ma Shan Zheng at 120 px in `ink-nong`, with the English name under it in `h2`. It fades in from 250 ms into the dive. If the target chunk is still loading 400 ms into the hold, "Grinding ink…" (content.md) appears under it in `label` type. On emergence it dissolves: blur 0 to 8 px, opacity 1 to 0, scale 1 to 1.04, over 500 ms.
- **Live region.** One visually hidden `aria-live="polite"` element. It announces jumps ("Now at Work") and chart recasts ("Chart recast for 19:00 to 20:59, 戌 hour").
- **Toasts.** One at a time, bottom-centre above the bar or cluster, 4 s. Used for "3D paused, tap to restart", "Compass access is off…" and the slow-device fallback.
- **Text legibility.** Every exterior copy card sits on a mist pocket: a radial gradient of `paper` at 85% feathered over 48 px, plus `text-shadow: 0 0 14px #EEE8DB`. It reads as mist gathering behind the words. Inside the cabin, cards are `night-panel` at 88% with a 1 px `cyan-ghost` border and 2 px radius. Body text must hit 4.5:1 against its real background, scrim included.

### 4.4 Seals

- The 林 seal is hand-traced SVG on a 100 × 100 grid. Small-seal 林 is two 木 side by side, each a vertical stem with a pair of upturned branches and a pair of downturned roots. Edge roughness and uneven 印泥 coverage are baked into the SVG as a mask. No runtime SVG filters, they are slow on phones.
- Two variants: 白文 (paper strokes cut from a red field) for the hero signature at 44 px; 朱文 (red strokes on paper, red border) for the nav mark at 28 px, the cabin-desk decal and the finale stamp at 64 px. Favicon: SVG plus a 180 px PNG.
- Stamp animation: scale 1.06 to 1.0, rotation 1.5° to its resting angle (each placement rests at a fixed angle between −2° and 2°, never 0°), opacity 0 to 1, a 120 ms darkening "press", 220 ms total, then a 2 px ink-bleed ring over 400 ms. No bounce. Seals never animate after they land.
- At most one seal on screen besides the nav mark.
- A name seal [name seal] (朱文, 2 × 2, read right column first: [two columns]) is an optional variant for the finale. `resources/resume-zh.pdf` gives the name [owner's Chinese name], but it ships only if the owner says yes (section 18).

### 4.5 Iconography

- One style: filled SVG paths with tapered brush ends, 24 px grid, about 1.5 px visual stroke. Every icon sits next to a text label or has an accessible name.
- GitHub, X and LinkedIn use the official marks from Simple Icons (CC0), flat in `ink-nong`, unmodified. Redrawing them as brushwork breaks the brands' rules and makes them harder to spot. Blog uses the character 文 in WenKai, with its gloss "wén · writing".
- Trigrams are bars, never the Unicode ☰–☷ glyphs, whose rendering varies by font. A yin line is two bars with a gap of 28% of the line length. In circular layouts the bottom line sits nearest the centre.

---

## 5. World layout

One world, one coordinate system. Everything below is in world metres with the axes from section 0. Terrain height is 0 unless stated.

```
                                   N (+Z)
      ridge ring: mountain cards at r 160, 230, 320 m around (0, 0, −90), on all sides

 z  24     ● K0 camera, open paper meadow
 z  11                          ♣ corner pine A (4.6, 11)
 z   6   ▲▲▲▲▲▲▲▲▲ forest edge ▲▲▲▲▲▲▲▲▲       path S-curves south, x −1…+1.6
 z −17     ♣ wipe pine B (−1.5, −17)
 z −30                        ◆ axe-cut rock (2.8, −30)
 z −60           ┌─door (4, −60)─┐   cabin x 1.5…6.5, z −60…−66, door faces north
 z −66           └───────────────┘
 z −68        ♣ (2.0, −67.9)     ♣ (6.3, −68.7)     close trunks for the nudge
            [hall x −3…11, z −60…−106, drawn only through the door or when inside]
 z −85   ~~~~~ stream, flows west (+X), 5 stepping stones at x 1.3…2.1 ~~~~~
 z −100…−115  mist wall
 z −120            crest, terrain y 1.8
 z −131      ▮ standing stones (−3, −131) and (3, −131) mark the grove entrance
 z −150       (( ( [#] ) ))   grove: platform centre (0, 0.45, −150), rings to r 11.3, clearing r 18
 z −186.5              ○ lantern (1.0, −186.5)
 z −188             ▮ stele (−1.4, −188), faces north
 z −192     ledge; ground falls to y −25 beyond
 z −340         ⛰ main peak card, summit y 115
                                   S (−Z)
```

### 5.1 Landmarks

| Landmark | Position | Notes |
|---|---|---|
| K0 camera | (0, 1.6, 24) | Facing south |
| Meadow | z 24 to 6 | Paper ground, sparse dry-brush grass strokes from z 20 to 10 |
| Corner pine A | base (4.6, 0, 11) | Unique mesh, 13 m, leans 8° east (toward −X). Its long branch crosses the top-right of the K0 frame: Ma Yuan's one-corner composition |
| Forest edge | z 6 | Pines 3 to 40 m either side of the path spline |
| Path spline | (0, 0, 6) → (−0.9, 0, −8) → (0.8, 0, −24) → (−0.4, 0, −38) → (1.6, 0, −50) → (3.6, 0, −57) | A paper-white strip (留白), 1.2 m wide, written by the ground shader |
| Wipe pine B | base (−1.5, 0, −17) | Unique mesh, 11 m, split trunk, first branches 3.5 m up, leans west over the path. Hand-placed hero pines A and B are exempt from the scatter keep-outs |
| Rock | (2.8, 0, −30) | 2.2 m, axe-cut 皴 |
| Lantern sightline | from K0 to the lantern | A 1.5 m wide corridor kept free of trees and props, so the glint is visible from K0, P3 and G1 |
| Cabin | footprint x 1.5 to 6.5, z −60 to −66 | On stone footings, floor y 0.45. Eaves y 3.05, ridge y 4.65, gable facing north, 0.5 m overhang |
| Door | centre x 4.0, in the north wall plane z −60, sill y 0.45 | 1.0 × 2.0 m planks, strap hinges on the east (screen-left) side, swings inward |
| Steps | z −59.4 and −58.8 | Two stone steps |
| Lattice window | (2.6, 1.9, −60) | 0.7 × 0.7 m, 步步锦 lattice, screen-left of the door from the approach |
| Chimney | (6.0, 0, −65.5), top at y 5.4 | Stone, with a thin ink smoke ribbon |
| Close trunks | (2.0, 0, −67.9), (6.3, 0, −68.7) | 0.5 m radius, 14 m tall, `ink-nong`. They prove the cabin is 6 m deep during the nudge |
| Main peak | card centred (−20, 0, −340), 220 m wide | Summit y 115, axe-cut strokes, base dissolved in a mist belt. Seen above the cabin roof from the approach and above the stele from the exit |
| Ridge ring | cards at radii 160, 230 and 320 m around (0, 0, −90) | Three layers (tier-dependent) on every side, because the finale looks north |
| Hall (interior) | floor x −3 to 11, z −60 to −106, y 0.45 | Physically behind the door, drawn only through the stencil or when inside. Section 8.4 |
| Moon gate | centre (4, 2.35, −106), radius 1.6 | In the hall's back wall |
| Path emerge point | (3.0, 0, −69) | Where the camera reappears after the moon gate |
| Path spline | (3.0, 0, −69) → (2.0, 0, −80) → (1.7, 0, −85) → (1.0, 0, −98) → (0.4, 1.2, −112) → (0, 1.8, −120) → (0, 0, −132) | |
| Stream | centre line z −85, 2.2 m wide | Flows west (+X). Five stepping stones at x 1.3 to 2.1 |
| Bamboo clump | (−3.5, 0, −86) | Medium and high tiers only |
| Terrain | y 0 to z −95, rising to 1.8 at z −118 to −122, back to 0 by z −130, flat to z −192 | |
| Mist wall | z −100 to −115 | Fog peak 0.14 |
| Standing stones | (−3, 0, −131), (3, 0, −131) | Plain, unlettered, 1.8 m |
| Grove clearing | centre (0, 0, −150), radius 18 | Old pines on a ring from r 18 to 28 |
| Platform | 9 × 9 m, centre (0, 0.45, −150) | Section 9 |
| Needle (天池) | (0, 1.95, −150) | Floats 1.5 m above the centre palace |
| Lantern | (1.0, 0, −186.5) | 1.8 m octagonal. Flame at (1.0, 1.35, −186.5). Bearing from the grove centre ≈ 181.6°, inside 午 (172.5° to 187.5°), the fire palace |
| Stele | (−1.4, 0, −188), faces north | Screen-left of the lantern from the approach |
| Ledge | z −192 | Ground drops to y −25 beyond |

Scatter keep-outs, used by Poisson-disc placement: the path corridor (2 m either side of the spline), the lantern sightline corridor, r 10 around the cabin centre (4, 0, −63), r 18 around the grove, r 6 around (−0.2, 0, −187.2).

The hall overlaps the forest behind the cabin in world space. That is fine: outside, the hall only draws inside the door's stencil, and inside, the exterior is hidden. The two never draw into the same pixels.

---

## 6. Camera path, pacing and hash targets

### 6.1 Beat table, desktop landscape

`A → B` means the camera moves from A to B over the beat. Holds are flat spans where the camera drifts only a few centimetres. Zone names are defined in 6.4.

| Beat | jvh | Hold | Position | Look at | vFOV | Fog | Zone | What happens |
|---|---|---|---|---|---|---|---|---|
| T0 hero | 0–40 | 0–35 | (0, 1.6, 24) → (0, 1.6, 22.5) | (0.8, 2.8, −20) | 40 | 0.040 | L | Hero copy. Lantern glint near centre. Canvas develops from paper on first frame |
| T1 step in | 40–90 | | → (0.2, 1.7, 7) | → (−0.4, 2.1, −30) | 40→42 | →0.032 | none | Hero copy fades out 40–65 |
| F1 services I | 90–150 | 100–142 | (−0.6, 1.7, 2) → (−0.8, 1.7, −6) | (1.2, 1.9, −34) | 42 | 0.030 | L | "What I build", services 1 and 2. Roll 1.5° into the curve |
| F2 wipe | 150–168 | | → (0.6, 1.7, −14) | → (−0.8, 1.8, −40) | 42 | 0.030 | none | Pine B passes within 2.2 m on screen-left and fills 40% of the frame |
| F3 services II | 168–222 | 175–215 | (0.9, 1.7, −22) → (0.4, 1.7, −30) | (−0.6, 1.8, −52) | 42 | 0.030 | L | Services 3 and 4 |
| F4 cabin in mist | 222–245 | | → (1.4, 1.8, −42) | → (4, 2.0, −60) | 42 | →0.022 | none | The cabin resolves ahead-right. Cyan in the plank gaps |
| C1 portrait | 245–275 | 250–272 | (4, 1.65, −53) → (4, 1.65, −53.6) | (4, 1.8, −60) | 42 | 0.022 | L | Door centred and closed. 木屋 inscription and bridge line. Main peak above the roof |
| C2 door | 275–292 | | → (4, 1.65, −54.6) | (4, 1.7, −60) | 42 | 0.022 | none | Door swings 0° to 95° over 276–290, scrubbed by scroll. Stencil portal on from 274 |
| C3 the nudge | 292–308 | 296–306 | → (6.6, 2.2, −55.2) | (4, 1.5, −60.3) | 42 | 0.022 | none | Signature moment 1. See 8.3 |
| C4 cross | 308–322 | | (4.2, 1.7, −57.4) → (4, 1.65, −59.0) → (4, 1.65, −61.6) | (4, 1.9, −80) | 42→55 | interior | none | Swing back onto the door axis and dolly through while FOV widens. Door plane crossed at about 316 |
| I0 ignition | 322–336 | | → (4, 1.7, −63.5) | (4, 2.3, −90) | 55 | 0.030 night | none | Traces light from under the camera (time-based, 2.5 s) |
| I1 hall | 336–380 | 345–375 | (4, 2.3, −65) → (4, 2.5, −67) | (4, 3.8, −96) | 55→52 | 0.030 | L | Cabin intro. **`#cabin` arrives at 345** |
| I2 scroll 1 | 380–405 | 387–403 | (5.0, 1.75, −71.4) | (0.9, 2.3, −75) | 50 | 0.030 | R | Project card 1 |
| I2 scroll 2 | 405–430 | 412–428 | (3.0, 1.75, −77.4) | (7.1, 2.3, −81) | 50 | 0.030 | L | Project card 2 |
| I2 scroll 3 | 430–455 | 437–453 | (5.0, 1.75, −83.4) | (0.9, 2.3, −87) | 50 | 0.030 | R | Project card 3 |
| I2 scroll 4 | 455–480 | 462–478 | (3.0, 1.75, −89.4) | (7.1, 2.3, −93) | 50 | 0.030 | L | Project card 4 and the "Also" list |
| I3 terminal | 480–528 | 488–524 | (4, 1.75, −96.9) → (4, 1.75, −97.2) | (4, 1.85, −99.9) | 45 | 0.030 | pane | Terminal, square-on. Section 10 |
| I4 moon gate | 528–572 | | (5.7, 1.8, −100.4) → (4.2, 2.1, −104.4) | (4, 2.35, −112) | 50 | whiteout 562–572 | R | Step round the desk to the gate. The timeline scrolls past in zone R. Stage swap at 572 under full paper |
| P0 emerge | 572–584 | | (3.0, 1.7, −69) → (2.6, 1.7, −74) | (1.6, 1.5, −95) | 45 | 0.30→0.032 | none | Out of paper behind a small cabin. The camera never looks back |
| P1 stream | 584–608 | 588–604 | (2.3, 1.75, −79) → (1.8, 1.8, −88) | (0.6, 1.8, −110) | 45 | 0.032 | R | Stepping stones. Grove intro line |
| P2 mist wall | 608–628 | | → (0.5, 3.2, −112) | (0.3, 3.3, −132) | 45 | →0.14 | none | Near-whiteout; trees 3 m away are ghosts. Guqin harmonic at 622 |
| P3 mist parts | 628–645 | | (0.3, 3.7, −119) → (0, 4.5, −124) | (0, 0.45, −150) | 45 | 0.14→0.012 over 630–642 | none | Crest, tilt down. The clearing opens; the lantern glints beyond the south trees |
| G0 descend | 645–660 | | → (0, 7.0, −132) | (0, 0.45, −150.3) | 45 | 0.012 | none | |
| G1 the seat | 660–715 | 666–712 | (0, 8.5, −134) → (0, 8.8, −134.6) | (0, 0.45, −150.5) | 45 | 0.012 | TL | Casting plays (9.5). **`#grove` arrives at 666** |
| G2 rise | 715–740 | | → (0, h_fit, −150.001) | (0, 0, −150), `camera.up` blends (0, 1, 0) → (0, 0, −1) | 45→40 | 0.008 | none | Pitch straight down, south stays at the top of the screen |
| G3 read | 740–835 | 742–833 | (0, h_fit, −150.001) | (0, 0, −150) | 40 | 0.008, ground mist → 0 | panel | Plan view. Chart panel, time controls, glosses, compass. No drift |
| G4 glide | 835–862 | | (0, 12, −156) → (0.6, 3.4, −170) | (0, 0.45, −152) → (1.0, 2.2, −186.5) | 40→45 | 0.012 | none | Over the rings toward the lantern; `up` returns to (0, 1, 0) |
| E0 warm | 862–880 | | → (0.5, 1.8, −175.5) | (0, 2.6, −188) | 45→48 | 0.020 | none | Lantern light on the nearest trunks |
| E1 stele | 880–935 | 886–932 | (0.3, 1.2, −179.8) → (0.3, 1.25, −180.2) | (−0.5, 3.6, −188) | 48 | 0.020 | L | Low angle, 高远: stele, lantern, peak above. **`#contact` arrives at 886** |
| E2 the painting | 935–985 | | waypoints (0.3, 1.25, −180.2) → (−9, 6, −184) → (−24, 16, −200) → (−16, 25, −228) → (3, 30, −240) | (−0.5, 3.6, −188) → (−0.4, 2.5, −187.5) → (0, 0, −170) → (1, 0, −150) → (1.5, 0, −142) | 48→45 | 0.020→0.006 | none | Ascending orbit round the east side. The walk lays itself out north of you. Signature moment 3 |
| E3 signed | 985–1000 | 985–1000 | (3, 30, −240) | (1.5, 0, −142) | 45 | 0.006 | mount | Seal stamps, colophon, map pins, "Walk again" |

Two derived values:

- `h_fit` solves the camera height so the R4 outer circle (r 11.3) plus 1 m margin fits the chart viewport rectangle, which is the screen minus the DOM chart panel. At 16:9 with the panel on the right third it comes out near 34 m. Recompute on resize.
- In G3 the chart is shifted into the chart viewport with `camera.setViewOffset`, not by moving the camera, so the plan view stays perfectly orthogonal-looking over the platform centre.

Check for E2: from (3, 30, −240) at 17° pitch, the lantern sits about 11° below centre, the grove near centre, the cabin about 7° above and the threshold about 10° above. Near is at the bottom and far is at the top, which is how a hanging scroll (立轴) is composed. If the spline wobbles through the swing, implement E2 as a parametric orbit around (−0.2, 0, −187.2): yaw 0° to 180° via the east side, radius 8 to 53 m, height 1.25 to 30 m.

### 6.2 DOM sections and hash targets

The DOM is the scroll track (`stack.md` §2–3). Each `<section>` has a fixed height in `svh`. Inside it, each beat is a `div.beat` whose height is the beat's jvh span, holding a `position: sticky` copy card, so the card holds while the camera holds.

| Hash | Section id | Span (jvh) | Height | Arrival jvh (u) | Jump emerges from | Nav active |
|---|---|---|---|---|---|---|
| none (`#threshold` accepted as an alias, then replaced with the bare path) | `threshold` | 0–245 | 245 svh | 0 (0.000) | T0 pose pulled 3 m back | "Top" on mobile, nothing on desktop |
| `#cabin` | `cabin` | 245–572 | 327 svh | 345 (0.345) | The C4 pose just outside the open door at jvh 312. It glides through the door with the dolly zoom, so every jump into the cabin still passes the door | Work |
| `#grove` | `grove` | 572–862 | 290 svh | 666 (0.666) | (0, 40, −140), descending through cloud onto the seat | Grove |
| `#contact` | `contact` | 862–1000 | 238 svh (138 + the final 100) | 886 (0.886) | The E0 pose at jvh 872 | Contact |

- Nav clicks `pushState` the hash and fog-dive (section 11). `popstate` fog-dives to wherever the hash points. Deep links on first load start in full paper and run only the emerge step.
- Scrolling updates the hash with `replaceState` when the active section changes, debounced 300 ms. It never pushes.
- With JavaScript off, the anchors jump natively to the section tops. That is fine: the static layout has no camera.
- `SectionDefinition.arrivalU` in `stack.md`'s registry takes the arrival values above.

### 6.3 Rig rules

- Position and look-at run on two centripetal Catmull-Rom splines through the beat waypoints. A piecewise-linear map from jvh to spline parameter makes holds flat. All numbers live in one data file, `src/core/world/journey.ts`, so tuning means editing numbers.
- Damping with `maath/easing.damp3`: position smooth time 0.35 s, look-at 0.25 s, so the eyes turn slightly before the body. Low tier uses 0.25 s for position, which feels more attached on a laggy phone. FOV goes through the same damping. No FOV snaps.
- Breath: on holds, a 2 cm vertical drift at 0.1 Hz and a 0.15° yaw drift at 0.07 Hz.
- Roll: none, except the 1.5° lean through the forest S-curve (F1 to F3).
- Pointer parallax: desktop exterior holds only, up to ±1.2° yaw and ±0.6° pitch, damped over 0.8 s. Off in the cabin, off in the grove (people are reading and clicking there), off on touch, off with reduced motion. No gyroscope parallax.
- Catch-up: when the camera lags its scroll target by more than 25 m (End key, scrollbar drag, a hard fling), fog rises in proportion to the lag through `uLocalFogBoost`, and clears once the lag is under 5 m. The camera never visibly sprints through the forest.
- Door and gate events that are time-based (ignition, casting, seal) play once going forward and never run in reverse. Scrubbing backwards through them shows their end state.

### 6.4 Text zones and portrait framing

- Desktop zones: **L** is the content column on the left, max 30rem wide, 6vw from the edge, vertically centred. **R** mirrors it on the right. **TL** is the inscription area under the header. **pane** means the terminal overlays the 3D pane. **panel** is the grove chart panel on the right third. **mount** is the finale layout (8.7).
- Composition rule: every keyframe keeps dark masses out of its text zone. `camera.setViewOffset` shifts the principal point so the subject centres in the 60% of the screen the text doesn't use. That rule is for whoever tunes the camera; the mist pocket behind each card is the safety net.
- Mobile portrait, zone **B**: copy cards are bottom-anchored, 92vw wide, above the bottom bar, at most 45% of the height. The view offset centres the subject in the top 55%.
- Portrait vFOV: derived from a 46° horizontal FOV, clamped to 55° to 68°. Ground-level look targets rise 1.5 m so the horizon sits near 62% of the screen height.
- Per-beat portrait overrides:

  | Beat | Override |
  |---|---|
  | T0 | Position (0, 1.6, 28). The hero accent sits top-left; name, role, pitch and links in zone B |
  | C3 | Nudge 1.8 m instead of 2.6 m: (5.8, 2.1, −55.2) |
  | I2 | Camera on the centre line x = 4, looking at the scroll; card in zone B |
  | I3 | Camera frames the pane in the top half; the terminal opens as a sheet (10.2) |
  | G1 | Steeper seat: (0, 14, −137) |
  | G3 | The R4 circle fits the screen width and centres 30% from the top; the chart sheet sits below |
  | E1 | Stele centred, vFOV 58 |
  | E2, E3 | Portrait is already a hanging scroll. No mount panels, a 12 px `paper-mount` border only |

Mobile uses the same jvh table as desktop. The copy cards were sized so each hold reads in one thumb-scroll.

---

## 7. Shared rendering model

This follows `stack.md` §5–6: one ink post pass outdoors, one bloom and AgX group indoors, toggled with `EffectGroup`, never rebuilt. The notes below are what this design adds on top.

### 7.1 Ink world materials

- `createInkMaterial()`: an unlit `ShaderMaterial`. No three.js lights anywhere outside, and no shadow maps on any tier. Shan shui has no cast shadows, and skipping them is the biggest single performance saving in the project.
- Painter's light, fixed direction `normalize(−0.5, 0.8, 0.35)`: from the upper left of a south-facing viewer, slightly from behind. Wrapped Lambert `lam = dot(N, L) * 0.5 + 0.5`.
- Per-object `uInkWeight` from 0 (清) to 1 (焦). Output value `v = inkWeight * mix(1.0, 0.55, smoothstep(0.25, 0.85, lam))`, times baked vertex AO (darker toward trunks and under eaves). The post ramp maps the resulting luminance to the five inks.
- 皴 texture strokes only on the shaded side (`lam < 0.55`), where painters put them. One `cunStroke()` GLSL helper with two modes: axe-cut (short angular wedges) for rocks, the peak, grove stones and the stele; hemp-fibre (long soft waves) for earth banks. The mountain shader adds 米点 dabs along far ridge crests. Low tier draws strokes on hero rocks and grove stones only.
- Warm light without a light: `uLanternPos` and a 14 m radius. Within it, lit faces tint toward `lantern-halo` by `(1 − d/14)² × 0.35`. Keep the tint's saturation above the ink pass's accent threshold for trunks within 6 m, or the ramp will grey it out.
- Cyan spill: the same mechanism with `uSpillPos` at the door, 6 m radius, `cyan-line`, switched on as the door opens (C2). It tints the door frame, steps and nearest ferns.
- Sway: pine pads 1 to 2 cm at the tips, 4 to 7 s period, in the vertex shader. Off with reduced motion.

### 7.2 Environment

- **Pines** (`stack.md` §4): 3 to 4 procedural variants, each a bent trunk plus 4 to 7 flattened, nearly horizontal needle pads, as painted pines are drawn. Merged per variant into one `InstancedMesh`. Ragged pad edges by noise `discard`. Tone per instance: 焦/浓 near, 淡 far. Tier changes set `mesh.count`. Corner pine A and wipe pine B are unique meshes with more branch tiers and a Voronoi bark-scale (鳞皴) pattern.
- **Mountains**: opaque planes with a shader ridge (`stack.md` §5). The ridge ring gives mountains on every side. The main peak is one taller card with axe-cut strokes.
- **Mist**: the post fog (distance plus height plus drifting noise) does most of it. Horizontal mist planes (paper, fbm alpha, `depthWrite: false`) add the belts painters use to cut mountains at the waist (山腰云). Counts by tier in section 13.
- **Paper grain**: a 512 px tileable fibre WebP multiplied in the ink pass on every tier. A paper-toned vignette toward `paper-shade` at the corners. Never a dark vignette outdoors.

### 7.3 Three additions to the ink pass

1. **Interior flag.** Interior materials write alpha = 0. Opaque ones do it directly; additive ones use custom blending with `blendSrcAlpha = ZeroFactor`, `blendDstAlpha = OneFactor` so alpha stays 0. The clear alpha is 1. `InkEffect` skips fog, ramp, edges and grain wherever `inputColor.a < 0.5`. Without this, the hall seen through the open door gets fogged to paper by the outdoor pass, because its depth is 15 to 45 m away. `stack.md` doesn't cover this case.
2. **Glints.** Two screen-space glint slots, composited after fog: `uGlint[i] = (screen uv, view depth, size px, alpha)`. Slot 0 is the lantern, a 2 to 4 px `lantern-core` core with a 10 px `lantern-flame` halo at 35%, flickering between 0.92 and 1.0 at about 1 Hz. Slot 1 is the cyan pinprick of the cabin, used only in E2 and E3. Occlusion takes one depth tap: hide the glint if the scene is nearer than the glint's depth minus 0.5 m at that pixel. The glint fades in once the camera is more than 25 m from the lantern. Closer than that, the real flame billboard takes over. A glint sprite in the scene would not survive the fog, because the post fog reads depth behind it and erases it to paper.
3. **Finale flattening.** A `uFlatten` uniform, 0 to 1 during E2: dither amplitude up 50%, ramp bands narrowed to five hard steps, edge width up 1 px. The walk turns into a flatter, more painted image as it becomes a picture.

### 7.4 Cabin render

- The cabin group runs Bloom (mipmap blur, luminance threshold 0.9) plus AgX plus `FinishEffect` (2% mono grain, dither, dive). Emissive values above 1.0 are what bloom catches. Low tier: no bloom; additive halo sprites on scroll edges and brackets fake the glow.
- Interior materials apply their own exp² fade to `night` at density 0.030, since the outdoor fog lives in the ink pass.
- Everything inside is drawn in lines or light. No PBR, no chrome, no glass reflections, no screen-space reflections.

---

## 8. Sections

Each section lists composition, elements, materials, light and fog, animation, interaction, DOM placement and mobile notes. Everything is procedural unless marked.

### 8.1 Threshold, 0–90 jvh, 平远

**Composition.** Eye height at the edge of an open paper meadow. Corner pine A fills the right edge and throws a long branch across the top-right. The forest band crosses the lower 45% in layered tones: near 浓, then 重, then 淡 fading to paper. Three ridge layers show through at 55 to 65% of the frame height. The top-left third is empty paper, and that is where the name sits. Near the centre, just below the horizon, the lantern glint: a 3 px amber point, the only colour on screen.

**Elements.** Ground plane (paper with sparse grass strokes as tapered quads, z 20 to 10). Corner pine A. `PineField`. Ridge ring. One or two mist planes. Lantern glint (7.3).

**Fog.** 0.040, height falloff heavy below 3 m so the tree bases dissolve.

**Animation.** Mist drifts west at 0.2 m/s. Pine sway. Glint flicker. The camera drifts 1.5 m forward through the hero hold.

**First frame.** The DOM is readable before WebGL exists. The page background is `paper` with a CSS mist gradient matching the K0 frame's tone. When the first two in-budget frames render, the canvas develops like ink soaking into paper: each pixel appears once `(1 − luminance) + noise × 0.3` passes a threshold sweeping from 1.3 to 0 over 1.8 s, so the darkest ink lands first. Scrolling during the reveal finishes it in 300 ms. Reduced-motion opt-in users get an 800 ms opacity fade instead.

**DOM, zone L, in reading order.**
1. Hero accent 入林 (see section 18), vertical, `hero-cjk`, `ink-jiao`, inline SVG, with its gloss "rù lín · into the forest (林 is also Lim)". The 白文 林 seal at 44 px sits below-right, like a painter's signature.
2. `<h1>` "CY Lim". The full name "Chee Yeong Lim" in meta and JSON-LD only.
3. Role line: "Software engineer in Penang, Malaysia."
4. Positioning line, content.md §2 option 1.
5. Sub-line, content.md §2.
6. Links row: GitHub, X, LinkedIn, Blog as icon plus short label, each at least 44 px tall, `rel="me"`. Wraps 2 × 2 on mobile.
7. Scroll cue at the bottom centre: "Scroll to walk in" in `label` type over a 1 px `ink-zhong` line that grows 24 px downward over 3 s and loops. Static under reduced motion. No bouncing arrow, no mouse icon.

**Mobile.** T0 portrait override (6.4). Accent top-left at 18vw; items 2 to 6 in zone B.

### 8.2 Forest walk, 90–245 jvh, 深远

**Composition.** A slow S-curve down a corridor of pines. Depth reads in five tonal planes: 焦 trunks within 1.5 m, partly out of frame, then 浓, 重, 淡, 清, with mist planes between them. At F2, wipe pine B passes within 2.2 m on screen-left and fills 40% of the frame for about 15 jvh. That wipe separates the two service cards.

**Elements.** `PineField` crowding 3 to 6 m from the path. Pine B. The axe-cut rock. Ferns and grass strokes along the path edges (instanced tapered quads). Moss dots (点苔) near trunks.

**Fog.** 0.030, breathing ±0.004 over a 12 s cycle. The far fog tint drifts from `paper` toward `paper-shade` as the forest deepens.

**DOM.** `<h2>` "What I build" opens the F1 card. Two sticky cards in zone L:
- F1 card: services 1 and 2, title and description from content.md §3.
- F3 card: services 3 and 4.

Each service is an `<article>` in document order, so screen readers get a plain list. Services moved here from the cabin intro on purpose: the walk through the trees should answer a client's first question, "what do you do?", before the cabin shows proof. Owner decision, section 18.

**Mobile.** Near-layer tree density halved so trunks don't cross zone B.

### 8.3 Cabin exterior, 245–322 jvh

**Composition.** 高远 after Fan Kuan's 溪山行旅图: a small hut at the foot of a peak that fills the sky. At C1 the cabin sits centred, 6.5 m away, the main peak rising behind the roof into a mist belt, the zone L paper empty for text. The cabin is dark ink and wrong in one detail: thin cyan lines where the planks meet, and a cyan bar under the door. It is the first cold colour on the site, 245 jvh in, and against the ink it should feel almost alarming.

**Elements.**
- Stone footings (0.45 m, `stone` with Voronoi ink cracks) and two steps.
- Walls: instanced horizontal planks 0.22 m high, 6 to 10 mm gaps, random 0 to 1 cm offsets.
- Roof: overhanging gable (悬山), 40° pitch, thatch drawn with dense hemp-fibre strokes and a dark eave line.
- Door: 1.0 × 2.0 m planks with an iron ring pull, strap hinges on the east side, swings inward.
- Lattice window in the 步步锦 pattern at (2.6, 1.9, −60).
- The leak: an emissive `cyan-line` box 4.8 × 2.5 × 5.8 m inside the plank shell, visible only through the gaps, the lattice and the 2 cm door gap. It is exactly the size of the outside. That is the joke.
- Chimney smoke: a vertical ribbon displaced by noise, alpha fading upward.
- Close trunks behind the cabin, `ink-nong`, with no fog between them and the camera at C3, so they read as close.
- The door opening is a drei `<Mask id={1}>`. Section 8.4 covers what renders through it.

**Beats.**
1. F4, emergence. The cabin resolves out of the mist ahead-right.
2. C1, the portrait. Symmetrical, door centred and closed. The 木屋 inscription brushes in at TL.
3. C2, the door. Scroll turns the door inward from 0° to 95°. Cyan floods out as a trapezoid on the ground (an additive decal shaped by the frame), and the spill term lights the frame and steps. Through the widening gap: the hall.
4. **C3, the nudge.** The camera slides 2.6 m west and rises 0.55 m, eyes on the door. Two things happen at once. The close trunks behind the cabin slide across its roofline with strong parallax, which proves they stand 2 m behind the back wall and that the cabin is 6 m deep. Meanwhile the view through the door barely moves, because the posts in there are 15 to 45 m away. The eye catches the contradiction before the brain names it. No caption; the picture does the work. From here you also see the cabin's west side wall and the hall through the door in the same frame, which the gag needs.
5. C4, entry. The camera swings back onto the door axis and dollies through while vFOV widens from 42° to 55°, so the space opens outward around you.

**Interaction.** Hovering the door or lattice raises the leak from 1.0 to 1.4 over 600 ms and shows a pointer cursor. Clicking either smooth-scrolls to jvh 318 (a local scroll, not a fog-dive).

**DOM, C1, zone L.** `<h2>` "The Cabin" with a "Work" label above it. Then one bridge line, proposed in section 18: "In old landscape paintings there's always a hut, and in the hut there's always a scholar at a desk. This one writes software." Nothing else. The intro waits for the inside.

**Mobile.** Door at about 30% of the frame height. Nudge 1.8 m. Check on a 360 px wide screen that the side wall and the doorway both read at C3.

### 8.4 Cabin interior, 322–572 jvh

**The idea.** A scholar's study (书斋) drawn in light, inside an ink painting turned inside out. The first metres are an honest cabin room at cabin scale. Past that, the plank walls come apart and drift into the dark, and what remains is a timber frame receding 40 m into night: paired posts, glowing bracket sets, a lit floor. Wood turns into circuitry and the walk shows it happening.

**Crossing the door.** At the door plane (z −60) the camera sets `insideCabin`. The exterior group goes `visible = false`, interior materials swap to their pre-built no-stencil twins (no recompile), and `postBlend` tweens 0 to 1 over 400 ms. Chrome crossfades to night. The forest bed ducks and the hum opens up.

**Geometry, world coordinates.**

| Part | Placement | Notes |
|---|---|---|
| Near room | x 1.8 to 6.2, z −60 to −64, ceiling y 3.05 | Honest planks, the same instanced plank geometry as outside, traces in the grain |
| Dissolve zone | z −64 to −72 | Wall planks separate with a gap growing 0 to 0.6 m, drift outward and up, and bob a few mm/s |
| Floor | x −3 to 11, z −60 to −106, y 0.45 | Wide planks with `CircuitWood` |
| Post pairs | x 0 and 8, at z −72, −78, −84, −90, −96, −102 | 6.5 m tall. Each capped with a 斗拱 bracket set: 栌斗 base block, crossing 拱 arms, small 升 blocks, drawn as `EdgesGeometry` line segments in `cyan-line`. Interlocking standard parts: the oldest component library in Chinese building |
| Beams | y 7.4 across each pair | `cyan-ghost` lines |
| Night shell | inward box x −25 to 33, y −5 to 30, z −60 to −130 | `night`, with about 300 irregular cyan points 20 m or more away. Never a grid. It guarantees the door never shows paper where the hall has no geometry |
| Back wall | z −106, 10 × 7 m planks | Holds the moon gate |
| Moon gate | centre (4, 2.35, −106), r 1.6 | A round opening (月洞门) filled with a bright `paper` mist shader |
| Dust | instanced points drifting upward in slow curls | 0 / 300 / 800 by tier |

**`CircuitWood`.** Every cyan line must trace back to a grain line, a joint or a knot. A 1024 × 256 trace texture is generated once at startup in a worker (`OffscreenCanvas`, fixed seed; main-thread fallback). Grain isolines come from domain-warped noise stripes along the plank. A router follows each isoline, snaps it to 0° and 45° segments, and drops vias and pads at knots. Channel R is trace coverage, G is distance along the trace, B is via masks. One texture is shared by every plank with random UV offsets. Emission `trace × (base + pulse)`, with `pulse = smoothstep(0.02, 0.0, abs(fract(G × 4 − t × speed) − 0.5))`. Pulses flow toward the scrolls and the desk. Wood base tones `#2A1E16` to `#3B2A1F` read as near-black under the grade. Low tier: static traces, no pulses.

**I0, ignition.** On the first crossing, traces light outward from the threshold under the camera along the grain at 12 m/s: floor first, walls 300 ms later, brackets last. 2.5 s, time-based. Crossing again later replays a 0.8 s version.

**I1, the hall.** The camera tilts up so the frame rising into the dark registers. DOM, zone L: the cabin intro from content.md §3. Its line "The panels in here are selected work" stays as written; the panels are the scrolls.

**I2, four project scrolls (立轴 of light).** The brief's holographic panels, mounted as hanging scrolls, because a scholar's study hangs scrolls and a portrait phone is already scroll-shaped.

| Scroll | Centre | Side on screen | Card zone |
|---|---|---|---|
| 1 | (0.9, 2.45, −75) | left | R |
| 2 | (7.1, 2.45, −81) | right | L |
| 3 | (0.9, 2.45, −87) | left | R |
| 4 | (7.1, 2.45, −93) | right | L |

- Each is 1.1 × 2.8 m, yawed 25° toward the centre line x = 4, hung by two cords from a light rod.
- Mount proportions follow real hanging scrolls, top margin (天头) about twice the bottom: 0.45 m top margin with the project title in Cormorant (paper colour, troika); 1.6 m image core (画心); 0.45 m text zone with role, years and stack tags in JetBrains Mono; roller ends (轴头) as small glowing caps.
- Image core: the project screenshot (512 px WebP, 384 px on low tier) remapped to a duotone from `night` to `cyan-line` through a luminance ramp, so any screenshot looks on-brand. NDA work gets a procedural emblem seeded from a hash of the project name.
- Surface: `cyan-line` at 6% fill, edge glow from UV distance to the border, faint horizontal silk-weave lines at 4%. It reads as hologram and as silk at once.
- Unroll: the first time each scroll enters view it unrolls from the top rod down over 700 ms, a glowing roller moving down while a shader clip reveals the mount. Reduced motion: already unrolled.
- Hover (desktop) or focus of its DOM card: the scroll steps 0.2 m toward the camera, brightens 30%, and its traces pulse toward it. Click, tap or Enter opens the card's `<details>`. No modal, no focus trap.
- DOM: one `<article>` card per scroll on the opposite side (zone in the table): index "01 / 04" in `label`, `<h3>` title in `cyan-line`, context and role, years, one-line description in `cyan-soft`, tags as a plain list in `mono` 12 px `cyan-dim`, link. `<details>` holds the longer write-up. The scroll-4 card ends with an "Also" list of the remaining selected-work items from content.md.
- Four of content.md's six items are featured. The owner picks which (section 18).

**I3, the terminal.** A low writing desk (书案) at (4, 0.45, −99.6), 1.8 × 0.8 m, top at y 1.20, drawn in `cyan-line` edges. On it: an inkstone whose well faintly reflects the terminal, a brush rest (笔山) shaped as five small peaks, which is the landscape outside in miniature, a brush on the rest, and one sheet of paper, the only paper-coloured surface in the room, faintly lit, with the 朱文 林 seal in its corner. The pane floats above the desk. Full spec in section 10.

**I4, the timeline and the moon gate.** The camera steps round the desk toward the gate. The compact timeline from content.md §3, a `<table>` with a caption, scrolls up through zone R as the page scrolls, like end credits. The gate's rim is `cyan-line`, and it lerps toward `ink-nong` as the camera closes in, while the paper mist inside brightens. The site is turning back into ink. The paper overlay takes over from 562, and the stage swaps to the path under full paper at 572.

**Mobile.** vFOV 62. Scroll stops centred with no side offset; the card is a bottom sheet at 45%. The hall's post spacing stays; only dust and pulses drop by tier.

### 8.5 Path to the grove, 572–645 jvh

**P0, decompression.** The camera comes out of paper behind the cabin, which is small again, and never looks back. Fog falls from 0.30 to 0.032. After the hall, the ink world should feel like cool air.

**P1, the stream.** A 2.2 m stream at z −85, drawn the way painters draw water: `paper` with a few horizontal ink ripple lines (水纹), animated on medium and high tiers, static on low. Five stepping stones, flattened noise-displaced icosahedra in `stone`. The bamboo clump on medium and high tiers: segmented stems and leaf strokes, a calligraphic accent. 林泉, "forests and streams", is the title of Guo Xi's essay; this is the nod. DOM, zone R: the grove intro from content.md §4, starting "I practise fengshui and Qimen Dunjia." plus the owner's own sentences when they exist.

**P2, the mist wall.** The ground rises. Fog climbs to 0.14, close to whiteout but not all the way. The master low-pass closes and the forest bed drops away. At 622 a single guqin harmonic rings if sound is on. This is the moment of doubt: the visitor has no idea what is ahead. The grove chunk must be ready here. If it isn't, the fog holds at peak ("the mist waits for you") while the DOM keeps scrolling normally, and after 1.5 s the section chip shows "Grinding ink…" with the seal breathing.

**P3, the mist parts.** Fog drops from 0.14 to 0.012 over 12 jvh, fast, like a curtain lifting, as the camera crests and tilts down. Below: dark stone rings in a bowl of ground mist, ringed by old pines. Beyond the far trees, to the south, the lantern glints again.

### 8.6 The grove, scene, 645–862 jvh

The chart itself is section 9. This covers the scene around it.

**Composition.** A round clearing around a square platform: round heaven over square earth (天圆地方). The design follows a real object, the Western Han nine-palace divination board (太乙九宫占盘) excavated in 1977 at Shuanggudui, Fuyang, which has a round heaven plate over a square earth plate. The grove builds that board at walking scale and adds a luopan's rings. The DOM copy says it is a design built on the board and the luopan, not a traditional instrument.

**Elements.**
- Platform, rings, apron, needle and inscription band (section 9).
- A stone floor disc, r 6.6, top y 0.10, under the platform.
- Ground mist: a height band below y 0.4 at density 0.25 with drifting fbm. Inside r 11 it thins to nothing, so the chart looks as if it is holding the mist back. It fades to zero during G2 so the plan view is clean.
- Standing stones at the entrance. Old pines, the oldest and most crooked of the variants, at r 18 to 28.

**Lighting and fog.** Painter's light only. Fog 0.012 at the seat, 0.008 overhead. The mist band opens above the clearing into a disc of plain paper, the only open sky on the walk.

**Why the seat is in the north.** Standing north of the platform facing south puts south at the far edge of the picture and east on the left. That is exactly the traditional printed chart, and it is also compass-true, so the site never has to choose. It is also 坐北朝南, "sit in the north, face south", the orientation of a well-sited house. And from the seat, the lantern glints just past the south edge, in the direction of palace 9, the fire palace. Nobody has to notice. Practitioners will.

**DOM.**
- G1, zone TL/L: the 九宫 inscription, `<h2>` "The Grove", the chart lead and "what a chart is" copy from content.md §4, the cast label "Cast for {localDateTime}, {timeZone}", and a "Read the chart" button that smooth-scrolls to jvh 742. First visit only: the hint "Hover or tap any character for its meaning."
- G3, panel: the chart panel (9.8).

**Mobile.** G1 seat steeper. In G3 the platform takes the top 55% and a bottom sheet holds three tabs, Chart, Time, Compass. It peeks at 30% and expands to 85%.

### 8.7 Exit and finale, 862–1000 jvh

**E0.** Into the southern trees. The lantern's warm term reaches the nearest trunks and their lit sides turn faintly amber. After 860 jvh of paper and ink this should feel like walking toward a lit window at night.

**E1, the stele, 高远.** A low angle at 1.2 m, looking up. The stele stands left of centre, the lantern right of it and slightly nearer, and above both the main peak rises out of a mist belt into the top 40% of the frame.
- Stone lantern in the Chinese octagonal pillar form, after the Northern Qi lamp at Tongzi Temple, Taiyuan: octagonal plinth, octagonal shaft, a lamp chamber with four openings, a flared octagonal eave with only a slight lift at the corners, a pearl finial. `LatheGeometry` with 8 radial segments gives octagons for free. Not the Japanese kasuga silhouette with its broad umbrella roof.
- Flame: a noise-driven billboard from `lantern-core` to `lantern-flame`, breathing on a 3 to 5 s cycle with fast flicker on top (amplitude kept low for photosensitive visitors). A `lantern-halo` light pool on the ground at 35%. The warm uniform term (7.1) does the rest; no point light.
- Stele (碑): a Han-style round-headed tablet (圆首碑), 0.9 × 2.6 × 0.28 m, on a plain 0.4 m base. No turtle, no dragons. Face in `stone`: the stele line from content.md §5 and four carved rows, each a brand mark and its "shown as" text, as normal-mapped decals filled with ink. No real geometry is cut.
- DOM, zone L, sticky through E2: the 石灯 inscription, `<h2>` "Contact" with "The Lantern" as its label, the stele line, then four link rows at least 56 px tall: icon, label, the visible "shown as" text from content.md, `rel="me"`. No email, no form. Hovering or focusing a row lights its carved row with warm light over 250 ms and leans the flame slightly toward the stele. The 3D rows take hover and click too, but the DOM anchors are the real links.

**E2, the painting.** The camera rises in an orbit round the east side and turns to look north, back over the whole walk. At the same time:
- Fog falls to 0.006 so the whole route shows at once.
- Three mist belts fade in: tall horizontal mist planes spanning x −150 to 150 at z −165, −105 (the mist wall, now seen from outside) and −40. They are the horizontal bands that separate layers in a hanging scroll.
- `uFlatten` goes to 1 (7.3).
- Glint slot 1 turns on at the cabin, (4, 3.2, −60): one pinprick of cyan where its planks leak.
- Landscape screens: `paper-mount` panels slide in from both sides and leave a centred window at a 3:4 ratio, an album leaf (册页). While the mount is closed the renderer scissors to the window. Portrait screens are already hanging-scroll shaped and get only a 12 px border.

Read bottom to top, the frame is the walk in reverse: the lantern glowing at the bottom, the grove's dark rings in the lower middle, the cabin roof with its speck of cyan above that, the forest edge and meadow, the northern ridges at the top. It holds exactly three points of colour: amber, cyan, and soon red.

**E3, signed.** Time-based, once per visit:
- The 林 seal (朱文, 64 px) stamps into the lower-right corner of the window, with a thud if sound is on. Silence after it.
- The colophon (题跋) writes itself in the empty upper left, vertical, in WenKai, dated for this visit in the traditional calendar, for example `丙午年 秋分后五日 戌时 · 林 写于槟城`. English under it in `body`: "Inscribed in Penang for your visit, five days after the autumn equinox, in the Bing-Wu year, at the hour of the Dog. 林 is Lim. Two trees make a forest." Rules: the sexagenary year turns at 立春, not 1 January; the term day reads 秋分日 on day 0 and 后N日 in Chinese numerals for days 1 to 14; values come from the same calendar adapter as the chart, and the term day counts on the chart's day boundary, so under zi23 the 23:00 hour already belongs to the next day (23:30 on the eve of 秋分 reads 秋分日 子时; wave3c CD-6). On landscape the colophon sits on the left mount.
- Three DOM map pins float over their world positions: Work at the cabin roof (4, 5, −63), Grove at the platform (0, 0.5, −150), Start at the meadow (0, 2, 20). They are real links, projected every frame, hidden when outside the window. Tapping one fog-dives there. The finale doubles as a map.
- The link rows from E1 stay visible (the right mount on landscape, zone B on portrait), with "Walk again" (fog-dive to the top), "Still version", and the footer from content.md §5.

---

## 9. The Qimen chart in 3D

Method: 时家奇门, 转盘, 拆补法, cast for the visitor's local clock time. Glossary and copy: content.md §4. Calendar: `calendar.md`. Engine: `src/lib/qimen/`, pure TypeScript, shared by the grove, the DOM chart, the album and the terminal.

### 9.1 Orientation

Compass-true in world space, viewed from the north (8.6). The plan view looks straight down with `camera.up = (0, 0, −1)`, so south is screen-up and east is screen-left. Pitching down from facing south keeps that with no roll flip.

| | East (−X), screen-left | | West (+X), screen-right |
|---|---|---|---|
| South row, z −153 | 巽4 (−3, −153) | 离9 (0, −153) | 坤2 (3, −153) |
| Middle row, z −150 | 震3 (−3, −150) | 中5 (0, −150) | 兑7 (3, −150) |
| North row, z −147 | 艮8 (−3, −147) | 坎1 (0, −147) | 乾6 (3, −147) |

### 9.2 Physical layout

Everything is centred on (0, y, −150).

| Layer | Radius or size | Top height | Moves? | Carries | Material |
|---|---|---|---|---|---|
| Earth plate 地盘 | 9 × 9 m, nine 3 m slabs, 0.12 m grout gaps with moss dots | y 0.45 | Never. Re-inks when the 局 changes | Earth stems; palace name and Luo Shu dot numeral; trigram bars on each outer slab's outer edge | `bluestone`, chipped bevels, axe-cut strokes |
| North step | 3 m wide at z −145.5 to −144.9 | y 0.22 | | The inscription band on its tread | `bluestone` |
| R1 heaven plate 天盘 | r 6.7 to 7.9 | y 0.32 | Rotates in 45° steps | Nine stars (禽 rides with 芮) and their heaven stems | `bluestone` |
| R2 human plate 人盘 | r 8.0 to 8.9 | y 0.24 | Rotates in 45° steps | Eight doors | `bluestone` |
| R3 spirit plate 神盘 | r 9.0 to 9.9 | y 0.16 | Rotates; glyph order depends on the dun | Eight deities | `bluestone` |
| R4 luopan apron 二十四山 | r 10.1 to 11.3 | y 0.06 | Fixed to the compass; turns only as part of the whole dial in compass mode | 24 mountains, 15° each; 5° ink ticks on its outer 0.2 m | `stone`, ink-filled carving |

Rings are extruded annuli with raised stone dividers between sectors and 4 cm gaps between rings, so each reads as a separate piece of stone that could turn. Platform and rings step down outward, so from above the platform reads highest.

**Slots.** Ring slot k (0 to 7) sits at bearing k × 45°, in palace order [1, 8, 3, 4, 9, 2, 7, 6]: 坎 0°, 艮 45°, 震 90°, 巽 135°, 离 180°, 坤 225°, 兑 270°, 乾 315°. Slot direction is `(−sin(k·45°), 0, cos(k·45°))`. Rings are built in the 伏吟 arrangement, every star and door in its home slot. Turning a ring clockwise by n slots means `rotation.y = −n × π/4`.

**24 mountains**, clockwise from north: 壬 子 癸 · 丑 艮 寅 · 甲 卯 乙 · 辰 巽 巳 · 丙 午 丁 · 未 坤 申 · 庚 酉 辛 · 戌 乾 亥, with 子 centred on 0°. The four cardinal branches and the four corner-trigram mountains are carved 20% larger. No colour-coding by element or yin and yang; schools disagree, and a wrong scheme is worse than none.

**Glyph orientation.** Rings read like a luopan: carved glyphs are radial, tops pointing outward, so the near ones look upside down from the seat, as on a real pan. Palaces read like a chart: lit glyphs are upright to the viewer, tops pointing south, which is screen-up from the seat and in plan view.

**The needle.** A thin iron needle floating 1.5 m above the centre palace, settling ±1°, its south end tipped in cinnabar. Chinese texts call the compass 指南, "pointing south". In plan view the red tip points screen-up and doubles as the "south is up" marker.

**The inscription band.** Carved on the north step's tread, facing the seat, in WenKai: `{dun}{ju}局 · {solarTerm}{yuan} · 旬首 {xunShou}` and the four pillars. The same text is in the DOM header.

### 9.3 What each palace shows

Seen south-up, each 3 m slab:

```
┌───────────────────────────┐
│ ○                  马     │  旬空 hollow circle · 驿马 马, both 0.25 m, ink-dan
│          九天             │  deity 0.50 m
│   丙            天英      │  heaven stem 0.60 · star 0.60
│   戊            景门      │  earth stem 0.60 (carved) · door 0.60
│ ⁘⁘⁘ 离9              ☲   │  Luo Shu dots + palace name 0.30 · trigram bars on the outer edge
└───────────────────────────┘
```

- Lit glyphs are `paper` on `bluestone` (8.9:1). Earth stems are carved and filled with paper-white (描白).
- Stars and doors use their two-character names (天英, 景门), which are clearer to non-experts than single characters.
- Luo Shu numerals use the classical dot diagram: odd numbers as hollow circles, even numbers as filled dots, joined by thin lines; five is a quincunx.
- Centre palace 5: 中五, its earth stem, the needle, and a small carved note 禽寄坤 with a faint line toward 坤2. In 转盘 practice the centre star and stem travel with palace 2's, so the R1 slot for 天芮 carries "芮·禽" and a second, smaller stem. No door and no deity in the centre.
- Advanced markers (入墓, 击刑, 门迫) are out of scope. Leave room in the data model.

### 9.4 值符 and 值使

Two different shapes, so the marks never rely on colour alone:

- **值符, duty chief:** the star glyph sits on a cinnabar square plate, the glyph in paper-white, like a 白文 seal stamped on the chart. The 值符 deity lands in the same palace and gets the same plate. Cinnabar on bluestone alone is only 1.6:1, so the plate is required for legibility.
- **值使, duty envoy:** a cinnabar brush ring (圈点, the red circle classical readers draw beside important passages) around the door glyph.
- **The 值符 arc:** a thin tapered cinnabar stroke on the stone, curving from the palace where the 旬首 hides on the earth plate to the palace where the 值符 star lands. It shows the move that produced this hour's chart. It fades to 40% after 3 s.
- The plates, the ring and the arc are the only red on the chart.

### 9.5 Casting

Plays once per session, the first time the chart is on screen, whether by scroll (u ≥ 0.655) or by a `#grove` jump. Time-based, not scrubbed. If the visitor scrolls past, it completes in 300 ms. Reduced motion shows the final state.

| Time | What happens |
|---|---|
| 0.0–1.3 s | **Luo Shu path.** A brush line draws through the palace centres in number order, and each palace's earth stem inks in as the line reaches it, 140 ms per palace. Yang dun runs 1 → 9 and yin dun 9 → 1, the direction the earth plate is laid for that dun |
| 1.5 s | **The plates turn.** Every ring starts at 伏吟, and the spirit ring starts with 值符 at 坎1. R1 turns to the current offset over 1.2 s, ease-in-out cubic, shortest path, no overshoot, since stone doesn't bounce. R2 starts 250 ms later, R3 500 ms later. Stone grind while turning, a woodblock detent click at each 45° |
| 3.2 s | **Glyphs settle.** Each lit glyph lifts 0.3 m off its ring slot, travels inward along its bearing and settles into its palace, rotating from radial to upright (落宫), 600 ms, staggered 120 ms by ring. The carving stays on the ring in `bluestone-deep`; the light moved into the palace |
| 4.1 s | **Marks.** The 值符 plates and 值使 ring stamp with the seal animation, then the 值符 arc draws |
| 4.6–5.2 s | The inscription band prints its fields one at a time |

The deity ring's order depends on the dun, so R3's glyphs are positioned individually: in the yang dun they run clockwise from the 值符 slot, in the yin dun anticlockwise. A dun change lifts, reorders and settles them. There is no ring flip.

**Engine contract for the renderer.** Add a pure helper `ringOffsets(chart)` in `src/lib/qimen/` returning `{ heaven, human, spirit }` in 45° slots from 伏吟, plus `dun`. The renderer never derives positions itself:

- heaven = slot(值符 destination palace) − slot(值符 star's home palace)
- human = slot(值使 destination palace) − slot(值使 door's home palace)
- spirit = slot(值符 destination palace), with glyph order from `dun`
- Palace 5 counts as 2 wherever a slot is needed.

### 9.6 Recasting and time controls

**Recast step.** Glyphs lift out (150 ms), rings turn along the shortest path (450 ms), glyphs settle (250 ms). When steps arrive faster than 3 per second, glyphs stay lifted, rings follow continuously, and glyphs settle 300 ms after the last step. Detent clicks are capped at 8 per second, so a fast scrub never builds a queue. If the 局 changes, the earth stems wash out to paper and re-ink over 600 ms before the rings move.

**Live.** The chart recasts at each 时辰 boundary (odd hours). The animation and the hour chime play only if the grove is on screen. Recompute on `visibilitychange` too.

**Controls.** DOM, always. On desktop they sit in the chart panel under the header; on mobile in the Time tab.

| Control | Element | Behaviour |
|---|---|---|
| Live | `<button aria-pressed>` "Live · this hour" | Default on. Shows "Next turn at {nextTurnTime}" (content.md) |
| Earlier, Later | Two 48 px buttons, ◀ and ▶ | One 时辰 per press. Long-press repeats at 4 per second. `[` and `]` while focus is inside the chart region. Leaves live mode |
| Hour marker | On R4, the current 时辰's branch mountain is inverted: an `ink-jiao` wedge with its character in paper-white, like a rubbing | Desktop medium and high tiers: drag it around the ring with 30° detents to scrub. It is a `role="slider"` with `aria-valuetext`, for example "Monday 28 September, 戌 hour, 19:00 to 20:59, yin dun structure 4". Every tier also has a DOM range input doing the same |
| Pick a moment | Native `<input type="datetime-local">` | Range 1930 to 2100 (`calendar.md` caveats). Past 2035 a one-line note says solar-term times are predictions |
| Back to now | Button, shown only when not live | Returns to live mode |
| Show English | Toggle | Adds 0.22 m English labels in Source Serif 4 under every palace glyph. Off by default on desktop, where hover works; on by default on touch |

Honesty line under the controls: "Cast for your local clock time. Some practitioners correct to true solar time. This chart doesn't." Then the method note and the disclaimer from content.md §4. There is no solar-time toggle in v1.

### 9.7 Glosses and selection

- Every 3D glyph has an invisible hit quad in one `InstancedMesh`. A raycast gives the instance id, which maps to the glyph. Hovering opens the DOM gloss tooltip (4.3) at the glyph's projected point, for example "天英 tiān yīng · Hero · home palace 9, 离 Li, south".
- Selecting a palace, by clicking it in 3D or focusing it in the DOM chart, washes its 45° wedge (slab plus the R1 to R4 sectors on its bearing) 15% lighter with a 2 px `paper-light` outline and dims the other palaces to 70%. Reading a palace means reading outward along its bearing.
- Touch: tapping a palace zooms the plan view until the palace fills 70% of the width and fills the "Palace details" panel with every glyph glossed plus the palace's name, direction and element. Long-press a single glyph for its tooltip. At 390 px a 0.6 m glyph is about 10 px in the full plan view, too small to read, so on phones the zoom and the DOM panel are the reading mode and the plan view shows the shape.

### 9.8 The DOM chart (source of truth)

The DOM chart is the accessible, crawlable and album-mode chart, and the reading panel on every tier.

```html
<figure id="qimen" aria-labelledby="qimen-title">
  <figcaption id="qimen-title">Qimen chart cast for …. South is at the top. 值符 天芮 in 乾6, 值使 死门 in 离9.</figcaption>
  <p class="qm-header">…</p>
  <ol class="qm-palaces">            <!-- Luo Shu order 1..9 for reading -->
    <li data-palace="1">
      <h4><span lang="zh-Hans">坎</span> Kan 1, North</h4>
      <dl>
        <dt>Deity</dt><dd><span lang="zh-Hans">九天</span> Nine Heaven</dd>
        <dt>Star</dt>… <dt>Heaven stem</dt>… <dt>Door</dt>… <dt>Earth stem</dt>…
      </dl>
      <p class="qm-marks">…</p>        <!-- 值符 Duty Chief, 值使 Duty Envoy, 旬空, 驿马, when present -->
    </li>
  </ol>
</figure>
```

- CSS grid places the items south-up: `grid-template-areas: "p4 p9 p2" "p3 p5 p7" "p8 p1 p6"`. Screen readers go 1 to 9, the order practitioners count in.
- Header, one line on desktop, wrapping on mobile: date and 时辰 range with time zone · four pillars · solar term · dun and 局 · 元 · 值符 and 值使 in plain English. Example in Appendix D.
- The grid is a single tab stop with roving focus. Arrow keys move between palaces in their visual positions. Enter expands a palace with each term's full meaning.
- Updates announce through the live region: "Chart recast for 21:00 to 22:59, 亥 hour."
- Rendered client-only (`useSyncExternalStore` with a null server snapshot) to avoid a hydration mismatch. The prerendered HTML carries the explanation and a `<noscript>` line, "The live chart needs JavaScript."

### 9.9 Compass mode

Phones and tablets only: shown when `matchMedia('(pointer: coarse)')` matches and the orientation API exists. Button label "Follow compass" (content.md). Heading comes from `enableCompass()` in `stack.md` §8: `webkitCompassHeading` on iOS after `DeviceOrientationEvent.requestPermission()` inside the tap handler, `deviceorientationabsolute` with a tilt-compensated heading on Android, corrected for `screen.orientation.angle`. Magnetic north as-is, no declination correction: a luopan reads a magnetic needle too, and declination in Penang is under 1°.

A real luopan has a square base (外盘) with two red cross-threads (天心十道) and a round dial (内盘) that turns inside it. Compass mode copies that:

- The screen is the square base. Two fixed cinnabar hairlines cross the screen through the chart centre (a DOM SVG overlay), with a small cinnabar pointer at the top edge: "you face this way".
- The camera goes to the plan view. The whole dial turns: platform, rings, apron, needle. It rotates by `−heading` so the direction the top of the phone points is at the top of the screen. Face south and the chart reads the way it is printed in books; the first time that happens a small line says so.
- Smoothing: `easing.dampAngle` with 0.25 s, shortest path across 359° to 0°. If readings jump more than 30° repeatedly, show "Hold the phone flat, away from metal."
- Palace and ring glyphs counter-rotate to stay upright on screen. A physical luopan wouldn't do that; it is a readability concession and the gloss says so. R4 mountains stay radial.
- The palace under the top thread highlights, and the Compass tab reads out: "Facing 丙, 165°, palace 9 离 Li. This hour: 景门 View Door, 天英 Hero, 九天 Nine Heaven."
- Denied or unsupported: content.md's copy, the button hides for the session, and manual rotation takes over. Manual rotation, on every device: drag the dial in plan view with 15° mountain detents, or use the DOM range input "Rotate luopan" with the arrow keys.
- Compass mode switches off when the visitor leaves `#grove`. "Read the chart" resets to south-up.

---

## 10. The terminal

Commands, aliases, hidden commands and exact output are in content.md §3. The command module is `sections/cabin/terminal/commands.ts`, pure and unit-tested (`stack.md` §6). This section covers look, placement and behaviour.

### 10.1 Look

- A pane 1.6 × 1.0 m centred at (4, 1.9, −99.9), tilted back 8°, floating above the desk. Cyan traces run up the desk legs into its base, so it is wired into the cabin.
- Glass: `night` at 88%, so the hall shows faintly through. 1 px `cyan-dim` border, 2 px radius. No corner brackets, no fake window buttons, no scanlines, no curvature, no phosphor green.
- Text: JetBrains Mono, 15 px desktop, 13 px mobile, `cyan-line` with `text-shadow: 0 0 6px rgba(92, 235, 223, 0.35)`. Help descriptions and hints in `cyan-dim`. The prompt `cy@cabin:~$` and links in `cyan-bright`, links underlined.
- Caret: a `cyan-bright` block that breathes (opacity 1 to 0.35 over 1.2 s) instead of blinking. Steady under reduced motion.
- New output lines settle from a 2 px blur to sharp over 120 ms: ink spreading on wet paper, translated to light. Output is never typed out character by character.
- In `qimen` output, 值符 and 值使 use inverse video (`night` on `cyan-line`). The cabin stays one hue.

### 10.2 Placement

The DOM terminal is the terminal. The 3D pane is a picture of it.

- The DOM terminal is a `<section aria-labelledby>` inside `#cabin` in document order: a `role="log"` output with `aria-live="polite"` and a labelled `<input>` (label from content.md §7). The banner is already in the log when it mounts, so it is not announced.
- The 3D pane shows a 1024 × 640 `CanvasTexture` redrawn from the same buffer only when output changes, capped at 30 fps while typing.
- Desktop, during the I3 hold: the camera faces the pane square-on, so its projection is a plain rectangle. The DOM terminal is positioned `fixed` over that rectangle, recomputed on resize and while the camera spring is still settling, and fades in when the hold begins and out when it ends. Outside the hold the canvas mirror shows the last state. No drei `<Html transform>`: it skips bloom and ink, and it is fragile on iOS.
- Mobile: tapping the 3D pane or the "Open terminal" button in the I3 card opens the terminal as a bottom sheet, 60% of the visual viewport, positioned with the `visualViewport` API so the soft keyboard never covers the input. A row of 44 px command chips sits above the input: `help`, `whoami`, `services`, `projects`, `qimen`, `contact`. Nobody should have to type on a phone.

### 10.3 Behaviour

- It never steals focus. It takes focus on click or tap, or on `` ` `` or `/` during the I3 hold (default prevented only then). While focused, Space and arrow keys go to the terminal. Esc blurs and hands the keys back.
- Wheel and touch inside the output scroll the output until it hits an end, then pass to the page (`overscroll-behavior: auto`). The terminal never traps the page.
- ↑ and ↓ walk history. Tab completes command names. Ctrl+L clears. Ctrl+C prints `^C` and a fresh prompt.
- Scrollback capped at 200 lines. History and scrollback persist in `sessionStorage`.
- `qimen` renders its chart as an HTML 3 × 3 grid inside the output, south up, not as spaced text: CJK glyphs are not reliably two cells wide in a Latin monospace. It calls the same engine as the grove, so the terminal and the stones always agree.
- `grove` and its aliases print content.md's line, wait 600 ms, then fog-dive to `#grove`, skipping the moon gate. The terminal is a shortcut.
- Links in output (`contact`, `projects`) are real `<a>` elements in the DOM log and underlined in the canvas.
- With JavaScript off, the section shows a static transcript of `whoami` and `contact`.

---

## 11. Transitions

### 11.1 The fog-dive

Used by nav clicks, the home mark, map pins, "Walk again", the terminal's `grove`, `popstate`, and deep links. Implementation: `diveTo()` in `stack.md` §3.

| Phase | Time | What happens |
|---|---|---|
| Intent | `pointerdown` / `touchstart` | Start fetching the target chunk. That wins about 100 ms before the click fires |
| Dive | 0–450 ms, ease-in cubic | `uDive` 0 → 1. Fog collapses toward the camera and a noise-thresholded dissolve spreads paper from the centre outward. The camera dollies 2.5 m forward. The DOM `#veil` mirrors `uDive` (it is the whole transition when WebGL isn't running). Current copy cards fade out over 200 ms. Title card from 250 ms. Audio: master low-pass to 300 Hz, beds duck −18 dB, a whoosh |
| Swap | at `uDive` = 1 | `scrollTo` instantly to the arrival jvh (Lenis `immediate: true`). Snap the camera to the target's emerge pose (6.2). Swap the post group if the target is the cabin. Mount and prewarm the target (`compileAsync`, troika `preloadFont`). "Grinding ink…" after 400 ms. Give up waiting at 5 s and emerge anyway |
| Emerge | 700 ms (900 ms for `#cabin`), ease-out cubic | `uDive` 1 → 0. The camera glides from the emerge pose onto the arrival along the real path, so the geography stays coherent. Title card dissolves. Cards fade in from 200 ms. Low-pass reopens |
| Settle | end | Focus moves to the section heading (`tabindex="-1"`, `preventScroll: true`). The live region announces the section name |

About 1.15 s end to end when the chunk is cached. A newer jump cancels an older one (token). Scrolling during a dive cancels it and hands control back to the scrollbar.

- The dive colour is always paper, including jumps into the cabin: their emergence starts outside the door in the ink world and walks through it.
- Near jumps: if the target is within 100 jvh, skip the dive and smooth-scroll along the path over 1.2 s.
- Reduced-motion opt-in: no dolly, no dissolve, a 150 ms crossfade through paper and back.
- Quality tier changes queue for the next moment fog density is above 0.12 (a dive, the moon gate, the mist wall) or 10 s, whichever comes first. DPR steps apply at once.

### 11.2 Seams inside the walk

These run through the same `uDive` and fog code with scroll-driven values instead of a timer, so a jump and a walk feel like the same world.

| Seam | jvh | What it hides |
|---|---|---|
| The door | 274–322 | The stencil portal, then the post-group crossfade and the exterior hide at the door plane. No fog: the door is the reveal, not a cut |
| The moon gate | 562–572 | Whiteout in paper. Camera teleports from the hall to the emerge point behind the cabin. Cabin stage hidden (or unmounted on low tier), path and grove stage shown |
| The mist wall | 608–642 | Fog peak 0.14. The grove chunk must be ready; if not, the fog holds (8.5 P2) |
| Catch-up | anywhere | Lag fog (6.3) |

### 11.3 Chunks and prefetch

Sections load through `stack.md`'s registry: `threshold`, `cabin`, `grove`, `contact`. The path and stream ship in the `grove` chunk; `contact` is prefetched when `grove` loads.

| Chunk | Prefetch when |
|---|---|
| `cabin` | Idle 3 s after the first 3D frame, u ≥ 0.12, or `pointerdown` or hover on Work |
| `grove` + calendar adapter | On entering the cabin (u ≥ 0.245), `pointerdown` or hover on Grove, or 15 s idle |
| `contact` | With `grove` |

On low tier a section more than one section behind the camera is unmounted and its GPU resources disposed. Mount and unmount only happen while fog is above 0.12, so nothing pops.

---

## 12. Sound

Muted by default. Sound starts only when the visitor turns it on, which also satisfies the browser's gesture rule for `AudioContext`. It fades in over 2 s. The context suspends when the tab is hidden or sound is off. The toggle is hidden in album mode, where ambience over a still page feels like a bug.

Almost everything is synthesised in Web Audio. A software engineer's site building its guqin out of Karplus-Strong is a quiet in-joke, and it keeps the download small. Two CC0 samples from Freesound (filtered to CC0, credited in `public/CREDITS.txt`), mono AAC and Opus at 48 kbps, fetched only when sound is first switched on, under 150 KB together. Target about −30 LUFS integrated, peaks under −14 dBFS: ambience you notice when it stops.

| Cue | Where (jvh) | Source | Level | Notes |
|---|---|---|---|---|
| Wind | 0–322, 572–1000 | Synth: pink noise, band-pass 350 Hz Q 0.6, LFO 0.07 Hz on cutoff | −30 dB | Slow stereo pan |
| Pine bed 松涛 | 90–245, 584–862 | CC0 loop, 20 s | −28 dB | Crossfaded by section |
| Stream | 580–612 | Synth: white noise, high-pass 1.2 kHz, random amplitude | −30 dB | Panned by the stream's screen x |
| Cabin hum | 245–572 | Synth: 55 and 110 Hz sines plus band-passed noise at 3.2 kHz | −40 dB outside, low-passed at 250 Hz; −26 dB inside | Opens to 6 kHz through the door |
| Door creak | 277, forward only | CC0 sample, 1.2 s | −22 dB | Never plays reversed |
| Ignition | First crossing | Synth: A2, E3, B3 sines swelling over 1.5 s | −24 dB | |
| Keys | Terminal typing | Synth: 6 ms noise burst, band-pass 2–4 kHz, ±8% pitch | −32 dB | |
| Fog-dive and moon gate | Any dive, 562–572 | Synth whoosh plus master low-pass 12 kHz → 300 Hz → back | −24 dB | Beds duck −18 dB |
| Guqin harmonic | 622, forward only | Karplus-Strong, D4 294 Hz with harmonic emphasis, 4 s decay, 20-cent slide down at the tail | −18 dB | The loudest moment on the site, and it's one note |
| Reveal | 628–645 | Master low-pass opens to 16 kHz over 2 s | | |
| Ring grind | While rings turn | Brown noise, band-pass 140 Hz Q 1.2, gain following angular velocity | −24 dB | |
| Detent | Each 45° | Synth woodblock: 1.1 kHz sine, 40 ms decay, plus a click | −26 dB | Max 8 per second |
| Hour chime | Live 时辰 change with the grove on screen | FM bell, 523 Hz, 5 s decay | −22 dB | |
| Lantern crackle | 862–1000 | Synth: sparse impulses through a 3 kHz band-pass | −34 → −28 dB | |
| Seal | E3 stamp | Synth: sine sweeping 95 → 55 Hz over 90 ms plus a noise tick | −20 dB | Silence after it |

No music bed, no pentatonic loops, no gongs, no footsteps, no birdsong. The camera is a drifting point of view, not a body.

---

## 13. Quality tiers and budgets

### 13.1 Reference devices

| Role | Device | GPU |
|---|---|---|
| Floor, low tier | Redmi Note 13 4G, Snapdragon 685 | Adreno 610 |
| Target, low/medium boundary | Galaxy A35, Exynos 1380 | Mali-G68 MP5 |
| Desktop baseline, medium | 2020 laptop | Intel Iris Xe |
| Desktop high | Discrete GPU or Apple M-series | |

### 13.2 Gate and starting tier

Runs in the inline head script and `app.js`, before `three-core` downloads, so turned-away devices never pay for it.

Static (album) if any hold: no WebGL2, `failIfMajorPerformanceCaveat` fails, `navigator.connection.saveData`, `deviceMemory ≤ 2`, a saved "Still version" preference, or `prefers-reduced-motion: reduce` without a saved opt-in.

Otherwise the starting tier comes from `stack.md` §5's heuristic (pointer type, cores, `deviceMemory`, renderer string). Then a hidden benchmark: the canvas mounts at opacity 0 and renders 60 frames of the threshold. Median frame time corrects the tier: over 22 ms at DPR 1 on low switches to the album with the toast "The forest was running slowly, so here's the still version." and a "Walk the forest anyway" button; over 18 ms on medium drops to low; over 12 ms on high drops to medium. The canvas fades in over 800 ms once two consecutive frames land in budget.

### 13.3 What each tier gets

Choreography, timing, composition, palette, chart glyphs, the casting animation, the seals, the lantern and all DOM text are identical on every tier. When the GPU has less, the forest gets foggier, which is cheaper and in style.

| Setting | Low | Medium | High |
|---|---|---|---|
| DPR start / floor | 1.0 / 0.75 | 1.5 / 1.0 | min(device, 2.0), 1.75 over 8 MP / 1.25 |
| Fog density multiplier | 1.3 | 1.1 | 1.0 |
| Pines (`mesh.count`) | 300 | 700 | 1500 |
| Mist planes / ridge layers | 2 / 1 per direction | 3 / 2 | 4 / 3 |
| Ink edges (Sobel on log depth) | off (`uEdges = 0`) | on | on, with dry-brush breaks and 8 fps "boil" |
| 皴 strokes | hero rocks and grove stones | all stone | all stone plus hemp strokes on earth |
| Door stencil portal | on, simplified hall (no dust, static traces, scroll textures load only once inside) | on | on |
| Cabin bloom | off, additive halo sprites | 4 levels | 6 levels |
| Trace pulses | static | animated | animated |
| Dust | 0 | 300 | 800 |
| Stream ripples | static | animated | animated |
| Bamboo | no | yes | yes |
| Hour-marker drag | no, range input only | yes | yes |
| MSAA (startup only) | 0 | 0 | 4 |
| Far sections | unmounted | hidden (`<Activity>`) | hidden |
| Frame cap | 30 fps if the first 5 s average under 50 fps, else 60 | 60 | display rate |
| Shadow maps | none on any tier | | |

Runtime rules (`stack.md` §5): tier changes touch only uniforms, `EffectGroup.enabled`, `mesh.count` and DPR. Never defines, `multisampling`, `scene.fog` or material swaps. drei `PerformanceMonitor`: after 2 s under 45 fps drop DPR by 0.25 to the floor, then drop a tier; over 58 fps for 4 s step back up once; lock after three flips. Idle: with no scroll or pointer for 5 s and no animation running, render at 20 fps; after 30 s idle stop until the next input; hidden tab stops. WebGL context lost: swap the canvas for the current section's still (14.1) and toast "3D paused. Tap to restart."; restoring rebuilds the renderer and recompiles only the current section.

If the low tier misses 33 ms p95 at the door on the Redmi Note 13, fall back to `stack.md`'s rule for low only: a short fog-dive at the door instead of the stencil. Try the simplified hall first; the door is signature moment 1.

### 13.4 Budgets

| Metric | Budget | Measured on |
|---|---|---|
| First Contentful Paint | ≤ 1.5 s | Galaxy A35, 4G |
| Largest Contentful Paint (the h1) | ≤ 2.0 s | same |
| CLS | ≤ 0.02 | same |
| Total Blocking Time | ≤ 200 ms | Lighthouse mobile |
| First 3D frame visible | ≤ 4.5 s | Galaxy A35, 4G |
| Lighthouse mobile | Performance ≥ 90, Accessibility 100, SEO 100, Best Practices ≥ 95 | CI |
| Frame time p95 while scrolling | ≤ 33 ms low, ≤ 20 ms medium, ≤ 16.7 ms high | Redmi Note 13, Galaxy A35, desktop |
| Draw calls | ≤ 150 per view | Spector.js |
| Triangles | ≤ 120k mobile, ≤ 300k desktop | |
| GPU texture memory | ≤ 64 MB on low | |
| Transfer | as `stack.md` §4: HTML ≤ 30 KB, boot JS ≤ 85 KB, Latin fonts ≤ 60 KB, stage core ≤ 340 KB, each section chunk ≤ 40 KB of own code, first interactive threshold ≤ 550 KB, full journey ≤ 1.3 MB. The grove chunk also carries the calendar adapter (tyme4ts, about 75 KB gz, or the 2.8 KB fallback in `calendar.md`) | `scripts/check-budget.mjs` |

---

## 14. Reduced motion, no WebGL, no JavaScript

### 14.1 The album (static version)

One static version serves `prefers-reduced-motion`, no WebGL, Save-Data, low memory, the benchmark fallback and the "Still version" choice. It is the same HTML in the same order with the same nav, anchors and copy. `<html data-mode="static">` and the canvas never loads (`stack.md` §2). It is designed as an album (册页), a bound set of painted leaves, not as a broken film.

- **Banner.** At the top, content.md §7's line for the reason ("You asked for less motion…" or "Your browser can't draw the forest…"), with "Walk the forest" when WebGL is available. Reduced-motion visitors who opt in get the 3D walk with autonomous motion off: no mist drift, sway, parallax, breath, boil, flicker or unrolls; `frameloop="demand"`; no Lenis; 150 ms crossfades for dives; plates crossfade instead of turning. The camera still follows scroll, because the visitor drives it.
- **Leaves.** One leaf per section on `paper` with `paper-mount` margins and a 1 px `ink-dan` hairline, like an album mount. Each opens with its inscription and a still. Desktop leaves alternate painting and text, 55/45; mobile stacks the painting over the text.
- **Stills.** Rendered from the real scenes at T0, C3 (door open, the nudge), I1, E1 and E3 by `scripts/shots.mjs` (`stack.md` §12) with `?still=<beat>&tier=high`. AVIF with WebP fallback in `<picture>`, 1600 and 800 px landscape plus 4:5 portrait crops, ≤ 120 KB at 1600 px, `loading="lazy"`, fixed aspect ratios, one-sentence alt text describing the painting. Committed, rerun when scenes change.
- **Cabin leaf.** The only dark leaf: `night` background, `cyan-line` headings, a tiny SVG trace pattern. Services, the four project cards, the "Also" list, the timeline, and the terminal, which works exactly as in 3D.
- **Grove leaf.** Not a still. The chart drawn live in SVG from the same engine: square palaces south-up, the three rings as SVG annuli with text on paths, the 24-mountain ring, the cinnabar plate, ring and arc, the same header, time controls and palace details. Changing the time updates instantly with no rotation. Compass mode works by rotating the SVG dial with no easing.
- **Contact leaf.** The E1 still and the link list.
- **Finale.** The E3 still with the colophon and the seal already stamped.
- **Transitions.** Plain anchors. `scroll-behavior: smooth` only when motion isn't reduced (and never together with Lenis). No dives.

### 14.2 No JavaScript

Everything above is prerendered at build time (`stack.md` §10), so crawlers and no-JS visitors get the full text of every section, all links and the glossary. The static layout is the default CSS; JS switches to immersive by setting the attribute. The grove shows the explanation, the glossary and `<noscript>` "The live chart needs JavaScript." The terminal shows its static transcript.

---

## 15. Accessibility checklist

- Landmarks: `header` with the nav, `main#content`, one `section` per nav target, `footer`. One h1. An h2 per section, h3 per item.
- The canvas is `aria-hidden`. Every canvas interaction has a DOM twin: scrolls to cards, palaces to the chart grid, stele rows to links, map pins to links, the 3D pane to the DOM terminal.
- Visible focus everywhere (2.5). Tab order follows reading order. Jumps move focus to the target heading and announce it.
- Targets at least 44 × 44 px; nav slots 48 px; contact rows 56 px.
- Body text at least 4.5:1 against its real background, scrims included.
- CJK marked `lang="zh-Hans"`. Pinyin and English glosses are inline, visually hidden, not tooltip-only.
- Nothing flashes. The lantern flicker stays between 0.92 and 1.0.
- 200% text zoom reflows without horizontal scrolling; sizes in rem.
- No autoplaying audio.
- Tested with TalkBack on Android Chrome, VoiceOver on iOS Safari, NVDA on Firefox, and keyboard only.
- The 20-second test: five people who haven't seen the site each get the Galaxy A35 on a fresh load. After 20 seconds, ask what CY does, where he is, and how to reach him. Pass is 5 of 5.

---

## 16. Signature moments

1. **The nudge (292–322 jvh).** The cabin door opens on cyan light. The camera slides a couple of metres sideways, and the trees behind the cabin slide across its roof and prove it is six metres deep, while the view through the door hardly moves because the hall behind it runs forty. Then you walk through, the painting inverts, paper to night and ink to light, and the floor grain lights up from under your feet. Bigger on the inside, shown with parallax and no line of dialogue. It is a stencil mask, so it runs on the floor phone.

2. **The heavens turn to your hour (608–715 jvh).** The mist thickens until there's nothing, one guqin note rings, and the fog lifts on a dark stone board in a clearing. A brush line inks the Luo Shu path through the nine palaces. Then the stone rings grind round, detent by detent, from their home positions to the visitor's own double-hour, and the lit glyphs lift off the rings and settle into their palaces. A cinnabar plate and a red brush circle mark the 值符 and 值使. South is at the top, as in the books, and it is true south; the lantern glints beyond the fire palace. On a phone, "Follow compass" turns the whole dial with your body.

3. **The painting signs itself (935–1000 jvh).** At the stele the camera rises in a slow orbit and turns north, the fog thins, mist belts slide in, and the whole walk flattens into one picture: the lantern at the bottom, the grove's rings, a speck of cyan at the cabin, the forest edge, the far ridges. A colophon writes itself, dated for this visit in the traditional calendar, and the red 林 seal stamps the corner. Lim is 林. Two trees make a forest. The cabin and grove below are links, so the finale is also a map.

---

## 17. Explicitly out of scope

Cut from the three drafts, or ruled out up front. Some of these could come back after launch; none ship in v1.

- A second warm light: the porch lantern, lanterns that drop to embers as wayfinding, a point light at the stele.
- Dusk or time-of-day lighting in the path and grove.
- 3D signposts in the forest walk. Services are DOM inscriptions.
- The cliff mesh, waterfall and ledge pine behind the cabin. The peak is one card.
- Birds, geese, fireflies, particles in the forest; pointer-pushed mist.
- The handscroll progress bar with a landscape silhouette. Replaced by the hairline.
- Leisure seals (格物, 觀象, 後會) and per-section seals (入, 木, 宫, 灯). The name seal [name seal] ships only on the owner's yes.
- Newsreader, Atkinson Hyperlegible, Noto Serif SC and Zhi Mang Xing. An MSDF atlas build pipeline (troika covers it).
- A 3D ledger board for the timeline; floor reflections of panels.
- The four plates hovering at four heights; a separate 12-branch ring and a 24-solar-term ring (the hour is marked on the 24 mountains); a 360° degree ring beyond the ticks on R4; the spirit ring flipping at the solstices.
- A solar-time toggle, geolocation or a city list. Clock time with an honesty line.
- Advanced chart markers (入墓, 击刑, 门迫).
- Terminal additions not in content.md: `open <n>`, `date`, `sound`, `still`, `cd lantern`, `qimen <time>`, "did you mean". Glass corner brackets, scanlines, typed-out output.
- A Calm 3D mode separate from the album. The in-3D "Motion" setting.
- The inline SVG hero painting traced from K0, the CSS paper overlay trick on low tier, the battery toast, a print stylesheet. Post-launch polish if wanted.
- A Chinese-language version of the site. WebGPU.
- Anything on the avoid lists: portfolio furniture (tech-logo spheres, typewriter hero, percentage preloader, "click to enter", custom cursor, skill bars, "connect wallet"); Chinoiserie and Japan standing in for China (red and gold lacquer, dragons, gongs, pentatonic loops, spinning yin-yang, "chop suey" Latin fonts, ensō, torii, cherry blossom, kasuga lanterns, fortune-cookie readings); stock sci-fi (code rain, Tron floors, glitch and RGB split, HUD brackets, lens flares, green on black, "ACCESS GRANTED").

---

## 18. Owner decisions and deviations

### 18.1 Copy changes proposed against content.md

Each needs the owner's yes. Until then, ship content.md's version.

| Topic | content.md | This spec | Why |
|---|---|---|---|
| Hero accent | 入山 | 入林 | 林 is his surname and the setting is a forest. Two of the three drafts proposed it |
| Links on the first screen | Only at the lantern | Also a small row in the hero | A client should reach CY without scrolling. Still social links only |
| Services | In the cabin intro | Two forest-walk cards | The walk answers "what do you do?" before the cabin shows proof |
| Nav labels | "Cabin · work", "Grove · Qimen", "Lantern · links" | "Work", "Grove", "Contact" with 木屋, 九宫, 石灯 above | Clients scan for Work and Contact |
| Cabin bridge line | none | "In old landscape paintings there's always a hut, and in the hut there's always a scholar at a desk. This one writes software." | Ties the sci-fi cabin to the painting |
| Featured work | Six panels | Four scrolls plus an "Also" list | Keeps the hall under 100 jvh of scrolls. Owner picks the four and clears screenshots |
| Colophon | none | Dated inscription signed 林, English line "林 is Lim. Two trees make a forest." | Signature moment 3 |
| Name seal | Chinese name unknown | `resources/resume-zh.pdf` gives [owner's Chinese name]. The 林 seal ships regardless; [name seal] and [given name] in the colophon only with a yes | |

### 18.2 Decisions still open (from all docs)

1. Confirm 林 for the seal and whether the name seal ships.
2. Qimen conventions: 子时 day boundary (default 23:00, per `calendar.md`), the 夜子时 hour stem (tyme4ts takes the next day's stem), 白虎/玄武 vs 勾陈/朱雀, clock time (default).
3. Glossary sign-off (`glossary.json`); CY practises, so CY signs off.
4. The four featured projects and cleared screenshots.
5. Grove intro in his own words (content.md TODO 13).
6. content.md's own list: positioning line, X handle, blog link, availability line and the rest.

### 18.3 Where this spec overrides stack.md

| stack.md | This spec | Why |
|---|---|---|
| Low tier skips the stencil door and cuts with a fog-dive | Stencil on every tier with a simplified hall; fog-cut only if the Redmi misses budget there | The door is signature moment 1, and the stencil pass through a 1 m door is cheap |
| Not covered | Interior alpha flag in `InkEffect` | Otherwise the outdoor fog erases the hall seen through the door |
| Not covered | Two glint slots composited after fog in `InkEffect` | A sprite can't survive depth-based post fog |
| Section heights 150 / 450 / 350 / 150 svh | 245 / 327 / 290 / 238 svh | Same 1100 total; split to this beat table |
| Start with drei `<Text>` for chart labels | `BatchedText` from the start, invisible instanced hit quads for picking | 35+ animated glyphs must stay under the draw-call budget on phones |
| `solar-terms.json` table | `calendar.md` adapter (tyme4ts in the grove chunk) | `calendar.md` is the later, measured decision |
| Jump nav "Threshold · Cabin · Grove · Contact" | Home mark plus Work, Grove, Contact | 4.1 |

---

## Appendix A. Scores

Scored 1 to 10 against the confirmed brief.

| Criterion | Cinematic | Usable | Craft |
|---|---|---|---|
| Fit to the confirmed brief | 7. Covers every item, but the chart's stars, doors and deities live on the rings with only earth stems on the palaces, where the brief says the chart is "lit on the palaces"; the forest walk has no content | 8. Covers every item literally, including fallbacks and mobile. Loses points for four lanterns against "one warm lantern accent", a dusk palette, and a compass mode that moves the camera instead of the luopan | 8. Covers every item. Renames content.md's accents (九宫 becomes 奇门, though the brief names 九宫); adds a cliff and waterfall |
| Clarity and usability for freelance clients | 5. Services at 340 vh, links only after 1100 vh, poetic nav labels first, no links on the first screen | 10. The 20-second contract, plain-word nav, links on the first screen, services in the walk, skip-to-work in one tap | 6. Client lines in the forest are good; links only at the end; "Read as text" is the only shortcut |
| Visual distinctiveness | 10. The nudge, the mist wall and guqin, the hanging-scroll finale, the handscroll progress bar | 6. Clean and solid, but signposts and the finale map feel familiar | 9. The inverted-ink cabin, scrolls of light, 斗拱 in line work, the dated colophon |
| Cultural authenticity | 8. 三远 as shot grammar, 坐北朝南, the lantern in the fire palace, the Luo Shu path direction, 圈点 circles | 6. Correct chart data and a verified fixture, but the four-plates-at-four-heights device is invented, and the name was taken from a résumé without asking | 10. Han divination board, Chinese not Japanese lantern, trigram and mountain rules, no colour-coding by school, a full checklist |
| Buildability (R3F, procedural, reasonable scope) | 5. `MeshPortalMaterial`, a per-material ink shader that diverges from `stack.md`, 48 mist cards, a flaring hall, a 20-cue synth score, a flipping ring | 8. Stencil portal, instanced glyphs, DOM-first; the MSDF pipeline, SVG hero and Calm mode add work | 5. Cliff, waterfall, three 皴 families, glyph transit, `<Html transform>` terminal (which `stack.md` rules out), solar-time toggle, leisure seals |
| Mobile performance | 6. Fog as LOD and deferred tier changes are smart; render-target portal and heavy post on phones are not | 10. Tier gate before download, hidden benchmark, real-device budgets, stencil door, DOM chart panel | 7. Sensible tiers, the low-tier grain trick; no hard budgets, mesh pines |
| **Total (of 60)** | **41** | **48** | **45** |

The usability spec is the backbone. It is the only one a client-facing site could ship as written, and its structure matches `stack.md`. It is also the least memorable, so most of what people will remember comes from the other two.

## Appendix B. Grafts and conflict resolution

### B.1 What each draft contributed

- **Usable (backbone):** the 20-second contract and its six rules; DOM sections as the scroll track; plain-word nav with a mobile bottom bar; links on the first screen; services in the forest walk; the stencil door; the lag-driven catch-up fog; the tier gate, hidden benchmark and device budgets; the DOM chart as source of truth; the terminal as a real DOM element with a canvas mirror and command chips; `visualViewport` for the mobile keyboard; the finale map pins; the verified test fixture; the accessibility checklist and the 20-second hallway test.
- **Cinematic:** the one-take rule and mist as the editor; 三远 as shot grammar; the beat-table format with holds and text zones; the lantern glint visible from frame one and placed in the fire palace; the nudge; the ignition from under your feet; the moon gate; the stream, the mist wall and the single guqin note; the mist parting on the platform; the Luo Shu brush path; engine-derived `ringOffsets`; fog as the level-of-detail system with tier changes queued for fog cover; the hanging-scroll finale looking back north with mist belts and the cyan pinprick; the section inscriptions and fog-dive title cards; the sound cue sheet (trimmed); cross-threads in compass mode.
- **Craft:** the five-ink palette with verified contrast; the cinnabar invariant; `night` as the exact inverse of `paper`; the scholar's study translated into light (desk, inkstone, brush rest, paper and seal); 斗拱 brackets in line work; project scrolls with real mount proportions; the Han divination board as the grove's model, round heaven over square earth; dark bluestone with paper glyphs like a rubbing; glyphs lifting off the rings and settling into the palaces; the 值符 plate for legibility; luopan conventions (radial ring glyphs, cinnabar-tipped needle, 天心十道, dial turning in a square base); the octagonal Chinese lantern and Han round-headed stele; the dated colophon; the cultural checklist; the avoid list for Japanese stand-ins.

### B.2 Conflicts and how they were settled

| Topic | Cinematic | Usable | Craft | Decision |
|---|---|---|---|---|
| World axes | +X east, +Z south, walk +Z | N +Z, E −X, walk −Z | +X east, +Z south, walk +Z | Usable's frame. It matches `stack.md` (anchors along −Z) and three.js's default camera forward. All three agree on compass-true and "arrive from the north facing south" |
| Scroll length | 1210 jvh | about 1000 | 1200 / 1000 | 1000 jvh on every breakpoint. "Streamlined" in the brief, and it matches `stack.md`'s 1100 svh document |
| Hero content | Name, pitch, sub-line | Plus links and two buttons | Name and one line | Name, role, pitch, sub-line, links. The buttons duplicate the nav, so they were cut |
| Forest walk | Three lines, undefined | Four 3D signposts with services | Two client lines | Services as two DOM cards, no signposts, with the pine wipe between them |
| Door technique | `MeshPortalMaterial` | Stencil | Portal or stencil | Stencil (`stack.md`), on every tier, plus the interior alpha flag |
| Interior form | Flaring plank hall, 36 m | 24 × 10 × 48 m box | Posts and brackets, walls gone, 36 m | Honest room at the door, planks dissolving, then post pairs with 斗拱 into night. Cinematic's story, craft's cheaper line-work build |
| Project display | Four holo panels | Four holo panels in two bays | 4–6 hanging scrolls of light | Four hanging scrolls of light. Still holographic panels, as briefed, and portrait-shaped for phones |
| Timeline | Credits roll | 3D ledger board | none | Credits roll, which is just the DOM table scrolling past. No ledger |
| Back exit | Moon gate | Moon gate | Paper back door | Moon gate |
| Chart structure | Glyphs on rings; slabs show earth stems | Four plates at four heights | Rings turn, then glyphs settle into palaces | Craft's. It keeps the literal 转盘 mechanism and lights the chart on the palaces, as briefed |
| Stone and glyph colour | Pale stone, celadon glyphs | Pale stone, ink inlay, amber hour | Bluestone, gilt glyphs | Bluestone with paper glyphs. Gilt and amber would add warm colours next to the lantern; celadon adds a hue. Paper on black reads as a rubbing |
| Duty marks | Brush circles on both | Square seal on star, ring on door | Cinnabar plates on both | Plate for 值符, ring for 值使: two shapes, so not colour-only; plus cinematic's 值符 arc |
| Luopan rings | Trigrams + 24 mountains | Trigrams, mountains, 12 branches, 24 terms | Mountains + degree ring | 24 mountains with 5° ticks; trigrams on the slabs; the hour marked on its branch mountain. Usable's "rings are inputs" idea survives as the hour marker |
| Compass mode | Dial rotates, cross-threads | Camera orbits, palaces fixed | Dial rotates in a square base | Dial rotates. It is what "the luopan can follow the compass" means, and it's how a real luopan works |
| Grove camera | Seat, plan view on a button | Three-quarter, then plan in scroll | Standing, then overhead in scroll | Seat for the casting, then plan view in the scroll path, plus a "Read the chart" button that scrolls there |
| Finale | Orbit, look north, hanging scroll, mount | Crane up, sea of mist, pins | Pull back south, colophon | Cinematic's look-back with 3:4 mount on landscape, craft's colophon, usable's pins |
| Seal | 林 | 林 and [name seal] | 林 plus leisure seals | 林 only; name seal optional on the owner's yes; leisure seals cut |
| Fonts | Newsreader, Ma Shan Zheng, Noto Serif SC, JetBrains Mono | Cormorant, Atkinson, WenKai, JetBrains Mono, Ma Shan Zheng | Cormorant, Source Serif 4, Zhi Mang Xing, Noto Serif SC, JetBrains Mono | Cormorant, Source Serif 4, WenKai, Ma Shan Zheng (8 glyphs), JetBrains Mono. WenKai is measured in `stack.md`; Latin stays under 60 KB |
| Nav and progress | Top-right nav, handscroll bar | Bottom bar mobile, top bar desktop, settings | Vertical glyph rail | Usable's nav, craft's hairline progress, cinematic's inscriptions |
| Palette base | Own values | Own values | Own values | Craft's hexes (paper and night are exact inverses), with cinematic's mount tone and a new `cyan-soft` for cabin body text |
| Dive timing | 450 / 750 ms | 350 / 600 ms | 500 / hold / 900 ms | `stack.md`'s 450 / 700 ms, 900 ms for the cabin; emerge along the real path (craft); intent prefetch (usable) |
| Reduced motion | Album | Calm 3D mode | Album, opt-in 3D | Album by default, as the brief says; opt-in 3D with autonomous motion off (`stack.md`) |
| Terminal | DOM over the pane, typed output | DOM over the pane, canvas mirror, chips | `<Html transform>`, own commands | DOM over the pane with canvas mirror and chips; content.md's commands; craft's calm output (no typing effect) |
| Sound | 20 cues | a few samples | CC0 plus one synthesised note | Cinematic's sheet trimmed to 15 cues, 2 samples |
| Pines | Alpha pads, 450–2200 | Canvas billboards, 600–3000 | Mesh plus impostors, 90–260 | `stack.md`'s merged instanced meshes, 300 / 700 / 1500 |
| Lanterns | One | Four (one lit at a time) | One | One |

## Appendix C. Cultural correctness checklist

Check before any release that touches the grove, the seals or the copy.

- [ ] Palaces use the Later Heaven (后天) arrangement: 离 S, 坎 N, 震 E, 兑 W, 巽 SE, 坤 SW, 艮 NE, 乾 NW. The Early Heaven arrangement (乾 S, 坤 N) never appears on the chart.
- [ ] Luo Shu: 9 S, 1 N, 3 E, 7 W, 4 SE, 2 SW, 8 NE, 6 NW, 5 centre. Every row, column and diagonal sums to 15.
- [ ] Trigram bars: 乾 three solid; 坤 three broken; 震 solid at the bottom; 艮 solid at the top; 坎 solid in the middle; 离 broken in the middle; 巽 broken at the bottom; 兑 broken at the top. Bottom line nearest the centre in circular layouts.
- [ ] Star homes: 蓬1, 芮2, 冲3, 辅4, 禽5, 心6, 柱7, 任8, 英9. Door homes: 休1, 死2, 伤3, 杜4, 开6, 惊7, 生8, 景9.
- [ ] Ring order clockwise from 坎1 around 1 8 3 4 9 2 7 6: stars 蓬 任 冲 辅 英 芮 柱 心; doors 休 生 伤 杜 景 死 惊 开.
- [ ] Deity order from 值符: 值符, 螣蛇, 太阴, 六合, 白虎, 玄武, 九地, 九天. Clockwise in the yang dun, anticlockwise in the yin dun. The 勾陈/朱雀 variant per the owner.
- [ ] 24 mountains start at 壬 and run clockwise, 子 centred on 0°, 卯 90°, 午 180°, 酉 270°.
- [ ] South at the top in every chart view: 3D plan, DOM grid, terminal grid, album SVG. East on the left.
- [ ] Seal-script 林 checked against a reference.
- [ ] No machine-translated Chinese. Every Chinese string is in `glossary.json` or content.md with owner sign-off.
- [ ] Year turns at 立春; months at each 节 instant; 拆补法 uses real solar-term instants (`calendar.md`).
- [ ] The lantern is the octagonal Chinese pillar form, not a Japanese tōrō. No Japanese signifiers anywhere.
- [ ] The grove copy calls the platform a design built on the Han divination board and the luopan, not a traditional instrument. Nothing predicts or sells.

## Appendix D. Test fixture

Fixture A, from the usability draft. Monday 28 September 2026, 19:00 to 20:59, UTC+8. 丙午年 丁酉月 乙巳日 丙戌时. 秋分, 符头 甲辰, so 下元, 阴遁 4. 旬首 甲申 hides under 庚 in 坤2. 值符 天芮 moves to 乾6. 值使 死门 moves to 离9. 旬空 午未. 驿马 申.

| Palace | Deity | Star | Heaven stem | Door | Earth stem |
|---|---|---|---|---|---|
| 巽 4 | 白虎 | 天任 | 癸 | 景门 | 戊 |
| 离 9 | 六合 | 天冲 | 己 | 死门 (值使) | 壬 |
| 坤 2 | 太阴 | 天辅 | 戊 | 惊门 | 庚 |
| 震 3 | 玄武 | 天蓬 | 辛 | 杜门 | 己 |
| 中 5 | | | | | 乙 |
| 兑 7 | 螣蛇 | 天英 | 壬 | 开门 | 丁 |
| 艮 8 | 九地 | 天心 | 丙 | 伤门 | 癸 |
| 坎 1 | 九天 | 天柱 | 丁 | 生门 | 辛 |
| 乾 6 | 值符 | 天芮 (值符) + 天禽 | 庚 + 乙 | 休门 | 丙 |

Expected `ringOffsets`: heaven +2 slots (芮 from slot 5 to slot 7), human −1 (死 from slot 5 to slot 4), spirit anchored at slot 7 with yin (anticlockwise) order.

What I checked for this doc: the day pillar is 乙巳 by (JDN − 11) mod 60 with JDN 2461312; the earth plate matches 阴遁4 laid backward from 巽4; every star, door and deity position matches its ring order from the stated 值符 and 值使 moves; heaven stems match each star's home earth stem; the 值使 steps two 时辰 backward from 坤2 to 离9. That checks the fixture against its own rules, not against the tradition. Before it becomes a Vitest case, confirm it against two established Qimen tools (`stack.md` §12 names `qimen-dunjia` 3.1.0 and `bigfishmarquis-qimen` 1.0.0 as dev-only oracles) and against a chart CY trusts.

Fixture B: the same day at 15:00 to 16:59, a 甲申 hour. The hour stem is 甲, so stars and doors sit on their home palaces (伏吟). It checks the 甲-hour rule.

Still to add: an hour on each side of a solar-term instant, 22:59 vs 23:00 for the day rollover, a yang-dun chart, and a chart where the 旬首 仪 sits in palace 5.
