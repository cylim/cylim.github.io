// The signpost's board faces (design.md §8.7 E1): each board's brand mark and username cut into the
// wood and filled with ink, over dry-brush grain. No geometry is cut: the groove walls are lit from
// a normal derived from the blurred mask, so each stroke reads as incised. A hovered board lights
// with warm light over 250 ms, strongest at the end nearer the lantern.
uniform sampler2D uMap;   // r: ink fill, g: groove depth (the fill blurred), b: grain and weather
uniform vec2 uTexel;
uniform vec3 uLight;      // the painter's light, in the face's frame (the boards all look roughly north)
uniform vec3 uInk;
uniform vec3 uLit;
uniform vec3 uWarm;
uniform float uGrain;     // grain ink strength
uniform vec4 uRowV0;      // each board's glow band in v, bottom
uniform vec4 uRowV1;      // and top
uniform vec4 uGlow;       // 0..1 per board

varying vec2 vUv;

void over(inout vec3 c, inout float a, vec3 src, float srcA) {
  c = src * srcA + c * (1.0 - srcA);
  a = srcA + a * (1.0 - srcA);
}

float band(float v, float v0, float v1) {
  return step(v0, v) * step(v, v1);
}

void main() {
  vec4 m = texture2D(uMap, vUv);
  float hl = texture2D(uMap, vUv - vec2(uTexel.x, 0.0)).g;
  float hr = texture2D(uMap, vUv + vec2(uTexel.x, 0.0)).g;
  float hd = texture2D(uMap, vUv - vec2(0.0, uTexel.y)).g;
  float hu = texture2D(uMap, vUv + vec2(0.0, uTexel.y)).g;
  // Cut means lower, so the wall on the far side of a stroke from the light catches it.
  vec3 n = normalize(vec3((hr - hl) * 2.2, (hu - hd) * 2.2, 1.0));
  float bevel = clamp((dot(n, uLight) - uLight.z) * 3.0, -1.0, 1.0);

  // Each board's face covers only its own row of the atlas, so a hard band is enough.
  float warm = dot(uGlow, vec4(
    band(vUv.y, uRowV0.x, uRowV1.x),
    band(vUv.y, uRowV0.y, uRowV1.y),
    band(vUv.y, uRowV0.z, uRowV1.z),
    band(vUv.y, uRowV0.w, uRowV1.w)
  ));
  // The lantern stands west (+X, screen-right) of the signpost: the light falls harder on that end.
  warm *= mix(0.6, 1.0, vUv.x);
  warm = smoothstep(0.0, 1.0, warm);

  vec3 c = vec3(0.0);
  float a = 0.0;
  over(c, a, uWarm, warm * 0.6);
  over(c, a, uInk, m.b * uGrain * (1.0 - 0.5 * warm));
  over(c, a, mix(uLit, uWarm, warm), max(bevel, 0.0) * 0.6 * (1.0 - m.r));
  over(c, a, uInk, max(-bevel, 0.0) * 0.45 * (1.0 - m.r));
  over(c, a, uInk, m.r * 0.94);
  if (a < 0.002) discard;
  gl_FragColor = vec4(c / a, a);
  #include <colorspace_fragment>
}
