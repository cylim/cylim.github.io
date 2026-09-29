# cy.my technical architecture

Status: proposal, 2026-09-28. Scope: how to build the "walk into the mist" site with the current React Three Fiber stack, deploy it to GitHub Pages, and split the work so several engineers can build sections in parallel.

Everything marked "measured" was run on this machine on 2026-09-28 (Node 26.5, npm 11.17, Chromium 152). Versions come from `npm view` / `gh api` on the same day.

## 0. Decisions at a glance

1. **WebGL2, not WebGPU.** `WebGLRenderer` through R3F 9. pmndrs postprocessing 6, troika text and our GLSL all target WebGL. Revisit once R3F v10 and drei v11 leave alpha.
2. **Native page scroll + Lenis.** The DOM content layer is the real document. The camera reads a normalized progress value derived from DOM section offsets. No drei `ScrollControls`, no GSAP.
3. **Hashes drive a fog-dive.** Jump-nav clicks `pushState` the hash, fade into fog, teleport scroll and camera, wait for the target section chunk, then fade out. `popstate` runs the same routine, so back/forward work.
4. **Prerendered HTML content layer.** Content lives in typed modules under `src/content/`, and `react-dom/server` prerenders it into `index.html` at build time. It reads fine with JS off, WebGL off or reduced motion on. The 3D stage is progressive enhancement and loads after first paint.
5. **One ink pass in post.** A single custom `postprocessing` Effect does depth-reconstructed height fog to paper, ink-ramp tone mapping, Sobel brush contours on log depth, dry-brush breakup, paper grain and wobble. Scene materials stay unfogged and cheap.
6. **Per-section post is toggled, never rebuilt.** `@react-three/postprocessing` 3.1 has `<EffectGroup enabled>`, which flips `Pass.enabled` without reconstruction. The ink group runs outdoors. The Bloom + AgX group runs only inside the cabin.
7. **Procedural first.** Pines, mountains, mist, cabin logs, stone platform, luopan, stele and lantern are all procedural. glTF only if a hero prop needs it, compressed with meshopt and KTX2/WebP, decoders self-hosted.
8. **CJK via subset fonts.** LXGW WenKai subset (136 glyphs measured at 33 KB woff for troika, 29 KB woff2 for DOM). CI fails if content uses a glyph the subset lacks.
9. **Deploy with Actions.** `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`, `checkout@v7`, `setup-node@v7`. One manual flip is needed: Pages source becomes "GitHub Actions". The `cylim/blog` project site at `cy.my/blog/` is a separate repo and is unaffected.

## 1. Versions and ecosystem notes

| Package | Current | Pin as | Notes |
|---|---|---|---|
| three | 0.186.1 | `~0.186.1` | postprocessing 6.39.5 peer range is `>=0.168 <0.187`, so do not float to 0.187 until postprocessing ships support |
| @types/three | 0.186.0 | `~0.186.0` | |
| react, react-dom | 19.3.0 | `~19.3.0` | R3F 9.8 peer range is `>=19 <19.4` |
| @react-three/fiber | 9.8.1 | `^9.8.1` | 9.8.0 added React 19.3 support. 9.8.1 made `<Activity>` work across the Canvas boundary |
| @react-three/drei | 10.7.9 | `^10.7.9` | `sideEffects: false`, tree-shakes well |
| @react-three/postprocessing | 3.1.3 | `^3.1.3` | peer R3F `>=9.7`. Has `EffectGroup`, `createEffectComponent`, `mergeMode` |
| postprocessing | 6.39.5 | `~6.39.5` | 7.0 is still beta |
| troika-three-text | 0.52.5 | `^0.52.5` | direct dep only for `configureTextBuilder` and `BatchedText`. Keep the range drei resolves so it dedupes. 0.53.0 exists but is not `latest` |
| maath | 0.10.8 | `^0.10.8` | `easing.damp3`, `dampAngle` |
| zustand | 5.0.15 | `^5.0.15` | vanilla store read from `useFrame` |
| lenis | 1.3.26 | `^1.3.26` | 2.0 is `dev` tag only |
| vite | 8.3.1 | `^8.3.1` | Rolldown + Oxc |
| @vitejs/plugin-react | 6.1.1 | `^6.1.1` | Oxc transform, no Babel by default |
| typescript | 7.0.2 | `~7.0.2` | native Go `tsc`, about 10x faster. No stable JS API until 7.1 |
| oxlint | 1.85.0 | dev | lint without typescript-eslint, which cannot load TS 7 yet |
| vitest | 5.0.2 | dev | peer `vite ^6.4 \|\| ^7 \|\| ^8` |
| @playwright/test | 1.63.0 | dev | |
| subset-font | 2.9.0 | dev | harfbuzz-wasm subsetter, outputs ttf/woff/woff2 |
| tyme4ts | 1.5.2 | dev | generates the solar-term table at build time |
| gsap 3.15.0 | | not used | ScrollTrigger duplicates what our progress store does. Add later only for DOM choreography |
| @gltf-transform/cli 4.5.0 | | only if a glTF appears | |

Node: `.nvmrc` = `26`, same as local. Node 26 becomes LTS in October 2026. Vite 8 needs `^20.19 || >=22.12`.

### Breaking or behaviour changes that matter here

- **R3F v9.** Types moved from the global `JSX` namespace to `ThreeElements`, and `MeshProps` and friends are gone (use `ThreeElements['mesh']`). R3F no longer sets `colorSpace` on texture props, so set `tex.colorSpace = SRGBColorSpace` on every color map yourself. The `gl` prop may be async (WebGPU). StrictMode now inherits into the Canvas.
- **R3F 9.6+ uniforms.** `<shaderMaterial uniforms={...}>` now keeps a stable uniforms object and *copies* values into it. Shared uniform objects passed through JSX therefore stop being shared. Create shared-uniform materials imperatively (`useMemo(() => createPineMaterial())`) and pass them with `material={mat}`.
- **R3F `shadows`.** `shadows={true}` still selects `PCFSoftShadowMap`, and three r186 removed it (it warns and falls back to PCF). The mist scene has no shadows, so use `shadows={false}`. If shadows ever come back, use `shadows="percentage"`.
- **three r183** deprecated `THREE.Clock` (JSDoc only, no runtime warning). R3F 9.8 still uses one internally, which is harmless. Our code uses `state.clock`/`delta` or `THREE.Timer`.
- **three r185** deprecated `Matrix3.scale()/.rotate()/.translate()`. Use `Matrix3.makeScale()` etc. if UV transforms need them. `DRACOLoader.setDecoderConfig` is deprecated and DRACOLoader now defaults to relative decoder URLs. That only matters if we ship Draco, and we won't.
- **three color management** (unchanged since r152). `ColorManagement.enabled = true`, `outputColorSpace = SRGBColorSpace`. `new Color('#hex')` converts sRGB to linear. Custom `ShaderMaterial`s should end with `#include <colorspace_fragment>`. That is a no-op when rendering into the composer's render target and correct when rendering straight to screen.
- **@react-three/postprocessing 3.x** forces `gl.toneMapping = NoToneMapping` while mounted. It defaults `multisampling = 8`, which is too expensive on mobile, so always pass it. `frameBufferType` defaults to `HalfFloatType`, which is what lets HDR emissive values reach Bloom.
- **Vite 8.** `build.rollupOptions` is now `build.rolldownOptions`. The object form of `manualChunks` is gone and the function form is deprecated, so use `output.codeSplitting.groups`. Lightning CSS minifies CSS by default. Default targets are Chrome 111, Firefox 114, Safari 16.4.
- **TypeScript 7.** `tsc --noEmit` type-checks the R3F/drei/three types correctly (measured, 0.2 s on a sample). Do not add typescript-eslint. If a tool needs the TS API, alias `@typescript/typescript6`.
- **WebGPU status.** Chrome/Edge desktop and Android 12+ ship it. Safari 26 on iOS/macOS 26 ships it. Firefox has it on desktop, but Android is still behind a flag. three's `WebGPURenderer` works, but pmndrs postprocessing v6 is WebGL-only, and R3F's first-class WebGPU/TSL support is the v10 alpha. Staying on WebGL2 costs nothing for this project.

## 2. Page architecture

```
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="jump-nav">  fixed nav: Threshold · Cabin · Grove · Contact  (real <a href="#cabin">)
  <div id="stage" aria-hidden="true">   fixed, inset 0, height 100lvh. Canvas mounts here later
  <main id="content">          prerendered HTML, normal document flow, drives scroll length
     <section id="threshold"> … <section id="cabin"> … <section id="grove"> … <section id="contact">
  <div id="veil" aria-hidden="true">    DOM fog overlay (loader + fallback dive)
```

There are three render modes, set on `<html data-mode>` by a tiny inline script in `<head>` before first paint:

