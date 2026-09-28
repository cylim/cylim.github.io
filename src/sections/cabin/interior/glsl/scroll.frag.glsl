// A hanging scroll (立轴) of light (design.md §8.4 I2). Additive: cyan-line at 6% fill, edge glow at
// the mount's border and round the image core, faint silk weave, and the image core as a duotone
// from night to cyan. The mount is revealed from the top rod down as it unrolls.
uniform sampler2D uImage;
// Image core UV transform (cover fit): scale xy, offset zw.
uniform vec4 uImageFit;
uniform float uUnroll;
uniform float uFocusOne;
// Mount layout in metres from the top: rod, top margin end, core end, text zone end, mount end.
uniform vec4 uRows;
uniform float uMountEnd;
uniform vec2 uSize;
uniform float uCoreInset;
varying vec2 vUv;
varying vec3 vWorld;

float edgeGlow(float d, float width) {
  return exp(-max(d, 0.0) / width);
}

void main() {
  float x = vUv.x * uSize.x;
  float y = (1.0 - vUv.y) * uSize.y;
  float reveal = uRows.x + uUnroll * (uMountEnd - uRows.x);
  if (y < uRows.x || y > reveal) discard;

  float dOuter = min(min(x, uSize.x - x), min(y - uRows.x, uMountEnd - y));
  bool inCore = x > uCoreInset && x < uSize.x - uCoreInset && y > uRows.y && y < uRows.z;
  float dCore = min(min(abs(x - uCoreInset), abs(uSize.x - uCoreInset - x)), min(abs(y - uRows.y), abs(y - uRows.z)));
  if (y < uRows.y - 0.02 || y > uRows.z + 0.02) dCore = 1.0;
  float dBand = abs(y - uRows.w);

  vec3 col = uCyan * 0.06;
  col += uCyan * 0.9 * edgeGlow(dOuter, 0.008);
  col += uCyan * 0.7 * edgeGlow(dCore, 0.005);
  col += uCyan * 0.25 * edgeGlow(dBand, 0.003) * step(uCoreInset, x) * step(x, uSize.x - uCoreInset);
  // Silk weave, faded out once the threads are finer than a pixel.
  float wy = y * 220.0;
  float fw = fwidth(wy);
  col += uCyan * 0.04 * (0.5 + 0.5 * sin(wy * 6.2832)) * (1.0 - smoothstep(0.35, 0.9, fw));

  if (inCore) {
    vec2 cuv = vec2((x - uCoreInset) / (uSize.x - 2.0 * uCoreInset), 1.0 - (y - uRows.y) / (uRows.z - uRows.y));
    vec3 img = texture2D(uImage, cuv * uImageFit.xy + uImageFit.zw).rgb;
    float lum = dot(img, vec3(0.2126, 0.7152, 0.0722));
    col += uCyan * 0.95 * smoothstep(0.06, 0.9, lum);
  }

  // The glowing edge where the mount is still coming off the roller.
  col += uBright * 1.4 * edgeGlow(reveal - y, 0.01) * step(uUnroll, 0.999);
  col *= 1.0 + 0.3 * uFocusOne;
  col *= 1.0 - nightFog(distance(cameraPosition, vWorld));
  gl_FragColor = vec4(col, 0.0);
}
