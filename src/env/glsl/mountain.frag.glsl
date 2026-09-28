// Mountains (stack.md §5 mountain.frag, design §7.1–7.2): opaque, discarded above the ridge so the
// silhouette writes depth. Ink is darkest along the crest and washes out to paper toward the foot,
// where the mist belts take over. uv is (metres along the card, world y).
uniform float uLayerTone;  // 0 near and dark .. 1 far and pale
uniform float uSeed;
uniform float uFade;       // fraction of the ridge height over which the wash fades to paper
uniform float uAxe;        // 1: axe-cut strokes on shaded flanks (the main peak); 2: over the whole face
uniform float uMiDots;     // 1: 米点 dabs along the crest (far ridges)
uniform float uStrokeScale;
uniform vec3 uFarFade;     // camera distance where the card starts and ends paling, and by how much
uniform float uCutFoot;    // 1: where the wash has faded to paper, leave a hole (a card with ends)
uniform vec3 uBelt;        // a belt of cloud across the card: centre y, half height (m); z 1 = on
uniform vec4 uGate;        // camera z where the card condenses (x → y) and dissolves (z → w); all 0: always

varying vec2 vUv;
varying float vRidge;
varying vec3 vWorld;
varying vec3 vNormalW;

void main() {
  float s = vUv.x;
  float y = vUv.y;
  float ragged = vnoise2(vec2(s * 0.09, uSeed)) * 0.6 + vnoise2(vec2(s * 0.42, uSeed + 7.0)) * 0.4;
  float top = vRidge - ragged * (2.0 + vRidge * 0.04);
  if (y > top) discard;

  float below = top - y;
  float fadeDepth = max(top, 8.0) * uFade;
  vec3 n = normalize(vNormalW);
  float lam = painterLam(n);

  // Crest line, then a streaked wash that thins downward (vertical streaks read as gullies).
  float crest = 1.0 - smoothstep(0.0, 4.0 + 6.0 * uLayerTone, below);
  float streak = vnoise2(vec2(s * 0.11, y * 0.018 + uSeed));
  float wash = (1.0 - smoothstep(0.0, fadeDepth, below)) * mix(0.48, 0.82, streak);
  float ink = max(crest * 0.92, wash) * mix(1.0, 0.72, smoothstep(0.35, 0.8, lam));

  float shade = smoothstep(0.58, 0.32, lam);
  if (uAxe > 1.5) shade = max(shade, 0.6);
  if (uAxe > 0.5 && shade > 0.0 && uCunLevel >= 1.0) {
    float c = cunStroke(vec2(s, y) / uStrokeScale, CUN_AXE);
    ink = mix(ink, max(ink, 0.9), c * shade * (1.0 - smoothstep(0.2, 0.9, below / fadeDepth)) * 0.8);
  }
  if (uMiDots > 0.5 && below < 14.0) {
    // 米点: flat horizontal dabs strung along the crest, the Mi family's misty hills.
    vec2 g = vec2(s / 7.0, (y - top) / 2.6);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 h = hash22(id + uSeed);
    vec2 d = (f - (h - 0.5) * 0.5) * vec2(1.0, 2.4);
    float dab = (1.0 - smoothstep(0.22, 0.34, length(d))) * step(0.45, h.x);
    ink = max(ink, dab * 0.8 * (1.0 - below / 14.0));
  }

  // A belt of cloud across the waist (山腰云), ragged along both edges like a wet wash.
  if (uBelt.z > 0.5) {
    float edge = (vnoise2(vec2(s * 0.035, uSeed)) - 0.5) * uBelt.y * 1.2 + (vnoise2(vec2(s * 0.13, uSeed + 3.0)) - 0.5) * uBelt.y * 0.5;
    ink *= smoothstep(uBelt.y * 0.35, uBelt.y, abs(y - uBelt.x + edge));
  }

  // The main peak is the stele's 高远; from the meadow, 364 m off, it should be a ghost behind the
  // level distance (平远), not a second subject.
  float far = smoothstep(uFarFade.x, uFarFade.y, distance(cameraPosition, vWorld)) * uFarFade.z;
  // Seen only from its own stretch of the walk: it condenses out of the mist and dissolves again.
  float gate = 1.0;
  if (uGate.x != uGate.y) gate = smoothstep(uGate.x, uGate.y, cameraPosition.z) * (1.0 - smoothstep(uGate.z, uGate.w, cameraPosition.z));
  // A card with ends: its paper foot must not hide the ring behind it, or its end shows as a
  // vertical cut through the far ridges. The hole's edge wanders like the wash, in brush-sized
  // blots, not pixels; as the gate closes, the wash goes first and the crest last.
  float blot = vnoise2(vec2(s * 0.08, y * 0.16) + uSeed) * 0.75 + vnoise2(vec2(s * 0.5, y * 0.9)) * 0.25;
  if (uCutFoot > 0.5 && ink * (1.0 - uLayerTone) * gate < 0.08 * blot + (1.0 - gate) * 0.95) discard;
  vec3 col = inkColor(ink * (1.0 - uLayerTone) * (1.0 - far) * gate);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