| Mode | When | What loads |
|---|---|---|
| `static` | no `WebGL2RenderingContext`, `prefers-reduced-motion: reduce` (default), saved preference, or a failed context probe | HTML + CSS + prerendered stills of each scene. three is never downloaded |
| `immersive` | everything else | HTML first, then the stage chunk on `requestIdleCallback` after `load` |
| no JS | JS disabled | same markup as `static`. CSS defaults to the static layout, and JS switches to immersive by adding the attribute |

The static layout is the default CSS, so noscript and no-WebGL cost nothing extra. Reduced-motion users get a visible "Enter the forest anyway" toggle that stores `localStorage.mode = 'immersive'`. Autonomous motion stays off in that case (see §9).

R3F events: the DOM layer sits above the canvas, so pointer events would never reach it. Use the standard R3F overlay pattern, `eventSource={document.getElementById('root')}` with `eventPrefix="client"`. The canvas gets `pointer-events: none`. Content cards are `pointer-events: auto`, and the rest of the DOM layer is `none`.

## 3. Scroll, camera path, jump-nav and fog-dive (brief item 1)

### Why native scroll and not drei `ScrollControls`

`ScrollControls` creates its own scroll container and renders `<Scroll html>` content into transformed divs inside the canvas wrapper. Anchors, `:target`, find-in-page, keyboard scrolling, focus-into-view and scroll restoration either break or need re-implementing, and the content only exists after JS runs. Native document scroll gets all of that for free. Lenis adds wheel smoothing on desktop and leaves touch native (`syncTouch: false`), so iOS momentum stays intact.

### Scroll length and progress mapping

Each `<section>` has a fixed height in `svh` multiples. That height sets the pacing: threshold 150svh, cabin 450svh (exterior, door, interior), grove 350svh, contact 150svh. Section content uses `position: sticky` cards. The scroll driver measures section tops with a `ResizeObserver`, not per frame, and maps scroll to a path parameter `u` in [0, 1]:

```ts
// src/core/scroll/progress.ts  (pure, unit-tested)
export interface SectionSpan { id: SectionId; top: number; height: number; u0: number; u1: number;
  /** local 0..1 → 0..1 easing with dwell plateaus at points of interest */ dwell: [number, number][] }

export function uFromScroll(scrollY: number, vh: number, spans: SectionSpan[]) {
  const s = spans.find((sp) => scrollY < sp.top + sp.height - vh) ?? spans[spans.length - 1]
  const local = clamp01((scrollY - s.top) / Math.max(1, s.height - vh))
  return { id: s.id, u: s.u0 + piecewise(s.dwell, local) * (s.u1 - s.u0) }
}
// dwell example for the cabin: walk up, pause at the door, pass through, linger at the panels
// [[0,0],[0.25,0.30],[0.35,0.32],[0.55,0.55],[0.80,0.90],[1,1]]
```

```ts
// src/core/scroll/ScrollDriver.ts
import Lenis from 'lenis'
import { journey } from '../store/journey'

export function startScrollDriver(getSpans: () => SectionSpan[]) {
  history.scrollRestoration = 'manual'
  const lenis = new Lenis({ autoRaf: true, lerp: 0.12, anchors: false, stopInertiaOnNavigate: true })
  let spans = getSpans()
  const ro = new ResizeObserver(() => { spans = getSpans(); lenis.resize() })
  ro.observe(document.getElementById('content')!)
  lenis.on('scroll', ({ scroll }: Lenis) => {
    const { id, u } = uFromScroll(scroll, document.documentElement.clientHeight, spans)
    const s = journey.getState()
    if (s.dive.phase === 'idle') journey.setState({ u, active: id })
    if (id !== s.active) replaceHashDebounced(id)   // replaceState, so natural scrolling never floods history
  })
  return lenis
}
```

Do not set `scroll-behavior: smooth` in CSS, because it fights Lenis. With reduced motion opted into immersive mode, skip Lenis and listen to native `scroll`.

### Store

```ts
// src/core/store/journey.ts
import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

export type SectionId = 'threshold' | 'cabin' | 'grove' | 'contact'
export type Tier = 'low' | 'medium' | 'high'
export interface JourneyState {
  u: number                       // camera path parameter, written by ScrollDriver
  active: SectionId
  snap: boolean                   // next frame: place camera without damping
  dive: { phase: 'idle' | 'in' | 'hold' | 'out'; amount: number; to: SectionId | null }
  post: 'ink' | 'cabin'           // which EffectGroup is live
  postBlend: number               // 0 = ink, 1 = cabin; crossfade at the door
  tier: Tier
  reducedMotion: boolean
  ready: Partial<Record<SectionId, boolean>>
}
export const journey = createStore<JourneyState>()(() => ({ /* defaults */ } as JourneyState))
export const useJourney = <T,>(sel: (s: JourneyState) => T) => useStore(journey, sel)
```

Per-frame consumers call `journey.getState()` inside `useFrame` and never subscribe. React subscribes only to coarse state such as `active`, `post` and `tier`.

### Camera path

World layout is fixed in one file (`src/core/world/layout.ts`). Zone anchors run along -z: threshold at z 0, cabin at z -60, grove at z -140, contact at z -200. Each section definition contributes waypoints relative to its anchor. The core concatenates them into two curves, camera positions and look targets.

```ts
// src/core/camera/path.ts
import { CatmullRomCurve3, Vector3 } from 'three'
export function buildPath(stations: { pos: Vector3; look: Vector3 }[]) {
  const position = new CatmullRomCurve3(stations.map((s) => s.pos), false, 'centripetal')
  const target = new CatmullRomCurve3(stations.map((s) => s.look), false, 'centripetal')
  for (const c of [position, target]) { c.arcLengthDivisions = 4000; c.updateArcLengths() }
  return { position, target }   // sample with getPointAt(u): arc-length parameterized, constant speed
}
```

Centripetal Catmull-Rom avoids the cusps and overshoot of the default at uneven waypoint spacing.

```tsx
// src/core/camera/CameraRig.tsx
export function CameraRig({ path }: { path: ReturnType<typeof buildPath> }) {
  const p = useMemo(() => new Vector3(), []), l = useMemo(() => new Vector3(), [])
  const look = useRef(new Vector3())
  const pointer = useRef(new Vector2())
  useFrame((state, delta) => {
    const s = journey.getState()
    const dt = Math.min(delta, 1 / 20)                    // no lurch after a background tab
    path.position.getPointAt(s.u, p)
    path.target.getPointAt(s.u, l)
    if (!s.reducedMotion) {                               // tiny parallax, desktop only
      pointer.current.lerp(state.pointer, 0.05)
      p.x += pointer.current.x * 0.15; p.y += pointer.current.y * 0.08
    }
    if (s.snap) { state.camera.position.copy(p); look.current.copy(l); journey.setState({ snap: false }) }
    else { easing.damp3(state.camera.position, p, 0.35, dt); easing.damp3(look.current, l, 0.5, dt) }
    state.camera.lookAt(look.current)
  }, -1)                                                  // before scene useFrames; priority < 0 keeps auto-render
  return null
}
```

### Jump-nav, deep links, back/forward

```ts
// src/core/scroll/hashNav.ts
export function initHashNav(lenis: Lenis | null) {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-jump]')
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (a.hash !== location.hash) history.pushState(null, '', a.hash || location.pathname)
    void diveTo(sectionFromHash(a.hash), lenis)
  })
  addEventListener('popstate', () => void diveTo(sectionFromHash(location.hash), lenis))
  // Deep link on first load: the loader veil is already opaque, so this is the "hold" phase.
  return diveTo(sectionFromHash(location.hash), lenis, { fromLoader: true })
}

let token = 0
export async function diveTo(id: SectionId, lenis: Lenis | null, o: { fromLoader?: boolean } = {}) {
  const my = ++token                                          // a newer jump cancels this one
  const { reducedMotion } = journey.getState()
  const loading = registry[id].load()                         // start fetching immediately
  if (!o.fromLoader) await tweenDive(1, reducedMotion ? 120 : 450)          // into the mist
  if (my !== token) return
  lenis?.stop()
  const el = document.getElementById(id)!
  lenis ? lenis.scrollTo(el, { immediate: true, force: true }) : el.scrollIntoView({ behavior: 'instant' })
  journey.setState({ snap: true, u: registry[id].arrivalU, active: id })
  await Promise.race([loading.then(() => prewarm(id)), sleep(5000)])      // compileAsync, font SDFs
  if (my !== token) return
  lenis?.start()
  await tweenDive(0, reducedMotion ? 120 : 700)                              // re-emerge
  document.getElementById(`${id}-heading`)?.focus({ preventScroll: true })   // a11y: move focus with the jump
}
```

`tweenDive` animates `journey.dive.amount` with a rAF loop. The ink effect reads it as `uDive`, and the DOM `#veil` mirrors it when there is no post pipeline. Section headings have `tabindex="-1"` so focus can move to them.

