// 水纹, the stream as painters draw water (design.md §8.5 P1). The ground already leaves it as
// blank paper; this adds a few broken horizontal ink lines drifting west with the flow, eddy arcs
// hugging the upstream face of each stepping stone, and a faint wake below it.
uniform vec4 uStream;          // centre z, half width, flow offset along +X (m), ink amount
uniform vec4 uStones[STONES];  // x, z, radius, 0

varying vec3 vWorld;
varying vec2 vUv;

void main() {
  float x = vWorld.x;
  float dz = vWorld.z - uStream.x;
  // env ground.frag.glsl paints paper where |dz| + wobble < half width: stay just inside that bank.
  float bank = abs(dz) + (vnoise2(vec2(x * 0.8, 3.0)) - 0.5) * 0.2;
  float inside = 1.0 - smoothstep(uStream.y - 0.2, uStream.y - 0.07, bank);
  if (inside <= 0.0) discard;

  float fx = x - uStream.z;
  float cov = 0.0;
  for (int i = 0; i < LANES; i++) {
    float fi = float(i);
    float h = hash12(vec2(fi, 7.3));
    float lane = (mix(-0.74, 0.74, (fi + 0.5) / float(LANES)) + (h - 0.5) * 0.16) * uStream.y;
    // Seen at a grazing angle the swell is foreshortened about fourfold, so it is drawn deep.
    float wave = 0.07 * sin(fx * (1.1 + h) + fi * 2.3) + 0.02 * sin(fx * 3.4 + fi * 5.1);
    // Strokes of a metre or two with gaps; each swells and thins where the brush lands and lifts.
    float n = vnoise2(vec2(fx * 0.55 + fi * 17.1, fi * 3.9));
    float on = smoothstep(0.52, 0.72, n);
    cov = max(cov, inkLine(abs(dz - lane - wave), 0.012 * on));
  }

  for (int s = 0; s < STONES; s++) {
    vec4 st = uStones[s];
    vec2 p = vWorld.xz - st.xy;
    float r = length(p);
    float c = p.x / max(r, 1e-4); // 1 downstream (west), −1 upstream (east)
    float arc1 = inkLine(abs(r - st.z - 0.05), 0.011) * smoothstep(0.25, -0.45, c);
    float arc2 = inkLine(abs(r - st.z - 0.14), 0.009) * smoothstep(-0.25, -0.8, c);
    float wx = p.x - st.z * 0.5;
    float wake = inkLine(abs(abs(p.y) - (st.z * 0.6 + 0.22 * wx)), 0.008) * smoothstep(0.0, 0.1, wx) * (1.0 - smoothstep(0.25, 0.8, wx));
    cov = max(cov, max(max(arc1, arc2), wake));
  }

  cov *= inside;
  if (cov < 0.004) discard;
  gl_FragColor = vec4(inkColor(uStream.w), cov);
  #include <colorspace_fragment>
}
