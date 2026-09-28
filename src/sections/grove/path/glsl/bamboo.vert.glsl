// The bamboo clump's brush strokes (design.md §8.5 P1), one instance each. A stroke turns to face
// the camera about its own axis, so stems, twigs and leaves always read as marks of a brush.
// Node marks lie across the culm instead: there `iAxis` is the culm direction scaled to the mark.
attribute vec3 iA;      // start (world)
attribute vec3 iAxis;   // start → end
attribute vec4 iShape;  // full width, tip curl, kind (0 stem, 1 leaf, 2 twig, 3 node), ink
attribute vec4 iCulm;   // culm foot y, culm height, sway phase, seed

uniform float uTime;    // env's world clock (frozen under e2e)
uniform float uMotion;  // 0 with reduced motion
uniform vec3 uWind;     // sway at a culm's tip, metres (west, with the mist)

varying vec2 vUv;
varying float vKind;
varying float vInk;
varying float vSeed;

// The culm bends from its foot: nothing moves at the ground, the tip moves most.
vec3 culmSway(float y) {
  float s = clamp((y - iCulm.x) / iCulm.y, 0.0, 1.0);
  float t = uTime * 0.6 + iCulm.z;
  return uWind * s * s * (sin(t) + 0.35 * sin(t * 2.3 + 1.7)) * uMotion;
}

void main() {
  float kind = iShape.z;
  float u = uv.x - 0.5;
  float v = uv.y;
  vec3 a = iA + culmSway(iA.y);
  vec3 axis = iAxis;
  if (kind > 0.5 && kind < 1.5) {
    // Leaves flutter about their root, each out of step.
    float f = sin(uTime * 1.9 + iCulm.w * 40.0) * uMotion;
    axis += normalize(uWind + vec3(0.0, 1e-4, 0.0)) * f * 0.1 * length(axis);
  }
  vec3 dir = normalize(axis);
  vec3 toCam = normalize(cameraPosition - (a + axis * 0.5));
  vec3 side = cross(dir, toCam);
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);

  vec3 p;
  if (kind > 2.5) {
    float len = length(axis);
    float c = 2.0 * v - 1.0;
    p = a + side * (v - 0.5) * len + dir * (u * iShape.x + iShape.y * (1.0 - c * c));
  } else {
    p = a + axis * v + side * (u * iShape.x + iShape.y * v * v);
    // A stem segment follows the culm's bend along its length.
    if (kind < 0.5) p += culmSway(p.y) - culmSway(iA.y);
  }

  vUv = uv;
  vKind = kind;
  vInk = iShape.w;
  vSeed = iCulm.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
