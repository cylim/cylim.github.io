import { useEffect, useMemo } from 'react'
import { BackSide, BoxGeometry, Color, MeshBasicMaterial, Shape, ShapeGeometry } from 'three'
import { journey } from '../store/journey'
import { color } from '../../theme/tokens'
import { markInterior } from './post/interior'
import { resetGlints, setGlint } from './post/glints'
import { Text } from 'troika-three-text'
import { TEXT_FONTS, textMaterial } from '../text/configure'

/**
 * Visual test bench for the render pipeline, loaded only with `?renderTest=…` (Stage.tsx):
 * - `1` (T0 view, jvh 0): ink boxes and cards from 4 m to 340 m (ridges behind the lantern), a flat ground, a corner trunk,
 *   ridge cards, a cyan box with the interior flag next to one without, a cinnabar box, both glints.
 * - `door` (C3 view, jvh 300): an ink wall with a doorway onto a 45 m interior hall; the hall
 *   must stay night and cyan, not fogged to paper.
 * - `cabin` (I1 view, jvh 345): interior only, cabin post group forced on (bloom, AgX, finish).
 */

const HDR_CYAN = new Color(color.cyanLine).multiplyScalar(2.4)

function ridgeGeometry(width: number, height: number, seed: number): ShapeGeometry {
  const s = new Shape()
  s.moveTo(-width / 2, 0)
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const x = -width / 2 + (width * i) / steps
    const f = i / steps
    const y = height * (0.45 + 0.35 * Math.sin(f * Math.PI) + 0.12 * Math.sin(f * 17 + seed) + 0.08 * Math.sin(f * 41 + seed * 3))
    s.lineTo(x, y)
  }
  s.lineTo(width / 2, 0)
  s.closePath()
  return new ShapeGeometry(s)
}

function Box({ at, size, tone }: { at: [number, number, number]; size: [number, number, number]; tone: string }) {
  return (
    <mesh position={at}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={tone} />
    </mesh>
  )
}

/** A carved-looking inscription: troika text with the depth-write-free material on a stone slab. */
function Inscription() {
  const texts = useMemo(() => {
    const mat = textMaterial(color.inkJiao)
    const make = (value: string, font: string, size: number, y: number) => {
      const t = new Text()
      t.text = value
      t.font = font
      t.fontSize = size
      t.anchorX = 'center'
      t.anchorY = 'middle'
      t.material = mat
      t.position.set(-2.6, y, 11.26)
      t.sync()
      return t
    }
    return [make('入林', TEXT_FONTS.cjk, 0.42, 1.05), make('Ink test', TEXT_FONTS.display, 0.2, 0.62)]
  }, [])
  useEffect(() => () => texts.forEach((t) => t.dispose()), [texts])
  return (
    <group name="render-test-text">
      <Box at={[-2.6, 0.7, 11]} size={[1.3, 1.4, 0.5]} tone={color.stone} />
      {texts.map((t) => (
        <primitive key={t.text} object={t} />
      ))}
    </group>
  )
}

