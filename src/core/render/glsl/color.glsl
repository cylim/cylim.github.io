// sRGB transfer helpers. The post chain works in linear light (HalfFloat buffers); tone decisions
// that must match the palette tokens (ramp lookup, accent test, dither) happen in sRGB.

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

vec3 srgbToLinear(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

// Rec. 709 luma on sRGB-encoded values: perceptual, and what the ink ramp stops are placed on.
float srgbLuma(vec3 s) {
  return dot(s, vec3(0.2126, 0.7152, 0.0722));
}

// Triangular dither of ±amp sRGB code values; hides banding in fog and night gradients.
vec3 ditherSrgb(vec3 linearColor, vec2 pixel, float amp) {
  float n = hash12(pixel) + hash12(pixel + 17.31) - 1.0;
  return srgbToLinear(linearToSrgb(linearColor) + n * amp / 255.0);
}
