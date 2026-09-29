// Cyan light flooding out of the opening door onto the sill, the steps and the ground (design.md
// §8.3 C2). The strip geometry follows the steps; this cuts the trapezoid the doorway throws: as
// wide as the clear gap at the sill, spreading and fading with distance. Blended toward cyan
// rather than added: added light on paper only reads as white.
uniform vec3 uColor;
uniform float uAmount;  // 0 closed .. 1 open
uniform vec3 uDoor;     // east jamb x, west jamb x, door plane z
uniform float uClear;   // share of the doorway clear of the leaf, from the west jamb

varying vec3 vWorld;

void main() {
  float d = max(vWorld.z - uDoor.z, 0.0);
  float xa = mix(uDoor.y, uDoor.x, uClear) - d * 0.32;
  float xb = uDoor.y + d * 0.32;
  float soft = 0.03 + d * 0.12;
  float across = smoothstep(xa - soft, xa + soft, vWorld.x) * (1.0 - smoothstep(xb - soft, xb + soft, vWorld.x));
  float along = exp(-d * 0.55) * (1.0 - smoothstep(3.6, 4.4, d));
  float a = uAmount * across * along * 0.85;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
