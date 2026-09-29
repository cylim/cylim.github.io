// The lantern flame (design.md §8.7 E1): a quad that turns about Y to face the camera, standing on
// the wick. uLean bends the tip toward the signpost board whose contact row is hovered.
uniform vec3 uCentre;
uniform vec2 uSize;     // width, height in metres (the breath scales the height)
uniform vec3 uLean;     // world offset of the tip, metres

varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 toCam = cameraPosition - uCentre;
  toCam.y = 0.0;
  toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  // The wick sits 30% up the quad, so the flame's belly is at the layout's flame point.
  vec3 wp = uCentre + right * (uv.x - 0.5) * uSize.x + vec3(0.0, (uv.y - 0.3) * uSize.y, 0.0);
  wp += uLean * uv.y * uv.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
