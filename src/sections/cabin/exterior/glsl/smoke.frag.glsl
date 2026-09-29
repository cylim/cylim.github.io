// Smoke in pale ink: opaque with discard, because the ink pass fogs by depth and a blended ribbon
// would fog away against the sky. The ink pass outlines it like a 勾云 cloud; the body is a pale
// wash of fibres that breaks into separate wisps as it rises.
uniform float uInk;

varying vec2 vUv;
varying vec3 vWorld;

void main() {
  float v = vUv.y;
  float t = uTime * uMotion;
  float across = abs(vUv.x - 0.5) * 2.0;
  // Ragged sides.
  float edge = 0.78 + 0.22 * (vnoise2(vec2(v * 14.0 - t * 0.4, vUv.x * 2.0 + 4.0)) - 0.5) * 2.0;
  if (across > edge * (1.0 - 0.35 * v)) discard;
  // Breaks along the ribbon: short gaps low down, whole missing lengths near the top.
  float gaps = vnoise2(vec2(v * 7.0 - t * 0.25, 1.3)) * 0.7 + vnoise2(vec2(v * 19.0 - t * 0.6, vUv.x * 3.0)) * 0.3;
  if (gaps < smoothstep(0.15, 1.0, v) * 0.75) discard;
  float fibre = vnoise2(vec2(vUv.x * 9.0, v * 4.0 - t * 0.15));
  float ink = uInk * mix(1.0, 0.6, v) * mix(0.85, 1.15, fibre);
  gl_FragColor = vec4(inkColor(ink), 1.0);
  #include <colorspace_fragment>
}
