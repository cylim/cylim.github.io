/**
 * Album stills (design.md §14.1): rendered from the real scenes by scripts/shots.mjs with
 * `?still=<beat>&tier=high` and committed under public/stills/.
 *
 * File contract (tooling writes, the album reads):
 *   /stills/<beat>-1600.avif  /stills/<beat>-1600.webp   landscape 16:10, 1600 × 1000
 *   /stills/<beat>-800.avif   /stills/<beat>-800.webp    landscape 16:10, 800 × 500
 *   /stills/<beat>-portrait-800.avif  .webp              portrait 4:5, 800 × 1000
 * A missing file is fine: the album shows a paper-and-mist placeholder instead.
 */

export type StillId = 'T0' | 'C3' | 'I1' | 'E1' | 'E3'

export interface Still {
  readonly id: StillId
  /** One sentence describing the painting. */
  readonly alt: string
}

// TODO(owner): alt text drafted from design.md §8; rewrite once the stills exist.
export const stills: Readonly<Record<StillId, Still>> = {
  T0: {
    id: 'T0',
    alt: 'An open paper meadow at the edge of an ink-wash pine forest, with one warm lantern light far off in the mist.',
  },
  C3: {
    id: 'C3',
    alt: 'A small dark cabin at the foot of a tall peak, its door open on cyan light and a long hall that cannot fit inside it.',
  },
  I1: {
    id: 'I1',
    alt: 'Inside the cabin, a timber frame drawn in cyan light recedes into the dark, with glowing brackets on every post.',
  },
  E1: {
    id: 'E1',
    alt: 'A round-headed stone stele beside an octagonal stone lantern, seen from low down, with the peak rising out of the mist above.',
  },
  E3: {
    id: 'E3',
    alt: 'The whole walk seen from above as one hanging scroll: the lantern, the stone rings of the grove, the cabin and the forest edge.',
  },
}

export const stillSizes = {
  landscape: [800, 1600] as const,
  landscapeRatio: [16, 10] as const,
  portraitWidth: 800,
  portraitRatio: [4, 5] as const,
} as const

/** Public path of one still file. */
export const stillSrc = (id: StillId, width: number, format: 'avif' | 'webp', portrait = false) =>
  `/stills/${id}${portrait ? '-portrait' : ''}-${width}.${format}`
