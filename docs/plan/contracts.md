# Shared contracts for the build

Status: written by the scaffold on 2026-09-28, before the parallel wave started, and brought up to date by the integration passes after wave 1, wave 2 and the wave-3a fix wave (same day). Wave 1 replaced every core stub; wave 2 built the four section scenes, audio, the lookdev pass and the platform fixes; wave 3a (dom-phone, painting, grove-rig) fixed the ranked wave-2 issues. `wave1-status.md` has the wave-1 results and, in its section 8, the per-section API map; `wave2-status.md` has the wave-2 results; `wave3a-status.md` has the fix wave, the latest journey sweep and the open issues. This file describes what exists in `src/` today, what each shared module promises, and who owns what. The specs still decide look and behaviour: `design.md` first, then `stack.md`, `qimen-spec.md`, `calendar.md` and `content.md`. Where this file records a decision the specs left open, it says so in the last section.

Everything marked STUB in a file header compiles and runs but is a placeholder for its owner to replace. Keep the exported signatures unless you coordinate the change here.

## 1. Commands

| What | Command |
|---|---|
| Type-check, all | `npm run typecheck` (TypeScript 7, about half a second) |
| Type-check, your paths only | `npx tsc -p tsconfig.json --noEmit 2>&1 \| grep -E 'src/env/'` |
| Unit tests | `npx vitest run` or `npx vitest run src/lib/qimen` |
| Lint, including import boundaries | `npm run lint` |
| Client build | `npx vite build` |
| SSR build of the content layer | `npx vite build --ssr src/entry-server.tsx --outDir dist-ssr` |
| Dev server on your own port | `npx vite --port <PORT> --strictPort` |
| Screenshots | `node scripts/dev-shot.mjs --port <PORT> --out /tmp/cy-<you> '#top' '#cabin' 'jvh:300' '/?mode=static'` |

Vitest runs two projects: `node` for everything, and `dom` (jsdom) for `src/dom/**/*.test.{ts,tsx}`.

`npm run build` chains `scripts/render-articles.mjs` (tooling), the client build, the SSR build and `scripts/prerender.mjs` (dom). Then `npm run check:glyphs` and `npm run check:budget`. End-to-end tests run against `npm run preview` (port 4173): `CHROMIUM_PATH=/usr/bin/chromium npx playwright test --grep-invert @visual`.

`npm run build && npm run shots` regenerates the album stills and `public/og.png` (`scripts/shots.mjs`). Stills are the painting alone: the script hides the content layer and everything the finale lays over the canvas (colophon, seal, pins), because the album sets its own colophon and seal beside the E3 still. og.png is the T0 frame with the name, the hero line and the 白文 林 seal on the paper under the forest band; its text comes from `content/site.ts` `hero`, and `meta.og.imageAlt` repeats the words drawn in it. Re-run it whenever a scene changes, then `npm run check:budget`.

Screenshot gotcha. Chromium 152's CLI `--screenshot` returns a blank paper-coloured frame whenever the page is scrolled, even on a plain static page. It only works for the top of the walk. `scripts/dev-shot.mjs` drives Playwright with SwiftShader instead. It accepts `#hash` targets (a fresh load with that hash), `jvh:N` (load, then scroll to journey position N) or a path with its own query. With the default `?e2e=1&tier=high` it prints `window.__cy` state and page errors per shot. Kill your dev server when you are done.

## 2. Module ownership

