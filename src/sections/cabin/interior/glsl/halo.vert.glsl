// Low tier's stand-in for bloom: camera-facing soft discs. aCentre is the glow's centre, the
// geometry's position.xy is the corner (-1..1), aSize the radius in metres.
attribute vec3 aCentre;
attribute float aSize;
attribute float aGain;
attribute float aArrive;
varying vec2 vCorner;
varying vec3 vWorld;
varying float vGain;
varying float vArrive;

void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(aCentre, 1.0);
  mv.xy += position.xy * aSize;
  vCorner = position.xy;
  vWorld = (modelMatrix * vec4(aCentre, 1.0)).xyz;
  vGain = aGain;
  vArrive = aArrive;
  gl_Position = projectionMatrix * mv;
}
