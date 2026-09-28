// The moon gate's paper mist (design.md §8.4 I4): bright paper that breathes, brightening as the
// camera closes in. The walk turns back into ink on the other side.
// Paper as AgX shows it untouched (far) and the exact paper token (near, where it blooms and the
// whiteout takes over). Far off it must not bloom: a warm halo would be a second warm light.
uniform vec3 uPaperFar;
uniform vec3 uPaper;
uniform float uNear;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec2 drift = vec2(uMotionTime * 0.025, uMotionTime * 0.01);
  // Two layers of mist drifting past each other, brighter toward the middle of the opening.
  float n = 0.6 * vnoise2(p * 2.2 + drift) + 0.4 * vnoise2(p * 5.1 - drift * 1.7);
  float r = length(p);
  float body = mix(0.78, 1.0, smoothstep(1.0, 0.2, r)) * (0.84 + 0.3 * n);
  vec3 paper = mix(uPaperFar, uPaper, uNear * uNear * uNear * 0.3);
  vec3 col = paper * body;
  col = mix(col, uNight, nightFog(distance(cameraPosition, vWorld)) * (1.0 - uNear));
  gl_FragColor = vec4(col, 0.0);
}
