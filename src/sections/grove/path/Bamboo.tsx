import { useMemo, useRef } from 'react'
import { DoubleSide, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial, Sphere, Vector3, type InstancedMesh } from 'three'
import { TIERS } from '../../../core/render'
import { useJourney } from '../../../core/store/journey'
import { worldUniforms } from '../../../env'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import fragGlsl from './glsl/bamboo.frag.glsl'
import vertGlsl from './glsl/bamboo.vert.glsl'
import commonGlsl from './glsl/common.glsl'
import { BAMBOO_BOUNDS, bambooPlan } from './plan'

/** Sway at a culm's tip in metres: west, with the wind that drifts the mist. */
const WIND = new Vector3(0.06, 0, 0.012)
/** Segments along each stroke, so leaves and node marks can curl. */
const STROKE_SEGMENTS = 6

const attr = (values: number[], size: number) => new InstancedBufferAttribute(Float32Array.from(values), size)

function buildStrokes(): { geometry: PlaneGeometry; count: number } {
  const { culms, strokes } = bambooPlan()
  const geometry = new PlaneGeometry(1, 1, 1, STROKE_SEGMENTS)
  geometry.setAttribute('iA', attr(strokes.flatMap((s) => [...s.a]), 3))
  geometry.setAttribute('iAxis', attr(strokes.flatMap((s) => [...s.axis]), 3))
  geometry.setAttribute('iShape', attr(strokes.flatMap((s) => [s.width, s.bend, s.kind, s.ink]), 4))
  geometry.setAttribute(
    'iCulm',
    attr(
      strokes.flatMap((s) => {
        const c = culms[s.culm]
        return c ? [c.base[1], c.height, c.phase, s.seed] : [0, 1, 0, s.seed]
      }),
      4,
    ),
  )
  return { geometry, count: strokes.length }
}

function createBambooMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'bamboo',
    vertexShader: vertGlsl,
    fragmentShader: `${commonGlsl}\n${fragGlsl}`,
    uniforms: { ...worldUniforms, uWind: { value: WIND } },
    side: DoubleSide,
  })
}

/**
 * The bamboo clump (design.md §8.5 P1), medium and high tiers only: every stem segment, node mark,
 * twig and leaf is one instance of a camera-facing brush stroke, one draw call in all.
 */
export function Bamboo() {
  const shown = useJourney((s) => TIERS[s.tier].bamboo)
  const { geometry, count } = useMemo(() => buildStrokes(), [])
  const material = useMemo(() => createBambooMaterial(), [])
  // Strokes are placed by attributes, not instance matrices, so culling gets the clump's bounds.
  const bounds = useMemo(() => new Sphere(new Vector3(...BAMBOO_BOUNDS.centre), BAMBOO_BOUNDS.radius), [])
  // R3F disposes the instanced mesh itself on unmount, not the geometry and material it was built with.
  const mesh = useRef<InstancedMesh>(null)
  useDisposeOnUnmount(mesh, () => [geometry, material])
  return <instancedMesh ref={mesh} name="bamboo" args={[geometry, material, count]} boundingSphere={bounds} visible={shown} />
}
