// Plain world-space vertex stage for the stream and the veils. uLift raises a veil like a curtain.
uniform float uLift;

varying vec3 vWorld;
varying vec2 vUv;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += uLift;
  vWorld = wp.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
