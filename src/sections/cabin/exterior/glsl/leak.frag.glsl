// The leak (design.md §8.3): the cabin's inside as one flat emissive cyan box, seen only through the
// plank gaps, the lattice and the gap under the door. Outdoor (alpha 1): its saturation keeps it out
// of the ink ramp, so it stays the first cold colour on the site.
uniform vec3 uColor;   // linear cyan-line
uniform float uLeak;   // 1 at rest, 1.4 while the door or lattice is hovered

void main() {
  gl_FragColor = vec4(min(uColor * uLeak, vec3(1.0)), 1.0);
  #include <colorspace_fragment>
}
