// Ink world surface (createInkMaterial), design.md §7.1. Unlit: the painter's light, a per-object
// ink weight, baked AO, 皴 strokes on the shaded side, and the lantern and door-spill terms.
// Writes alpha 1: the ink pass treats alpha < 0.5 as cabin interior.
uniform float uInkWeight;
uniform float uCunClass;
uniform float uCunScale;
uniform float uCunStrength;
#ifdef INK_NEEDLES
uniform sampler2D uNeedles;  // needle atlas: r needle strokes, g wash (env/pines/needleAtlas.ts)
uniform vec2 uNeedleSize;    // atlas size in texels
uniform vec2 uNeedleGrid;    // atlas cells across, down
varying float vCardSeed;
varying float vHigh;
#endif

varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying vec2 vUv;
varying float vAO;
varying float vInk;
varying float vSeed;
varying float vRim;

#if defined(INK_BARK) || defined(INK_NEEDLES)
// 鳞皴: pine bark as plates, each outlined in broken dry-brush ink along its lower side, the way
// scales are painted, plus the odd knot (节). uv.x wraps around the trunk (0..1), uv.y runs up it
// in metres. Plates smaller than a few pixels fade out, so a distant trunk reads as a plain wash.
float barkScales(vec2 uv, float around, float rows) {
  vec2 p = vec2(uv.x * around, uv.y * rows);
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 id1 = vec2(0.0), off1 = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 id = vec2(mod(i.x + g.x, around), i.y + g.y);
      vec2 o = g + hash22(id) * 0.8 + 0.1 - f;
      float d = length(o * vec2(1.0, 1.4));
      if (d < d1) { d2 = d1; d1 = d; id1 = id; off1 = o; } else if (d < d2) { d2 = d; }
    }
  }
  float fw = max(fwidth(p.x), fwidth(p.y));
  vec2 h = hash22(id1 + 17.0);
  // Outline the plate below and to one side of its centre only, pressed harder at one end.
  float below = smoothstep(-0.1, 0.35, off1.y / max(length(off1), 1e-3) + (h.x - 0.5) * 0.6);
  float width = mix(0.03, 0.1, h.y) * mix(0.5, 1.0, smoothstep(-0.4, 0.4, off1.x * sign(h.x - 0.5)));
  float line = (1.0 - smoothstep(width, width + 0.03 + fw, d2 - d1)) * below * step(0.25, h.x + h.y * 0.5);
  float dry = smoothstep(0.25, 0.6, vnoise2(p * vec2(2.1, 1.3) + 3.7));
  float knot = step(hash12(id1 + 41.3), 0.035) * (1.0 - smoothstep(0.16, 0.24, d1)) * smoothstep(0.05, 0.11, d1);
  return max(line * dry, knot * 1.4) * (1.0 - smoothstep(0.16, 0.4, fw));
}
#endif

