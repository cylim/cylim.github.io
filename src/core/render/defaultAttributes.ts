import { BufferAttribute, type BufferGeometry, type Material, type Object3D } from 'three'

/** Attributes three itself gives defaults for; its own shader chunks guard them with defines. */
const BUILT_IN = new Set(['color', 'uv', 'uv1', 'uv2', 'uv3'])

type Defaults = Record<string, readonly number[]>

function customDefaults(material: Material): Defaults | null {
  const d = (material as Material & { defaultAttributeValues?: Defaults }).defaultAttributeValues
  if (!d) return null
  for (const key in d) if (!BUILT_IN.has(key)) return d
  return null
}

/**
 * Gives `geometry` a real constant attribute for every custom default in `material` it lacks.
 * Returns the names it added.
 *
 * Why: three binds `defaultAttributeValues` with gl.vertexAttrib*, which is context state, not
 * vertex-array state, and only while it (re)builds a geometry's vertex array. Once any other
 * program writes that attribute location, a cached vertex array draws with the other value. In
 * the walk this painted the cabin's close trunks as paper: their geometry has no `iInk`, and after
 * the cabin's materials had run, the trunk read 0 instead of the default 1 (wave2-status.md).
 */
export function fillDefaultAttributes(geometry: BufferGeometry, material: Material): string[] {
  const defaults = customDefaults(material)
  const position = geometry.getAttribute('position')
  if (!defaults || !position) return []
  const added: string[] = []
  for (const name in defaults) {
    const value = defaults[name]
    if (BUILT_IN.has(name) || !value || geometry.getAttribute(name)) continue
    const size = value.length
    const array = new Float32Array(position.count * size)
    for (let i = 0; i < array.length; i++) array[i] = value[i % size] ?? 0
    geometry.setAttribute(name, new BufferAttribute(array, size))
    added.push(name)
  }
  return added
}

/**
 * Runs `fillDefaultAttributes` over every visible mesh under `root`. Stage calls it before each
 * frame renders (the scene's projection uploads buffers, so attributes must exist before it).
 * A geometry is filled once; afterwards this is a few property lookups per mesh.
 */
export function fillSceneDefaultAttributes(root: Object3D): void {
  root.traverseVisible((o) => {
    const mesh = o as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] }
    if (!mesh.geometry || !mesh.material) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of materials) fillDefaultAttributes(mesh.geometry, m)
  })
}
