import { BufferAttribute, BufferGeometry, Color, EdgesGeometry, Matrix4, Vector3 } from 'three'

/** How one piece of line work glows: lit colour (linear, may exceed 1), idle level, ignition arrival. */
export interface LineStyle {
  color: Color
  /** Brightness before ignition, in cyan-ghost. */
  idle: number
  /** Ignition arrival in seconds, or a function of the vertex's world position; negative = always lit. */
  arrive: number | ((p: Vector3) => number)
}

/**
 * Collects line segments with the glow material's per-vertex attributes (aColor, aArrive, aIdle,
 * aAlong), so all of the hall's static line work draws in one call.
 */
export class LineBuilder {
  private readonly pos: number[] = []
  private readonly col: number[] = []
  private readonly arrive: number[] = []
  private readonly idle: number[] = []
  private readonly along: number[] = []
  private readonly v = new Vector3()

  private push(p: Vector3, style: LineStyle, along: number) {
    this.pos.push(p.x, p.y, p.z)
    this.col.push(style.color.r, style.color.g, style.color.b)
    this.arrive.push(typeof style.arrive === 'number' ? style.arrive : style.arrive(p))
    this.idle.push(style.idle)
    this.along.push(along)
  }

  /** The feature edges of a solid (EdgesGeometry), placed by `matrix`. */
  edges(geometry: BufferGeometry, matrix: Matrix4, style: LineStyle, thresholdDeg = 20): this {
    const e = new EdgesGeometry(geometry, thresholdDeg)
    const a = e.getAttribute('position')
    for (let i = 0; i < a.count; i++) this.push(this.v.fromBufferAttribute(a, i).applyMatrix4(matrix), style, -1)
    e.dispose()
    geometry.dispose()
    return this
  }

  /** A polyline; `wire` gives it a running distance so pulses travel along it. */
  polyline(points: readonly Vector3[], style: LineStyle, wire = false, closed = false): this {
    let s = 0
    const n = closed ? points.length : points.length - 1
    for (let i = 0; i < n; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      if (!a || !b) continue
      const len = a.distanceTo(b)
      this.push(a, style, wire ? s : -1)
      this.push(b, style, wire ? s + len : -1)
      s += len
    }
    return this
  }

  build(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.col), 3))
    g.setAttribute('aArrive', new BufferAttribute(new Float32Array(this.arrive), 1))
    g.setAttribute('aIdle', new BufferAttribute(new Float32Array(this.idle), 1))
    g.setAttribute('aAlong', new BufferAttribute(new Float32Array(this.along), 1))
    g.computeBoundingSphere()
    return g
  }
}
