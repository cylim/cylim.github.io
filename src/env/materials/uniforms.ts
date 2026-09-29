/**
 * Uniforms shared by reference across every env material (stack.md §1: since R3F 9.6 JSX uniforms
 * are copied, so shared uniforms only stay shared on materials built imperatively like these).
 * Env's EnvDriver writes the clock, motion and tier fields each frame; the entries marked
 * "writer:" below are the only ones other modules may set.
 */

import { Color, Vector3, type IUniform } from 'three'
import { cabin, exit, NORTH, PAINTER_LIGHT } from '../../core/world/layout'
import { color, ink } from '../../theme/tokens'

const paper = new Color(color.paper)
const srgb = (hex: string) => new Color(hex).convertLinearToSRGB()

export const worldUniforms = {
  /** Shader clock in seconds (frozen under e2e). Writer: EnvDriver. */
  uTime: { value: 0 },
  /** 0 with reduced motion: no sway, no mist drift. Writer: EnvDriver. */
  uMotion: { value: 1 },
  /** Tier's 皴 level: 0 hero rocks and grove stones, 1 all stone, 2 all stone plus hemp on earth. Writer: EnvDriver. */
  uCunLevel: { value: 2 },
  /** Pine pad sway at the tips, metres (design §7.1: 1 to 2 cm). */
  uSwayAmp: { value: 0.015 },

  uLightDir: { value: new Vector3(...PAINTER_LIGHT).normalize() },
  uPaperColor: { value: paper },
  uInkColor: { value: new Color(ink[0]) },
  /** sRGB-encoded copies: ink shades mix in sRGB (glsl/light.glsl inkColor). */
  uPaperSrgb: { value: srgb(color.paper) },
  uInkSrgb: { value: srgb(ink[0]) },

  uLanternPos: { value: new Vector3(...exit.lantern.flame) },
  uLanternColor: { value: new Color(color.lanternHalo) },
  uLanternRadius: { value: exit.lanternWarmRadius },
  /** Scales the warm term; 1 = design strength. Writer: contact scene (flame breath, hover lean). */
  uLanternIntensity: { value: 1 },

  uSpillPos: { value: new Vector3(...cabin.spill.pos) },
  uSpillColor: { value: new Color(color.cyanLine) },
  uSpillRadius: { value: cabin.spill.radius },
  /**
   * The way the door faces (north). The spill lights what stands in front of the door plane: the
   * frame, the steps, the ground and the ferns. The open leaf swings in behind the plane and stays
   * ink, with only a trace of cyan (wave-2 L9: at full strength it read as a pale teal board).
   */
  uSpillFacing: { value: new Vector3(...NORTH) },
  /** Cyan spill from the open door, 0 closed to 1 open. Writer: cabin scene (door swing, C2). */
  uSpill: { value: 0 },

} satisfies Record<string, IUniform>

export type WorldUniforms = typeof worldUniforms

/** Cyan spill at the cabin door, 0..1 (design §7.1, C2). For the cabin scene. */
export function setDoorSpill(amount: number): void {
  worldUniforms.uSpill.value = Math.min(1, Math.max(0, amount))
}

/** Warm-term strength, 1 = design value (design §7.1, §8.7). For the contact scene. */
export function setLanternIntensity(intensity: number): void {
  worldUniforms.uLanternIntensity.value = Math.max(0, intensity)
}
