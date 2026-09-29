// The lantern flame: a noise-licked teardrop from lantern-core at the heart to lantern-flame at the
// edge, with a faint glow around it. Both colours are saturated, so the ink pass lets them through.
uniform vec3 uCore;
uniform vec3 uFlame;
uniform float uLevel;   // brightness 0.92..1.0 (breath and flicker)
uniform float uAlpha;   // fades out where the post glint takes over (> 25 m)
uniform float uTime;    // frozen under e2e, still under reduced motion

varying vec2 vUv;

void main() {
  float y = vUv.y;
  // Licks rise through the flame; they sway the tip more than the base.
  float lick = noise(vec2(vUv.x * 3.0, y * 2.5 - uTime * 1.6)) - 0.5;
  float x = vUv.x - 0.5 - lick * 0.16 * y;
  // Round below the belly (y 0.3), drawn to a point above it.
  float half_ = y < 0.3 ? 0.24 * sqrt(max(y / 0.3, 0.0)) : 0.24 * pow(max(1.0 - (y - 0.3) / 0.7, 0.0), 1.25);
  half_ *= 0.92 + 0.16 * noise(vec2(y * 6.0 - uTime * 2.3, 3.7));
  float ax = abs(x);
  float body = 1.0 - smoothstep(half_ * 0.7, half_ + 0.015, ax);
  float heart = (1.0 - smoothstep(half_ * 0.1, half_ * 0.6, ax)) * (1.0 - smoothstep(0.25, 0.6, y)) * step(0.05, y);
  vec2 g = vec2(x * 2.2, (y - 0.32) * 1.1);
  float glow = exp(-dot(g, g) / 0.05) * 0.3;

  vec3 col = mix(uFlame, uCore, clamp(heart * 1.2, 0.0, 1.0)) * uLevel;
  float a = clamp(body + glow * (1.0 - body), 0.0, 1.0) * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
