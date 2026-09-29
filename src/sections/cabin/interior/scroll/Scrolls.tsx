import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  CylinderGeometry,
  Group,
  LineSegments,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import { Text } from 'troika-three-text'
import { featuredWork, type WorkItem } from '../../../../content'
import { TIERS, wake } from '../../../../core/render'
import { journey, type Tier } from '../../../../core/store/journey'
import { TEXT_FONTS, interiorTextMaterial, preloadText } from '../../../../core/text/configure'
import { hall } from '../../../../core/world/layout'
import { color, easing } from '../../../../theme/tokens'
import { useDisposeOnUnmount } from '../../../shared/lifetime'
import { overDomContent } from '../../shared/pointer'
import { makePortalTwins, pickTwin, setPortalStencil, type PortalTwins } from '../../shared/portal'
import { floorArrival } from '../frame'
import { hallUniforms } from '../hallUniforms'
import { LineBuilder } from '../lines'
import { glowMaterial, scrollMaterial, type ScrollLayout } from '../materials'
import { scrollImage, type ScrollImage } from './image'

const S = hall.scrollSize
const DEG = Math.PI / 180

/**
 * A 立轴 mount, in metres from the top: the rod, the 天头 top margin with the title, the 画心
 * image core, the text zone, and a 地头 half the 天头 (real mounts keep the top about twice the
 * bottom). The roller (地轴) hangs under the mount.
 */
const ROD = 0.05
const ROWS = new Vector4(ROD, ROD + S.topMargin, ROD + S.topMargin + S.core, ROD + S.topMargin + S.core + S.textZone)
const MOUNT_END = ROWS.w + S.topMargin / 2
const CORE_WIDTH = 0.9
const LAYOUT: ScrollLayout = { size: new Vector2(S.width, S.height), rows: ROWS, mountEnd: MOUNT_END, coreInset: (S.width - CORE_WIDTH) / 2 }

const UNROLL_MS = 700
const STEP = 0.2
/** Scrolls unroll the first time they are in frame this close to the camera. */
const UNROLL_RANGE = 15
const TEXT_LIFT = 0.004

/** y (scroll-local, up) of a distance from the top of the mount. */
const fromTop = (d: number) => S.height / 2 - d

const TITLE = { size: 0.085, color: new Color(color.paper).multiplyScalar(1.15) }
const META = { size: 0.034, line: 1.4 }

/** One visit's unroll progress per scroll, kept outside React so a remount does not replay it. */
const unrolled = [0, 0, 0, 0]
const unrollStart: (number | null)[] = [null, null, null, null]

const metaLine = (item: WorkItem) => [item.role, item.years].filter(Boolean).join(' · ')

/** Every glyph the scrolls draw, so troika builds the atlases before the section counts as ready. */
export function preloadScrollText(): Promise<void> {
  const titles = featuredWork.map((w) => w.title).join('')
  const meta = featuredWork.map((w) => metaLine(w) + w.tags.join(' · ')).join('')
  return Promise.all([preloadText('display', titles), preloadText('mono', meta)]).then(() => undefined)
}

/** Shared text materials: one per colour, switched between door and room in place. */
function textMaterials() {
  return {
    title: interiorTextMaterial(TITLE.color),
    role: interiorTextMaterial(color.cyanSoft),
    tags: interiorTextMaterial(color.cyanDim),
  }
}

function text(value: string, fontUrl: string, size: number, y: number, material: ReturnType<typeof interiorTextMaterial>, lineHeight = 1.2): Text {
  const t = new Text()
  t.text = value
  t.font = fontUrl
  t.fontSize = size
  t.lineHeight = lineHeight
  t.maxWidth = CORE_WIDTH
  t.textAlign = 'center'
  t.anchorX = 'center'
  t.anchorY = 'top'
  t.position.set(0, y, TEXT_LIFT)
  t.material = material
  t.fillOpacity = 0
  t.sync()
  return t
}

/** Top rod, the light rod it hangs from and the two cords, in scroll-local metres; they light when ignition reaches `arrive`. */
function hangingLines(arrive: number): BufferGeometry {
  const b = new LineBuilder()
  const top = S.height / 2
  b.edges(new BoxGeometry(S.width + 0.06, 0.03, 0.03), new Matrix4().makeTranslation(0, top - 0.025, 0), {
    color: new Color(color.cyanLine).multiplyScalar(1.2),
    idle: 0.8,
    arrive,
  })
  const railY = top + 0.55
  const rail = { color: new Color(color.cyanBright).multiplyScalar(1.8), idle: 0.8, arrive }
  b.polyline([new Vector3(-0.32, railY, 0), new Vector3(0.32, railY, 0)], rail)
  const cord = { color: new Color(color.cyanGhost).multiplyScalar(2.4), idle: 0.5, arrive }
  for (const sx of [-1, 1]) b.polyline([new Vector3(sx * 0.3, railY, 0), new Vector3(sx * (S.width / 2 - 0.04), top - 0.01, 0)], cord)
  return b.build()
}

