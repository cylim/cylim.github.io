import { breakpoint, layout } from '../../theme/tokens'

/**
 * The finale's picture window (design.md §8.7 E2): on landscape screens the paper-mount panels leave
 * a centred 3:4 window, an album leaf; portrait screens are already hanging-scroll shaped and keep
 * only a 12 px border. walk.css draws the same geometry (`50vw − 37.5svh` per mount). The fixed
 * header (landscape) and bottom bar (phones) cover the window's edge, so pins stay clear of them.
 */
export interface FinaleWindow {
  left: number
  top: number
  right: number
  bottom: number
}

export function finaleWindow(vw: number, vh: number): FinaleWindow {
  if (vw < breakpoint.desktop) {
    const b = layout.mountBorderPortrait
    return { left: b, top: b, right: vw - b, bottom: vh - layout.bottomBarHeight }
  }
  const mount = vw < vh ? layout.mountBorderPortrait : Math.max(0, vw / 2 - (vh * 3) / 8)
  return { left: mount, top: layout.headerHeight, right: vw - mount, bottom: vh }
}

/** A map pin shows only while its world point projects inside the window, with a little margin. */
export function insideWindow(p: { x: number; y: number }, w: FinaleWindow, margin = 8): boolean {
  return p.x >= w.left + margin && p.x <= w.right - margin && p.y >= w.top + margin && p.y <= w.bottom - margin
}
