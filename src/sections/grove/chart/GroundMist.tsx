import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Color, DoubleSide, Group, Mesh, RingGeometry, ShaderMaterial } from 'three'
import { TIERS, motionTime } from '../../../core/render'
import { journey } from '../../../core/store/journey'
import { beatSpanById } from '../../../core/world/journey'
import { grove } from '../../../core/world/layout'
import { color } from '../../../theme/tokens'
import { useDisposeOnUnmount } from '../../shared/lifetime'

/**
 * The grove's ground mist (design.md §8.6): a band of paper below y 0.4 in drifting fbm, thinning to
 * nothing inside r 11 so the chart seems to hold it back. It clears during G2 so the plan view is
 * clean, and returns for the glide out (G4). Low tier draws one layer, medium two, high three.
 */

const vert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const frag = /* glsl */ `
uniform vec3 uPaper;
uniform vec2 uCentre;
uniform vec2 uClear;
uniform float uOuter;
uniform float uTime;
uniform float uOpacity;
uniform float uSeed;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void main() {
  float r = distance(vWorld.xz, uCentre);
  float band = smoothstep(uClear.x, uClear.y, r) * (1.0 - smoothstep(uOuter - 8.0, uOuter, r));
  vec2 drift = vec2(uTime * 0.05, uTime * 0.018);
  float n = fbm(vWorld.xz * 0.16 + drift + uSeed);
  float a = band * smoothstep(0.3, 0.72, n) * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uPaper, a);
  #include <colorspace_fragment>
}`

const LAYERS = [
  { y: 0.14, opacity: 0.55, seed: 0 },
  { y: 0.27, opacity: 0.4, seed: 7.3 },
  { y: 0.38, opacity: 0.28, seed: 13.9 },
] as const

const G2 = beatSpanById('G2').jvh
const G4 = beatSpanById('G4').jvh
const OUTER = grove.oldPines.r1 + 2

export function GroundMist() {
  const { group, materials, geometry } = useMemo(() => {
    const geo = new RingGeometry(grove.groundMist.clearInside - 1.5, OUTER, 96, 1)
    geo.rotateX(-Math.PI / 2)
    const g = new Group()
    g.name = 'grove-ground-mist'
    g.position.set(grove.centre[0], 0, grove.centre[2])
    const mats = LAYERS.map((l, i) => {
      const mat = new ShaderMaterial({
        name: 'grove-ground-mist',
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uPaper: { value: new Color(color.paper) },
          uCentre: { value: [grove.centre[0], grove.centre[2]] },
          uClear: { value: [grove.groundMist.clearInside - 1, grove.groundMist.clearInside + 2.5] },
          uOuter: { value: OUTER },
          uTime: { value: 0 },
          uOpacity: { value: l.opacity },
          uSeed: { value: l.seed },
        },
      })
      const m = new Mesh(geo, mat)
      m.position.y = l.y
      m.renderOrder = 4 + i
      m.raycast = () => undefined
      g.add(m)
      return mat
    })
    return { group: g, materials: mats, geometry: geo }
  }, [])

  useDisposeOnUnmount(group, () => [geometry, ...materials])

  useFrame((state) => {
    const s = journey.getState()
    const clear = Math.min(1, Math.max(0, (s.jvh - G2[0]) / (G2[1] - G2[0])))
    const back = Math.min(1, Math.max(0, (s.jvh - G4[0]) / (G4[1] - G4[0])))
    const fade = Math.max(1 - clear, back)
    const layers = TIERS[s.tier].mistPlanes >= 4 ? 3 : TIERS[s.tier].mistPlanes >= 3 ? 2 : 1
    const time = motionTime(state.clock.elapsedTime, s)
    materials.forEach((m, i) => {
      const mesh = group.children[i]
      const on = i < layers && fade > 0.001
      if (mesh && mesh.visible !== on) mesh.visible = on
      if (m.uniforms.uTime) m.uniforms.uTime.value = time
      if (m.uniforms.uOpacity) m.uniforms.uOpacity.value = (LAYERS[i]?.opacity ?? 0) * fade
    })
  })

  return <primitive object={group} />
}
