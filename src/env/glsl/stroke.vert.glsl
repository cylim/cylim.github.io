// Instanced brush marks (grass, fern, moss dots), turned to face the camera about the vertical so
// they always read as strokes. The instance matrix carries only the root position.
attribute vec4 iShape;  // strokes: height, root width, tip curl, lean; dots: size, 0, 0, 0
attribute float iInk;
attribute float iSeed;

uniform float uTime;
uniform float uMotion;

varying vec2 vUv;
varying float vInk;
varying float vSeed;
varying vec3 vWorld;

void main() {
  vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 toCam = cameraPosition - root;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-5, 0.0, 0.0));
  float u = uv.x - 0.5;
  float v = uv.y;
#ifdef STROKE_DOT
  // A dab, facing the camera fully.
  vec3 up = normalize(cross(right, normalize(toCam)));
  vec3 p = root + (right * u + up * (v - 0.5)) * iShape.x;
#else
  float lean = iShape.w + sin(uTime * 0.9 + iSeed * 6.2831) * 0.05 * uMotion * v;
  float h = iShape.x;
  float w = iShape.y * (1.0 - v * 0.9);
  vec3 p = root + right * (u * w + sin(lean) * h * v + iShape.z * v * v) + vec3(0.0, cos(lean) * h * v, 0.0);
#endif
  vUv = uv;
  vInk = iInk;
  vSeed = iSeed;
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
