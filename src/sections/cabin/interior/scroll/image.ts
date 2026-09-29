import { CanvasTexture, SRGBColorSpace, TextureLoader, Vector4, type Texture } from 'three'
import type { WorkItem } from '../../../../content'
import { drawEmblem, emblemPlan } from './emblem'

/** The scroll's image core is 0.9 × 1.6 m (画心). */
export const CORE_ASPECT = 0.9 / 1.6

export interface ScrollImage {
  texture: Texture
  /** Cover fit into the core: UV scale xy, offset zw. */
  fit: Vector4
}

/** Crop an image of this aspect (width / height) to fill the core, centred. */
export function coverFit(aspect: number): Vector4 {
  return aspect > CORE_ASPECT
    ? new Vector4(CORE_ASPECT / aspect, 1, (1 - CORE_ASPECT / aspect) / 2, 0)
    : new Vector4(1, aspect / CORE_ASPECT, 0, (1 - aspect / CORE_ASPECT) / 2)
}

function emblem(name: string, px: number): ScrollImage {
  const canvas = document.createElement('canvas')
  canvas.height = px
  canvas.width = Math.round(px * CORE_ASPECT)
  const ctx = canvas.getContext('2d')
  if (ctx) drawEmblem(ctx, canvas.width, canvas.height, emblemPlan(name))
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { texture, fit: new Vector4(1, 1, 0, 0) }
}

const cache = new Map<string, Promise<ScrollImage>>()

/**
 * The scroll's image core at `px` (TIERS[tier].scrollTexture): the project's screenshot when
 * `item.image` names a 512 px WebP in public/, else its procedural emblem. The shader turns either
 * into the night → cyan duotone, so any screenshot looks on-brand.
 */
export function scrollImage(item: WorkItem, px: number): Promise<ScrollImage> {
  const key = `${item.id}@${px}`
  let p = cache.get(key)
  if (!p) {
    const src = item.image
    p = src
      ? new TextureLoader().loadAsync(src).then(
          (texture): ScrollImage => {
            texture.colorSpace = SRGBColorSpace
            const img = texture.image as { width?: number; height?: number } | null
            const aspect = img?.width && img.height ? img.width / img.height : CORE_ASPECT
            return { texture, fit: coverFit(aspect) }
          },
          () => emblem(item.title, px),
        )
      : Promise.resolve(emblem(item.title, px))
    cache.set(key, p)
  }
  return p
}