- core-journey: src/core/store/**, src/core/scroll/**, src/core/camera/**, src/core/sections/**, src/core/world/journey.ts, src/core/boot/**, src/main.tsx
- core-render: src/core/render/** (Stage, quality, post, glsl, textures), src/core/text/**
- env: src/env/** (terrain, path strip, pines incl. hero pines, mountains, mist, scatter, rock, grass/fern strokes, createInkMaterial and other world materials), src/core/world/layout.ts (may extend, not break)
- qimen: src/lib/qimen/**, src/lib/compass/**, src/lib/calendar/**, scripts/build-terms.*
- dom: index.html, src/dom/**, src/content/**, src/styles/**, src/entry-server.tsx, scripts/prerender.mjs, src/theme/** (tokens owner)
- tooling: scripts/** (except build-terms and prerender), public/** (fonts, seals, favicon, og, robots, sitemap, 404, CREDITS), .github/**, playwright.config.ts, tests/e2e/**
- wave 2 (later): src/sections/{threshold,cabin,grove,contact}/**, src/audio/**

Notes on the table:

- Root config files (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.oxlintrc.json`, `.gitignore`, `.nvmrc`) belong to nobody in the wave. Treat them as frozen and put a change request in your report.
- The terminal command engine lives in `src/dom/terminal/`, owned by dom, not in `sections/cabin/terminal/` as `stack.md` §6 sketched. The DOM terminal must work in the album with no 3D, and the DOM may not import sections. The cabin's 3D pane mirrors the log through the store (`terminal.lines`).
- `scripts/dev-shot.mjs` falls under tooling's `scripts/**`. Tooling may rewrite it but should keep the CLI.
- `src/env/Environment.tsx` already exists as an empty stub, and `Stage.tsx` already mounts it. Env fills it in without touching core-render files.

## 3. Import boundaries

`.oxlintrc.json` enforces these with `no-restricted-imports`. I checked each rule against a deliberate violation.

| Folder | May import | Must not import |
|---|---|---|
| `src/sections/<x>/` | core, env, lib, content, theme | another section, `dom/`, `audio/` |
| `src/dom/`, `src/content/`, `src/theme/`, `src/entry-server.tsx` | core store, scroll, sections ids, world data, content, theme | three, @react-three/*, postprocessing, troika, maath, `sections/`, `env/`, `core/render/`, `core/camera/`, `audio/` |
| `src/lib/` | nothing from the app | react, three, tyme4ts, `core/`, `sections/`, `dom/`, `env/`, `content/` |
| `src/core/`, `src/env/` | each other, lib, content, theme | sections (except `core/sections/registry.ts` via dynamic import), `dom/` |

The DOM layer ships in the boot chunk, which is why it may never reach 3D code. `vite.config.ts` also claims react, react-dom, scheduler, zustand and use-sync-external-store for a `boot-vendor` chunk at priority 30. Rolldown groups pull in their modules' dependencies by default, so without that group the `r3f` group swallowed react and the entry modulepreloaded `three-*.js` and `r3f-*.js`. The current build preloads only `boot-vendor`.

Boot JS budget (wave 2, platform). The 85 KB of `stack.md` §4 is out of reach while the DOM is React: React 19, ReactDOM and zustand alone are 68.4 KB gzip, and hydration needs every section's copy. Wave 2 moved everything off the first screen out of the boot closure: the camera keys and beat notes (boot imports `core/world/beats.ts`, the stage imports `core/world/journey.ts`), the gloss tooltip (`GlossLayer` chunk), the settings panel (`Settings`), and the walk-only chrome (`WalkChrome`: inscriptions, title card, finale, lost-canvas still). With the wave-2 scenes in, boot measured 97.9 KB (from 101.9) in 10 chunks, and 97.4 KB after the integration pass moved `guessTier` out of the quality table, so `scripts/check-budget.mjs` now gates at 102 KB, 4 KB of headroom. The chunk count grows as lazy chunks start sharing content and token modules with boot; each split costs a little gzip context. Reaching 85 needs Preact/compat or islands-only hydration, which is an owner decision (`wave1-status.md` H1). Boot code must keep importing `beats.ts`, never `journey.ts`, or the keys come back.

## 4. Contracts, file by file

### src/theme/tokens.ts and tokens.css

Exports `color`, `ColorToken`, `ink`, `inkRamp`, `alpha`, `font`, `fontFiles`, `typeScale`, `sealSize`, `glyph3d`, `motion`, `easingCss`, `easing`, `z`, `breakpoint`, `layout`, `tokens` (all of the above in one object) and `cssVars()`.

- `color` holds every design §2 hex under camelCase names, plus `woodDark` and `woodLight` from §8.4. `night` is the exact RGB inverse of `paper`, and a comment says so in both files.
- `ink` lists the five inks darkest first, 焦 浓 重 淡 清. `ink[0]` is the contour colour. `inkRamp` holds the stops for `makeInkRamp` and ends on paper.
- `typeScale` holds CSS lengths in rem, with a `desktop` size where §3.1 has one. `glyph3d` holds 3D glyph heights in metres. `fontFiles` lists the `/fonts/*.woff2` and `.woff` paths tooling must produce.
- `motion` holds durations in ms: dive 450, 700, 900 for the cabin, 150 reduced, 50 under e2e, and a 5000 give-up. It also has the chrome crossfade, tooltip delay, seal timings and canvas reveal.
- `z` is the stacking order: stage 0, content 10, map pins 15, chrome 20, terminal overlay 22, veil 30, title card 31, header and bottom bar 40, sheet 45, popover 50, toast 60, tooltip 70, skip link 100. The veil covers content but never the nav.
- `cssVars()` returns the custom properties `tokens.css` must declare, for example `--paper-light`, `--fs-h2`, `--lh-h2`, `--z-veil`, `--dur-dive-in` and `--zone-b-w`. `tokens.test.ts` fails if the CSS drifts, so edit `tokens.ts` first, then the CSS.

### src/core/sections/ids.ts

`SECTION_IDS` (walk order), `SectionId`, `SECTION_HASH`, `SectionHash`, `isSectionId`, `sectionFromHash(hash)`. The last one maps unknown and empty hashes to `threshold` and accepts `#threshold`. This file is the one definition of `SectionId`.

### src/core/store/journey.ts

This is a zustand vanilla store, `journey`, with a React hook `useJourney(selector)`. Other exports are `initialJourneyState()`, `nowMs(s)`, `chartInstant(s)`, `isSettled(s)` and the types `JourneyState`, `Tier`, `RenderMode`, `PostGroup`, `DivePhase`, `StagePhase`, `CompassStatus`, `DiveState`, `ScreenRect`, `ScreenPoint` and `TerminalLine`.

Three rules. Per-frame code calls `journey.getState()` and never subscribes. React selects only coarse fields; never `u`, `jvh`, `dive.amount` or `lagFog`. Nested objects get replaced, never mutated.

Every field has one writer:

| Field | Meaning | Writer |
|---|---|---|
| `u`, `jvh` | Path position, u = jvh / 1000 | ScrollDriver |
| `active` | Section under the scroll position | ScrollDriver, diveTo |
| `snap` | Place the camera without damping next frame | diveTo sets it, CameraRig clears it |
| `dive` | `{ phase, amount 0..1, to }`. uDive in post, and the `#veil` mirrors it | core/scroll dive |
| `lagFog` | Catch-up fog added to uLocalFogBoost | CameraRig |
| `fogBase` | Beat fog density before the tier multiplier | CameraRig |
| `portrait` | Aspect below 1, so portrait overrides and zone B apply | boot resize |
| `post`, `postBlend`, `insideCabin` | Post group, crossfade, camera past the door plane | CameraRig |
| `tier`, `reducedMotion`, `mode` | Quality tier, motion preference, `static` or `immersive` | boot; QualityController changes `tier` |
| `stage` | `none`, `loading`, `benchmark`, `live` or `lost` | core/render |
| `ready[id]` | Section chunk loaded and prewarmed | SectionHost |
| `e2e`, `clock`, `nowOverride` | Deterministic mode, frozen shader clock, `?now=` | boot |
| `soundOn` | Sound toggle | DOM button; `src/audio` reads it |
| `ignitionPlayed`, `cabinFocus`, `pane` | I0 played; scroll hovered or card focused, 0..3; projected terminal pane rect | cabin scene; DOM writes `cabinFocus` on focus |
| `terminal.lines` | Terminal log, max 200 | DOM terminal writes, 3D pane reads |
| `chartInstantMs`, `selectedPalace`, `showEnglish`, `dialDeg` | Picked moment (null means live), selected palace, English labels, manual dial rotation | DOM chart controls and the grove scene |
| `compass` | `{ status, heading }` | DOM compass button through lib/compass; since wave 3a CameraRig also sets it to `off` when the walk leaves the grove |
| `groveCastPlayed` | Casting has played this session | grove scene |
| `contactHover`, `finale`, `pins` | Hovered social row, finale once-per-visit flags, projected E3 map pins | contact scene; DOM writes `contactHover` |
| `gloss` | A 3D glyph asks the DOM tooltip to open at a screen point | scenes; DOM Gloss reads |

Fields added in wave 1:

| Field | Meaning | Writer |
|---|---|---|
| `paper` | Moon-gate whiteout 0..1 (rises 562–571, clears by 578). The ink pass uses `uDive = max(dive.amount, paper)` | CameraRig |
| `dive.waiting` | The hold is waiting for the target section; the title card shows "Grinding ink…" after 400 ms | core/scroll dive |
| `lagFog` | Now 0..1 "how much paper" (engages above 25 m of lag, clears under 5 m) | CameraRig |
| `staticReason` | Why the album shows (`AlbumReason` from content/ui), mirrored on `html[data-static-reason]` | boot; core/render writes `'slow'` |
| `tier` | Also written by the DOM on an explicit Settings → Low or High (then it dispatches `cy:quality`) | boot, QualityRuntime, DOM |
| `selectedPalace` | Also written by the DOM chart when a palace takes focus | grove scene, DOM |

Wave 2:

| Field | Meaning | Writer |
|---|---|---|
| `ringSpeed` | Fastest ring's angular speed in slots per second while the plates turn, 0 at rest (grind and detent cues) | grove scene, only on change; audio reads |
| `cabinFocus` | Both ways: the DOM card lights (`.work-card[data-focus]`) when the scene writes it, and writes it on card hover and focus. Writers compare before writing | cabin scene, DOM |
| `contactHover` | Both ways: the DOM row lights (`.socials-rows a[data-lit]`) when the scene writes it | contact scene, DOM |
| `selectedPalace` | A value the DOM grid didn't write itself counts as a 3D pick: the grid opens that palace's meanings, makes it the tab stop and scrolls it into view inside the panel; on phones the sheet opens on the Chart tab | grove scene, DOM |
| `finale` | `mountOpen` opens the mounts from E2 on (never before `MARKS.finaleStart`); the DOM opens them anyway at `MARKS.sealStamp`. `sealStamped` and `colophonShown` start the stamp and the writing once per visit; if neither has come after E3 is reached, the DOM signs the painting itself: after 1.2 s with no live contact scene (still loading, or a lost context), after 8 s with one, so the scene's colophon-then-seal order wins even after an End-key jump whose catch-up fog takes seconds to clear. The DOM also sets `html[data-mounts]` while the mounts are open, and the contact card moves onto the right mount with them | contact scene |
| `pins` | Shown from `MARKS.sealStamp` while `visible` and inside the window (3:4 between the mounts under the header; on phones from the bottom of the top block, which is the colophon, the E1 link icons and the footer when it is anchored up, down to the bar). The DOM places the labels with `src/dom/finale/pins.ts` (wave 3a, see the DOM section) | contact scene, every frame |
| `pane` | While it is set inside the I3 hold the terminal sits over it (`[data-pane=over]`) and fades in; when it clears it fades out in place (`leaving`). While the cabin scene is live the card copy stays hidden (`await`) so it never flashes first; with no pane 600 ms into the hold it shows in its card | cabin scene |

Helpers: `visibleSections(u)`, `isSettled(s)` (dive idle, and either static mode, stage 'lost', or stage 'live' with every visible section ready; immersive before 'live' is not settled; this is what e2e waits on), `underFogCover(s)` (dive ≥ 0.5, paper ≥ 0.5, lagFog ≥ 0.5, or outdoor fogBase above `FOG_COVER`).

### src/core/sections: types.ts, defineSection.ts, registry.ts, SectionHost.tsx

- `SectionDefinition` has `id`, `hash`, `label`, `zh`, `spanJvh`, `span` (in u), `arrivalJvh`, `arrivalU`, `heightSvh`, `post`, `load()` and `Scene`. `SectionSceneProps` is `{ id }`. Scenes read everything else from the store, `layout.ts` or content.
- `defineSection(input)` derives the u values and memoises `load()`, retrying after a failed fetch. It also wraps `load` once in `React.lazy` as `def.Scene`, so the lazy component and prewarm share one fetch.
- `registry` maps each id to its definition, with a dynamic import of `src/sections/<id>/Scene.tsx`. `sections` lists them in walk order, and `distanceToSpan(u, span)` is a helper. Scene modules must default-export a component taking `SectionSceneProps`.
- `SectionHost` mounts a scene once the camera is within `RIG.preloadU` of its span and keeps it in `<Activity>` afterwards. On low tier a section more than one section behind unmounts, but only under fog cover. It prewarms with `gl.compileAsync` on the scene's root group and then sets `ready[id]`; a scene error boundary logs, counts the section as ready and draws nothing. Anything a scene suspends on (fonts, textures) resolves before prewarm.
- `prefetch.ts`: `prefetchSection(id)` (grove also fetches contact) and `startSectionPrefetch()` (u ≥ 0.12 fetches the cabin; entering the cabin fetches the grove).

Values follow design §6.2. Spans in jvh are threshold 0 to 245, cabin 245 to 572, grove 572 to 862 and contact 862 to 1000. Arrivals are 0, 345, 666 and 886. Heights are 245, 327, 290 and 238 svh, which total 1100. The cabin's `post` is `cabin`, but the rig switches on the door plane, not on this field.

### src/core/world/layout.ts (env may extend, not break)

This is pure data plus helpers, with no three.js import. It uses `Vec2 = [x, z]` and `Vec3 = [x, y, z]` readonly tuples.

- Axes follow design §0. North is +Z, south is −Z, east is −X and west is +X. `bearingToDir(b)` returns `(−sin b, 0, cos b)`. `dirToBearing(dx, dz)`, `bearingBetween(a, b)` and `wrapDeg` are helpers. `yawForBearing(b)` returns `−b` in radians, for objects whose local +Z should face `b`. `cameraYawForBearing(b)` returns `π − b`.
- Landmark groups: `threshold` (K0, meadow, pines A and B, rock), `pathToCabin`, `pathToGrove`, `PATH_WIDTH`, `cabin` (footprint, door, steps, window, chimney, close trunks, leak box, spill), `hall` (near room, dissolve, post pairs, night shell, moon gate, four scrolls, desk, terminal pane), `pathZone` (emerge point, stream, stones, bamboo, mist wall, crest, standing stones), `grove`, `exit` (lantern, signpost, ledge, orbit centre, mist belts, map pins), `mountains`, `glints`, `PAINTER_LIGHT` and `zoneAnchor`.
- `grove` has the platform, the rings R1 to R4 with radii and heights, the needle, the ground mist, `palaceCentre[1..9]` compass-true, `ringPalaces = [1, 8, 3, 4, 9, 2, 7, 6]` with slot k at bearing k × 45°, and `planFitRadius` 12.3. `ringSlotDir(k)` gives a slot's direction.
- Terrain: `TERRAIN_KNOTS` and `terrainHeight(x, z)`. It is flat to z −95, crests at 1.8 m from z −118 to −122, flat from −130 to the ledge at −192, then drops to −25. The `pathToGrove` y values are nominal, so sample `terrainHeight` for the ground.
- Scatter keep-outs: `KEEP_OUTS` holds both path corridors at 2 m either side, the lantern sightline at 1.5 m wide, and circles around the cabin (r 10), the grove (r 18) and the exit (r 6). `inKeepOut(x, z, keepOuts?, margin?)` and `distanceToPolyline` go with it. The corridors use spline control points as a polyline, which stays within about 0.5 m of the curve. Hero pines A and B are exempt.
- Wave 2 entries: `threshold.nearTrunks` (the two 焦 trunks the threshold scene draws at F1 and F3), `cabin.ridgeY` 5.15 (the 40° pitch from the eaves; was 4.65) and `cabin.chimney.topY` 6.2 (was 5.4), `exit.finaleCabinGlint` [4, 2.5, −66.06] (glint slot 1 during the finale, on the south wall the finale camera sees; `glints.cabin` on the door gable stays for the automatic fade-in) and `exit.finaleOpening` (a corridor keep-out the contact scene registers from jvh 935).

### src/core/world/journey.ts, the beat table (core-journey)

This is the single camera tuning file. It exports `EMERGE`, `BEATS`, `Beat`, `Key`, `RIG`, `PORTRAIT`, `PortraitOverride`, `H_FIT_DEFAULT`, `beatAt`, `beatById`, `channelKeys`, `sampleScalar` and `Channel`, and re-exports everything in `beats.ts`, so stage code keeps importing from here.

`src/core/world/beats.ts` (wave 2) is the part the boot chunk needs, with no camera keys: `J`, `jvhToU`, `uToJvh`, `SectionSpan`, `SECTION_SPANS`, `sectionAtJvh`, `BeatId`, `TextZone`, `BeatSpan`, `BEAT_SPANS` (id, section, range, hold, zone per beat), `BEAT_IDS`, `beatSpanAt`, `beatSpanById`, `holdOf`, `inHold`, `MARKS`, `FOG_COVER`, `PRELOAD_U` (`RIG.preloadU`), `FRAMING`, `STILLS` and `stillJvh`. DOM, boot, store, scroll and sections code import this file only. The `BEATS` rows still carry each beat's range, hold and zone so the camera table reads on its own; `beats.test.ts` fails if a row and `BEAT_SPANS` disagree, so a retimed hold is edited in both.

Keyframe conventions:

- Each beat has independent channels: `pos`, `look`, `fov`, `fog`, `roll`, `up` and `paper`. A key is `{ at: jvh, v, cut?, fit? }`. A beat can leave a channel empty, and the previous value carries on.
- `pos` and `look` run through centripetal Catmull-Rom curves over all keys of the channel, with a piecewise-linear jvh-to-parameter map between keys. Equal consecutive keys mean a stationary hold, so dedupe them before building the curve. `up` blends with a normalised lerp. The scalar channels are piecewise-linear and constant beyond their ends.
- `cut: true` jumps instead of interpolating. There is exactly one, at 572, where the moon gate teleports the camera under full paper. `fit: 'plan'` tells the rig to replace y with h_fit, which defaults to 34 m and must be recomputed on resize.
- Roll is in degrees, positive leaning right as the viewer sees it. The S-curve lean runs +1.5° in F1 and −1.5° in F3.
- `fog` is `uFog.x` before `TIERS[tier].fogMultiplier` when a beat's `medium` is `ink`. Inside the hall `medium` is `night`, and the value is the interior materials' own fade density.
- `paper` is the scroll-driven dissolve for the moon gate: it rises from 562 to 571, holds, and clears by 578.
- How I placed keys. Hold boundaries are explicit. Pass-through waypoints sit at chord-length positions between holds, so speed stays even. The exceptions, where a beat's own range matters, are C2 at 292, C4 at 310, 313 and 322 (the door plane is crossed near 316), I0 at 336, and the mist-wall run at 626, 633, 645 and 660. A test caps speed at 2 m per jvh; the fastest segment is the E2 orbit at about 1.7.
- `MARKS` holds scroll events: door portal 274, door swing 276 to 290, creak 277, door-click target 318, moon gate 562 to 572, guqin 622, cast start 655, "Read the chart" 742, seal 985 and the prefetch points. `EMERGE` holds the dive emerge poses from §6.2. `RIG` holds damping, breath, parallax, catch-up thresholds, near and far planes, and `preloadU`. `PORTRAIT` holds §6.4: a 46° horizontal FOV clamped to 55–68°, a 1.5 m look lift, and per-beat overrides for T0, C3, I2a to I2d, I3, G1, G3, E1, E2 and E3.

Wave 3a (grove-rig):
- The landscape F4 pos/look key moved from 233 to 240, so the camera keeps one speed into C1 (`path.test.ts` caps the speed ratio along the approach at 1.35 on both layouts).
- `PORTRAIT` overrides now also cover F4 (key at 232), C1 (about 7 m from the door, level, horizon at 44%; the door is 21–22% of the frame height), C2, I2a–d (explicit pos/look, 2.3 m further back, aimed at the scroll's middle), G1 (0, 18, −138) looking at (0, 0.45, −151), and E1 (1 m further back, look x −0.25). `subjectY` gained C1 0.44, P3 0.5 and G1 0.25.
- `RIG.planZoom = { fill: 0.7, smoothTime: 0.4, max: 12 }` and `RIG.compass = { holdMargin: 4 }` (below).

### src/core/render (core-render)

- `quality.ts` has `TIERS[tier]` with every §13.3 value: DPR cap and floor, fog multiplier, pines 300/700/1500, mist planes, ridge layers, ink edges, boil, 皴 level, bloom levels, MSAA, simplified hall, dust, and so on. It also has `stepTier`, `isTier`, `startDpr`, `guessTier(DeviceHints)` (the `stack.md` §5 heuristic, where SwiftShader counts as low), `BENCHMARK` and `PERF_MONITOR`. Env and sections read counts from `TIERS` and never hard-code them.
- `Stage.tsx` default-exports `Stage({ eventSource, initialTier, reducedMotion, startup?, onReveal?, onSlow?, onContextLost? })`. The `<Canvas>` has the `stack.md` §5 props, `stencil: true`, a paper clear colour with alpha 1 and `scene.fog = null`. It mounts `CameraRig`, `Environment`, one `SectionHost` per section, `PostStack` (the ink group and the cabin Bloom + AgX + finish group, crossfaded by `postBlend`) and `QualityController` (benchmark, develop reveal, DPR and tier monitor, the tier queue that waits for fog cover, frame caps, idle pacing).
- `mountStage.tsx` exports `mountStage(container, eventSource): () => void`. `main.tsx` imports it lazily in immersive mode, after `load`, on idle. It owns `#stage`'s inline opacity (never set it in CSS). Its two exits: a slow benchmark switches to the album (`mode 'static'`, `staticReason 'slow'`) and toasts "Walk the forest anyway"; context loss sets `stage 'lost'` and toasts "3D paused. Tap to restart."
- `index.ts` is the barrel for env and sections:
  - Quality: `TIERS`, `stepTier`, `guessTier` and the other quality helpers.
  - Glints: `glintSlots`, `setGlint`, `resetGlints`.
  - Post knobs: `postFx`, `resetPostFx`, `autoFlatten`, `POST`.
  - Interior flag: `markInterior`, `INTERIOR_ALPHA_THRESHOLD`.
  - Pacing and time: `wake`, `holdAwake`, `shaderTime`, `motionTime`.
  - The `CyToastDetail` type.
- The interior contract (`post/interior.ts`): interior materials store alpha 0, via `markInterior(mat, 'opaque'|'additive'|'blend')` or `gl_FragColor.a = 0.0`, and the ink pass skips them.
- `src/core/text/configure.ts` exports `TEXT_FONTS`, `SDF_GLYPH_SIZE`, `preloadText`, `textMaterial` and `interiorTextMaterial`.
- Events: the stage dispatches `cy:toast` with `{ id, message, action?: { label?, run } }` and listens for `cy:quality` (Settings → Quality).

Wave 2 additions (lookdev and integration):

- `postFx.scissor: ScissorRect | null` (`ScissorRect = { x, y, w, h }`, CSS px, top-left origin, as `getBoundingClientRect()` gives them; exported from the barrel). While set, PostRig applies it every frame to `gl.setScissor` and the composer's input and output buffers; outside the rect the canvas goes transparent, so set it only while opaque DOM covers the rest (contact sets it while the finale mounts are closed). Null turns it off. `resetPostFx` clears it.
- `postFx.aerial` (0..1, default `POST.aerial` 0.5): the most paper aerial perspective adds. New `POST` constants: `aerial`, `aerialRate`, `edge`, `bands`, `fogBreath`.
- Fog model (`glsl/inkFog.glsl`): `inkFog(wp, dist) = 1 − (1 − groundMist)(1 − aerial)`. Ground mist is exp² with density `uFog.x · exp(−falloff · h) · noise + boost` and no density floor (issue H2 closed); aerial is `uAerial.x · (1 − exp(−uAerial.y · dist))` with the rate `uFog.x × POST.aerialRate`. Only depth ≥ 0.9999999 counts as sky.
- Contours: 0.85–1.75 CSS px, varying along the line; suppressed where the nearest surface already reads as paper (so pale opaque props lose their outline).
- Prewarm: `gl.compile` / `gl.compileAsync` with no render target bound compile against an offscreen target, which matches the composer's program variant (Stage `compileForComposer`).
- `QualityRuntime`: Auto after Low or High resets the ceiling to the benchmark result (M3). MSAA and bloom levels stay startup-only.
- `guessTier` and `DeviceHints` live in `guessTier.ts` (quality.ts re-exports them), so the boot chunk imports the guess without the TIERS table.
- Default vertex attributes (`defaultAttributes.ts`, integration): Stage runs `fillSceneDefaultAttributes(scene)` before every frame, which gives each visible mesh real constant attributes for any custom `material.defaultAttributeValues` its geometry lacks. three binds those defaults with `gl.vertexAttrib*`, which is context state, not vertex-array state, and only while it rebuilds a vertex array, so a cached draw read whatever another program last wrote there: the cabin's close trunks read `iInk` 0 and drew as paper. Materials may keep declaring defaults; they now always hold.
- `RenderStats` (e2e only): Stage mounts it under `?e2e=1`; `window.__cy.renderStats()` returns the last whole frame's `{ calls, triangles, points, lines, programs, geometries, textures }` (accumulated across the composer's passes). The counters reset as each frame starts and are read live, so a read between frames sees the last complete frame even after the frame governor has stopped the loop. Read it a second or so after `settled`, because SwiftShader frames lag. `triangles` is `Infinity` (JSON `null`) in a frame where a troika `BatchedText` draws before its first sync: `BatchedText` never sets `geometry.instanceCount`, so three passes `Infinity` until the batch's instanced attributes are bound, and WebGL draws 0 instances. It is a counter artefact of the frames right after a mount, not geometry.

Wave 3a (painting):
- The ink pass's fog is the walk fog (ground mist, aerial perspective, and from wave 3a an understorey mist and canopy haze) mixed into a finale "painting mist" by `finaleMistWeight(jvh)`, which ramps in from jvh 938: distance recession starting 55 m out, four ragged-topped belts from `layout.exit.mistBelts` between the subjects, and a sea of cloud under the ledge. The lag and dive boosts still apply in the finale. The understorey mist (`understoreyMist(jvh)`) runs on the walk, the path and the exit only, never in the grove or at the cabin.
- `postFx.fogNoise` (default 0.6, was 0.35) now means patchiness: density runs from 1 − w to 1 + w. `postFx.ts` also exports `finaleMistWeight`, `forestDepth`, `forestFogTint` (the far fog tint drifts toward paper-shade with forest depth, up to 0.4, design §8.2) and `understoreyMist`. New `POST` knobs: `edgeFalloff` (contour weight falls from full at 5 m to 22% by 65 m, with 断笔 breaks), `finaleMist`, `fogTint`, `fogTintDistance`, `understorey`, `forestAerial`. `POST.bands` went from 0.18 to 0.07.
- `glintFrame(slot, g, dist, jvh, flicker, fog = 0)`: slot 0 (the lantern) fades out between `LANTERN_FOG_FADE` = [0.5, 0.9] × `FOG_COVER` of `fogBase + postFx.fogBoost`, so the glint is gone in the P2 mist wall and back at P3. `InkEffect.fog` carries the value; PostRig sets it.
- `?renderTest` is its own lazy chunk (about 5 KB); the stage chunk only holds the dynamic import.

### src/core/camera/CameraRig.tsx (core-journey)

The real rig, at `useFrame` priority −1.
- The path: centripetal Catmull-Rom splines split at the 572 cut, arc-length within each segment.
- Motion: maath damping, breath on holds, the F1–F3 lean, desktop parallax, portrait overrides.
- Framing: `setViewOffset` text zones, and the G2/G3 plan view with h_fit.
- Dives: the dolly and the emerge poses.
- It writes `fogBase`, `lagFog`, `paper`, `post`, `postBlend` and `insideCabin`, and clears `snap`.
- The mist waits (design §8.5 P2, wave 2): from `MARKS.reveal[0]` (628) to the end of the grove span, while `ready.grove` is not true, `fogBase` holds at `pathZone.mistWall.fogPeak` (0.14), easing in over 0.2 s and out over 0.6 s (`mistHoldTarget`). This covers a grove chunk that hasn't loaded or is still suspended on its glyphs; GrovePath's own `postFx.fogBoost` hold then adds nothing.
- It owns the camera's fov, aspect, view offset, up and near/far every frame. Nothing else writes the camera.
- Pure parts: `rig.ts` (`Rig`), `path.ts` (`buildCameraPath`) and `framing.ts`.

Wave 3a (grove-rig):
- Touch zoom in the plan view (design §9.7), `src/core/camera/planZoom.ts`: `PlanFocus { x, y, z, size }`, `setPlanFocus(f | null)` (the grove writes it every frame while zoomed, null otherwise), `planFocus()` (the rig reads it), and the pure maths `Lens`, `zoomToFill(H, fovDeg, depth, size, fillPx)` and `zoomLens(W, H, lens, off, zoom, centre, t)`. The camera never moves: the rig narrows the FOV and shifts the view offset so the palace fills `RIG.planZoom.fill` (70%) of the chart area's width (the smaller side on a landscape tablet) and slides to its middle over `smoothTime` 0.4 s (instant with reduced motion). It applies only while jvh is in the G3 beat [740, 835) and no dive runs; scrolling out or a dive drops the zoom but keeps the selection. The DOM can't import core/camera, so it drives the zoom only through `selectedPalace`.
- Compass (design §9.9): `rig.ts` exports `compassAction(s, prev): { glideTo: number | null; off: boolean }`. When compass mode switches on anywhere in the grove outside the G3 hold, CameraRig glides to 746 (829 when coming from G4) with `scrollToJvh(glideTo, { smooth: true })`; once `active !== 'grove'` in the walk it writes `compass: { status: 'off', heading: null }`. "Read the chart" resets to south-up in the DOM, as before.

### src/core/scroll (core-journey)

- `index.ts` exports:
  - Driving and gliding: `startScrollDriver({ smoothWheel })`, `scrollToJvh(jvh, { smooth? })` (a 1.2 s glide).
  - Jumps: `jumpTo(id, { replace? })` (pushState, then dive) and `diveTo(id, { fromLoad? })`.
  - Hash nav: `initHashNav()`, `sectionOfHash(hash)`.
  - Announcing: `announce(message)` (a `cy:announce` window event with `detail: { message }`).
  - Also: `isDiving()`, `NEAR_JUMP_JVH`, `jvhAtScrollY`, `scrollYAtJvh`, `refreshScrollMap`, `scrollRange`, `jvhFromScroll`.
- The scroll map is measured from the DOM section tops (ResizeObserver) and is piecewise-linear between them. Lenis smooths the wheel on fine-pointer desktops only and loads lazily.
- In the walk, a jump is a fog-dive:
  - Phases on `journey.dive`: in → hold → out.
  - The hold waits for `ready[id]` and gives up after 5 s.
  - A newer jump supersedes an older one. A hand scroll going in aborts the dive; during the hold it emerges at once.
  - Within 100 jvh there is no dive, only a glide.
  - Reduced motion gets a short crossfade.
  - On settle it focuses `#<id>-heading` and announces "Now at …". The heading gets `data-jump-focus="keyboard"|"pointer"` from the last input (`modality.ts`, capture-phase keydown and pointerdown), and base.css draws the ring for keyboard jumps only, whatever `:focus-visible` guesses. The attribute goes on blur.
  - Deep links start in full paper and only emerge, and leave focus alone (the fragment and the announcement suffice). Back and forward re-dive.
- In the album there are no dives. A jump lands the leaf just under the header (`scroll-margin-top`) and holds it there for 2.5 s while client-only content lays out. `active` comes from a probe line under the header.
- The DOM never needs to import these for plain links: delegated listeners handle `<a data-jump href="#grove">` (with prefetch on intent) and `[data-scroll-jvh="742"]`.

### src/core/boot (core-journey)

- `params.ts` has `parseBootParams(search)`, reading `e2e`, `tier`, `now`, `mode`, `debug` and `still` (a validated BeatId).
- `mode.ts` has `decideBoot(params, prefs, env)`: the album gates and their reasons, and the tier guess. `webgl.ts` has `probeWebgl2`; `viewport.ts` has `startViewportWatch`.
- `prefs.ts` has `readPrefs()`, `writePrefs(patch)` and `PREFS_KEY = 'cy.prefs'`, which stores JSON `{ mode?, quality?, sound? }`. The inline script in `index.html` reads `mode` from the same key before first paint.
- `e2e.ts` has `exposeE2E()`, which sets `window.__cy = { settled, state, jump(id), scrollToJvh(jvh), renderStats? }` under `?e2e=1` or `?still=`. `renderStats` appears once the stage mounts (see core/render). `?still=<BeatId>` hides `#root` and scrolls to `stillJvh(beat)` for album stills. The grove adds `?groveCast=<seconds>` (freeze the casting at that moment, e2e only).
- Sound (`main.tsx`, walk only): the first time `soundOn` turns true, `import('./audio')` and call `startAudio()`; that click is the gesture an AudioContext needs. A saved "on" waits for the first pointerdown or keydown. A failed chunk only logs a warning. After that `src/audio` follows `soundOn` itself.
- Deep-link veil (`index.html`): when the head script picks the walk and the hash is `#cabin`, `#grove` or `#contact`, it sets `html[data-veil]`, and an inline style holds `#veil` at opacity 1 before first paint. `bindVeil` (`src/dom/bindings.ts`) takes the veil over and clears the attribute; if the app never boots, a 4 s timeout clears it, so content is never covered for good. `#veil` now comes before `#root` in the body.

### src/lib/qimen (qimen)

- `types.ts` follows `qimen-spec.md` §13 field for field: `Stem`, `Branch`, `PalaceNo`, `OuterPalaceNo`, `Star`, `Door`, `Deity`, `SolarTermName`, `TimeBasis`, `ZiHour`, `DeityNames`, `Dun`, `Yuan`, `QimenOptions`, `ResolvedOptions`, `TermRow`, `GanZhi`, `Wall`, `ChartBasis`, `SolarTermRef`, `SolarTermInfo`, `XunShou`, `ZhiFu`, `ZhiShi`, `PlateFlags`, `ChartVoid`, `PalaceFlags`, `PalaceState` and `QimenChart`.
- It also defines `RingOffsets { heaven, human, spirit, dun }` from design §9.5. `heaven` and `human` are normalised to −3..4 for the shortest turn and agree with `chart.rotation` mod 8. `spirit` is the absolute slot 0..7 of the 值符 deity. Fixture A expects heaven +2, human −1, spirit 7 and `yin`.
- `index.ts` (the barrel, about 11.5 KB gzip including the 6.2 KB term table, so import it lazily from boot code) exports:
  - Casting: `computeChart(instant, options?)` (throws `RangeError` outside `termRange()`), `buildChart`, `termTable`, `termRange`.
  - Rings: `ringOffsets(chart)`, `deitySlot`, `palaceAtSlot`, `shortestSlots`, `turnBetween`.
  - Labels (`chartLabels`, `palaceLabels`, `inscription`, `glossOf`, `missingGlosses`, `QIMEN_GLYPHS`): also importable table-free from `./labels`.
  - Constants: `STEMS`, `BRANCHES`, `RING`, `PALACES`, `MOUNTAINS`, `LUO_SHU_GRID` and the rest.
- All 29 spec vectors pass. `chart.nextChangeUtc` is the next 时辰 boundary or term start, DST-exact.
- `src/lib/calendar`: `shichenAt`, `shiftShichen`, `localStamp` (table-free, in `shichen.ts`) and `colophonDate`, `formatColophon` (with the table).
- `src/lib/compass`: `headingFromEvent`, `mountainAt`, `palaceAt`, `createJumpWatch`, `enableCompass(onHeading)`. Call `enableCompass` inside the click handler.
- lib may not import content, so labels and the colophon take `glossFor` and the colophon copy as parameters.

### src/content (dom)

These are data-only modules behind the `src/content/index.ts` barrel. This is the single source for DOM, 3D and album text. Components never inline copy or gloss text.

| Module | Main exports |
|---|---|
| `types.ts`, `format.ts` | `Accent`, `Link`, `GlossaryTerm`; `fill(template, vars)`, which leaves unknown `{keys}` visible |
| `site.ts` | `homeMark`, `nav` (Top 林, Work 木屋, Grove 九宫, Contact 石灯; desktop drops Top), `hero` (入林 accent, positioning option 1, no availability, `showSocialRow`), `forest.cards` (F1 gets web-apps and web3; F3 gets mobile and pipelines-security), `cabin` (label, h2, bridge line, intro, headings), `groveHeading`, `contact`, `inscriptions[id]`, `seals` (林 on, name seal off), `colophon` templates |
| `services.ts` | `services`, `serviceById`, `ServiceId` |
| `work.ts` | `workItems`, `featuredOrder` (OripaX, JRNY, Cosmos insights, Terra app), `alsoOrder` (JRNY Plan, TBSx3, Upstream fixes), `featuredWork`, `alsoWork`. JRNY Spark exists but appears in neither list |
| `timeline.ts`, `stack.ts` | `timeline`, `timelineCaption`, `yearsLabel`; `stack` |
| `terminal.ts` | `terminal` (prompt, banner, chips, static transcript), `terminalCommands`, `qimenTemplate`, `QimenTemplateVars`, `fortunes` |
| `grove.ts` | `chartOptions` (civil, zi23, huXuan), `chartYearRange` [1930, 2100], `predictionFromYear` 2035, `grove` (all grove copy, controls, compass lines, marks) |
| `glossary.ts` | palaces with trigram line patterns, doors, stars, deities, stems, branches, mountains, `solarTerms` (new), chart, method and luopan terms, `siteAccents`, `glossFor(zh)`, `glossLine(t)` |
| `socials.ts`, `meta.ts`, `ui.ts` | `socials` and `socialById`; `meta` (title, OG, JSON-LD, theme colour); `ui` microcopy, including `AlbumReason` |
| `brandMarks.ts` | `BRAND_PATHS` (Simple Icons, CC0) and `BRAND_GRID`, shared by the DOM link icons and the signpost's board faces |
| `accents.ts`, `terminalCommands.ts`, `stills.ts` | `siteAccents`, `methodTerms` and `chartTerms` (re-exported by glossary); the terminal command table; `stills`, `stillSizes` and `stillSrc` (`/stills/<T0\|C3\|I1\|E1\|E3>-{800,1600}.{avif,webp}` and `-portrait-800`) |

`TODO(owner)` comments sit next to every string content.md flags, plus the strings I drafted new: solar-term English, site-accent glosses, the board note, the honesty line, compass lines and the post-2035 note.

### src/dom/ContentLayer.tsx and the DOM hooks (dom)

`ContentLayer` renders everything, in this order:
- The skip link, `header.site-header` (the home mark and `nav.jump-nav`, which becomes the bottom bar under 768 px), `.cluster` and the progress hairline.
- `main#content`: the album banner, then the four `<section id aria-labelledby>`s, each built from `src/dom/leaves/*` (renamed from `src/dom/sections`).
- The footer; then, in the walk only and client-only, the `WalkChrome` chunk: `.lost-still`, the inscriptions, `.finale` (mounts and map pins) and `.title-card`; then `.toast-host`, `#live-region`, and client-only `#gloss-tooltip` (the `GlossLayer` chunk). The settings panel is the `Settings` chunk, fetched on intent.

Inside each section, every beat is a `div.beat[data-beat=<BeatId>]` holding a card track, a sticky `.card-frame.zone-(L|R|pane|panel|mount)` and a `.card[data-card]`. Card opacity per scroll frame comes from `src/dom/cards.ts` through `src/dom/bindings.ts`.

The DOM writes `html[data-beat|data-dive|data-palette|data-tier]`, and once per visit `html[data-seal]` (the finale seal stamps: 1.06 and 1.5° onto its resting angle, a 120 ms press, 220 ms in all, then a 2 px bleed over 400 ms) and `html[data-colophon]` (the colophon writes itself a character at a time, then the English). It clears `html[data-veil]` when it takes the veil over.

Events:
- Listened for: `cy:announce` (the live region), `cy:toast` (both the DOM `{ message, actionLabel?, onAction? }` shape and the stage's `CyToastDetail`), and `cy:terminal-open` (the 3D pane was tapped: `#terminal-input` takes focus; on phones the sheet opens first. The sheet's own "Open terminal" button puts focus on the log instead, so the chips work without the keyboard).
- Dispatched: `cy:quality`, with detail `'auto'|'low'|'high'`; `cy:key` on every non-modifier keydown in `#terminal-input`, detail `{ key }`; `cy:recast` when the live chart turns to a new 时辰 (not for picked moments), detail `{ hour }`.

Other walk-only DOM behaviour:
- Context loss (`stage === 'lost'`): `.lost-still` shows the still for the current stretch (T0 for the forest, C3 at the door, I1 in the hall, E1 at the signpost, E3 at the finale) in place of the canvas, and painted mist where there is none (the path and the grove) or while the file is missing. It follows the scroll and goes when the stage restarts.
- Compass mode (`compass.status === 'active'`) during G3: two cinnabar threads cross the chart centre, which comes from `FRAMING` (landscape: x = 0.5 + `zoneShiftX.panel`, y = 0.5, left of the panel; portrait: x = 0.5, y = `planPortraitCentreY`, above the sheet), with a pointer at the top. The grid marks the palace under the top thread (`li[data-facing]`) and the Compass controls read it out.
- The phone chart sheet peeks at 30svh and opens to 85svh; its bar drags between them (`sheetDrag.ts`: a 6 px slop so taps still reach the tabs, a flick or the nearer height decides).

Scenes open the gloss tooltip by writing `journey.gloss`.

Wave 3a (dom-phone, integration):
- Map pins (`src/dom/finale/pins.ts`, DOM-internal): `placePins(points, sizes, window, obstacles?)`, `leaderOf(placement, size, into?)`, `speckKeepOut(point)`, `PIN_GAP`, and the types `PinPoint`, `PinSize`, `PinPlacement`, `PinSide`, `Rect`. Labels are placed in priority order (Work, Grove, Start), each at the first corner (ne, nw, se, sw) that stays inside the window and clear of the labels placed before it, every dot, the cabin's cyan speck, the seal and the top block; failing that it is lifted in steps and tied to its dot by a thin leader; only a pin with no spot at all is hidden. Markup: each `a.map-pin[data-pin]` is a zero-size link on the projected point holding `.map-pin-dot`, `.map-pin-leader` and `.map-pin-label`, with `--dx`, `--dy`, `--leader`, `--leader-angle` and `data-side`; `data-visible` as before.
- Phone finale (portrait E3): the colophon writes on the paper the scene leaves at the top with no panel (vertical WenKai on the left, the English beside it); `colophonPhrases(chars)` (exported from `Colophon.tsx`) breaks the columns only between phrases and keeps the signature 林 写于槟城 whole. The four link rows fold into 44 px icon links top-left, each keeping its label and "shown as" text as its accessible name and `rel="me"`. "Walk again" and "Still version" sit under the English, and so does the footer where CSS anchor positioning exists (elsewhere it stays bottom-left). The contact card fades out as the mounts open (jvh 968–985). `FinaleLinks` renders twice, `.finale-links-card` (the E1 card: album and landscape) and `.finale-links-colophon` (phone E3 only); CSS shows at most one.
- Phone cards are capped at 45svh; a card that still doesn't fit scrolls inside itself. E1's link rows are a 2 × 2 grid of 56 px tiles on phones; the G1 mist pocket is 96% opaque.
- Door DOM twin: the C1 card has `button.open-door[data-scroll-jvh=318]` (`MARKS.doorClickTarget`, `ui.openDoor` "Open the door", TODO(owner)), which glides like the 3D door click; hidden in the album.
- Card focus: a card stays visible while focus is inside it, except when focus sits on a `[data-scroll-jvh]` control, since those glide the walk elsewhere (`walk.css:104`). Before, "Read the chart" left the G1 card over the G3 plan view.
- Phone chart sheet: a palace picked in 3D switches the sheet to the Chart tab but leaves it at its peek, so the plan-view zoom above it stays visible (integration, from grove-rig's request). The sheet's own tabs and bar still open it to 85svh. The grid's `revealInPanel` does not scroll the phone sheet: `.card-panel` scrolls there, not `.sheet-panel` (wave3a-status M4).
- Fonts: `index.html` no longer has static font preload tags. A head script inserts the two preloads (Cormorant Garamond 600, Source Serif 4 400) only on a tab's first page load (sessionStorage `cy.fontsPreloaded`); later loads in the same tab take the fonts from the memory cache, which is what Chrome reported as "preloaded but not used".

Fixed ids and attributes other modules rely on:

- `#stage` holds the canvas. `#root` holds the React root and is the R3F `eventSource`. `#content` is the skip-link target. `#veil` is the DOM fog overlay.
- `<section id="threshold|cabin|grove|contact">` and `#<id>-heading` with `tabindex="-1"`, the focus target after a jump.
- `a[data-jump]` for fog-dive links and `[data-scroll-jvh]` for local scrolls.
- `<html data-mode="static|immersive">`, where static is the CSS default.
- `#terminal-input`, which the DOM focuses when the cabin pane dispatches `cy:terminal-open`. `terminal.lines` is written only through `src/dom/terminal/buffer.ts`.

`src/entry-server.tsx` exports `render(): string`. `src/main.tsx` hydrates prerendered HTML, or renders fresh with `flushSync` on the dev server, then starts scroll and hash nav and idle-imports the stage. `index.html` has the head tags, the inline mode script, and the `<!--content-->` slot inside `#root`.

### src/env/Environment.tsx (env)

`Environment()` (no props, mounted by Stage, hidden while `insideCabin`) draws:
- terrain with the paper path strips and the stream band
- 1,500 scattered pines (tier prefixes), hero pines A and B, the two close trunks
- the axe-cut rock, grass, fern and moss strokes
- three ridge rings and the main peak
- mist planes, all drawn from above only (seen from below they drew hard horizon lines). Since wave 3a the finale belts are the ink pass's (core/render), not meshes

The barrel `src/env/index.ts` also exports:
- Materials: `createInkMaterial` and `useInkMaterial`.
- Shared uniforms: `worldUniforms`, plus the setters `setDoorSpill` (cabin) and `setLanternIntensity` (contact).
- Keep-outs: `registerKeepOut` and `useKeepOut`.
- Paths: `PATH_CURVES`, `pathCentreX`, `PATH_HALF_WIDTH` and `WALK_LINE`.
- Geometry builders: `buildRock`, `buildPine` and `FIELD_SPECS`.

layout.ts gained `terrainProfile`, `lanternSightline`, `sightlineAt`, `CREST_SADDLE` (a notch in the crest so the lantern shows from K0), `ledgeWobble`, and the keep-outs `stream`, `bamboo` and `standing-stone-0/1`.

Wave 2 (lookdev and integration):
- Barrel additions for sections writing their own ink-world shaders: `inkPrelude()` and `baseDefines()` (every ink fragment starts with them), `inkNoiseGlsl` (the noise functions) and `rng(seed)`.
- `createInkMaterial({ needles: true })`: pads (`rim ≥ 0`) are 松针 needle cards from `buildPine`, opened toward the camera in the vertex shader and textured from one procedural needle atlas (Canvas 2D, painted once at stage mount); wood gets the painted-trunk shading (a flat lit tone at about a third of the weight, darker sides and shaded face) and light 鳞皴; `bark: true` gives fuller 鳞皴. `ragged` varies each card's silhouette.
- `createInkMaterial({ lanternWarmth })`: 0..1 of the lantern's warm term (tint and hue lift), default 1. The signpost's timber and boards take 0.3 so wood beside the lantern stays ink toned.
- `createInkMaterial({ cun: 'axe' })`: 石分三面, ink = weight × (0.28 top, 0.62 side, 1.0 shade) plus crease lines. This applies to every axe-cut stone, including the cabin footings and the grove and exit stones.
- `buildPine(spec, detail?)`: pads are degenerate 4-vertex cards with `card` and `cardSize`; draw them with a `needles: true` material.
- Ridge ring heights 13–32, 22–54 and 36–86 m; the main peak fades from 300 to 360 m of camera distance. The mist-canopy plane draws only from above.
- Portal exclusion (wave 3a, env owns it): `setPortalExclusion(ref: number | null)` in the barrel (`env/materials/portal.ts`). While non-null, every material env draws, registered through the internal `envMaterial()`, uses stencil `NotEqual ref`, and materials created later pick up the current state. The cabin exterior's shell calls it with `PORTAL_ID` on the portal-on edge and `null` on the off edge and on dispose. Sections' own `createInkMaterial` materials are not affected; the cabin keeps `outsidePortal` for its shell. The cabin shim `envPortal.ts` is gone.

Wave 3a (painting):
- `baseDefines()` now returns `{}` (kept for the cabin and grove shaders); `inkPrelude()` carries no preview code. `?envTest`, `preview.glsl`, the `ENV_PREVIEW` blocks and the `uPreview*` uniforms are deleted.
- `worldUniforms` gained `uSpillFacing` (the door's facing, north): the door spill lights only the half-space in front of the door plane, 12% behind it, so the open leaf reads as dark wood.
- Canopy from above: needle cards get a view-elevation wash LOD (a pale wash, the needle clusters carry the mass); grouped 浓淡 tones across the forest from `forest.ts` `groupTone(x, z)`. Pines behind the cabin in the C1 sightline are height-capped (12.5° from the C1 eye).
- layout.ts: `exit.mistBelts` is `{ z: [−171, −98, −29, 50], halfWidth: [7, 26, 21, 20], top: [7, 18, 16, 18], x0, x1 }` (read by InkEffect); `mountains.cabinPeak { centre [4, 0, −262], width 150, summitY 90, belt [50, 7], gate [−30, −42, −58, −63] }`, a peak card that condenses over F4 and is gone behind the cabin, gated by camera z; `mountains.ridgeRing.southPush [0.44, 0.3, 0.22]` pushes the south arc out with heights scaled so the T0 crests keep their elevation.
- The grove stand-in in `FinaleProxies` is darker (bluestoneDeep, no ground mist in the finale).

### Sections (wave 2)

All four scenes are real. Each default-exports its Scene from `src/sections/<id>/Scene.tsx`; `wave1-status.md` §8 lists the core exports they build on.

**threshold** draws only the two near 焦 trunks (`layout.threshold.nearTrunks`, keep-outs `near-trunk-f1/f3`); the forest, rock, ridges, mist and lantern glint are env's and the ink pass's.

**cabin** (`Scene.tsx` composes `<Exterior/>` and `<Interior/>`):
- `shared/portal.ts`: `PORTAL_ID` = 1 (the exterior's drei `<Mask>`), `portalStencil`, `makePortalTwins` / `usePortalTwins(make, mode?)` (stencil-tested outside twin and a no-stencil inside twin sharing uniforms), `pickTwin`, `setPortalStencil` (troika), `useInsideCabin`. `useDisposeOnUnmount` now lives in `src/sections/shared/lifetime.ts` (see below); `shared/pointer.ts` `overDomContent(e)`; `shared/planks.ts` `PLANK`.
- `src/sections/shared/lifetime.ts` (wave3c QM-1/QM-2): `useDisposeOnUnmount(anchor ref | Object3D, () => resources)`, `onDetached`, `disposeAll`. Every section uses it. Rule: GPU disposal happens only when R3F really detaches the anchor (three's `removed` event, checked a microtask later), never on an `<Activity>` hide, so hidden sections stay warm (stack.md §4) and a hidden-then-dropped section is still freed. Anything that must stop on a hide (timers, store writes, shared uniforms, hover state) stays in plain effect cleanups.
- Exterior: `CabinShell.frame(s, camera, delta, mask)` (the unused `scene` argument went in wave 3a); mask in the door opening while jvh is in [274, 572), full-screen within 0.4 m of the door or inside; every shell material is stencil NotEqual `PORTAL_ID`; `setPortalExclusion(PORTAL_ID | null)` on the portal edges; `setDoorSpill` only on change; door and lattice hover (cursor, leak 1→1.4, `wake(700)`) and click (`scrollToJvh(318, { smooth: true })`); `useKeepOut('cabin-yard')` while visible. Hides itself on `insideCabin` in the same frame.
- Interior: hall visible for jvh [274, 572). Store writes: `pane` (projected CSS rect, I3 hold only, on ≥ 0.5 px change, null outside), `ignitionPlayed` (when the full 2.5 s run ends), `cabinFocus` (3D scroll hover). Dispatches `cy:terminal-open` on a pane tap. Twins switch through React (`useInsideCabin`), not per frame.

**grove** (`Scene.tsx` starts `chartGlyphsReady()` when the chunk loads, suspends on it, then mounts `<GrovePath/>`, `<GroveChart/>`, `<GroundMist/>`):
- `GrovePath` (no props): stream ripples, stepping and standing stones, bamboo (medium and high), mist-wall veils; adds and removes its own share of `postFx.fogBoost` when the grove is late (the rig's hold now covers the unloaded case too).
- `GroveChart` store writes: `groveCastPlayed` (once, at the casting start: jvh ≥ 655, < 862, dive under 0.5), `ringSpeed` (fastest ring in 45° slots per second, rounded to 0.1, only on change), `selectedPalace` (3D click toggles), `gloss` (hover, or a 500 ms touch long-press), `chartInstantMs` (hour-marker drag, medium and high, mouse or pen, 30° detents), `dialDeg` (dial drag in G3, 15° detents).
- Event: `cy:recast` with `{ chartAtMs }` for a live, on-screen 时辰 change (the DOM chart also dispatches `cy:recast` with `{ hour }`; audio dedupes with a 10 s gate).
- Dial convention: clockwise on screen by `180 − heading` with the compass on, otherwise `dialDeg`, the same as the album SVG.
- Touch zoom (wave 3a, `chart/zoom.ts`: `afterTap(state, tap)`, `zoomForSelection(zoom, selected)`): a touch tap in the plan view on a palace (its slab, or the rings along its bearing) selects it and zooms onto it through `setPlanFocus`. While zoomed, a tap on the same slab does nothing and a tap anywhere else clears `selectedPalace` and zooms out. `selectedPalace` becoming null (from anywhere) zooms out; another palace moves the zoom. Mouse clicks keep the old toggle, and the click that ends a long-press no longer counts as a tap. The touch path starts only from a touch press on a glyph or stone.

**contact** (`Lantern`, `Signpost`, `FinaleProxies`, `FinaleDriver`):
- Store writes, all skipping unchanged values: `contactHover` (signpost board hover; clears only its own value), `finale.mountOpen` (immersive and jvh ≥ 968), `finale.colophonShown` then `finale.sealStamped` (+400 ms and +2600 ms after the camera arrives at E3 and catch-up fog clears; once per visit; immediate under e2e and reduced motion), `pins` (from jvh 935, CSS px, written on real movement only, `{}` outside the finale).
- `postFx.scissor` to the 3:4 window 900 ms after the mounts open, landscape ≥ 768 px only; cleared when they close or the section hides.
- `setLanternIntensity` every frame (flame breath and hover lean); `glintSlots[1].pos` moved onto the camera-to-cabin ray 30 m out during the finale; `registerKeepOut('finale-opening')` from jvh 935.
- The flame clears stored alpha where its body is solid (the interior-alpha rule), so the ink pass leaves it alone.
- The signpost (`signpostGeometry.ts`, pure: post, boards, atlas rows and transforms; `signpostFace.ts`: the board faces' canvas atlas and `layoutFaces`/`rowAt`/`rowBands`) is three draw calls: timber (post, stones, moss), boards, and the face overlay that takes the pointer. A `contactHover` board glows warm over 250 ms and the flame leans toward it.
- A board click activates `#contact a[href="<social.href>"]`. Brand paths come from `src/content/brandMarks.ts`, shared with `src/dom/icons.tsx`.

### src/audio (wave 2)

- `startAudio(): Promise<void>` (idempotent; creates the AudioContext synchronously inside the enabling gesture; renders samples in `samples.worker.ts`; never rejects) and `stopAudio()`. `main.tsx` imports it on the first `soundOn` true in the walk.
- Reads the store through `journey.subscribe` and never writes it: `soundOn`, `jvh`, `insideCabin`, `dive`, `paper`, `ringSpeed`, `ignitionPlayed`, `finale.sealStamped`. Listens for `cy:key` (capped at 30 per second) and `cy:recast` (chimes only with the grove on screen, at most once per 10 s).
- Forward-only marks fire only on a walk (dive idle, step ≤ 60 jvh): creak 277, gate whoosh 562, guqin 622, reveal 628.
- Levels: beds are LUFS measured alone, one-shots sample peak, `MASTER_DB` −3 before a soft limiter (knee −17, ceiling −14 dBFS). The ring grind sits at −26, not the sheet's −24 (owner sign-off pending). Everything is synthesised; nothing is fetched.

## 5. Decisions I made

1. `SectionId` lives in `core/sections/ids.ts`, not in the store, so content can use it without importing store code.
2. The beat table uses per-channel keys with explicit jvh values, not per-section `stations`/`dwell` as in `stack.md` §4. Design §6.3 wants every camera number in one file.
3. Deep links and jumps land on `arrivalJvh`: 345, 666 and 886. Only no-JS anchors land on section tops.
4. The glossary is TypeScript, not `glossary.json`, so the 3D and the DOM share types. Trigrams are line patterns, never the Unicode ☰–☷ glyphs (design §4.5).
5. `typeScale.barLabel` is 13 px. Design §4.2 says 12 px, but the §3.1 hard floor wins.
6. Every font lives in `public/fonts/` (design §3). `stack.md` put the DOM woff2 in `src/assets/fonts/`.
7. The store carries the DOM-to-3D bridges: terminal log, pane rect, map pins, gloss requests, chart instant, selected palace, dial, compass, hovers and finale flags. Neither side touches the other's DOM or scene.
8. The blog link is `https://cy.my/blog/`, with the trailing slash from the owner defaults. X is labelled "X" and points at `l.cy.my/twitter`.
9. `@types/node` is a dev dependency for tests and scripts. sharp 0.35.5 installed and loads on Node 26.5.
10. `tokens.css` is hand-synced, and a test checks it against `cssVars()`.

## 6. Known gaps and risks

- The open issues after the wave-3a fix wave are ranked in `wave3a-status.md`; the wave-2 list in `wave2-status.md` is history. Wave 2 closed H2 (ridges at K0), H3 (night shell), H4 (stub scenes), M2 (scissor), M3 (Auto ceiling), M4 (veil flash), M5 (audio mount) and the prewarm double compile; the boot budget is gated at 102 KB pending the owner's H1 decision.
- (wave3c QM-5) leva and r3f-perf are uninstalled and the `?debug` switch is gone: nothing used them, and r3f-perf pulled a React 18 / drei 9 tree with peer warnings.
- R3F 9.8 logs `THREE.Clock` deprecation warnings. That is harmless per `stack.md` §1.
- Font swap: `src/styles/fonts.css` defines metric-matched stand-ins under the second family of each stack (`'Cormorant'`, `'Source Serif Pro'`): Times New Roman or its metric twins Liberation Serif and Tinos, with fontaine's `size-adjust` and ascent and descent overrides. Measured on the preview build, text runs come within 1–2% of the web fonts' width (unadjusted: 5–10% off) and the first screen does not move. Android has none of these fonts and falls through to Noto Serif unadjusted; a second stand-in for it needs its own name in the token stacks (request to the tokens owner).
- In the grove, the P1 intro card comes before the h2 in G1 in document order, following design §8.5 and §8.6. Dom should check the reading order.
- `index.html` repeats values that also live in `content/meta.ts`: the theme colour, OG tags and JSON-LD. The prerender step could inject them instead.
