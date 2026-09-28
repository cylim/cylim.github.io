uniform vec3 uTint;
varying float vFade;
varying vec3 vWorld;
varying float vSeed;

void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, r) * vFade;
  // A slow, faint shimmer so the shell reads as depth, not as a painted backdrop.
  float shimmer = 0.8 + 0.2 * sin(uMotionTime * (0.3 + vSeed) + vSeed * 40.0);
  vec3 col = uTint * a * shimmer * (1.0 - nightFog(distance(cameraPosition, vWorld)));
  gl_FragColor = vec4(col, 0.0);
}