`prewarm(id)` mounts the section hidden, runs `await gl.compileAsync(scene, camera)` (`KHR_parallel_shader_compile`, no main-thread stall on Chrome), and waits for troika `preloadFont` so glyph SDFs exist before the fog lifts. If a user scrolls naturally into a section that is not loaded yet, the store sets `ready[id] = false` and the ink pass raises `uLocalFogBoost`. The mist thickens instead of showing an empty clearing.

## 4. Lazy loading, code splitting, budgets, assets (brief item 2)

### Section registry and lazy scenes

```ts
// src/core/sections/types.ts
export interface SectionDefinition {
  id: SectionId
  hash: '' | `#${string}`
  label: string                 // English nav label
  zh?: string                   // accent characters, e.g. '奇门'
  span: [u0: number, u1: number]
  arrivalU: number              // where a jump lands
  stations: Station[]           // camera waypoints, relative to the zone anchor
  dwell: [number, number][]
  post: 'ink' | 'cabin'
  clearings?: { x: number; z: number; r: number }[]   // environment scatter avoids these
  load: () => Promise<{ default: ComponentType<SectionSceneProps> }>
}

// src/core/sections/registry.ts  (created on day 1 with four stubs; nobody edits it afterwards except spans)
export const registry = {
  threshold: defineSection({ id: 'threshold', hash: '', load: () => import('../../sections/threshold/Scene'), ... }),
  cabin:     defineSection({ id: 'cabin', hash: '#cabin', load: () => import('../../sections/cabin/Scene'), ... }),
  grove:     defineSection({ id: 'grove', hash: '#grove', load: () => import('../../sections/grove/Scene'), ... }),
  contact:   defineSection({ id: 'contact', hash: '#contact', load: () => import('../../sections/contact/Scene'), ... }),
} satisfies Record<SectionId, SectionDefinition>
```

`defineSection` wraps `load` in a memoized promise, so `React.lazy(def.load)` and `prewarm` share one fetch.

```tsx
// src/core/sections/SectionHost.tsx
export function SectionHost({ def }: { def: SectionDefinition }) {
  const Scene = useMemo(() => lazy(def.load), [def])
  const near = useJourney((s) => distanceToSpan(s.u, def.span) < PRELOAD_U)   // e.g. 0.06
  const keep = useJourney((s) => s.tier !== 'low' || distanceToSpan(s.u, def.span) < 2 * PRELOAD_U)
  const [visited, setVisited] = useState(false)
  useEffect(() => { if (near) setVisited(true) }, [near])
  if (!visited || !keep) return null                                   // low tier: unmount far sections
  return (
    <Activity mode={near ? 'visible' : 'hidden'}>                       {/* R3F 9.8.1: hides objects, pauses useFrame */}
      <Suspense fallback={null}><Scene /></Suspense>
    </Activity>
  )
}
```

`Activity` keeps GPU resources and compiled programs for sections you have already passed, so scrolling back does not hitch. Effects inside hidden Activity unmount, which also stops their `useFrame`.

Always-mounted shared pieces: the environment (pine scatter, mountain layers, mist bands), the camera rig and the post stack.

### Chunking (Vite 8 / Rolldown)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',                                   // user site served at https://cy.my/
  plugins: [react()],
  build: {
    sourcemap: 'hidden',
    assetsInlineLimit: 2048,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'r3f', test: /[\\/]node_modules[\\/]@react-three[\\/]fiber[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
```

Keep the groups narrow. If a vendor group captures a module the boot entry also imports (`scheduler`, `zustand`, `react`), the entry starts statically importing the vendor chunk and three lands on the critical path. The budget script checks for this by asserting that `dist/index.html` has no `modulepreload` for `three-*.js`. Let troika, drei pieces and postprocessing split naturally so troika only arrives with the cabin/grove chunks.

### Measured sizes

These come from a throwaway Vite 8.3.1 build of a minimal Canvas with PerformanceMonitor, AdaptiveDpr, Instances, Text, a damp3 rig and EffectComposer + EffectGroup + Bloom (gzip):

| Chunk | gz |
|---|---|
| boot: react + react-dom + lenis + entry | 70.5 KB |
| three (whole core; R3F imports `* as THREE`, so tree-shaking is limited) | 186.8 KB |
| R3F 9.8 (bundles its reconciler since 9.5) + used drei + maath + zustand | ~64 KB |
| postprocessing + @react-three/postprocessing (with Bloom) | ~21 KB |
| troika-three-text (drei `Text`) | ~42 KB |

### Budgets (enforced by `scripts/check-budget.mjs` in CI)

| Item | Budget (gz / transfer) |
|---|---|
| HTML with prerendered content (CSS ships as one external stylesheet, not inlined: every section is prerendered, so a critical subset is nearly the whole sheet and inlining it would pass 30 KB; wave3c QM-P7) | ≤ 30 KB |
| Boot JS (React, content hydration, nav, store, Lenis) | ≤ 85 KB |
| Latin fonts (woff2, subset) | ≤ 60 KB |
| Stage core chunk set (three, R3F, drei bits, postprocessing, rig, env, ink pass, threshold scene) | ≤ 340 KB |
| Each section chunk (code only) | ≤ 40 KB |
| Shared text chunk (troika) | ~42 KB, loaded with cabin or grove |
| CJK subset for troika (woff) | ≤ 60 KB |
| Textures total (paper grain 512² WebP, maybe one noise tile) | ≤ 120 KB |
| First visit to an interactive threshold | ≤ 550 KB |
| Full journey | ≤ 1.3 MB |
| GPU at steady state | ≤ 150 draw calls, ≤ 300k tris desktop / 120k mobile |

LCP is the prerendered `<h1>CY Lim</h1>` over a CSS paper-and-mist gradient that matches the first 3D frame. The canvas fades in over it when ready.

### Procedural vs glTF

Build procedurally.

- **Pines.** 3 or 4 variants built once with `BufferGeometryUtils.mergeGeometries`: a bent trunk plus 4 to 7 flattened, noise-displaced needle pads. Each variant is one `InstancedMesh`.
- **Mountains.** Large opaque planes whose ridge silhouettes come from a shader (§5).
- **Cabin exterior.** Instanced log cylinders, roof planes, a door frame.
- **Stone platform, luopan rings, stele.** `ExtrudeGeometry`, `RingGeometry`, `LatheGeometry`.
- **Lantern.** `LatheGeometry` plus an emissive core.

If a hero prop needs a model (a better lantern or a cabin stove, say):

- Pipeline: `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp`. Use `--texture-compress ktx2` only if KTX-Software `toktx` is installed.
- Prefer meshopt over Draco. three's `meshopt_decoder.module.js` is about 29 KB raw and bundles locally. drei's Draco path defaults to a gstatic CDN. If KTX2 is used, copy `three/examples/jsm/libs/basis/` to `public/basis/` and call `useKTX2.setTranscoderPath('/basis/')`.
- CC0 sources: Poly Haven (models, textures, HDRIs), ambientCG (PBR textures), Kenney (Nature Kit, low-poly), Quaternius (nature and buildings packs), KayKit by Kay Lousberg. Poly Pizza mixes CC0 and CC-BY, so check each model. Record every third-party asset in `public/CREDITS.txt`.

## 5. Ink-wash rendering (brief item 3)

### Technique stack

| Layer | Technique | Where | Cost |
|---|---|---|---|
| Paper | clear color = paper token; sky has depth 1 and fogs to paper | renderer | free |
| Mist as blank paper (留白) | height + distance fog reconstructed from depth in post: dense at valley floor, peaks poke out, a noise field drifts through it | InkEffect | ~1 depth tap + ALU |
| Mist bands | 3 or 4 horizontal paper-colored planes with scrolling fbm alpha, `depthWrite: false` | env | cheap overdraw |
| 三远 depth layering | 4 to 6 opaque mountain planes at 80 to 400 m. Shader ridgeline (1D fbm), ink darkest at the ridge, foot fades to paper, 皴 strokes as anisotropic noise. Post fog lightens far layers by real depth | env | 6 draw calls |
| Pines as silhouettes | instanced merged geometry, flat ink value with per-instance jitter, noise `discard` on pad edges for dry-brush raggedness, wind sway in the vertex shader | env | 4 draw calls |
| Ink tone mapping | luminance → 256×1 ramp of five ink tones (焦 浓 重 淡 清) + paper. Saturated pixels (lantern, cyan) bypass the ramp | InkEffect | 1 tap |
| Brush contours | Sobel on log view distance, 8 taps, jittered by stepped noise ("boil" at 8 fps), faded by fog, broken by dry-brush streak noise (飞白) | InkEffect | 8 taps |
| Ink bleed | noise-perturbed luminance before the ramp, so washes feather | InkEffect | ALU |
| Paper grain | tileable 512² WebP multiply at screen scale | InkEffect | 1 tap |
| Fog-dive | noise-thresholded dissolve to paper driven by `uDive` | InkEffect / FinishEffect | ALU |

