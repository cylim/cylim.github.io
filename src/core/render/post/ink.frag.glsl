// The ink pass (stack.md §5, design.md §7): fog to paper, ink-ramp tone mapping, brush contours,
// ink bleed, paper grain and vignette, the two glints, the develop reveal, the fog-dive dissolve.
// postprocessing provides: depthBuffer, readDepth(), getViewZ(), resolution, texelSize, aspect.
// Prepended by InkEffect.ts: the inkFog uniforms, noise.glsl, color.glsl, inkFog.glsl, dissolve.glsl.

uniform sampler2D uGrain;     // procedural paper: r tooth, g fibres, b mottle; each centred on 0.5
uniform sampler2D uRamp;      // 256 × 1 ink ramp, sRGB texture, so it samples linear
uniform vec3 uPaper;
uniform vec3 uPaperLight;
uniform vec3 uShadeRatio;     // paper-shade / paper (linear): the vignette multiplies toward it
uniform vec3 uInk;            // 焦, the contour colour
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform float uPaperLuma;     // sRGB luma of paper; ramp lookups divide by it so paper maps to paper
uniform float uInkMix;        // 1 − postBlend
uniform float uEdges;         // 0 on low tier
uniform float uWobble;        // dry-brush breaks and boil, high tier
uniform float uBoil;          // 8 fps step counter; constant under reduced motion
uniform float uBleed;
uniform vec3 uGrainAmp;       // tooth, fibre, mottle
uniform float uGrainScale;    // 1 / (512 × pixel ratio): one paper texel per CSS pixel
uniform float uPixelRatio;
uniform float uVignette;
uniform float uDive;          // max(fog-dive, moon-gate paper)
uniform float uFlatten;
uniform float uBands;         // everyday pull toward the five inks; uFlatten takes it to hard steps
uniform vec3 uEdge;           // contour strength, and the second-difference range mapped to it
uniform vec4 uEdgeFalloff;    // full weight to x m, down to z of it by y m; w: mid-distance breaks
uniform float uFinale;        // 0..1: the finale's painting mist replaces the walk's fog (E2, E3)
uniform vec4 uFinaleMist;     // aerial ceiling, aerial rate (1/m), belt opacity, aerial start (m)
uniform vec4 uBeltZ;          // finale belts: centre z,
uniform vec4 uBeltW;          //   half width along z,
uniform vec4 uBeltTop;        //   and top height (m)
uniform vec2 uLedge;          // ledge z, ground height beyond it
uniform float uFogTint;       // 0..1: far fog drifts from paper toward paper-shade (§8.2)
uniform vec2 uFogTintDist;    // distance over which the tint comes in (m)
uniform vec4 uUnder;          // understorey mist: x where (0..1, by jvh), y most paper, z..w distance it comes in over
uniform float uReveal;        // develop threshold sweeping 1.3 → 0; ≤ 0 when done
uniform float uTime;
uniform vec4 uBandStops;      // ramp stops of 浓 重 淡 清 (焦 is 0, paper is 1)
uniform vec4 uBandEdges;      // midpoints between consecutive stops, 焦|浓 … 淡|清
uniform float uBandPaper;     // midpoint between 清 and paper
uniform vec4 uGlint0;         // xy uv, z view depth (m), w visibility (0 = off)
uniform vec3 uGlint0Size;     // x core radius, y halo radius (device px), z halo opacity
uniform vec3 uGlint0Core;
uniform vec3 uGlint0Halo;
uniform vec4 uGlint1;
uniform vec3 uGlint1Size;
uniform vec3 uGlint1Core;
uniform vec3 uGlint1Halo;

vec3 viewPosition(vec2 uv, float depth) {
  vec4 v = uProjInv * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}

// log2(1 + view depth): contours are scale-invariant, a trunk at 5 m and a ridge at 200 m get
// the same weight of line.
float logDepth(vec2 uv) {
  return log2(1.0 - getViewZ(readDepth(uv)));
}

// The five inks as steps; `soft` is the half-width of each step's edge in ramp units.
float bandRamp(float t, float soft) {
  float q = 0.0;
  q = mix(q, uBandStops.x, smoothstep(uBandEdges.x - soft, uBandEdges.x + soft, t));
  q = mix(q, uBandStops.y, smoothstep(uBandEdges.y - soft, uBandEdges.y + soft, t));
  q = mix(q, uBandStops.z, smoothstep(uBandEdges.z - soft, uBandEdges.z + soft, t));
  q = mix(q, uBandStops.w, smoothstep(uBandEdges.w - soft, uBandEdges.w + soft, t));
  q = mix(q, 1.0, smoothstep(uBandPaper - soft, uBandPaper + soft, t));
  return q;
}

