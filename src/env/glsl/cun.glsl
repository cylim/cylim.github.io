// 皴 texture strokes (design.md §7.1). One helper, two brush modes:
//   CUN_AXE  (斧劈皴) short angular wedges, chopped down and to the side: rocks, the peak, stones, the ledge.
//   CUN_HEMP (披麻皴) long soft fibres running down the slope, broken like a dry brush: earth banks.
// `p` is in stroke units (metres / scale), x across the slope and y up it. Returns ink coverage 0..1.
#define CUN_AXE 0
#define CUN_HEMP 1

float cunAxe(vec2 p) {
  // Slant the lattice so the wedges read as chops, not tiles.
  const float c = 0.819, s = 0.574;
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * vec2(1.0, 2.4);
  float cov = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 g = q + float(k) * vec2(0.5, 0.37);
    vec2 cell = floor(g), f = fract(g);
    vec2 h = hash22(cell + float(k) * 19.7);
    float u = (f.x - 0.08) / 0.84;
    float halfW = mix(0.3, 0.0, u) * (0.55 + 0.45 * h.y);
    float v = f.y - 0.5 - (h.y - 0.5) * 0.3 + u * 0.14;
    float wedge = step(0.0, u) * step(u, 1.0) * (1.0 - smoothstep(halfW * 0.6, halfW, abs(v)));
    cov = max(cov, wedge * step(0.42, h.x));
  }
  return cov;
}

float cunHemp(vec2 p) {
  float x = p.x + 0.35 * sin(p.y * 0.9 + vnoise2(p * 0.3) * 4.0);
  float lane = floor(x * 2.2);
  float f = fract(x * 2.2) - 0.5;
  float w = 0.08 + 0.1 * hash12(vec2(lane, 3.1));
  float line = 1.0 - smoothstep(w * 0.6, w, abs(f));
  float breaks = smoothstep(0.35, 0.6, vnoise2(vec2(lane * 7.3, p.y * 0.6)));
  return line * breaks;
}

float cunStroke(vec2 p, const int mode) {
  return mode == CUN_AXE ? cunAxe(p) : cunHemp(p);
}

// Stroke coordinates on a surface: x runs across the slope, y up it (world metres).
vec2 cunCoords(vec3 wp, vec3 n) {
  vec3 t = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-4, 0.0, 0.0));
  return vec2(dot(wp, t), wp.y);
}