function Outdoor() {
  // Exact token cyan: with the flag it must come out as #5CEBDF, untouched by fog, ramp and grain.
  const interiorCyan = useMemo(() => markInterior(new MeshBasicMaterial({ color: color.cyanLine }), 'opaque'), [])
  const ridges = useMemo(
    () => [
      { geo: ridgeGeometry(300, 45, 1), z: -205, tone: color.inkZhong },
      { geo: ridgeGeometry(380, 70, 4), z: -265, tone: color.inkNong },
      { geo: ridgeGeometry(460, 115, 7), z: -340, tone: color.inkJiao },
    ],
    [],
  )
  useEffect(() => {
    setGlint(1, { auto: false, alpha: 1 })
    return () => resetGlints()
  }, [])
  return (
    <group name="render-test-outdoor">
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -120]}>
        <planeGeometry args={[600, 320]} />
        <meshBasicMaterial color={color.inkQing} />
      </mesh>
      {/* corner trunk and pads, like pine A on the right edge */}
      <Box at={[3.3, 4.5, 17]} size={[0.45, 9, 0.45]} tone={color.inkJiao} />
      <Box at={[2.2, 7.6, 17]} size={[3.2, 0.35, 1.4]} tone={color.inkNong} />
      <Box at={[3.9, 6.2, 17.3]} size={[2.4, 0.3, 1.2]} tone={color.inkNong} />
      <Box at={[-3.6, 0.9, 15]} size={[1.6, 1.8, 1.6]} tone={color.inkNong} />
      <Box at={[1.8, 1.25, 7]} size={[1.2, 2.5, 1.2]} tone={color.inkZhong} />
      <Box at={[-5, 2.5, -2]} size={[1, 5, 1]} tone={color.inkJiao} />
      <Box at={[5.5, 3, -14]} size={[1, 6, 1]} tone={color.inkNong} />
      <Box at={[-3, 4, -32]} size={[1.2, 8, 1.2]} tone={color.inkJiao} />
      <Box at={[9, 5, -48]} size={[1.5, 10, 1.5]} tone={color.inkJiao} />
      <Box at={[-12, 6, -75]} size={[2, 12, 2]} tone={color.inkJiao} />
      {/* interior-flagged cyan (left) vs plain cyan (right) at the same depth */}
      <mesh position={[-1.6, 1.0, 13]} material={interiorCyan}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
      </mesh>
      <mesh position={[-0.3, 1.0, 13]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshBasicMaterial color={color.cyanLine} />
      </mesh>
      <Box at={[0.9, 0.55, 12]} size={[0.5, 0.5, 0.5]} tone={color.cinnabar} />
      <Inscription />
      {ridges.map((r) => (
        <mesh key={r.z} geometry={r.geo} position={[0, 0, r.z]}>
          <meshBasicMaterial color={r.tone} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The hall as interior geometry: night shell, lit floor, cyan posts and beams. `wide` uses the
 * design's proportions (posts at x 0 and 8, shell x −25 to 33); the narrow version fits behind
 * the test cabin, since this bench has no stencil door to hide a wide shell outside it.
 */
function Hall({ z0, wide }: { z0: number; wide: boolean }) {
  const mats = useMemo(
    () => ({
      shell: markInterior(new MeshBasicMaterial({ color: color.night, side: BackSide }), 'opaque'),
      floor: markInterior(new MeshBasicMaterial({ color: color.woodDark }), 'opaque'),
      post: markInterior(new MeshBasicMaterial({ color: HDR_CYAN }), 'opaque'),
      ghost: markInterior(new MeshBasicMaterial({ color: color.cyanGhost, transparent: true, opacity: 0.8 }), 'additive'),
      paper: markInterior(new MeshBasicMaterial({ color: color.paper }), 'opaque'),
    }),
    [],
  )
  const [w, h, d] = wide ? [58, 35, 70] : [4.4, 3.3, 46]
  const shell = useMemo(() => new BoxGeometry(w, h, d), [w, h, d])
  const half = wide ? 4 : 1.7
  const postH = wide ? 6.5 : 2.9
  const posts = [-72, -78, -84, -90, -96, -102].map((z) => z0 - (-60 - z))
  return (
    <group name="render-test-hall">
      <mesh geometry={shell} material={mats.shell} position={[4, wide ? 12.5 : h / 2 - 0.05, z0 - d / 2]} />
      <mesh material={mats.floor} rotation-x={-Math.PI / 2} position={[4, 0.45, z0 - 23]}>
        <planeGeometry args={[wide ? 14 : 4.2, 46]} />
      </mesh>
      {posts.map((z) => (
        <group key={z}>
          <mesh material={mats.post} position={[4 - half, 0.45 + postH / 2, z]}>
            <boxGeometry args={[0.12, postH, 0.12]} />
          </mesh>
          <mesh material={mats.post} position={[4 + half, 0.45 + postH / 2, z]}>
            <boxGeometry args={[0.12, postH, 0.12]} />
          </mesh>
          <mesh material={mats.ghost} position={[4, 0.45 + postH, z]}>
            <boxGeometry args={[half * 2 + 0.2, 0.08, 0.08]} />
          </mesh>
        </group>
      ))}
      <mesh material={mats.paper} position={[4.3, 1.25, z0 - 39.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.6, 0.42]} />
      </mesh>
    </group>
  )
}

function Door() {
  // Cabin front wall at z −60 with a 1.1 × 2.1 m doorway centred on x 4; the hall starts behind it.
  const wall = color.inkNong
  return (
    <group name="render-test-door">
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -40]}>
        <planeGeometry args={[200, 120]} />
        <meshBasicMaterial color={color.inkQing} />
      </mesh>
      <Box at={[2.45, 1.7, -60]} size={[2.0, 3.4, 0.2]} tone={wall} />
      <Box at={[5.55, 1.7, -60]} size={[2.0, 3.4, 0.2]} tone={wall} />
      <Box at={[4, 3.0, -60]} size={[1.1, 0.8, 0.2]} tone={wall} />
      <Box at={[1.5, 1.7, -63]} size={[0.2, 3.4, 6]} tone={color.inkZhong} />
      <Box at={[6.5, 1.7, -63]} size={[0.2, 3.4, 6]} tone={color.inkZhong} />
      <Box at={[4, 3.6, -63]} size={[5.4, 0.3, 6.4]} tone={color.inkJiao} />
      <Box at={[-6, 5, -70]} size={[1.2, 10, 1.2]} tone={color.inkJiao} />
      <Box at={[12, 6, -58]} size={[1.2, 12, 1.2]} tone={color.inkNong} />
      <Hall z0={-60.3} wide={false} />
    </group>
  )
}

function Cabin() {
  useEffect(() => {
    journey.setState({ post: 'cabin', postBlend: 1, insideCabin: true })
    return () => journey.setState({ post: 'ink', postBlend: 0, insideCabin: false })
  }, [])
  return <Hall z0={-60.3} wide />
}

export default function RenderTest({ variant }: { variant: string }) {
  if (variant === 'door') return <Door />
  if (variant === 'cabin') return <Cabin />
  return <Outdoor />
}
