import type { ComponentType, LazyExoticComponent } from 'react'
import type { SectionHash, SectionId } from './ids'
import type { PostGroup } from '../store/journey'

/** Props every section Scene receives. Anything else comes from the store, layout.ts or content. */
export interface SectionSceneProps {
  id: SectionId
}

export type SectionSceneModule = { default: ComponentType<SectionSceneProps> }

/**
 * One scroll section (stack.md §4, with design.md §6.2 values).
 * Camera keyframes are not here: they live in core/world/journey.ts (design.md §6.3).
 */
export interface SectionDefinition {
  readonly id: SectionId
  readonly hash: SectionHash
  /** Plain nav word (content/site.ts nav). */
  readonly label: string
  /** CJK accent for inscriptions and title cards. */
  readonly zh: string
  /** Scroll span in jvh, [start, end). */
  readonly spanJvh: readonly [number, number]
  /** Scroll span in u, [start, end). */
  readonly span: readonly [u0: number, u1: number]
  /** Where a jump lands, in jvh and u. */
  readonly arrivalJvh: number
  readonly arrivalU: number
  /** DOM <section> height in svh. */
  readonly heightSvh: number
  /**
   * Post group at the arrival pose. The cabin's exterior beats (245–322) still render 'ink';
   * the rig switches on the door plane, not on this field.
   */
  readonly post: PostGroup
  /** Memoised: every call returns the same promise, so the lazy Scene and prewarm share one fetch. */
  readonly load: () => Promise<SectionSceneModule>
  /** React.lazy over `load`, created once per definition. Render inside <Suspense>. */
  readonly Scene: LazyExoticComponent<ComponentType<SectionSceneProps>>
}

export type SectionDefinitionInput = Omit<SectionDefinition, 'load' | 'span' | 'arrivalU' | 'Scene'> & {
  readonly load: () => Promise<SectionSceneModule>
}