No NormalPass. It re-renders the whole scene, and depth-only contours look right for pines against mist. If crease lines are wanted on the cabin logs or the stele on high tier, reconstruct normals from depth derivatives inside the same pass.

### Gotchas

- Anything that writes depth gets contours. troika glyph quads write depth by default, which draws rectangles around text. Set `depthWrite: false` on text materials (via `onSync` or a base `material` prop).
- Mountains must be opaque with `discard` at the ridge. If a transparent layer skips depth writes, post fog sees depth 1 behind it and erases it to paper.
- Keep `scene.fog = null`. Built-in materials then compile no fog code, and fog is defined once, in post.

### Shader sketches

Shared GLSL lives in `src/core/render/glsl/` and is imported with `?raw`. Includes are string concatenation.

```glsl
// glsl/noise.glsl
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// glsl/inkFog.glsl   (includer declares: uniform vec4 uFog; uniform float uLocalFogBoost;)
// uFog: x density, y height falloff (1/m), z mist floor height, w noise amplitude
float inkFog(float dist, vec3 wp, float t) {
  float h = max(wp.y - uFog.z, 0.0);
  float n = vnoise(wp * 0.06 + vec3(t * 0.02, 0.0, t * 0.015));
  // 0.2 floor = aerial perspective, so distant ridges still pale even above the mist
  float dens = uFog.x * (0.2 + exp(-uFog.y * h) * (1.0 + uFog.w * (n - 0.5))) + uLocalFogBoost;
  return 1.0 - exp(-dens * dens * dist * dist);
}
```

```glsl
// post/ink.frag.glsl
// postprocessing provides: depthBuffer, readDepth(), getViewZ(), resolution, texelSize, time, cameraNear/Far
uniform sampler2D uPaper;      // grain tile, RepeatWrapping, NoColorSpace
uniform sampler2D uRamp;       // 256x1 ink ramp, SRGBColorSpace (sampled as linear)
uniform vec3 uPaperColor, uInkColor;
uniform mat4 uProjInv, uCamWorld;
uniform vec4 uFog;
uniform float uLocalFogBoost, uEdges, uWobble, uInkMix, uDive;

float logDist(vec2 uv) { return log2(1.0 - getViewZ(readDepth(uv))); }   // scale-invariant edges

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); v /= v.w;
  vec3 wp = (uCamWorld * v).xyz;
  float fog = depth >= 0.9999 ? 1.0 : inkFog(-v.z, wp, time);

  vec3 col = mix(inputColor.rgb, uPaperColor, fog);                         // mist = blank paper

  float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
  float accent = smoothstep(0.12, 0.3, (mx - mn) / max(mx, 1e-3));          // lantern / cyan survive
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float bleed = (vnoise(vec3(uv * resolution / 24.0, 0.0)) - 0.5) * 0.06 * uWobble;
  vec3 inked = texture2D(uRamp, vec2(clamp(lum + bleed, 0.0, 1.0), 0.5)).rgb;
  col = mix(col, mix(inked, col, accent), uInkMix);

  if (uEdges > 0.5) {                                                        // off on low tier
    float t = floor(time * 8.0);
    vec2 j = (vec2(vnoise(vec3(uv * 6.0, t)), vnoise(vec3(uv * 6.0 + 7.3, t))) - 0.5) * texelSize * 3.0 * uWobble;
    vec2 o = texelSize * 1.5, c = uv + j;
    float tl = logDist(c + vec2(-o.x, o.y)), tc = logDist(c + vec2(0.0, o.y)), tr = logDist(c + o);
    float ml = logDist(c - vec2(o.x, 0.0)),                                    mr = logDist(c + vec2(o.x, 0.0));
    float bl = logDist(c - o),              bc = logDist(c - vec2(0.0, o.y)),  br = logDist(c + vec2(o.x, -o.y));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    float edge = smoothstep(0.08, 0.35, length(vec2(gx, gy)));
    float dry = smoothstep(0.25, 0.75, vnoise(vec3(uv * vec2(900.0, 90.0), 0.0)));   // 飞白 streaks
    col = mix(col, uInkColor, edge * (1.0 - fog) * mix(0.55, 1.0, dry) * uInkMix);
  }

  col *= mix(vec3(1.0), texture2D(uPaper, uv * resolution / 512.0).rgb, 0.28);   // paper grain

  float n = vnoise(vec3(uv * 3.0, time * 0.1));
  col = mix(col, uPaperColor, smoothstep(n - 0.15, n + 0.15, uDive * 1.3 - 0.15));  // fog-dive dissolve
  outputColor = vec4(col, inputColor.a);
}
```

```ts
// post/InkEffect.ts
import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Color, Matrix4, Vector4, type Camera, type Texture } from 'three'
import noise from '../glsl/noise.glsl?raw'
import fog from '../glsl/inkFog.glsl?raw'
import frag from './ink.frag.glsl?raw'
import { tokens } from '../../../theme/tokens'

export class InkEffect extends Effect {
  constructor(private cam: Camera, paper: Texture, ramp: Texture) {
    super('InkEffect', `uniform vec4 uFog; uniform float uLocalFogBoost;\n${noise}\n${fog}\n${frag}`, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uPaper', new Uniform(paper)], ['uRamp', new Uniform(ramp)],
        ['uPaperColor', new Uniform(new Color(tokens.paper))], ['uInkColor', new Uniform(new Color(tokens.ink[0]))],
        ['uProjInv', new Uniform(new Matrix4())], ['uCamWorld', new Uniform(new Matrix4())],
        ['uFog', new Uniform(new Vector4(0.028, 0.16, 0.0, 0.35))], ['uLocalFogBoost', new Uniform(0)],
        ['uEdges', new Uniform(1)], ['uWobble', new Uniform(1)], ['uInkMix', new Uniform(1)], ['uDive', new Uniform(0)],
      ]),
    })
  }
  override update() {
    this.uniforms.get('uProjInv')!.value.copy(this.cam.projectionMatrixInverse)
    this.uniforms.get('uCamWorld')!.value.copy(this.cam.matrixWorld)
    // uDive / uInkMix / uLocalFogBoost are copied from journey.getState() by PostStack's useFrame
  }
}
```

```ts
// the ramp: built in code from tokens, 0 bytes of download
export function makeInkRamp(stops: [number, string][]) {   // [[0,'#141417'],[0.18,'#2b2b30'],[0.4,'#55565c'],[0.65,'#9a9a9c'],[0.85,'#d4d0c6'],[1,'#ece6d8']]
  const data = new Uint8Array(256 * 4)
  /* lerp in sRGB bytes between stops */
  const tex = new DataTexture(data, 256, 1); tex.colorSpace = SRGBColorSpace; tex.needsUpdate = true
  return tex
}
```

```glsl
// env/mountain.frag.glsl  (opaque ShaderMaterial on a wide plane; one per 三远 layer)
uniform float uSeed, uRidge, uLayerTone;   // uLayerTone: 0 = near/dark .. 1 = far/pale
uniform vec3 uInkColor, uPaperColor;
varying vec2 vUv;
float fbm1(float x) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(vec3(x, uSeed, 0.0)); x *= 2.03; a *= 0.5; } return s; }
void main() {
  float ridge = 0.35 + uRidge * fbm1(vUv.x * 3.0);
  if (vUv.y > ridge) discard;                                   // silhouette writes depth → Sobel draws the contour
  float below = (ridge - vUv.y) / ridge;                        // 0 at ridge .. 1 at foot
  float cun = vnoise(vec3(vUv.x * 40.0, vUv.y * 6.0, uSeed));   // 皴 texture strokes
  float ink = (0.8 * smoothstep(1.0, 0.85, below) + 0.2 * cun) * (1.0 - smoothstep(0.35, 0.9, below));
  gl_FragColor = vec4(mix(uPaperColor, uInkColor, ink * (1.0 - uLayerTone)), 1.0);
  #include <colorspace_fragment>
}
```

```glsl
// env/pine.vert.glsl  (InstancedMesh; aSeed is an InstancedBufferAttribute)
attribute float aSeed;
uniform float uTime, uSway;
varying vec2 vUv; varying float vSeed;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.6 + aSeed * 6.2831) * uSway * p.y * p.y * 0.004;   // sway grows with height
  vUv = uv; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
}
// env/pine.frag.glsl
uniform vec3 uInkColor, uPaperColor;
varying vec2 vUv; varying float vSeed;
void main() {
  if (vnoise(vec3(vUv * 18.0, vSeed * 10.0)) < 0.18) discard;             // ragged pad edges
  gl_FragColor = vec4(mix(uInkColor, uPaperColor, 0.06 + vSeed * 0.12), 1.0);
  #include <colorspace_fragment>
}
```

Use a raw `<instancedMesh args={[geo, mat, maxCount]}>` with matrices written in `useLayoutEffect`. drei `<Instance>` components cost one React node per tree. Tier changes set `mesh.count`, which needs no reallocation. Scatter with Poisson-disc sampling along the path corridor and skip the section `clearings`.

