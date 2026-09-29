// Line work and small emissive meshes. aColor: lit colour (linear, may exceed 1 to bloom);
// aArrive: ignition arrival in seconds (negative = always lit); aIdle: brightness before
// ignition, in cyan-ghost; aAlong: distance along a wire for pulses (negative = none).
attribute vec3 aColor;
attribute float aArrive;
attribute float aIdle;
attribute float aAlong;
varying vec3 vColor;
varying vec3 vWorld;
varying float vArrive;
varying float vIdle;
varying float vAlong;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vColor = aColor;
  vWorld = world.xyz;
  vArrive = aArrive;
  vIdle = aIdle;
  vAlong = aAlong;
  gl_Position = projectionMatrix * viewMatrix * world;
}
