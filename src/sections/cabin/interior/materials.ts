import { BackSide, Color, DoubleSide, ShaderMaterial, Vector2, Vector4, type Texture } from 'three'
import { alpha, color } from '../../../theme/tokens'
import noiseGlsl from '../../../core/render/glsl/noise.glsl'
import { hall } from '../../../core/world/layout'
import { hallUniforms } from './hallUniforms'
import { agxInverse } from './tone'
import circuitWoodFrag from './glsl/circuitWood.frag.glsl'
import circuitWoodVert from './glsl/circuitWood.vert.glsl'
import flatFrag from './glsl/flat.frag.glsl'
import gateFrag from './glsl/gate.frag.glsl'
import surfaceVert from './glsl/surface.vert.glsl'
import glowFrag from './glsl/glow.frag.glsl'
import glowVert from './glsl/glow.vert.glsl'
import hallGlsl from './glsl/hall.glsl'
import haloFrag from './glsl/halo.frag.glsl'
import haloVert from './glsl/halo.vert.glsl'
import paneFrag from './glsl/pane.frag.glsl'
import paperFrag from './glsl/paper.frag.glsl'
import pointsFrag from './glsl/points.frag.glsl'
import pointsVert from './glsl/points.vert.glsl'
import scrollFrag from './glsl/scroll.frag.glsl'
import shellFrag from './glsl/shell.frag.glsl'
import shellVert from './glsl/shell.vert.glsl'
import wellFrag from './glsl/well.frag.glsl'

/**
 * Hall materials (design.md §7.4, §8.4). Every one is a ShaderMaterial on the shared hall uniforms
 * with the interior alpha flag (alpha 0; opaque ones write it, the rest get it from their
 * markInterior mode through makePortalTwins). Each factory is a `make` for makePortalTwins: it is
 * called twice, and the twins share one uniforms object.
 */

const fragment = (...chunks: string[]) => [hallGlsl, ...chunks].join('\n')

export function circuitWoodMaterial(trace: Texture): ShaderMaterial {
  const g = hall.moonGate
  return new ShaderMaterial({
    name: 'cabin-circuit-wood',
    uniforms: {
      ...hallUniforms,
      uTrace: { value: trace },
      uWoodDark: { value: new Color(color.woodDark) },
      uWoodLight: { value: new Color(color.woodLight) },
      uGate: { value: new Vector4(g.centre[0], g.centre[1], g.centre[2], g.radius) },
    },
    vertexShader: circuitWoodVert,
    fragmentShader: fragment(circuitWoodFrag),
  })
}

/** Lines and small emissive meshes; per-vertex colour, ignition arrival, idle level and wire distance. */
export function glowMaterial(): ShaderMaterial {
  const m = new ShaderMaterial({
    name: 'cabin-glow',
    uniforms: { ...hallUniforms, uGain: { value: 1 } },
    vertexShader: glowVert,
    fragmentShader: fragment(glowFrag),
    depthWrite: false,
  })
  // Geometry without these attributes gets constants: lit cyan-line, always lit, no pulses.
  Object.assign(m.defaultAttributeValues as Record<string, number[]>, { aColor: [1, 1, 1], aArrive: [-1], aIdle: [0], aAlong: [-1] })
  return m
}

export function shellMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-night-shell',
    uniforms: { ...hallUniforms },
    vertexShader: shellVert,
    fragmentShader: fragment(shellFrag),
    side: BackSide,
  })
}

/** Stars on the night shell (drift 0) or hall dust (drift 1). */
export function pointsMaterial(drift: boolean, tint: Color): ShaderMaterial {
  return new ShaderMaterial({
    name: drift ? 'cabin-dust' : 'cabin-stars',
    uniforms: { ...hallUniforms, uPointScale: { value: 400 }, uDrift: { value: drift ? 1 : 0 }, uTint: { value: tint } },
    vertexShader: pointsVert,
    fragmentShader: fragment(pointsFrag),
    depthWrite: false,
  })
}

export function haloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-halos',
    uniforms: { ...hallUniforms, uGain: { value: 0.32 } },
    vertexShader: haloVert,
    fragmentShader: fragment(haloFrag),
    depthWrite: false,
  })
}

export function gateMistMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-moon-gate',
    uniforms: { ...hallUniforms, uPaperFar: { value: new Color(color.paper) }, uPaper: { value: agxInverse(color.paper) }, uNear: { value: 0 } },
    vertexShader: surfaceVert,
    fragmentShader: fragment(noiseGlsl, gateFrag),
  })
}

export function flatMaterial(c: Color): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-flat',
    uniforms: { ...hallUniforms, uColor: { value: c } },
    vertexShader: surfaceVert,
    fragmentShader: fragment(flatFrag),
    side: DoubleSide,
  })
}

export interface ScrollLayout {
  size: Vector2
  /** Metres from the top: rod, top margin end (core start), core end, text zone end. */
  rows: Vector4
  mountEnd: number
  coreInset: number
}

export function scrollMaterial(image: Texture | null, layout: ScrollLayout): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-scroll',
    uniforms: {
      ...hallUniforms,
      uImage: { value: image },
      uImageFit: { value: new Vector4(1, 1, 0, 0) },
      uUnroll: { value: 0 },
      uFocusOne: { value: 0 },
      uRows: { value: layout.rows },
      uMountEnd: { value: layout.mountEnd },
      uSize: { value: layout.size },
      uCoreInset: { value: layout.coreInset },
    },
    vertexShader: surfaceVert,
    fragmentShader: fragment(scrollFrag),
    depthWrite: false,
  })
}

export interface PaperLayout {
  sheet: Vector2
  sealCentre: Vector2
  sealSize: number
  sealRotDeg: number
}

export function paperMaterial(seal: Texture, layout: PaperLayout): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-desk-paper',
    uniforms: {
      ...hallUniforms,
      // Faintly lit, and kept under the bloom threshold: paper glowing warm would be a second
      // warm light. The seal is exact cinnabar through the grade.
      uPaper: { value: new Color(color.paperShade).multiplyScalar(0.85) },
      uCinnabar: { value: agxInverse(color.cinnabar) },
      uSeal: { value: seal },
      uSheet: { value: layout.sheet },
      uSealCentre: { value: layout.sealCentre },
      uSealSize: { value: layout.sealSize },
      uSealRot: { value: (layout.sealRotDeg * Math.PI) / 180 },
    },
    vertexShader: surfaceVert,
    fragmentShader: fragment(noiseGlsl, paperFrag),
  })
}

export function wellMaterial(reflect: Texture): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-inkstone-well',
    uniforms: { ...hallUniforms, uReflect: { value: reflect }, uInk: { value: agxInverse(color.inkJiao) } },
    vertexShader: surfaceVert,
    fragmentShader: fragment(wellFrag),
  })
}

/** The terminal pane's glass (design.md §10.1): night at 88% with the log canvas and a breathing caret. */
export function paneMaterial(text: Texture, caret: Vector4): ShaderMaterial {
  return new ShaderMaterial({
    name: 'cabin-terminal-pane',
    uniforms: { ...hallUniforms, uText: { value: text }, uCaret: { value: caret }, uGlass: { value: alpha.terminalGlass }, uTextOn: { value: 1 } },
    vertexShader: surfaceVert,
    fragmentShader: fragment(paneFrag),
    depthWrite: false,
  })
}