### Quality tiers

| | low | medium | high |
|---|---|---|---|
| Initial guess | coarse pointer and (≤ 4 cores or `deviceMemory` ≤ 3), or renderer string matches Mali-G5x / Adreno 5xx / PowerVR / SwiftShader | other coarse-pointer devices | fine pointer |
| DPR cap | 1.0 | 1.5 | 2.0 (1.75 if screen > 8 MP) |
| Ink pass | fog + ramp + grain, `uEdges = 0`, `uWobble = 0` | full | full |
| EffectComposer multisampling (startup only) | 0 | 0 | 4 |
| Pines (`mesh.count`) | 300 | 700 | 1500 |
| Mist bands / mountain layers | 2 / 3 | 3 / 5 | 4 / 6 |
| Cabin portal (stencil) | no, fog-dive cut at the door | yes | yes |
| Bloom levels (startup only) | 3 | 4 | 6 |
| Far sections | unmounted | hidden (Activity) | hidden (Activity) |

Rules:

- Runtime tier changes may only touch uniforms, `EffectGroup.enabled`, `mesh.count` and DPR. Never touch defines, `multisampling`, `scene.fog` or material swaps, because those trigger shader recompiles and hitches.
- DPR changes reallocate render targets, so step DPR in 0.25 increments at most once per 2 s.
- `?tier=low|medium|high` overrides everything (debugging, e2e).

```tsx
// src/core/render/QualityController.tsx
export function QualityController() {
  const setDpr = useThree((s) => s.setDpr)
  const tier = useJourney((s) => s.tier)
  useEffect(() => setDpr(Math.min(devicePixelRatio, TIERS[tier].dprCap)), [tier, setDpr])
  return (
    <PerformanceMonitor
      flipflops={3}
      onDecline={() => journey.setState((s) => ({ tier: stepTier(s.tier, -1) }))}
      onIncline={() => journey.setState((s) => ({ tier: stepTier(s.tier, +1) }))}
      onFallback={() => journey.setState({ tier: 'low' })}   // after 3 flip-flops, stay low
    />
  )
}
```

Canvas setup:

```tsx
<Canvas
  eventSource={root} eventPrefix="client"
  dpr={Math.min(devicePixelRatio, TIERS[initialTier].dprCap)}
  gl={{ antialias: false, alpha: false, stencil: true, powerPreference: 'high-performance' }}
  camera={{ fov: 40, near: 0.1, far: 600 }}
  shadows={false}
  frameloop={reducedMotion ? 'demand' : 'always'}
  onCreated={({ gl }) => gl.setClearColor(tokens.paper)}
>
```

On iOS, put the canvas container at `position: fixed; inset: 0; height: 100lvh`. The URL bar collapsing then does not resize the renderer. Listen for `webglcontextlost` and switch to `static` mode, because iOS drops contexts under memory pressure.

## 6. Cabin interior and per-section post (brief item 4)

### Post stack

```tsx
// src/core/render/post/PostStack.tsx
export function PostStack({ initialTier }: { initialTier: Tier }) {
  const camera = useThree((s) => s.camera)
  const ink = useMemo(() => new InkEffect(camera, paperTex, inkRamp), [camera])
  const finish = useMemo(() => new FinishEffect(), [])     // grain + dive for the cabin side
  const post = useJourney((s) => s.post)
  const crossing = useJourney((s) => s.postBlend > 0 && s.postBlend < 1)
  const bloom = useRef<BloomEffect>(null)
  useFrame(() => {
    const s = journey.getState()
    ink.uniforms.get('uInkMix')!.value = 1 - s.postBlend
    ink.uniforms.get('uDive')!.value = s.dive.amount
    ink.uniforms.get('uEdges')!.value = s.tier === 'low' ? 0 : 1
    if (bloom.current) bloom.current.intensity = 1.2 * s.postBlend
  })
  return (
    <EffectComposer multisampling={initialTier === 'high' ? 4 : 0} enableNormalPass={false} stencilBuffer>
      <EffectGroup enabled={post === 'ink' || crossing}><primitive object={ink} dispose={null} /></EffectGroup>
      <EffectGroup enabled={post === 'cabin' || crossing}>
        <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.9} levels={TIERS[initialTier].bloomLevels} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <primitive object={finish} dispose={null} />
      </EffectGroup>
    </EffectComposer>
  )
}
```

- `EffectGroup` builds one `EffectPass` per group and flips `pass.enabled` (`@react-three/postprocessing` 3.1 source: "cheap, no reconstruction"). When groups exist, the composer appends a shared `CopyPass` so a disabled last group still leaves an image on screen.
- Outdoors, the cost is RenderPass + ink pass + copy. Indoors it is RenderPass + bloom mip chain + tone/finish pass + copy. Both groups run only during the roughly 0.5 s door crossfade.
- Postprocessing compiles pass materials on first render. Warm the cabin group by enabling it for one frame while the loader veil is opaque on first load.
- HDR emissive (for example `color={[0, 2.4, 3.2]}` on `MeshBasicMaterial`) needs the default `HalfFloatType` buffer to exceed 1.0 so Bloom catches it. Nothing outdoors goes above 1, so the Bloom threshold of 0.9 also guards against accidental glow.

### Bigger on the inside

Put the interior physically behind the door. Make it much larger than the exterior (for example 14 m deep behind a 5 m cabin) and clear the forest scatter from its footprint.

- Outside, the door is a drei `<Mask id={1}>`. Interior materials use `useMask(1)`, so they only draw through the doorway. Cabin-zone exterior materials use `useMask(1, true)`. Requires `gl={{ stencil: true }}` and `EffectComposer stencilBuffer`.
- When the camera crosses the door plane (`u > def.doorU`), set `insideCabin`. The exterior group goes `visible = false`, interior materials drop the stencil test (swap to a no-stencil twin created up front, so no recompile), and `postBlend` tweens 0 to 1.
- Low tier skips the stencil. The door approach ends in a short fog-dive (paper to cyan) and the interior appears on the other side.

Interior look:

- Log walls reuse the exterior log geometry. The material adds an emissive circuit-trace mask with pulses running along the traces.
- Hologram panels are additive, `depthWrite: false`, with fresnel + scanlines. Titles use troika with the Latin font.
- The terminal is a `CanvasTexture` screen.

```glsl
float traces(vec2 uv) {                       // manhattan traces following the wood grain direction
  vec2 g = uv * vec2(24.0, 6.0), id = floor(g), f = fract(g);
  float h = hash13(vec3(id, 1.0));
  float line = h > 0.5 ? smoothstep(0.06, 0.0, abs(f.y - 0.5)) : smoothstep(0.06, 0.0, abs(f.x - 0.5));
  return line * step(0.35, hash13(vec3(id, 3.1)));
}
// holo.frag.glsl
uniform float uTime; uniform vec3 uCyan; uniform sampler2D uMap;
varying vec2 vUv; varying vec3 vN, vView;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  float scan = 0.75 + 0.25 * sin(vUv.y * 480.0 - uTime * 6.0);
  float a = (texture2D(uMap, vUv).a * 0.9 + fres * 0.6) * scan;
  gl_FragColor = vec4(uCyan * (1.6 + 2.0 * fres), a);        // > 1.0 so Bloom picks it up
}
```

The terminal's input is a real DOM `<input>` inside `#cabin`'s content card. It is focusable, works with mobile keyboards and pairs with an `aria-live="polite"` `<output>`. The 3D screen mirrors the same buffer into a 1024×512 `CanvasTexture`, redrawn only on change (`texture.needsUpdate = true`). Tapping the 3D screen focuses the input. Commands live in a pure module (`sections/cabin/terminal/commands.ts`: `help`, `ls projects`, `cat <project>`, `whoami`, `contact`) and are unit-tested. drei `<Html transform>` would skip bloom and ink, and CSS3D over a fixed canvas is fragile on iOS, so don't use it for the terminal.

## 7. The Qimen chart in 3D and CJK text (brief item 5)

### Engine boundary

`src/lib/qimen/` is pure TypeScript with no three or React imports:

```ts
export interface QimenChart {
  at: string                 // ISO instant used
  term: SolarTermName        // 节气 in effect
  dun: 'yang' | 'yin'; ju: number; yuan: 'upper' | 'middle' | 'lower'
  pillars: { year: GanZhi; month: GanZhi; day: GanZhi; hour: GanZhi }
  xunShou: GanZhi; zhiFu: Star; zhiShi: Door
  palaces: Record<PalaceNo, { earth: Stem[]; heaven: Stem[]; star: Star | null; door: Door | null; deity: Deity | null;
                              flags: { kong?: boolean; ma?: boolean; zhiFu?: boolean; zhiShi?: boolean } }>
}
export function computeChart(instant: Date, tzOffsetMinutes: number): QimenChart   // 时家奇门 转盘 拆补法
```

