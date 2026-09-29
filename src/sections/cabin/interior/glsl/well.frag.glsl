// The inkstone's well: black ink that faintly mirrors the terminal pane above it.
uniform sampler2D uReflect;
uniform vec3 uInk;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  if (dot(p, p) > 1.0) discard;
  vec4 r = texture2D(uReflect, vec2(vUv.x, 1.0 - vUv.y));
  vec3 col = uInk + r.rgb * r.a * 0.22 + uNight * 0.3;
  col = mix(col, uNight, nightFog(distance(cameraPosition, vWorld)));
  gl_FragColor = vec4(col, 0.0);
}
