// Ink world surface (createInkMaterial). Attributes other than position/normal/uv are optional:
// missing ones read the material's defaultAttributeValues (ao 1, swayW 0, rim −1, iInk 1, iSeed 0).
attribute float ao;     // baked vertex AO, 1 open .. 0 occluded
attribute float swayW;  // sway weight, 0 rooted .. 1 pad tip
attribute float rim;    // −1 wood; ≥ 0 pad (a needle card when INK_NEEDLES)
attribute float iInk;   // per-instance ink weight multiplier
attribute float iSeed;  // per-instance seed 0..1
#ifdef INK_NEEDLES
attribute vec4 card;      // corner x, corner y (−1..1), atlas cell (+16 mirrored), tilt (radians)
attribute vec3 cardSize;  // half width, half height (m), seed 0..1
uniform vec2 uNeedleGrid; // atlas cells across, down
varying float vCardSeed;
varying float vHigh;
#endif

uniform float uTime;
uniform float uMotion;
uniform float uSwayAmp;

varying vec3 vWorld;
varying vec3 vNormalW;
varying vec3 vLocal;
varying vec2 vUv;
varying float vAO;
varying float vInk;
varying float vSeed;
varying float vRim;

void main() {
  mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
  vec4 wp = m * vec4(position, 1.0);
#ifdef INK_SWAY
  // Pads drift 1 to 2 cm at the tips on a 4 to 7 s period, each tree out of phase (design §7.1).
  float period = mix(4.0, 7.0, fract(iSeed * 7.13 + 0.37));
  float ph = uTime * 6.2831853 / period + iSeed * 6.2831853 + position.y * 0.12;
  wp.xz += vec2(sin(ph), cos(ph * 0.87 + 1.3)) * uSwayAmp * swayW * uMotion;
#endif
  vUv = uv;
#ifdef INK_NEEDLES
  vCardSeed = 0.0;
  // How far above and away the eye is: from the grove seat and the finale a crown is seen from
  // above and far off, where a painter lays a pale wash and lets the needle clusters carry it.
  vec3 toEye = cameraPosition - wp.xyz;
  float eyeDist = length(toEye);
  vHigh = smoothstep(0.05, 0.3, toEye.y / max(eyeDist, 1e-3)) * smoothstep(14.0, 36.0, eyeDist);
  if (rim >= 0.0) {
    // Open the card in the view plane, kept upright to the world (a painted pad is always seen
    // side-on); looking straight down it falls back to the screen's up so it never collapses.
    vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 level = vec3(0.0, 1.0, 0.0) - back * back.y;
    float l = length(level);
    vec3 up = normalize(mix(camUp, level / max(l, 1e-4), smoothstep(0.15, 0.45, l)));
    vec3 right = normalize(cross(up, back));
    float c = cos(card.w);
    float s = sin(card.w);
    vec2 k = vec2(c * card.x - s * card.y, s * card.x + c * card.y);
    // A pad a metre or two from the eye would fill the frame as a black splat: it draws back into
    // its twig instead (the grove seat, the close pass of pine B).
    float scale = length(m[0].xyz) * smoothstep(1.2, 3.2, distance(cameraPosition, wp.xyz));
    wp.xyz += (right * k.x * cardSize.x + up * k.y * cardSize.y) * scale;

    float code = floor(card.z + 0.5);
    float mirrored = step(15.5, code);
    float cell = code - 16.0 * mirrored;
    vec2 cellXY = vec2(mod(cell, uNeedleGrid.x), floor(cell / uNeedleGrid.x));
    // Atlas rows run top-down like the canvas they were painted on: v 0 is the top of a cell.
    vec2 local = vec2(mix(card.x, -card.x, mirrored) * 0.5 + 0.5, 0.5 - 0.5 * card.y);
    vUv = (cellXY + local) / uNeedleGrid;
    vCardSeed = cardSize.z;
  }
#endif
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(m) * normal);
  vLocal = position;
  vAO = ao;
  vInk = iInk;
  vSeed = iSeed;
  vRim = rim;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
