// A single brush mark in ink: dots are ragged dabs (点苔); strokes taper and break up toward the
// tip like a drying brush (飞白). Opaque with discard, so they sit in depth like everything else.
varying vec2 vUv;
varying float vInk;
varying float vSeed;
varying vec3 vWorld;

void main() {
#ifdef STROKE_DOT
  vec2 q = vUv - 0.5;
  float r = length(q * vec2(1.0, 1.25));
  float edge = 0.4 + 0.12 * (vnoise2(q * 7.0 + vSeed * 31.0) - 0.5);
  if (r > edge) discard;
  float ink = vInk;
#else
  float dry = vnoise2(vec2(vUv.x * 2.0 + vSeed * 17.0, vUv.y * 11.0));
  if (dry < 0.12 + 0.55 * vUv.y * vUv.y) discard;
  float ink = vInk * mix(1.0, 0.75, vUv.y);
#endif
  vec3 col = inkColor(ink);
  col = applyLantern(col, vWorld, vec3(0.0, 1.0, 0.0));
  col = applySpill(col, vWorld, vec3(0.0, 1.0, 0.0));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