/** The bottom roller (地轴) with its glowing ends (轴头), coloured per vertex for the glow shader. */
function rollerGeometry(arrive: number): BufferGeometry {
  const parts: [CylinderGeometry, Color][] = [
    [new CylinderGeometry(0.02, 0.02, S.width + 0.04, 12, 1), new Color(color.cyanLine).multiplyScalar(0.45)],
    ...[-1, 1].map((sx): [CylinderGeometry, Color] => {
      const cap = new CylinderGeometry(0.03, 0.03, 0.06, 12, 1)
      cap.translate(0, sx * (S.width / 2 + 0.05), 0)
      return [cap, new Color(color.cyanBright).multiplyScalar(2.6)]
    }),
  ]
  const pos: number[] = []
  const col: number[] = []
  for (const [g, c] of parts) {
    g.rotateZ(Math.PI / 2)
    const flat = g.toNonIndexed()
    const a = flat.getAttribute('position')
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i))
      col.push(c.r, c.g, c.b)
    }
    flat.dispose()
    g.dispose()
  }
  const n = pos.length / 3
  const out = new BufferGeometry()
  out.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  out.setAttribute('aColor', new BufferAttribute(new Float32Array(col), 3))
  out.setAttribute('aArrive', new BufferAttribute(new Float32Array(n).fill(arrive), 1))
  out.setAttribute('aIdle', new BufferAttribute(new Float32Array(n).fill(0.8), 1))
  return out
}

type TextMaterials = ReturnType<typeof textMaterials>

/** One scroll: its mount, rods, roller and text, and its unroll and focus state. */
class HangingScroll {
  readonly root = new Group()
  /** Steps toward the viewer along the scroll's facing when focused; holds everything else. */
  readonly step = new Group()
  readonly mountMesh: Mesh
  private readonly mount: PortalTwins<ShaderMaterial>
  private readonly glow: PortalTwins<ShaderMaterial>
  private readonly lines: LineSegments
  private readonly roller: Mesh
  private readonly texts: Text[]
  private readonly centre: Vector3
  private readonly probe = new Vector3()
  private shownUnroll = -1
  private shownFocus = -1

  constructor(
    readonly index: number,
    readonly item: WorkItem,
    materials: TextMaterials,
  ) {
    const spec = hall.scrolls[index]
    this.centre = new Vector3(...(spec?.centre ?? [0, 0, 0]))
    this.root.name = `hall-scroll-${index + 1}`
    this.root.position.copy(this.centre)
    this.root.rotation.y = Math.sign(hall.centreLineX - this.centre.x) * hall.scrollYawDeg * DEG
    this.mount = makePortalTwins(() => scrollMaterial(null, LAYOUT), 'additive')
    this.glow = makePortalTwins(glowMaterial, 'additive')
    this.mountMesh = new Mesh(new PlaneGeometry(S.width, S.height), this.mount.outside)
    // The scroll's light comes on as the ignition front passes under it.
    const arrive = floorArrival(this.centre) + 0.15
    this.lines = new LineSegments(hangingLines(arrive), this.glow.outside)
    this.roller = new Mesh(rollerGeometry(arrive), this.glow.outside)
    // Rolled up under the top rod until it first comes into view.
    this.roller.position.y = fromTop(ROD) - 0.02
    this.texts = [
      text(item.title, TEXT_FONTS.display, TITLE.size, fromTop(ROD + S.topMargin / 2) + TITLE.size * 0.62, materials.title),
      text(metaLine(item), TEXT_FONTS.mono, META.size, fromTop(ROWS.z + 0.05), materials.role),
      text(item.tags.join(' · '), TEXT_FONTS.mono, META.size, fromTop(ROWS.z + 0.05 + META.size * 2.2), materials.tags, META.line),
    ]
    this.step.add(this.mountMesh, this.lines, this.roller, ...this.texts)
    this.root.add(this.step)
  }

  setInside(inside: boolean): void {
    this.mountMesh.material = pickTwin(this.mount, inside)
    this.lines.material = pickTwin(this.glow, inside)
    this.roller.material = pickTwin(this.glow, inside)
  }

  setImage(img: ScrollImage): void {
    const u = this.mount.outside.uniforms
    if (u.uImage) u.uImage.value = img.texture
    ;(u.uImageFit?.value as Vector4 | undefined)?.copy(img.fit)
  }

