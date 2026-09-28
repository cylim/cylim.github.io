import { journey } from '../store/journey'

/**
 * Keeps the viewport-derived store fields current: `portrait` (aspect below 1, §6.4) and
 * `reducedMotion` if the OS setting changes mid-visit. Returns a stop function.
 */
function onResize(): void {
  const portrait = innerWidth < innerHeight
  if (journey.getState().portrait !== portrait) journey.setState({ portrait })
}

export function startViewportWatch(): () => void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const onReduce = () => journey.setState({ reducedMotion: reduce.matches })
  addEventListener('resize', onResize)
  reduce.addEventListener('change', onReduce)
  onResize()
  return () => {
    removeEventListener('resize', onResize)
    reduce.removeEventListener('change', onReduce)
  }
}
