// Night-shell stars (aDrift 0) and hall dust (aDrift 1). aSeed: four random numbers per point.
attribute float aSize;
attribute vec4 aSeed;
uniform float uMotionTime;
uniform float uPointScale;
uniform float uDrift;
varying float vFade;
varying vec3 vWorld;
varying float vSeed;

void main() {
  vec3 p = position;
  float fade = 1.0;
  if (uDrift > 0.5) {
    // Dust rises through the hall in slow curls and wraps from the ceiling back to the floor.
    float t = uMotionTime * (0.05 + 0.07 * aSeed.x);
    p.y = 0.5 + mod(position.y - 0.5 + t, 6.5);
    p.x += 0.3 * sin(t * 3.1 + aSeed.y * 6.2832);
    p.z += 0.3 * cos(t * 2.3 + aSeed.z * 6.2832);
    fade = smoothstep(0.5, 1.4, p.y) * smoothstep(7.0, 5.6, p.y);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  vFade = fade;
  vSeed = aSeed.w;
  gl_PointSize = clamp(aSize * uPointScale / -mv.z, 1.0, 6.0);
  gl_Position = projectionMatrix * mv;
}