// Brush contour strength 0..1 around uv. Returns the depth and uv of the nearest tap (the surface
// the contour belongs to) and the Sobel gradient that orients the dry-brush streaks.
float inkEdge(vec2 uv, out float nearDepth, out vec2 nearUv, out vec2 grad) {
  vec2 c = uv;
  if (uWobble > 0.0) {
    vec2 j = vec2(vnoise2(uv * 6.0 + uBoil * vec2(3.1, 7.7)), vnoise2(uv * 6.0 + 19.1 + uBoil * vec2(5.3, 2.9))) - 0.5;
    c += j * texelSize * 3.0 * uWobble;
  }
  // 提按: the brush presses and lifts, so the line swells and thins along its length. Offsets are
  // in CSS pixels, so a line is as heavy at DPR 2 as at DPR 1.
  float press = vnoise2(uv * resolution / (uPixelRatio * 140.0) + 3.1);
  vec2 o = texelSize * uPixelRatio * (0.85 + 0.9 * press + uFlatten);
  float cc = logDepth(c);
  float tl = logDepth(c + vec2(-o.x, o.y));
  float tc = logDepth(c + vec2(0.0, o.y));
  float tr = logDepth(c + o);
  float ml = logDepth(c - vec2(o.x, 0.0));
  float mr = logDepth(c + vec2(o.x, 0.0));
  float bl = logDepth(c - o);
  float bc = logDepth(c - vec2(0.0, o.y));
  float br = logDepth(c + vec2(o.x, -o.y));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  grad = vec2(gx, gy);
  float nearLog = cc;
  nearUv = c;
  if (tl < nearLog) { nearLog = tl; nearUv = c + vec2(-o.x, o.y); }
  if (tc < nearLog) { nearLog = tc; nearUv = c + vec2(0.0, o.y); }
  if (tr < nearLog) { nearLog = tr; nearUv = c + o; }
  if (ml < nearLog) { nearLog = ml; nearUv = c - vec2(o.x, 0.0); }
  if (mr < nearLog) { nearLog = mr; nearUv = c + vec2(o.x, 0.0); }
  if (bl < nearLog) { nearLog = bl; nearUv = c - o; }
  if (bc < nearLog) { nearLog = bc; nearUv = c - vec2(0.0, o.y); }
  if (br < nearLog) { nearLog = br; nearUv = c + vec2(o.x, -o.y); }
  nearDepth = exp2(nearLog) - 1.0;
  // Second differences, not the Sobel magnitude: the ground at a grazing angle is a steep but
  // smooth ramp in depth, and first-order Sobel would ink it solid. Silhouettes and overlaps
  // are steps, which second differences catch; planes are nearly straight lines, which they ignore.
  float lap = max(
    max(abs(ml + mr - 2.0 * cc), abs(tc + bc - 2.0 * cc)),
    0.7 * max(abs(tl + br - 2.0 * cc), abs(tr + bl - 2.0 * cc))
  );
  return smoothstep(uEdge.y, uEdge.z, lap) * uEdge.x;
}

// 飞白: the brush runs dry in hairline streaks along the stroke.
float dryBrush(vec2 uv, vec2 grad) {
  vec2 n = grad / max(length(grad), 1e-4);
  vec2 px = uv * resolution / uPixelRatio;
  float across = dot(px, n);
  float along = dot(px, vec2(-n.y, n.x));
  float s = vnoise2(vec2(across * 0.9, along * 0.035));
  return mix(0.55, 1.0, smoothstep(0.25, 0.75, s));
}

// One finale belt: paper over everything lower than its ragged top within its band of z.
float finaleBelt(vec3 wp, float z, float w, float top, float n) {
  float across = 1.0 - smoothstep(0.6 * w, w, abs(wp.z - z + (n - 0.5) * w * 0.8));
  float t = top * (0.78 + 0.44 * n);
  return across * (1.0 - smoothstep(t - 0.45 * top, t, wp.y));
}

