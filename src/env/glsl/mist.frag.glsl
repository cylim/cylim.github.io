// Mist planes (design §7.2): paper with drifting fBm alpha, never writing depth, so the ink pass
// still fogs whatever stands behind them by its own distance. Drifts west (+X) at 0.2 m/s.
uniform float uOpacity;
uniform float uScale;      // fBm frequency, 1/m
uniform float uThreshold;  // fBm level where mist starts; higher = patchier
uniform vec4 uRect;        // x0, x1, z0, z1 of the plane
uniform vec3 uRing;        // annulus: r0, r1, soft width (r1 = 0 for a rectangle)
uniform vec2 uRingCentre;
uniform vec4 uHoleA;       // x, z, clear radius, full radius (w = 0: none)
uniform vec4 uHoleB;
uniform vec2 uNearFade;    // camera distance where the mist starts and reaches full strength
uniform float uAboveOnly;  // 1: only seen from above the plane (fades out as the eye drops under it)

varying vec3 vWorld;

float hole(vec4 h, vec2 p) {
  return h.w > 0.0 ? smoothstep(h.z, h.w, distance(p, h.xy)) : 1.0;
}

void main() {
  vec2 p = vWorld.xz;
  float n = fbm2((p - vec2(0.2 * uTime * uMotion, 0.0)) * uScale);
  float a = smoothstep(uThreshold, uThreshold + 0.3, n);

  float border;
  if (uRing.y > 0.0) {
    float r = distance(vWorld.xz, uRingCentre);
    border = smoothstep(uRing.x, uRing.x + uRing.z, r) * (1.0 - smoothstep(uRing.y - uRing.z, uRing.y, r));
  } else {
    vec2 lo = p - uRect.xz;
    vec2 hi = uRect.yw - p;
    vec2 soft = (uRect.yw - uRect.xz) * 0.18;
    border = smoothstep(0.0, soft.x, min(lo.x, hi.x)) * smoothstep(0.0, soft.y, min(lo.y, hi.y));
  }
  border *= hole(uHoleA, p) * hole(uHoleB, p);
  // A horizontal plane veils everything above its own height, which near the camera draws a hard
  // line across every trunk. Fading it in with distance keeps the belt where painters put it: far off.
  a *= smoothstep(uNearFade.x, uNearFade.y, distance(vWorld, cameraPosition));
  a *= mix(1.0, smoothstep(vWorld.y - 1.0, vWorld.y + 3.0, cameraPosition.y), uAboveOnly);
  a *= border * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uPaperColor, a);
  #include <colorspace_fragment>
}