Solar terms: `scripts/gen-solar-terms.mjs` uses tyme4ts `SolarTerm.fromIndex(year, i)`, where index 0 is the previous year's 冬至. It writes `src/lib/qimen/solar-terms.json` with UTC instants for 2020 to 2060, about 4 KB gz, and the file is committed. tyme4ts returns Beijing time (UTC+8), so convert to UTC before storing. Day and hour pillars are arithmetic from the Julian day. Runtime has no calendar dependency.

Edge cases the tests must pin down:

- instants within a minute of a 节气 boundary
- the 23:00 子时 day rollover (pick early/late 子 convention and document it)
- 阳遁/阴遁 switch at 冬至/夏至
- 中5宫 寄 坤2 in 转盘
- 空亡 and 马星 placement

Prerendering the chart would cause a hydration mismatch. Render the DOM chart client-only via `useSyncExternalStore` with a `null` server snapshot, and prerender a static explanation plus a `<noscript>` note. Recompute at each 时辰 boundary (odd hours) with a `setTimeout` to the next one, and on `visibilitychange`.

### 3D layout

The platform is laid out in Luo Shu order, aligned to scene compass directions: 离9 south, 坎1 north, 震3 east, 兑7 west, 巽4 SE, 坤2 SW, 艮8 NE, 乾6 NW, 中5 centre. On a south-up map that reads 巽4 离9 坤2 / 震3 中5 兑7 / 艮8 坎1 乾6. Each palace slab carries 4 to 6 labels: 八神 top, 九星, 八门, and 天盘/地盘 stems in a right column. The 值符 and 值使 palaces get the warm lantern tone, which is saturated and so passes through the ink ramp untouched. 空亡 palaces get a faded wash.

- Start with drei `<Text>` for every label (about 50 meshes, about 50 draw calls).
- If mobile draw calls hurt, switch the palace labels to troika's `BatchedText` (exported by troika-three-text 0.52) through `extend({ BatchedText })`. That is one draw call.
- Pass `characters={QIMEN_GLYPHS}` so the SDF atlas is built once during the fog-dive, not every two hours when labels change.
- `sdfGlyphSize` 64 for labels, 128 for the few large hero glyphs (thin strokes in 螣 and 蓬 break up at 64).
- Set `depthWrite: false` on text materials (§5 gotcha).

```ts
// src/core/text/configure.ts  (imported by the text components of cabin and grove, runs once)
import { configureTextBuilder } from 'troika-three-text'
configureTextBuilder({ defaultFontURL: '/fonts/latin-subset.woff', sdfGlyphSize: 64 })
// unicodeFontsURL stays default (jsDelivr Noto) purely as a safety net; the CI glyph check keeps it from firing
```

troika reads ttf, otf and woff, **not woff2**. Ship each subset twice: `.woff` for troika and `.woff2` for DOM `@font-face`.

### Subsetting

```js
// scripts/subset-fonts.mjs  (run when copy changes; outputs are committed, source TTFs are not)
import subsetFont from 'subset-font'
import { readFile, writeFile } from 'node:fs/promises'
import { collectCjk } from './collect-cjk.mjs'   // scans src/content/**, src/lib/qimen/labels.ts, index.html

const text = await collectCjk()
const src = await readFile(process.env.WENKAI_TTF ?? '.fonts-src/LXGWWenKai-Regular.ttf')
await writeFile('public/fonts/wenkai-subset.woff', await subsetFont(src, text, { targetFormat: 'woff' }))
await writeFile('src/assets/fonts/wenkai-subset.woff2', await subsetFont(src, text, { targetFormat: 'woff2' }))
await writeFile('src/assets/fonts/wenkai-subset.glyphs.txt', [...new Set(text)].sort().join(''))
```

CI runs `scripts/check-glyphs.mjs`, which fails if `collectCjk()` returns a character missing from `glyphs.txt`.

Measured on 136 glyphs (九宫, 八门, 九星, 八神, 10 stems, 12 branches, 24 节气, 遁/局/元 vocabulary, numerals, 罗盘/洛书/二十四山):

| Font | ttf | woff (troika) | woff2 (DOM) | License |
|---|---|---|---|---|
| LXGW WenKai Regular v1.522 (source 25.6 MB) | 47.6 KB | 33.4 KB | 28.6 KB | OFL 1.1. Its Reserved Font Name clause has an explicit additional permission for subsets and WOFF/WOFF2 conversions "solely for web font delivery". Keep `OFL.txt` next to the file |
| Ma Shan Zheng (brush, source 5.9 MB) | 84.1 KB | 56.0 KB | 50.1 KB | OFL 1.1, no Reserved Font Name. Use only for a handful of hero glyphs (~20 glyphs, ~10 KB) |
| Noto Serif SC | | | | OFL 1.1. Song/Ming style looks printed rather than painted. Fallback only |

Recommendation: WenKai for all labels and glosses, optionally Ma Shan Zheng for 5 to 10 hero characters.

## 8. Device-orientation compass (brief item 6)

- Requires a secure context. cy.my serves HTTPS through Cloudflare (`https_enforced` is off at GitHub, but the Cloudflare edge redirects http to https).
- iOS/iPadOS Safari needs `DeviceOrientationEvent.requestPermission()` inside a click handler (transient activation), otherwise it rejects with `NotAllowedError`. The spec's newer `requestPermission(absolute)` argument asks for magnetometer access too, and older iOS ignores it.
- iOS gives `webkitCompassHeading`: degrees clockwise from magnetic north, tilt-compensated.
- Chromium on Android fires `deviceorientationabsolute`, with `alpha` counter-clockwise from north. Compute a tilt-compensated heading from alpha/beta/gamma.
- Magnetic north is correct here: a real luopan uses a magnetic needle, and declination in Penang is under 1°.

```ts
// src/lib/compass/heading.ts  (pure, tested)
export function headingFromEuler(alpha: number, beta: number, gamma: number) {   // W3C DeviceOrientation example
  const d = Math.PI / 180, x = beta * d, y = gamma * d, z = alpha * d
  const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z)
  const Vx = -cZ * sY - sZ * sX * cY, Vy = -sZ * sY + cZ * sX * cY
  let h = Math.atan(Vx / Vy)
  if (Vy < 0) h += Math.PI; else if (Vx < 0) h += 2 * Math.PI
  return h / d                                                                    // 0..360, clockwise from north
}
export const withScreen = (h: number, screenAngle: number) => (h + screenAngle + 360) % 360

// src/sections/grove/compass/enableCompass.ts
export type CompassStatus = 'unsupported' | 'denied' | 'active' | 'no-data'
export async function enableCompass(onHeading: (deg: number) => void): Promise<CompassStatus> {
  const DOE = (window as any).DeviceOrientationEvent
  if (!DOE || !isSecureContext) return 'unsupported'
  if (typeof DOE.requestPermission === 'function') {                // iOS 13+: must run inside the click handler
    const res = await DOE.requestPermission(true).catch(() => 'denied')
    if (res !== 'granted') return 'denied'
  }
  const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
  let got = false
  const onEvt = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
    const angle = screen.orientation?.angle ?? 0
    let h: number | null = null
    if (typeof e.webkitCompassHeading === 'number') h = withScreen(e.webkitCompassHeading, angle)
    else if (e.absolute && e.alpha != null) h = withScreen(headingFromEuler(e.alpha, e.beta ?? 0, e.gamma ?? 0), angle)
    if (h != null) { got = true; onHeading(h) }
  }
  addEventListener(type, onEvt as EventListener)
  await sleep(1500)
  if (!got) { removeEventListener(type, onEvt as EventListener); return 'no-data' }   // desktop Chrome fires a single null event
  return 'active'
}
```

Verify the `screen.orientation.angle` correction for `webkitCompassHeading` in landscape on a real device. The luopan group rotates by `-heading` in radians, smoothed with `easing.dampAngle(group.rotation, 'y', target, 0.25, dt)`, which takes the shortest path across 359° to 0°.

UI flow: show an "Align with your phone" button only when `matchMedia('(pointer: coarse)')` matches and the API exists. Fallbacks:

- **Denied or no data.** Show a short note and keep manual control.
- **Desktop.** Drag the rings with pointer events and inertia.
- **Keyboard.** A DOM `<input type="range" aria-label="Rotate luopan">` in the grove card drives the same store value with the arrow keys.

## 9. Accessibility, SEO, fallbacks (brief item 7)

DOM content layer (prerendered):

