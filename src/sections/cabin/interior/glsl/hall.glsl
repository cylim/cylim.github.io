// Shared by every hall shader (design.md §7.4, §8.4). The uniforms live in hallUniforms.ts and are
// the same objects in every material, so one write per frame reaches the whole hall.

// Stands still under reduced motion and in e2e (core/render motionTime).
uniform float uMotionTime;
uniform vec3 uNight;
uniform float uFogDensity;
// Seconds into the full-length (2.5 s) ignition; below 0 before it, large once it is done.
uniform float uIgnite;
uniform vec3 uIgniteOrigin;
uniform float uPulseOn;
uniform vec4 uFocus;
uniform vec3 uScrollAnchor[4];
uniform vec3 uCyan;
uniform vec3 uGhost;
uniform vec3 uBright;

// The interior's own exp² fade to night at 0.030 (the ink pass never fogs the hall).
float nightFog(float dist) {
  float d = uFogDensity * dist;
  return 1.0 - exp(-d * d);
}

// Ignition front along the floor: 12 m/s for the first 12 m, then faster so the far end still
// lights inside 2.5 s.
float igniteArrival(vec3 p) {
  float d = distance(p.xz, uIgniteOrigin.xz);
  return d < 12.0 ? d / 12.0 : 1.0 + (d - 12.0) / 30.0;
}

float ignited(float arrival) {
  return smoothstep(arrival, arrival + 0.3, uIgnite);
}

// How strongly the traces near a hovered or focused scroll answer it.
float focusNear(vec3 p) {
  float f = 0.0;
  for (int i = 0; i < 4; i++) f = max(f, uFocus[i] * smoothstep(3.6, 0.8, distance(p.xz, uScrollAnchor[i].xz)));
  return f;
}
