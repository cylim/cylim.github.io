import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import { CircleGeometry, Color, CylinderGeometry, type Group, Mesh, type Object3D, RingGeometry, type ShaderMaterial, Vector3 } from 'three'
import { hall } from '../../../core/world/layout'
import { color } from '../../../theme/tokens'
import { useDisposeOnUnmount } from '../../shared/lifetime'
import { makePortalTwins, pickTwin, type PortalTwins } from '../shared/portal'
import { flatMaterial, gateMistMaterial } from './materials'
import { agxInverse } from './tone'

/** The opening's depth through the back wall. */
const DEPTH = 0.26
/** The rim starts turning to ink this far from the gate (m) and is ink at the second distance. */
const NEAR = { from: 9, to: 2.2 }

const RIM_CYAN = new Color(color.cyanLine).multiplyScalar(1.6)
const RIM_INK = agxInverse(color.inkNong)

class Gate {
  private readonly mist: PortalTwins<ShaderMaterial>
  private readonly rim: PortalTwins<ShaderMaterial>
  private readonly meshes: { disc: Mesh; ring: Mesh; tunnel: Mesh }
  private readonly centre: Vector3
  private near = -1

  constructor() {
    const { centre, radius } = hall.moonGate
    this.centre = new Vector3(...centre)
    this.mist = makePortalTwins(gateMistMaterial)
    this.rim = makePortalTwins(() => flatMaterial(RIM_CYAN.clone()))
    const tunnel = new CylinderGeometry(radius, radius, DEPTH, 96, 1, true)
    tunnel.rotateX(Math.PI / 2)
    const wallFace = hall.backWall.z + 0.03
    this.meshes = {
      disc: new Mesh(new CircleGeometry(radius, 96), this.mist.outside),
      tunnel: new Mesh(tunnel, this.rim.outside),
      ring: new Mesh(new RingGeometry(radius, radius + 0.09, 96), this.rim.outside),
    }
    this.meshes.disc.position.set(centre[0], centre[1], wallFace - DEPTH + 0.02)
    this.meshes.tunnel.position.set(centre[0], centre[1], wallFace - DEPTH / 2)
    this.meshes.ring.position.set(centre[0], centre[1], wallFace + 0.004)
  }

  get objects(): Object3D[] {
    return [this.meshes.disc, this.meshes.tunnel, this.meshes.ring]
  }

  setInside(inside: boolean): void {
    this.meshes.disc.material = pickTwin(this.mist, inside)
    this.meshes.tunnel.material = pickTwin(this.rim, inside)
    this.meshes.ring.material = pickTwin(this.rim, inside)
  }

  frame(camera: Object3D): void {
    const t = Math.min(1, Math.max(0, (NEAR.from - camera.position.distanceTo(this.centre)) / (NEAR.from - NEAR.to)))
    const near = t * t * (3 - 2 * t)
    if (near === this.near) return
    this.near = near
    const u = this.mist.outside.uniforms
    if (u.uNear) u.uNear.value = near
    ;(this.rim.outside.uniforms.uColor?.value as Color | undefined)?.copy(RIM_CYAN).lerp(RIM_INK, near)
  }

  dispose(): void {
    for (const m of Object.values(this.meshes)) m.geometry.dispose()
    for (const t of [this.mist, this.rim]) {
      t.outside.dispose()
      t.inside.dispose()
    }
  }
}

/**
 * The 月洞门 in the back wall (design.md §8.4 I4, §11.2): a round opening, r 1.6, filled with
 * bright paper mist. Its rim is cyan-line and turns toward ink-nong as the camera closes in, while
 * the mist brightens: the site turning back into ink. The whiteout itself is the rig's `paper`.
 */
export function MoonGate({ inside }: { inside: boolean }) {
  const anchor = useRef<Group>(null)
  const [gate] = useState(() => new Gate())
  useDisposeOnUnmount(anchor, () => [gate])
  useLayoutEffect(() => gate.setInside(inside), [gate, inside])
  useFrame(({ camera }) => gate.frame(camera))
  return (
    <group ref={anchor} name="hall-moon-gate">
      {gate.objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </group>
  )
}