```html
<main id="content">
  <section id="threshold" aria-labelledby="threshold-heading">
    <h1 id="threshold-heading" tabindex="-1">CY Lim</h1><p>Software engineer in Penang …</p>
  </section>
  <section id="cabin" aria-labelledby="cabin-heading">
    <h2 id="cabin-heading" tabindex="-1">The Cabin <span lang="zh-Hans" class="gloss" …>工坊</span></h2>
    <ul class="projects">…one <article> per project, same data as the 3D panels…</ul>
    <form class="terminal" aria-label="Terminal"><label>…</label><input …><output aria-live="polite">…</output></form>
  </section>
  <section id="grove" aria-labelledby="grove-heading">
    <h2 id="grove-heading" tabindex="-1">The Grove</h2>
    <figure><table class="qimen" aria-describedby="qimen-caption">3×3 rows of palaces, each cell lists deity/star/door/stems with glosses</table>
      <figcaption id="qimen-caption">Live Qimen Dunjia chart for your current time …</figcaption></figure>
  </section>
  <section id="contact" aria-labelledby="contact-heading">
    <h2 id="contact-heading" tabindex="-1">…</h2>
    <ul class="social"><li><a rel="me" href="https://github.com/cylim">GitHub</a> …X, LinkedIn, Blog (https://cy.my/blog/)</li></ul>
  </section>
</main>
```

- **Glosses.** Chinese accents are `<span lang="zh-Hans" tabindex="0" aria-describedby="g-jiugong">九宫</span>` plus a `role="tooltip"` element. The tooltip shows on hover and focus, dismisses with Esc, and stays open while hovered (WCAG 1.4.13). The 3D copies raycast on hover and open the same DOM tooltip. `lang="zh-Hans"` matters for screen-reader voice and font fallback.
- **Reduced motion.** `static` mode by default. If the user opts in, disable autonomous motion (mist drift, wind sway, parallax, wobble "boil"), use `frameloop="demand"`, make the fog-dive a 120 ms fade, and disable Lenis. Scroll-linked camera movement stays, since the user drives it.
- **No WebGL.** Two probes: `'WebGL2RenderingContext' in window` in the head script, then a real `getContext('webgl2', { failIfMajorPerformanceCaveat: true })` before loading the stage. Failure means `static` mode with prerendered stills (`public/stills/{section}.avif` + WebP, captured by the screenshot script, below 120 KB each, `loading="lazy"`).
- **Head tags.**
  - `<html lang="en">`, a new title and description, `<link rel="canonical" href="https://cy.my/">`.
  - Open Graph `og:type=website`, `og:url`, `og:title`, `og:description`, `og:image=https://cy.my/og.png` (1200×630, from the screenshot script) and `og:image:alt`.
  - `<meta name="twitter:card" content="summary_large_image">`. The current page wrongly uses `value=`.
  - `theme-color` = paper token, SVG favicon + PNG fallback.
  - `<link rel="me">` for GitHub, X and LinkedIn.
  - JSON-LD `Person`: name "CY Lim", alternateName "Chee Yeong Lim", jobTitle, address Penang MY, `sameAs` the social URLs.
  - Keep the existing `p:domain_verify` meta.
  - Add `robots.txt` and a one-URL `sitemap.xml`.
  - Self-host fonts. The current page loads Google Fonts over `http://`, which is mixed content and gets blocked.
- **`<noscript>`** only needs a one-line note in the grove ("The live chart needs JavaScript"), because everything else is already static HTML.
- **Focus and keyboard.** Visible focus rings, a skip link, a jump-nav `<nav aria-label="Journey">` with `aria-current="location"` on the active item, and focus moved to the section heading after a jump.

## 10. GitHub Pages deploy (brief item 8)

Current state, checked with `gh api` on 2026-09-28:

- `cylim/cylim.github.io`: Pages `build_type: legacy` from `master:/`, `cname: cy.my`, Cloudflare in front, HTTPS at the edge.
- `cylim/blog`: **separate project site**, `legacy` from `gh-pages:/`, `html_url: http://cy.my/blog/`, returns 200. Last push 2016.
- `cylim/UOW_INTISubang`: also a project site at `cy.my/UOW_INTISubang/`, currently 404.
- Changing the user site's build type does not touch either project site. Constraint: the new `dist/` must not contain `/blog/` or `/UOW_INTISubang/`.

### Carrying over existing assets

Everything under `public/` is copied verbatim to `dist/`:

```
public/
  CNAME                       # harmless; GitHub ignores it for Actions deploys, but it documents intent and helps a rollback
  resources/{bg.png,favicon.png,profile.json,profile.png,resume-en.pdf,resume-zh.pdf,transcript.pdf}
  articles/201808-first-year.md
  fonts/…  stills/…  og.png  robots.txt  sitemap.xml  404.html
```

A regression to fix during migration: today Jekyll renders `articles/201808-first-year.md` to `/articles/201808-first-year.html` (200, and linked as canonical). Actions deploys do not run Jekyll, so that URL would 404. `scripts/render-articles.mjs` (marked 18) renders every `articles/*.md` into `public/articles/*.html` with a minimal ink-styled template, and keeps the `.md` next to it. GitHub Pages serves extensionless `/articles/201808-first-year` from the `.html`.

No `.nojekyll` is needed, because Actions artifacts are served as-is. `upload-pages-artifact` v4+ drops dotfiles unless `include-hidden-files: true`, and we have none.

### Workflow `.github/workflows/deploy.yml`

```yaml
name: Deploy cy.my

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test -- --run
      - run: npm run check:glyphs
      - run: npm run build          # vite build + ssr build + prerender + render-articles
      - run: npm run check:budget
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

A second workflow, `ci.yml`, runs the same build on `pull_request` plus the Playwright job (`npx playwright install --with-deps chromium`, then `npm run e2e`), and uploads the report as an artifact. Visual diffs start as advisory. Smoke assertions gate.

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "node scripts/render-articles.mjs && vite build && vite build --ssr src/entry-server.tsx --outDir dist-ssr && node scripts/prerender.mjs",
    "preview": "vite preview --port 4173 --strictPort",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "oxlint src scripts tests",
    "test": "vitest",
    "e2e": "playwright test",
    "shots": "node scripts/shots.mjs",
    "gen:terms": "node scripts/gen-solar-terms.mjs",
    "gen:fonts": "node scripts/subset-fonts.mjs",
    "check:glyphs": "node scripts/check-glyphs.mjs",
    "check:budget": "node scripts/check-budget.mjs"
  }
}
```

Prerender, verified working with Vite 8.3.1 on a scratch project:

```js
// scripts/prerender.mjs
import { readFile, writeFile } from 'node:fs/promises'
const { render } = await import('../dist-ssr/entry-server.js')    // renderToString(<ContentLayer />)
const html = await readFile('dist/index.html', 'utf8')
await writeFile('dist/index.html', html.replace('<!--content-->', render()))
```

The client calls `hydrateRoot(document.getElementById('content'), <ContentLayer />)`. The Vite base stays `'/'`, because this is the user site at the domain root, not `/cylim.github.io/`.

### The one manual settings change

Switch Pages source from "Deploy from a branch" to **GitHub Actions**. Either Settings → Pages → Build and deployment → Source, or:

```sh
gh api -X PUT repos/cylim/cylim.github.io/pages -f build_type=workflow
```

Order: switch the Pages source **before** merging, then merge; the push runs `deploy.yml`. Merging first would let the legacy branch builder publish the unbuilt source tree. The step-by-step cutover, verification and rollback are in `deploy-runbook.md`. For Actions deploys the custom domain comes from the Pages setting, not from the CNAME file. The `github-pages` environment has no branch policy yet; the runbook adds one so only `master` can deploy.

## 11. Folder structure and module boundaries (brief item 9)

```
index.html                       # shell with <!--content--> slot, head tags, inline mode script
public/                          # verbatim assets (see §10)
scripts/                         # prerender, render-articles, subset-fonts, collect-cjk, check-glyphs,
                                 # gen-solar-terms, check-budget, shots
src/
  main.tsx                       # boot: hydrate content, init nav + scroll, decide mode, idle-import stage
  entry-server.tsx               # renderToString(<ContentLayer/>)
  content/                       # typed copy, single source for DOM and 3D labels
    site.ts  projects.ts  grove.ts (glossary)  social.ts
  dom/                           # content-layer components (no three imports)
    ContentLayer.tsx  JumpNav.tsx  Veil.tsx  Gloss.tsx  sections/{Threshold,Cabin,Grove,Contact}Copy.tsx
  theme/
    tokens.ts                    # paper, ink[5], lantern, cyan, type scale, motion timings
    tokens.css                   # same values as CSS custom properties (generated or hand-synced + test)
  core/                          # shared runtime, owned by the core engineer
    store/journey.ts
    scroll/{ScrollDriver.ts,progress.ts,hashNav.ts,dive.ts}
    camera/{path.ts,CameraRig.tsx}
    world/layout.ts              # zone anchors, north direction, ground height
    sections/{types.ts,registry.ts,SectionHost.tsx,defineSection.ts}
    render/
      Stage.tsx                  # <Canvas>, SectionHosts, Environment, PostStack, QualityController
      quality.ts  QualityController.tsx
      post/{PostStack.tsx,InkEffect.ts,ink.frag.glsl,FinishEffect.ts,finish.frag.glsl}
      glsl/{noise.glsl,inkFog.glsl}
      materials/{createInkMaterial.ts,paper.ts,inkRamp.ts}
    text/configure.ts
  env/                           # forest shared by all sections (owned by the environment engineer)
    Environment.tsx  pines/  mountains/  mist/  scatter.ts
  sections/
    threshold/{index.ts,Scene.tsx,…}
    cabin/{index.ts,Scene.tsx,Exterior.tsx,Interior.tsx,Portal.tsx,panels/,terminal/{commands.ts,TerminalScreen.tsx}}
    grove/{index.ts,Scene.tsx,Platform.tsx,Luopan.tsx,ChartLabels.tsx,compass/}
    contact/{index.ts,Scene.tsx,Stele.tsx,Lantern.tsx}
  lib/                           # pure TS, no React/three, fully unit-tested
    qimen/{index.ts,chart.ts,labels.ts,solar-terms.json,*.test.ts}
    compass/{heading.ts,heading.test.ts}
tests/e2e/{sections.spec.ts,nav.spec.ts,fallback.spec.ts}
```

