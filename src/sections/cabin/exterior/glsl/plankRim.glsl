  // Leak-backed planks (rim attribute 1): the light in the gap above catches each face's top edge,
  // one pixel wide at any distance, so the line holds where the 6–10 mm gap itself is under a pixel,
  // hidden by the plank's own thickness, or aliased away without MSAA. Up close the real gap reads
  // and the edge light fades back.
  if (vRim > 0.5 && abs(n.y) < 0.5) {
    float perPx = max(fwidth(vUv.y), 1e-5);
    float edgePx = (1.0 - vUv.y) / perPx;
    float gapPx = 0.008 / (0.22 * perPx);
    float k = (1.0 - smoothstep(0.3, 1.1, edgePx)) * mix(0.8, 0.3, smoothstep(1.0, 2.5, gapPx));
    col = mix(col, min(uLeakColor * uLeak, vec3(1.0)), k);
  }
