// A flat colour with the night fade (the moon gate's rim).
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  gl_FragColor = vec4(mix(uColor, uNight, nightFog(distance(cameraPosition, vWorld))), 0.0);
}