void main() {
  vec3 n = normalize(vNormalW);
  n = gl_FrontFacing ? n : -n;

  float lam = painterLam(n);
  float weight = uInkWeight * vInk;
  float ink = inkValue(weight, lam);

#ifdef INK_NEEDLES
  if (vRim >= 0.0) {
    // 松针: a needle card. The atlas gives a pale wash for the mass and dark needle fans on it;
    // the silhouette is alpha-tested, with a lower threshold on distant mips so thin needles thin
    // out into a ragged edge instead of vanishing.
    vec2 tex = texture2D(uNeedles, vUv).rg;
    vec2 px = vUv * uNeedleSize;
    float lod = 0.5 * log2(max(max(dot(dFdx(px), dFdx(px)), dot(dFdy(px), dFdy(px))), 1e-6));
    float far = smoothstep(0.5, 3.5, lod);
    float thr = mix(0.5, 0.24, far);
  #ifdef INK_RAGGED
    // Each card erodes a little differently, so repeated atlas cells never read as stamps.
    thr += (vnoise2(px / 26.0 + vCardSeed * 97.0) - 0.5) * 0.18;
  #endif
    // Seen from above and far off, the wash's thin edges fall away and leave paper between clusters.
    float washCut = thr + 0.16 * vHigh;
    // Magnified, filtered needles swell; cut them higher so they stay a hair wide.
    float needleCut = thr + 0.14 * smoothstep(0.0, -2.0, lod);
    if (tex.r < needleCut && tex.g < washCut) discard;
    // Up close a needle is a stroke; small on screen, mips average needles and gaps, so read the
    // average as density: a dense cluster stays dark at any distance.
    float needle = smoothstep(mix(needleCut, 0.06, far), mix(needleCut + 0.3, 0.42, far), tex.r);
    // The wash thins toward its edge like a wet stroke, so a pad is a soft mass, not a cut-out.
    float wash = mix(0.36, 0.8, smoothstep(0.4, 0.95, tex.g)) * mix(0.55, 1.0, smoothstep(washCut, washCut + 0.25, tex.g));
    // A painted pad is pressed dark along its needle fringe and let fade underneath, where the mist
    // sits between layers; flat, it reads as a cut-out. v runs down the atlas cell.
    wash *= mix(1.0, 0.62, smoothstep(0.45, 0.85, fract(vUv.y * uNeedleGrid.y)));
    // From above (grove seat, finale): a pale wash under the clusters, the needles a little lighter too.
    wash *= mix(1.0, 0.5, vHigh);
    ink = min(weight * mix(wash, mix(1.08, 0.8, vHigh), needle), 1.0);
  } else
#endif
  {
#if defined(INK_BARK) || defined(INK_NEEDLES)
    // A painted trunk is a flat mid tone pressed darker along its sides, like the brush that drew
    // its outline, and on the shaded side; Lambert alone makes it a grey cylinder.
    float facing = abs(dot(n, normalize(cameraPosition - vWorld)));
    float side = 1.0 - facing;
    // One crisp, dry-edged boundary between the lit and the shaded side, not a smooth gradient.
    // Soft, not cel-hard: the brush feathers the boundary, and a long vertical drag varies the wash.
    float dryEdge = (vnoise2(vUv * vec2(9.0, 1.8) + vSeed * 7.0) - 0.5) * 0.2;
    float shaded = smoothstep(0.58, 0.4, lam + dryEdge);
    float drag = mix(0.82, 1.08, vnoise2(vec2(vUv.x * 5.0 + vSeed * 13.0, vUv.y * 0.35)));
    ink = weight * (mix(0.3, 0.56, shaded) * drag + 0.62 * smoothstep(0.55, 1.0, side));
    // Scales gather on the shaded side and toward the edges, where a painter's brush drags.
    float where = mix(0.3, 1.0, max(shaded, smoothstep(0.3, 0.8, side)));
  #ifdef INK_BARK
    ink = mix(ink, max(ink, 0.95 * weight), barkScales(vUv, 12.0, 4.4) * where);
  #else
    ink = mix(ink, max(ink, 0.9 * weight), barkScales(vUv, 7.0, 2.8) * where * 0.85);
  #endif
#endif
  }

#if defined(CUN_MODE) && CUN_MODE == 0
  // 石分三面: a painted rock has three faces, a pale top, a mid side and a dark side, each flat.
  float face = mix(0.28, 0.62, smoothstep(0.76, 0.7, lam));
  face = mix(face, 1.0, smoothstep(0.52, 0.46, lam));
  ink = uInkWeight * vInk * face;
#endif

#ifdef CUN_MODE
  if (uCunLevel >= uCunClass) {
    // Strokes gather on the shaded side (lam < 0.55) and thin out, not stop, on the lit side.
    float shade = mix(0.3, 1.0, smoothstep(0.55, 0.3, lam)) * smoothstep(0.95, 0.7, lam);
    if (shade > 0.0) {
      float s = cunStroke(cunCoords(vWorld, n) / uCunScale, CUN_MODE);
      ink = mix(ink, max(ink, 0.95), s * shade * uCunStrength);
    }
  }
  #if CUN_MODE == 0
  // Axe-cut stone: where the facet normal turns inside a pixel quad, a crease. Depth contours only
  // find silhouettes; this draws the chops between faces, broken like a dry brush.
  float crease = smoothstep(0.12, 0.45, length(fwidth(vNormalW)));
  ink = max(ink, crease * smoothstep(0.3, 0.55, vnoise2(vWorld.xz * 3.0 + vWorld.y * 2.0)) * 0.95);
  #endif
#endif

  vec3 col = inkColor(1.0 - (1.0 - ink) * vAO);
  col = applyLantern(col, vWorld, n);
  col = applySpill(col, vWorld, n);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
