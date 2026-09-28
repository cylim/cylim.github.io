// Fog-dive dissolve (design.md §11.1, §11.2): a noise-thresholded front spreads paper from the
// centre of the frame outward. amount 0 = clear, 1 = solid paper-light (the dive peak).
// The moon gate runs the same function from scroll. Requires noise.glsl.

vec3 paperDissolve(vec3 col, vec2 uv, float amount, float aspect, float t, vec3 paper, vec3 paperLight) {
  if (amount <= 0.0) return col;
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  float n = vnoise2(q * 3.0 + vec2(t * 0.05, 0.0)) * 0.6 + vnoise2(q * 11.0 + 3.7) * 0.4;
  // The front starts just short of the centre and passes the farthest corner before amount = 1.
  float front = amount * 1.9 - 0.5;
  float m = smoothstep(-0.12, 0.12, front - r * 0.9 - (n - 0.5) * 0.5);
  vec3 target = mix(paper, paperLight, smoothstep(0.55, 1.0, amount));
  return mix(col, target, max(m, step(0.999, amount)));
}