Rules that keep parallel work conflict-free:

1. A section folder imports only from `core/`, `env/` (read-only hooks such as `useClearing`), `lib/`, `content/` and `theme/`. It never imports another section. Enforce with oxlint `no-restricted-imports` patterns per folder.
2. `core/` reaches sections only through `registry.ts` dynamic imports. The registry is created on day 1 with four stub scenes, so after that nobody edits it except to tune `span`/`arrivalU`.
3. Each section owns its camera stations (`index.ts`), relative to its `layout.ts` anchor. The core engineer owns the handoff points between zones.
4. Visual constants go in `theme/tokens.ts`. Sections do not hard-code colors. The art lead reviews token changes.
5. Post-processing changes go through `core/render/post`. Sections request looks through their `post` field and `postBlend`, never by mounting effects.
6. Shared GLSL lives in `core/render/glsl`. A section may add private shaders in its own folder.
7. Suggested `CODEOWNERS`: `src/core/** @core`, `src/env/** @env`, `src/sections/cabin/** @cabin`, `src/sections/grove/** src/lib/qimen/** @grove`, `src/dom/** src/content/** @content`.

## 12. Testing (brief item 10)

### Unit (vitest 5, `environment: 'node'`)

- `lib/qimen`: golden charts. Pick about 20 instants covering the §7 edge cases and cross-check them against an established app or an oracle library. `qimen-dunjia` 3.1.0 (MIT, Chai Bu) or `bigfishmarquis-qimen` 1.0.0 (MIT, zero deps) work as devDependency oracles, but never ship them. Also property tests: 9 stars, 8 doors and 8 deities appear exactly once, and 转盘 rotation preserves ring order.
- `solar-terms.json`: monotonic, 24 per year, 冬至 near Dec 21 to 22 UTC.
- `core/scroll/progress.ts`: `uFromScroll` is monotonic, lands exactly on `arrivalU` at section tops, and dwell plateaus hold.
- `hashNav` reducer: hash to section mapping, token cancellation when jumps overlap.
- `lib/compass/heading.ts`: flat device (beta = gamma = 0) gives `360 - alpha`, and screen-angle wrap works.
- `sections/cabin/terminal/commands.ts`.

### E2E and visual (Playwright 1.63)

Headless Chromium 152 here renders WebGL2 through SwiftShader by default. `--use-angle=swiftshader --enable-unsafe-swiftshader` makes that explicit. `--disable-gpu --disable-software-rasterizer` yields no WebGL2, which is exactly what the fallback test needs. Both were verified on this machine.

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
const executablePath = process.env.CHROMIUM_PATH || undefined     // CHROMIUM_PATH=/usr/bin/chromium locally
const gl = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
export default defineConfig({
  testDir: 'tests/e2e',
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:4173' },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath, args: gl } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath, args: gl } } },
    { name: 'reduced-motion', use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce', launchOptions: { executablePath, args: gl } } },
    { name: 'no-webgl', use: { ...devices['Desktop Chrome'],
        launchOptions: { executablePath, args: ['--disable-gpu', '--disable-software-rasterizer'] } } },
  ],
})
```

```ts
// tests/e2e/sections.spec.ts
import { test, expect } from '@playwright/test'
const NOW = '2026-01-01T04:00:00Z'
for (const hash of ['', '#cabin', '#grove', '#contact']) {
  const id = hash.slice(1) || 'threshold'
  test(`arrives at ${id}`, async ({ page }, info) => {
    await page.goto(`/?e2e=1&tier=medium&now=${NOW}${hash}`)
    await page.waitForFunction(() => (window as any).__cy?.settled === true, null, { timeout: 30_000 })
    await expect(page.locator(`#${id}`)).toBeInViewport()
    if (info.project.name === 'no-webgl') await expect(page.locator('html')).toHaveAttribute('data-mode', 'static')
    else await expect(page.locator('#stage canvas')).toBeVisible()
    await expect(page).toHaveScreenshot(`${id}.png`)
  })
}
test('back/forward re-dives', async ({ page }) => {
  await page.goto('/?e2e=1')
  await page.getByRole('link', { name: 'Grove' }).click()
  await page.getByRole('link', { name: 'Contact' }).click()
  await page.goBack()
  await expect(page).toHaveURL(/#grove$/)
  await page.waitForFunction(() => (window as any).__cy?.settled === true)
  await expect(page.locator('#grove-heading')).toBeFocused()
})
```

`?e2e=1` makes rendering deterministic. It freezes the mist/boil clock, fixes the chart time from `?now=`, skips Lenis, uses 50 ms dives, and exposes `window.__cy = { settled, state: journey.getState }`, where `settled` means no dive is running and every visible section is ready.

`scripts/shots.mjs` is a zero-dependency smoke check and still generator. It builds, runs `vite preview`, then loops:

```sh
chromium --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=1280,800 --virtual-time-budget=10000 --screenshot=shots/grove.png "http://localhost:4173/?e2e=1&tier=high#grove"
```

The same script writes `public/stills/*.avif` (via `sharp` or `avifenc` if installed) and `public/og.png`.

Screenshot baselines should come from CI's Playwright-bundled Chromium. Local Arch Chromium differs in version, so locally use it only for smoke runs (`--grep-invert @visual`, or `--update-snapshots` to a scratch directory).

## 13. Open items for the owner

1. The X/Twitter handle differs between sources. `l.cy.my/twitter` redirects to `twitter.com/seewhy`, but `resources/profile.json` says `@cylim226`. Which one goes on the stele?
2. Should `cy.my/blog/` (last updated 2016) stay as the "blog" link, or should it point somewhere newer?
3. Hour-pillar convention for 子时 (23:00 day rollover or midnight), and whether to use clock time or longitude-corrected solar time. Default proposal: visitor's clock time, 23:00 rollover, stated in the grove copy.
4. Should `resources/profile.json`, `resume-*.pdf` and `transcript.pdf` stay public at their current URLs? Default is yes, carried over unchanged.

## Sources checked (2026-09-28)

- npm registry via `npm view` for every version above; GitHub releases via `gh api repos/<owner>/<repo>/releases/latest`.
- [R3F v9 migration guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide); R3F releases v9.5.0 to v9.8.1 and v10 alphas (github.com/pmndrs/react-three-fiber/releases).
- [drei releases](https://github.com/pmndrs/drei/releases) (v10.0.0 React 19, v10.7.9, v11 alphas); drei 10.7.9 package source (`Text`, `Gltf`, `Mask`, `PerformanceMonitor`).
- @react-three/postprocessing 3.1.3 package source (`EffectComposer` defaults, `EffectGroup`); postprocessing 6.39.5 build (`readDepth`, `getViewZ`, peer range).
- three.js release notes r182 to r186 (github.com/mrdoob/three.js/releases); three 0.186.1 source (`Clock` deprecation, `PCFSoftShadowMap` removal, `compileAsync`).
- [Vite 8 migration guide](https://vite.dev/guide/migration); [Rolldown manual code splitting](https://rolldown.rs/in-depth/manual-code-splitting).
- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/); [InfoQ on TS 7 API status](https://www.infoq.com/news/2026/08/typescript-7-released/).
- [Lenis README](https://github.com/darkroomengineering/lenis/blob/main/README.md).
- [troika-three-text docs](https://protectwise.github.io/troika/troika-three-text/) (font formats, fallback fonts, preload).
- [MDN deviceorientationabsolute](https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientationabsolute_event); [MDN DeviceOrientationEvent.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).
- [WebGPU implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status); [web.dev: WebGPU supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers).
- GitHub docs: [custom workflows for Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) ("If you are publishing from a custom GitHub Actions workflow … any existing CNAME file is ignored").
- Font licenses: LXGW WenKai `OFL.txt` (github.com/lxgw/LxgwWenKai), Ma Shan Zheng `OFL.txt` (github.com/google/fonts/ofl/mashanzheng).