// The finale's painting mist (design §8.7 E2): the walk seen as one hanging scroll. Recession by
// distance (近浓远淡), four belts of paper between its layers, and a sea of cloud under the ledge,
// so the drop reads as one dark lip over blank paper instead of a grey cliff.
float finaleMist(vec3 wp, float dist) {
  float aerial = uFinaleMist.x * (1.0 - exp(-uFinaleMist.y * max(dist - uFinaleMist.w, 0.0)));
  vec3 q = wp - uDrift;
  float n = vnoise3(q * vec3(0.03, 0.1, 0.045)) * 0.65 + vnoise3(q * vec3(0.09, 0.2, 0.09) + 7.3) * 0.35;
  float b = max(
    max(finaleBelt(wp, uBeltZ.x, uBeltW.x, uBeltTop.x, n), finaleBelt(wp, uBeltZ.y, uBeltW.y, uBeltTop.y, n)),
    max(finaleBelt(wp, uBeltZ.z, uBeltW.z, uBeltTop.z, n), finaleBelt(wp, uBeltZ.w, uBeltW.w, uBeltTop.w, n))
  );
  // At the ledge the face keeps a thin, ragged dark lip, then dissolves; the lowland (uLedge.y) is
  // cloud. The edge wanders up to 1.3 m north of ledgeZ (layout.ledgeWobble), hence the early start.
  float beyond = smoothstep(uLedge.x + 1.8, uLedge.x - 0.4, wp.z);
  float lipY = -0.05 - 0.25 * n;
  float drop = beyond * max(1.0 - smoothstep(lipY - 0.35, lipY, wp.y), step(wp.y, uLedge.y + 1.0));
  return 1.0 - (1.0 - aerial) * (1.0 - uFinaleMist.z * b) * (1.0 - drop);
}

// On the walk the forest floor and the trunk bases dissolve past the first few trees, under a
// ragged top about 3 m up, so the far forest hangs from its canopy over blank paper (留白). The
// canopy a few trees back goes into a patchy haze too, so the crowns overhead read as a near dark
// layer over paler ones, not one busy ceiling; the nearest crowns keep their ink.
float understorey(vec3 wp, float dist) {
  if (uUnder.x <= 0.0) return 0.0;
  vec3 q = wp - uDrift;
  float n = vnoise3(q * vec3(0.05, 0.15, 0.05)) * 0.7 + vnoise3(q * 0.17 + 3.1) * 0.3;
  float top = 3.1 + 2.6 * (n - 0.5);
  float floor_ = (1.0 - smoothstep(top - 2.6, top, wp.y)) * smoothstep(uUnder.z, uUnder.w, dist);
  float canopy = smoothstep(5.5, 9.0, wp.y + 3.0 * (n - 0.5)) * smoothstep(16.0, 48.0, dist) * smoothstep(0.3, 0.75, n) * 0.6;
  return uUnder.x * uUnder.y * max(floor_, canopy);
}

// Paper over a surface at `wp`, `dist` metres from the eye: the walk's fog, or in the finale the
// painting mist plus whatever catch-up and dive fog the walk still adds (uFogBoost).
float sceneFog(vec3 wp, float dist) {
  float walk = 1.0 - (1.0 - inkFog(wp, dist)) * (1.0 - understorey(wp, dist));
  if (uFinale <= 0.0) return walk;
  float boost = inkFogAmount(uFogBoost, dist);
  float finale = 1.0 - (1.0 - finaleMist(wp, dist)) * (1.0 - boost);
  return mix(walk, finale, uFinale);
}

