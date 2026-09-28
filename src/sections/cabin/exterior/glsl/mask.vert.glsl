// The door-opening portal mask (drei <Mask>, stencil only). With uFull it covers the whole screen:
// the camera is about to pass through the doorway, or is already inside.
uniform float uFull;

void main() {
  gl_Position = uFull > 0.5 ? vec4(uv * 2.0 - 1.0, 0.0, 1.0) : projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
