// The lantern's light pool on the ground (design.md §8.7 E1): lantern-halo at 35% under the flame,
// feathering out like a wash soaking into paper. No light is involved; it is a stain.
uniform vec3 uColor;
uniform float uOpacity;   // 0.35 at the design strength, times the flame's breath

varying vec2 vUv;

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  vec2 dir = normalize(p + vec2(1e-5, 0.0));
  // The edge wanders a little, as a wash does.
  float edge = 0.82 + 0.18 * noise(dir * 1.8 + 2.0);
  float r = length(p) / edge;
  float a = pow(1.0 - smoothstep(0.05, 1.0, r), 1.6) * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