vec3 glint(vec3 col, vec2 uv, vec4 g, vec3 size, vec3 core, vec3 halo) {
  if (g.w <= 0.0) return col;
  // One depth tap at the glint's own pixel: hide it where the scene stands in front of it.
  float scene = -getViewZ(readDepth(g.xy));
  float vis = g.w * smoothstep(g.z - 0.75, g.z - 0.5, scene);
  if (vis <= 0.0) return col;
  float d = length((uv - g.xy) * resolution);
  float haloMask = exp(-(d * d) / max(size.y * size.y, 1e-3)) * size.z;
  // The flame body: a tight ring of the halo colour at near full strength around the core. On
  // paper the pale core alone barely reads; with it, the glint is a 3 px amber point.
  float ring = size.x + 1.5 * uPixelRatio;
  float flameMask = exp(-(d * d) / (ring * ring)) * 0.85;
  float coreMask = 1.0 - smoothstep(size.x * 0.6 - 0.6, size.x * 0.6 + 0.6, d);
  col = mix(col, halo, clamp(max(haloMask, flameMask) * vis, 0.0, 1.0));
  return mix(col, core, clamp(coreMask * vis, 0.0, 1.0));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  // Interior flag (design.md §7.3.1): the hall writes alpha 0 and keeps its own look.
  bool interior = inputColor.a < 0.5;

  if (!interior) {
    // Only the cleared depth is sky. With near 0.1 m and far 600 m, 0.9999 is already 370 m out,
    // which would paint the far ridge ring as sky.
    bool sky = depth >= 0.9999999;
    vec3 vp = viewPosition(uv, depth);
    vec3 camPos = uCamWorld[3].xyz;
    float fog = 1.0;
    float dist = 1e4;
    if (!sky) {
      vec3 wp = (uCamWorld * vec4(vp, 1.0)).xyz;
      dist = length(vp);
      fog = sceneFog(wp, dist);
    }
    col = mix(col, uPaper, fog);

    vec4 paper = texture2D(uGrain, uv * resolution * uGrainScale);
    vec4 wash = texture2D(uGrain, uv * resolution * uGrainScale * 0.37 + 0.5);

    // Ink ramp in sRGB luma, normalised to paper. Saturated pixels (lantern, cyan, cinnabar) bypass it.
    vec3 s = linearToSrgb(col);
    float mx = max(s.r, max(s.g, s.b));
    float mn = min(s.r, min(s.g, s.b));
    float accent = smoothstep(0.12, 0.3, (mx - mn) / max(mx, 1e-3));
    float t = clamp(srgbLuma(s) / uPaperLuma + (wash.b - 0.5) * uBleed * 2.0, 0.0, 1.0);
    t = mix(t, bandRamp(t, mix(0.05, 0.006, uFlatten)), max(uBands, uFlatten));
    vec3 inked = texture2D(uRamp, vec2(t, 0.5)).rgb;
    col = mix(col, mix(inked, col, accent), uInkMix);
    // Deep in the forest the far mist is paper-shade, not paper (§8.2). After the ramp, which would
    // grey the warm shade into 清.
    col *= mix(vec3(1.0), uShadeRatio, uFogTint * fog * smoothstep(uFogTintDist.x, uFogTintDist.y, dist) * uInkMix);

    if (uEdges > 0.5) {
      float nearDepth;
      vec2 nearUv;
      vec2 grad;
      float edge = inkEdge(uv, nearDepth, nearUv, grad);
      if (edge > 0.001) {
        // Fade the line by the fog at the surface it belongs to (the nearest tap), not at this pixel,
        // so the sky side of a silhouette is inked as strongly as the tree side.
        vec3 nearVp = vp * (nearDepth / max(-vp.z, 1e-3));
        vec3 nearWp = (uCamWorld * vec4(nearVp, 1.0)).xyz;
        float nearFog = sceneFog(nearWp, distance(nearWp, camPos));
        // A mist plane writes no depth: a pad it has washed to paper still has its silhouette in
        // the depth buffer. Don't outline surfaces that already read as paper.
        float veiled = smoothstep(0.8, 0.95, srgbLuma(linearToSrgb(texture2D(inputBuffer, nearUv).rgb)) / uPaperLuma);
        float dry = uWobble > 0.0 ? dryBrush(uv, grad) : 1.0;
        // Near trees are outlined (骨法), far ones are washes (没骨); in between the line breaks up.
        float far = smoothstep(uEdgeFalloff.x, uEdgeFalloff.y, nearDepth);
        float weight = mix(1.0, uEdgeFalloff.z, far);
        vec2 gn = grad / max(length(grad), 1e-4);
        vec2 px = uv * resolution / uPixelRatio;
        float gaps = smoothstep(0.3, 0.62, vnoise2(vec2(dot(px, gn) * 0.04, dot(px, vec2(-gn.y, gn.x)) * 0.02) + 5.7));
        weight *= mix(1.0, gaps, uEdgeFalloff.w * smoothstep(0.0, 0.5, far));
        col = mix(col, uInk, edge * weight * (1.0 - nearFog) * (1.0 - veiled) * dry * uInkMix);
      }
    }

    col *= 1.0 + dot(paper.rgb - 0.5, uGrainAmp);
    float r = length((uv - 0.5) * 2.0);
    col *= mix(vec3(1.0), uShadeRatio, smoothstep(0.75, 1.45, r) * uVignette);
  }

  // Glints go on after fog, so the mist cannot erase them.
  col = glint(col, uv, uGlint0, uGlint0Size, uGlint0Core, uGlint0Halo);
  col = glint(col, uv, uGlint1, uGlint1Size, uGlint1Core, uGlint1Halo);

  // The first frame develops like ink soaking into paper: the darkest ink lands first.
  if (uReveal > 0.0) {
    float lum = srgbLuma(linearToSrgb(col)) / uPaperLuma;
    vec2 px = uv * resolution / uPixelRatio;
    float n = vnoise2(px / 36.0) * 0.65 + vnoise2(px / 7.0 + 11.3) * 0.35;
    float m = smoothstep(uReveal - 0.05, uReveal + 0.05, (1.0 - lum) + n * 0.3);
    col = mix(uPaper, col, m);
  }

  col = paperDissolve(col, uv, uDive, aspect, uTime, uPaper, uPaperLight);
  col = ditherSrgb(col, uv * resolution, 1.0 + 0.5 * uFlatten);
  // Opaque from here on. three always creates an alpha canvas (alpha: false is only emulated by
  // the clear), so a leftover interior alpha of 0 would composite additively over the page.
  outputColor = vec4(col, 1.0);
}
