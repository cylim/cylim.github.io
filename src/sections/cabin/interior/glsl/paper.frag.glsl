// The one sheet of paper on the desk, with the 朱文 林 seal in its corner. Both colours arrive
// pre-compensated for the cabin's AgX grade, so the seal is exact cinnabar (design.md §2.5).
uniform vec3 uPaper;
uniform vec3 uCinnabar;
uniform sampler2D uSeal;
// Sheet size (m), seal centre (sheet UV), seal side (m) and resting angle (radians).
uniform vec2 uSheet;
uniform vec2 uSealCentre;
uniform float uSealSize;
uniform float uSealRot;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  float fibre = 0.94 + 0.06 * vnoise2(vUv * vec2(90.0, 60.0)) * vnoise2(vUv * vec2(7.0, 21.0));
  vec3 col = uPaper * fibre;
  vec2 d = (vUv - uSealCentre) * uSheet;
  float c = cos(uSealRot);
  float s = sin(uSealRot);
  vec2 suv = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / uSealSize + 0.5;
  // 朱文 strokes are thin; seen from the I3 seat, mip levels would thin them to pink.
  if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) col = mix(col, uCinnabar, min(1.0, texture2D(uSeal, suv).a * 1.7));
  col = mix(col, uNight, nightFog(distance(cameraPosition, vWorld)));
  gl_FragColor = vec4(col, 0.0);
}
