// The ink world's only light (design.md §7.1). No three.js lights anywhere outdoors.
// Declares the shared world uniforms every env fragment shader uses; bodies must not redeclare them.
uniform float uTime;
uniform float uMotion;
uniform float uCunLevel;
uniform vec3 uLightDir;
uniform vec3 uPaperColor;   // linear
uniform vec3 uInkColor;     // linear
uniform vec3 uPaperSrgb;
uniform vec3 uInkSrgb;
uniform vec3 uLanternPos;
uniform vec3 uLanternColor;
uniform float uLanternRadius;
uniform float uLanternIntensity;
uniform vec3 uSpillPos;
uniform vec3 uSpillColor;
uniform float uSpillRadius;
uniform vec3 uSpillFacing;
uniform float uSpill;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

// Ink amount → colour. Mixed in sRGB, because the ink pass ramps on sRGB luma normalised to paper:
// ink 0.55 then lands near 重 as design §7.1 intends. A linear mix would read one or two inks paler.
vec3 inkColor(float ink) {
  return srgbToLinear(mix(uPaperSrgb, uInkSrgb, clamp(ink, 0.0, 1.0)));
}

// Wrapped Lambert against the painter's light.
float painterLam(vec3 n) { return dot(n, uLightDir) * 0.5 + 0.5; }

// Ink amount for a surface: 0 = paper, 1 = 焦. Lit faces carry 55% of the weight, shaded faces all of it.
float inkValue(float weight, float lam) { return weight * mix(1.0, 0.55, smoothstep(0.25, 0.85, lam)); }

// Faces turned toward a point light within `radius` tint toward `tint` by (1 − d/r)² × 0.35.
float glowAmount(vec3 wp, vec3 n, vec3 pos, float radius) {
  vec3 to = pos - wp;
  float d = length(to);
  float k = max(1.0 - d / radius, 0.0);
  return k * k * 0.35 * smoothstep(-0.15, 0.45, dot(n, to / max(d, 1e-3)));
}

vec3 applyLantern(vec3 col, vec3 wp, vec3 n) {
  float amt = glowAmount(wp, n, uLanternPos, uLanternRadius) * uLanternIntensity;
  if (amt <= 0.0) return col;
  vec3 c = mix(col, uLanternColor, amt);
  // The ink pass greys anything below its accent threshold (saturation 0.12 to 0.3, stack.md §5).
  // Within 6 m, lift lit faces to the halo's hue at that threshold so near trunks stay amber.
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / max(mx, 1e-4);
  float want = 0.34 * smoothstep(6.5, 5.5, distance(wp, uLanternPos));
  if (sat < want) {
    vec3 hue = uLanternColor / max(uLanternColor.r, max(uLanternColor.g, uLanternColor.b));
    float hueSat = 1.0 - min(hue.r, min(hue.g, hue.b));
    c = mx * mix(vec3(1.0), hue, want / hueSat);
  }
  return c;
}

vec3 applySpill(vec3 col, vec3 wp, vec3 n) {
  if (uSpill <= 0.0) return col;
  // Only in front of the door plane (the frame's back face is 7 cm behind it); the leaf, swung in
  // behind the plane, keeps a trace.
  float front = mix(0.12, 1.0, smoothstep(-0.16, -0.07, dot(wp - uSpillPos, uSpillFacing)));
  return mix(col, uSpillColor, glowAmount(wp, n, uSpillPos, uSpillRadius) * uSpill * front);
}
