// Prelude of the path shaders. The uniforms are env's worldUniforms, shared by reference: the world
// clock (frozen under e2e), the motion switch and the paper and ink colours. hash12 and vnoise2 are
// env's own (env/glsl/noise.glsl), so the ripples follow the bank wobble the ground shader paints.
uniform float uTime;
uniform float uMotion;
uniform vec3 uPaperColor;   // linear
uniform vec3 uPaperSrgb;
uniform vec3 uInkSrgb;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

// Ink amount (0 paper, 1 焦) to linear colour, mixed in sRGB like env's inkColor so tones land on
// the same steps of the ink pass's ramp.
vec3 inkColor(float ink) {
  return srgbToLinear(mix(uPaperSrgb, uInkSrgb, clamp(ink, 0.0, 1.0)));
}

// Coverage of a line of half width w at distance d, antialiased over a pixel. Lines thinner than a
// pixel fade out instead of breaking into dots.
float inkLine(float d, float w) {
  float aa = max(fwidth(d), 1e-5);
  return (1.0 - smoothstep(w - aa, w + aa, d)) * min(1.0, w / aa);
}
