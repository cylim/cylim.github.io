import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, InstancedBufferAttribute, Mesh, MeshBasicMaterial, ShaderMaterial } from 'three'
import { fillDefaultAttributes, fillSceneDefaultAttributes } from './defaultAttributes'

const inkLike = () => {
  const m = new ShaderMaterial()
  Object.assign(m.defaultAttributeValues, { iInk: [1], card: [0, 0, 0, 0], ao: [0.5] })
  return m
}

describe('fillDefaultAttributes', () => {
  it('gives the geometry constant attributes for the custom defaults it lacks', () => {
    const g = new BoxGeometry()
    const added = fillDefaultAttributes(g, inkLike())
    expect(added.toSorted()).toEqual(['ao', 'card', 'iInk'])
    const n = g.getAttribute('position').count
    expect(g.getAttribute('iInk').count).toBe(n)
    expect(g.getAttribute('iInk').getX(n - 1)).toBe(1)
    expect(g.getAttribute('card').itemSize).toBe(4)
    expect(g.getAttribute('ao').getX(0)).toBe(0.5)
  })

  it('keeps attributes the geometry already has, instanced or not', () => {
    const g = new BoxGeometry()
    const own = new InstancedBufferAttribute(new Float32Array([0.3, 0.7]), 1)
    g.setAttribute('iInk', own)
    fillDefaultAttributes(g, inkLike())
    expect(g.getAttribute('iInk')).toBe(own)
  })

  it("leaves three's built-in defaults and plain materials alone", () => {
    const g = new BoxGeometry()
    g.deleteAttribute('uv')
    expect(fillDefaultAttributes(g, new ShaderMaterial())).toEqual([])
    expect(fillDefaultAttributes(g, new MeshBasicMaterial())).toEqual([])
    expect(g.getAttribute('uv')).toBeUndefined()
  })

  it('walks visible meshes only', () => {
    const root = new Group()
    const shown = new Mesh(new BoxGeometry(), inkLike())
    const hidden = new Mesh(new BoxGeometry(), inkLike())
    hidden.visible = false
    root.add(shown, hidden)
    fillSceneDefaultAttributes(root)
    expect(shown.geometry.getAttribute('iInk')).toBeDefined()
    expect(hidden.geometry.getAttribute('iInk')).toBeUndefined()
  })
})
