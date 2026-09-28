// CircuitWood planks and posts (instanced).
// iUv: trace texture window, offset (xy) and scale (zw). iMeta: ignition delay (s), bob amplitude
// (m), bob phase, wood tone.
attribute vec4 iUv;
attribute vec4 iMeta;
uniform float uMotionTime;
varying vec2 vUv;
varying vec3 vWorld;
varying float vDelay;
varying float vTone;

void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  // Dissolving planks bob a few millimetres a second.
  world.y += iMeta.y * sin(uMotionTime * 0.45 + iMeta.z);
  world.x += iMeta.y * 0.6 * sin(uMotionTime * 0.31 + iMeta.z * 1.7);
  vUv = iUv.xy + uv * iUv.zw;
  vWorld = world.xyz;
  vDelay = iMeta.x;
  vTone = iMeta.w;
  gl_Position = projectionMatrix * viewMatrix * world;
}
