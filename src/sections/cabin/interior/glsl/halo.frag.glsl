uniform float uGain;
varying vec2 vCorner;
varying vec3 vWorld;
varying float vGain;
varying float vArrive;

void main() {
  float r2 = dot(vCorner, vCorner);
  float a = exp(-r2 * 4.0) * (1.0 - smoothstep(0.7, 1.0, r2));
  float lit = vArrive < 0.0 ? 1.0 : ignited(vArrive);
  vec3 col = uCyan * a * uGain * vGain * lit * (1.0 - nightFog(distance(cameraPosition, vWorld)));
  gl_FragColor = vec4(col, 0.0);
}
