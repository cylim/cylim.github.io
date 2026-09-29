import { useEffect, useRef, useState } from 'react'
import { stills, stillSizes, stillSrc, type StillId } from '../../content/stills'
import { breakpoint } from '../../theme/tokens'

/**
 * One album still (design.md §14.1): AVIF with a WebP fallback, landscape 16:10 on desktop and a
 * 4:5 crop on phones, lazy, with a fixed aspect ratio so nothing shifts. The frame is painted mist
 * until the image arrives; if the file is missing the mist simply stays.
 */
export const STILL_SIZES = '(min-width: 768px) 55vw, 100vw'

/**
 * `priority` marks the album's first still, its largest paint (QM-P5): fetched at high priority, and
 * index.html's head script preloads it for album visits only. It stays lazy, because the walk
 * prerenders the same img (hidden) and must not download it.
 */
export function Still({ id, sizes = STILL_SIZES, priority = false }: { id: StillId; sizes?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  const { alt } = stills[id]
  const [w1, w2] = stillSizes.landscape
  const [rw, rh] = stillSizes.landscapeRatio
  const mobile = `(max-width: ${breakpoint.desktop - 0.02}px)`
  const set = (format: 'avif' | 'webp') => `${stillSrc(id, w1, format)} ${w1}w, ${stillSrc(id, w2, format)} ${w2}w`

  // A load error before hydration fires no React event; check the element once on mount.
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.currentSrc && el.naturalWidth === 0) setFailed(true)
  }, [])

  return (
    <figure className="still" data-still={id} data-failed={failed ? '' : undefined}>
      {failed ? (
        <div className="still-mist" role="img" aria-label={alt} />
      ) : (
        <picture>
          <source media={mobile} type="image/avif" srcSet={stillSrc(id, stillSizes.portraitWidth, 'avif', true)} />
          <source media={mobile} type="image/webp" srcSet={stillSrc(id, stillSizes.portraitWidth, 'webp', true)} />
          <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
          <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
          <img
            ref={img}
            src={stillSrc(id, w2, 'webp')}
            alt={alt}
            width={w2}
            height={(w2 * rh) / rw}
            loading="lazy"
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            onError={() => setFailed(true)}
          />
        </picture>
      )}
    </figure>
  )
}
