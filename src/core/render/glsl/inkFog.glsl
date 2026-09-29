// Height + distance fog to paper (stack.md §5, design.md §7.2). Mist is blank paper (留白).
// Requires noise.glsl. The includer declares:
//   uniform vec4 uFog;       x density (beat fog × tier multiplier), y height falloff (1/m),
//                            z mist floor height (m), w patchiness 0..1 (density from 1 − w to 1 + w)
//   uniform float uFogBoost; lag fog + local boost + dive collapse, added to the density
//   uniform vec3 uDrift;     world-space offset of the drifting noise field (wind × time)
//   uniform vec2 uAerial;    x the most paper aerial perspective adds, y its rate (1/m)
//
// Two terms, because one exp² curve cannot do both jobs (issue H2). The ground mist is dense low
// down and thins with height, so tree bases dissolve and ridges rise out of it; its density is read
// at the surface, a painter's model rather than an integral along the ray. Aerial perspective then
// pales everything with distance but saturates, so a ridge 400 m out keeps its silhouette at 淡/清
// instead of fogging to paper the way a density floor under exp² does.

// Mist lies in banks with clear air between them, never as an even veil: two octaves of drifting
// noise, pushed toward their extremes, so some stands of trees are blank paper (留白) and the next
// ones stand clear.
float inkFogDensity(vec3 wp) {
  float h = max(wp.y - uFog.z, 0.0);
  vec3 q = wp - uDrift;
  float n = vnoise3(q * vec3(0.03, 0.06, 0.03)) * 0.7 + vnoise3(q * 0.09 + 11.7) * 0.3;
  float banks = smoothstep(0.22, 0.78, n) * 2.0 - 1.0;
  return uFog.x * exp(-uFog.y * h) * (1.0 + uFog.w * banks) + uFogBoost;
}

// exp² ground mist: 0 = clear, 1 = paper.
float inkFogAmount(float density, float dist) {
  float x = density * dist;
  return 1.0 - exp(-x * x);
}

float inkAerial(float dist) {
  return uAerial.x * (1.0 - exp(-uAerial.y * dist));
}

// Total paper over a surface at `wp`, `dist` metres from the eye.
float inkFog(vec3 wp, float dist) {
  float mist = inkFogAmount(inkFogDensity(wp), dist);
  return 1.0 - (1.0 - mist) * (1.0 - inkAerial(dist));
}
