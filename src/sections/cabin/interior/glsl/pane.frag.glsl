// The terminal pane (design.md §10.1): night glass at 88% with the log drawn on a canvas. The caret
// is a cyan-bright block that breathes over 1.2 s instead of blinking (steady under reduced motion,
// where the motion clock stands still).
uniform sampler2D uText;
// Caret rectangle in UV (min xy, max zw); max below min hides it.
uniform vec4 uCaret;
uniform float uGlass;
// 0 while the DOM terminal covers the pane: then only the glass shows.
uniform float uTextOn;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec4 t = texture2D(uText, vUv) * uTextOn;
  float caret = uTextOn * step(uCaret.x, vUv.x) * step(vUv.x, uCaret.z) * step(uCaret.y, vUv.y) * step(vUv.y, uCaret.w);
  float breathe = 0.675 + 0.325 * cos(uMotionTime * 6.2832 / 1.2);
  vec3 col = mix(uNight, t.rgb * 1.25, t.a);
  col = mix(col, uBright * 1.2, caret * breathe);
  col = mix(col, uNight, nightFog(distance(cameraPosition, vWorld)));
  gl_FragColor = vec4(col, max(uGlass, max(t.a, caret * breathe)));
}
