/**
 * The 林 seal (design.md §4.4), hand-traced by scripts/make-seals.mjs into public/seals/ with its edge
 * roughness and uneven 印泥 baked in. Each placement file has its resting angle baked in too
 * (public/seals/seals.json): every placement rests between −2° and 2°, never 0°.
 * 朱文 (red strokes, red border) for the nav mark and the finale; 白文 (paper strokes cut from red)
 * for the hero signature. Always decorative: the text next to it carries the meaning.
 */

const FILES = {
  nav: '/seals/lin-zhuwen-nav.svg',
  hero: '/seals/lin-baiwen-hero.svg',
  finale: '/seals/lin-zhuwen-finale.svg',
  plain: '/seals/lin-zhuwen.svg',
} as const

export type SealPlacement = keyof typeof FILES

/** Only the nav and hero seals are on the first screen; the rest load when they are needed. */
const EAGER: readonly SealPlacement[] = ['nav', 'hero']

export function Seal({ placement, size, className }: { placement: SealPlacement; size: number; className?: string }) {
  const eager = EAGER.includes(placement)
  return (
    <img
      className={className ? `seal ${className}` : 'seal'}
      src={FILES[placement]}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
      loading={eager ? undefined : 'lazy'}
      fetchPriority={eager ? undefined : 'low'}
      draggable={false}
    />
  )
}