  frame(camera: Camera): void {
    const s = journey.getState()
    const i = this.index
    let p = unrolled[i] ?? 0
    if (p < 1) {
      const started = unrollStart[i] ?? null
      if (s.e2e || s.reducedMotion) p = 1
      else if (started === null) {
        const v = this.probe.copy(this.centre).project(camera)
        const inFrame = v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95
        if (s.insideCabin && inFrame && camera.position.distanceTo(this.centre) < UNROLL_RANGE) {
          unrollStart[i] = performance.now()
          wake(UNROLL_MS + 150)
        }
      } else p = easing.outCubic(Math.min(1, (performance.now() - started) / UNROLL_MS))
      unrolled[i] = p
    }
    if (p !== this.shownUnroll) {
      this.shownUnroll = p
      const u = this.mount.outside.uniforms
      if (u.uUnroll) u.uUnroll.value = p
      const reach = p * (MOUNT_END - ROD)
      this.roller.position.y = fromTop(ROD + reach) - 0.02
      const [title, role, tags] = this.texts
      if (title) title.fillOpacity = Math.min(1, Math.max(0, (reach - S.topMargin * 0.6) / 0.2))
      const meta = Math.min(1, Math.max(0, (reach - (ROWS.z - ROD)) / 0.2))
      if (role) role.fillOpacity = meta
      if (tags) tags.fillOpacity = meta
    }

    const f = hallUniforms.uFocus.value.getComponent(i)
    if (f !== this.shownFocus) {
      this.shownFocus = f
      this.step.position.z = f * STEP
      const u = this.mount.outside.uniforms
      if (u.uFocusOne) u.uFocusOne.value = f
      const g = this.glow.outside.uniforms.uGain
      if (g) g.value = 1 + 0.3 * f
    }
  }

  dispose(): void {
    this.mountMesh.geometry.dispose()
    this.lines.geometry.dispose()
    this.roller.geometry.dispose()
    for (const t of this.texts) t.dispose()
    for (const tw of [this.mount, this.glow]) {
      tw.outside.dispose()
      tw.inside.dispose()
    }
  }
}

const hover = (index: number) => (e: ThreeEvent<PointerEvent>) => {
  if (!journey.getState().insideCabin || overDomContent(e)) return
  e.stopPropagation()
  if (journey.getState().cabinFocus !== index) journey.setState({ cabinFocus: index })
}
const leave = (index: number) => () => {
  if (journey.getState().cabinFocus === index) journey.setState({ cabinFocus: null })
}

function Scroll({ scroll, inside, tier }: { scroll: HangingScroll; inside: boolean; tier: Tier }) {
  const [everInside, setEverInside] = useState(inside)
  if (inside && !everInside) setEverInside(true)
  useLayoutEffect(() => scroll.setInside(inside), [scroll, inside])

  // Low tier's simplified hall loads scroll images only once the visitor is inside (design.md §13.3).
  const px = TIERS[tier].scrollTexture
  const wait = TIERS[tier].simplifiedHall && !everInside
  useEffect(() => {
    if (wait) return
    let live = true
    void scrollImage(scroll.item, px).then((img) => {
      if (!live) return
      scroll.setImage(img)
      wake(100)
    })
    return () => {
      live = false
    }
  }, [scroll, px, wait])

  useFrame(({ camera }) => scroll.frame(camera))
  return (
    // Nested as in the scene graph: R3F re-parents a child primitive onto its JSX parent.
    <primitive object={scroll.root}>
      <primitive object={scroll.step}>
        <primitive object={scroll.mountMesh} onPointerOver={hover(scroll.index)} onPointerOut={leave(scroll.index)} />
      </primitive>
    </primitive>
  )
}

/**
 * The four hanging scrolls of light (design.md §8.4 I2), one per featured project, yawed 25°
 * toward the centre line. Each unrolls from its top rod over 700 ms the first time it comes into
 * view, and steps 0.2 m forward and brightens while it is hovered or its DOM card has focus
 * (journey.cabinFocus, written both ways).
 */
export function Scrolls({ inside, tier }: { inside: boolean; tier: Tier }) {
  const anchor = useRef<Group>(null)
  const [set] = useState(() => {
    const materials = textMaterials()
    const scrolls = featuredWork.slice(0, hall.scrolls.length).map((item, i) => new HangingScroll(i, item, materials))
    return { materials, scrolls }
  })
  useDisposeOnUnmount(anchor, () => [...set.scrolls, ...Object.values(set.materials)])
  useLayoutEffect(() => {
    for (const m of Object.values(set.materials)) setPortalStencil(m, !inside)
  }, [set, inside])
  return (
    <group ref={anchor} name="hall-scrolls">
      {set.scrolls.map((s) => (
        <Scroll key={s.item.id} scroll={s} inside={inside} tier={tier} />
      ))}
    </group>
  )
}
