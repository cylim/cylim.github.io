// Bamboo strokes in ink (墨竹): opaque with discard, so they sit in depth and take the ink pass's
// contours like every other silhouette. Flat tone, no light: a brush mark, not a lit tube.
varying vec2 vUv;
varying float vKind;
varying float vInk;
varying float vSeed;

const float PI = 3.14159265;

void main() {
  float u = vUv.x - 0.5;
  float v = clamp(vUv.y, 0.0, 1.0);
  float ink = vInk;
  float hw;
  if (vKind < 0.5) {
    // Stem segment: one even side-brush stroke, pressed a little at both ends, rounded where the
    // brush lands and lifts, with dry streaks (飞白) running along it.
    float e = abs(2.0 * v - 1.0);
    hw = 0.5 * (0.84 + 0.16 * pow(e, 6.0));
    float cap = smoothstep(0.9, 1.0, e);
    hw *= sqrt(max(1.0 - cap * cap, 0.0));
    if (abs(u) > hw) discard;
    float across = abs(u) / hw;
    float dry = vnoise2(vec2(u * 30.0 + vSeed * 13.0, v * 2.4 + vSeed * 5.0));
    if (dry < 0.24 * (1.0 - e) * smoothstep(0.05, 0.5, across)) discard;
    ink *= mix(0.86, 1.14, smoothstep(0.5, 1.0, across)) * mix(1.0, 1.18, pow(e, 5.0));
  } else if (vKind < 1.5) {
    // Leaf: pressed in at the root, full through the first third, drawn out to a sharp tip.
    hw = 0.5 * pow(max(sin(PI * pow(v, 0.6)), 0.0), 0.85);
    if (abs(u) > hw) discard;
    if (v > 0.7 && vnoise2(vec2(u * 40.0, v * 14.0 + vSeed * 31.0)) < (v - 0.7) * 1.5) discard;
    ink *= mix(1.05, 0.88, v);
  } else if (vKind < 2.5) {
    // Twig: thin, thinning toward its end.
    hw = 0.5 * mix(1.0, 0.45, v);
    if (abs(u) > hw) discard;
  } else {
    // Node mark: a short arc across the culm, full in the middle, tapering to both ends.
    hw = 0.5 * pow(max(sin(PI * v), 0.0), 0.6);
    if (abs(u) > hw) discard;
  }
  gl_FragColor = vec4(inkColor(ink), 1.0);
  #include <colorspace_fragment>
}
