// A sheet of mist across the path (design.md §8.5 P2–P3): blank paper in drifting fbm tatters,
// thickest low down, feathered at every edge. It dissolves as the camera walks into it, so passing
// through a sheet never pops. The curtain sheets rise past the crest (uLift, in the vertex stage).
uniform float uOpacity;
uniform float uSeed;

varying vec3 vWorld;
varying vec2 vUv;

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise2(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.9375;
}

void main() {
  // Drifts west with the wind that moves the post fog (postFx.wind, 0.2 m/s).
  vec2 q = vec2(vWorld.x - uTime * 0.2 * uMotion, vWorld.y) * vec2(0.2, 0.34) + uSeed * 37.0;
  float n = fbm(q);
  float body = smoothstep(0.3, 0.72, n);
  float y = vUv.y + (n - 0.5) * 0.25;
  float edge = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.45, 1.0, y)) * smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float near = smoothstep(0.8, 4.0, distance(vWorld, cameraPosition));
  float a = uOpacity * mix(0.35, 1.0, body) * edge * near;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uPaperColor, a);
  #include <colorspace_fragment>
}
