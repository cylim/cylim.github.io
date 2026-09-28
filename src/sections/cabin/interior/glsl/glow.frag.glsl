uniform float uGain;
varying vec3 vColor;
varying vec3 vWorld;
varying float vArrive;
varying float vIdle;
varying float vAlong;

void main() {
  float lit = vArrive < 0.0 ? 1.0 : ignited(vArrive);
  float pulse = vAlong < 0.0 ? 0.0 : uPulseOn * smoothstep(0.035, 0.0, abs(fract(vAlong * 2.0 - uMotionTime * 0.5) - 0.5));
  vec3 col = mix(uGhost * vIdle, vColor * (1.0 + 2.5 * pulse), lit) * uGain;
  col *= 1.0 - nightFog(distance(cameraPosition, vWorld));
  gl_FragColor = vec4(col, 0.0);
}
