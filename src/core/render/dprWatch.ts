/**
 * Calls `cb` with the new window.devicePixelRatio whenever it changes: the window moved to a display
 * with another scale, or the browser zoomed. A `(resolution: Xdppx)` query only reports leaving X, so
 * it is re-armed at the new ratio after every change. Returns a stop function.
 */
export function watchDevicePixelRatio(cb: (devicePixelRatio: number) => void): () => void {
  let query: MediaQueryList | null = null
  const onChange = () => {
    arm()
    cb(window.devicePixelRatio || 1)
  }
  const arm = () => {
    query?.removeEventListener('change', onChange)
    query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
    query.addEventListener('change', onChange)
  }
  arm()
  return () => query?.removeEventListener('change', onChange)
}
