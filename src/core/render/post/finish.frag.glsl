// Cabin finish (design.md §7.4): 2% mono grain, dither, and the fog-dive / moon-gate dissolve.
// Runs after Bloom and AgX. Prepended by FinishEffect.ts: noise.glsl, color.glsl, dissolve.glsl.

uniform sampler2D uGrain;
uniform float uGrainScale;
uniform vec2 uGrainOffset;   // jumps at 24 fps (film grain); fixed under reduced motion
uniform float uGrainAmt;     // 0.02 × postBlend
uniform float uDive;
uniform float uDither;
uniform float uTime;
uniform vec3 uPaper;
uniform vec3 uPaperLight;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  float g = texture2D(uGrain, uv * resolution * uGrainScale + uGrainOffset).r;
  col *= 1.0 + (g - 0.5) * 2.0 * uGrainAmt;
  // The dive colour is always paper, even into and out of the cabin (design.md §11.1).
  col = paperDissolve(col, uv, uDive, aspect, uTime, uPaper, uPaperLight);
  col = ditherSrgb(col, uv * resolution, uDither);
  // Opaque: the canvas has an alpha channel whatever the Canvas `gl.alpha` says (see ink.frag.glsl).
  outputColor = vec4(col, 1.0);
}
