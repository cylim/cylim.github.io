uniform sampler2D uTrace;
uniform vec3 uWoodDark;
uniform vec3 uWoodLight;
// The moon gate's opening in the back wall: centre xyz, radius.
uniform vec4 uGate;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDelay;
varying float vTone;

void main() {
  if (abs(vWorld.z - uGate.z) < 0.2 && distance(vWorld.xy, uGate.xy) < uGate.w) discard;
  vec4 t = texture2D(uTrace, vUv);
  float cover = t.r;
  // G is premultiplied by coverage so mip levels average the distance along the trace.
  float along = t.g / max(t.r, 0.04);
  float lit = ignited(igniteArrival(vWorld) + vDelay);
  float focus = focusNear(vWorld);
  float pulse = uPulseOn * lit * smoothstep(0.02, 0.0, abs(fract(along * 4.0 - uMotionTime * (0.3 + 0.45 * focus)) - 0.5));
  // Wood reads as near-black under the grade; only its grain shows.
  vec3 wood = mix(uWoodDark, uWoodLight, t.a * vTone) * 0.32;
  vec3 trace = mix(uGhost * 1.1, uCyan * (0.24 + 0.5 * focus), lit);
  vec3 col = wood * (1.0 - cover) + trace * cover * (1.0 + 4.0 * pulse) + uBright * t.b * mix(0.12, 0.45 + 0.6 * focus, lit);
  col = mix(col, uNight, nightFog(distance(cameraPosition, vWorld)));
  gl_FragColor = vec4(col, 0.0);
}
