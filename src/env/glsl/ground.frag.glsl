// The ground (design.md §5.1, §8.1): lightly inked paper, with the two path splines and the stream
// left as blank paper (留白). Paths are looked up by z, since both run strictly south (env/paths.ts).
uniform float uInkWeight;
uniform vec4 uPath[PATH_VEC4S];
uniform vec4 uPathEnds;   // toCabin north, south; toGrove north, south (z)
uniform float uPathHalf;
uniform vec3 uStream;     // centre z, half width, 0
uniform vec3 uGrove;      // centre x, z, clearing radius

varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying vec2 vUv;
varying float vAO;
varying float vInk;
varying float vSeed;
varying float vRim;

float pathSample(int i) {
  int v = i / 4;
  return uPath[v][i - v * 4];
}

// Distance from the path centre line (perpendicular), or 1e4 where there is no path.
float pathDistance(vec3 wp) {
  float f = (PATH_Z0 - wp.z) / PATH_STEP;
  if (f < 0.0 || f > float(PATH_COUNT) - 1.001) return 1e4;
  int i = int(floor(f));
  float a = pathSample(i);
  float b = pathSample(i + 1);
  if (a > PATH_NONE * 0.5 || b > PATH_NONE * 0.5) return 1e4;
  float slope = (b - a) / PATH_STEP;
  float c = mix(a, b, f - float(i));
  return abs(wp.x - c) / sqrt(1.0 + slope * slope);
}

// Strips fade in and out over a few metres where each path starts and stops.
float pathTaper(float z) {
  float cabinPath = smoothstep(uPathEnds.x + 0.5, uPathEnds.x - 3.5, z) * smoothstep(uPathEnds.y - 0.3, uPathEnds.y + 1.2, z);
  float grovePath = smoothstep(uPathEnds.z + 0.3, uPathEnds.z - 1.5, z) * smoothstep(uPathEnds.w - 0.5, uPathEnds.w + 4.0, z);
  return z > (uPathEnds.y + uPathEnds.z) * 0.5 ? cabinPath : grovePath;
}

void main() {
  vec3 n = normalize(vNormalW);
  vec3 wp = vWorld;
  float lam = painterLam(n);

  // A pale wash, mottled like paper that took the ink unevenly. (Streaky drag textures read as dirt
  // at the grazing angles the walk sees the ground from, so there are none.)
  float mottle = mix(0.5, fbm2(wp.xz * 0.045), 0.7);
  float meadow = smoothstep(2.0, 12.0, wp.z);                 // the open meadow north of the forest edge
  float clearing = 1.0 - smoothstep(uGrove.z - 4.0, uGrove.z + 6.0, distance(wp.xz, uGrove.xy));
  float w = uInkWeight * (0.7 + 0.6 * mottle) * mix(1.0, 0.5, max(meadow, clearing));
  float ink = inkValue(w, lam);

  // The ledge and any steep bank: a rock-face wash, darker toward its lip, with big axe-cut strokes;
  // gentle earth slopes get hemp fibres on the high tier.
  float steep = 1.0 - smoothstep(0.35, 0.75, n.y);
  vec2 cc = cunCoords(wp, n);
  float face = steep * (0.35 + 0.3 * vnoise2(cc * vec2(0.35, 0.12)) + 0.2 * smoothstep(-10.0, -1.0, wp.y));
  ink = max(ink, face);
  float shade = smoothstep(0.62, 0.3, lam);
  if (shade > 0.0) {
    if (steep > 0.5) ink = mix(ink, max(ink, 0.92), cunStroke(cc / 2.2, CUN_AXE) * shade * 0.85 * step(1.0, uCunLevel));
    else if (uCunLevel >= 2.0) ink = mix(ink, max(ink, 0.55), cunStroke(cc / 0.5, CUN_HEMP) * shade * 0.5);
  }

  vec3 col = inkColor(ink);
  col = applyLantern(col, wp, n);
  col = applySpill(col, wp, n);

  // 留白: the strip is untouched paper, so it is not shaded or tinted at all.
  float edgeNoise = (vnoise2(wp.xz * vec2(2.5, 0.7)) - 0.5) * 0.16 + (hash12(floor(wp.xz * 24.0)) - 0.5) * 0.03;
  float halfW = uPathHalf * pathTaper(wp.z);
  float strip = 1.0 - smoothstep(halfW - 0.05, halfW + 0.05, pathDistance(wp) + edgeNoise);
  float bank = abs(wp.z - uStream.x) + (vnoise2(vec2(wp.x * 0.8, 3.0)) - 0.5) * 0.2;
  float stream = 1.0 - smoothstep(uStream.y - 0.08, uStream.y + 0.04, bank);
  col = mix(col, uPaperColor, max(strip * step(0.001, halfW), stream));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
