// Chimney smoke (design.md §8.3): a ribbon turned to the camera about the vertical, rising from the
// chimney top, leaning downwind (west, +X, like the mist) and curling on slow noise. The mesh's
// origin is the chimney top; uv.y runs 0 at the chimney to 1 at the top.
uniform float uTime;
uniform float uMotion;
uniform float uHeight;

varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float v = uv.y;
  float t = uTime * uMotion;
  vec3 toCam = cameraPosition - base;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-5, 0.0, 0.0));
  float y = v * uHeight;
  // A slow S that grows with height, plus a smaller wobble travelling up the ribbon.
  float curl = sin(v * 4.2 - t * 0.35 + 0.6) * (0.2 + 0.8 * v) + (vnoise2(vec2(y * 0.8 - t * 0.5, 2.3)) - 0.5) * 0.4 * v;
  // Swells a little from the chimney mouth, then thins to a wisp.
  float width = 0.14 + 0.22 * sin(min(v * 1.6, 1.0) * 3.1416) * (1.0 - 0.5 * v);
  vec3 p = base + vec3(2.6 * v * v, y, 0.4 * v * v) + right * ((uv.x - 0.5) * width + curl);
  vUv = uv;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
