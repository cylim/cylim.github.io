/** UI microcopy (content.md §7, design.md §4, §11, §13, §14). */

/**
 * Why the album (static version) is showing. index.html's head script writes the reason to
 * `<html data-static-reason>`; the album banner reads it. 'slow' comes from the benchmark fallback.
 */
export type AlbumReason = 'nowebgl' | 'reduced' | 'saveData' | 'memory' | 'pref' | 'param' | 'slow' | 'error'

export const ui = {
  skipLink: 'Skip to content',
  /** Shown under the fog-dive title card if the chunk is still loading 400 ms into the hold. */
  loading: 'Grinding ink…',
  jumpNavLabel: 'Jump to a place',
  backToTop: 'Back to the edge of the forest',
  glossHint: 'Hover or tap any character for its meaning.',
  /**
   * C1: the DOM twin of clicking the cabin's door or lattice (design.md §8.3, §15), a glide to the
   * doorway. TODO(owner): drafted, not in content.md.
   */
  openDoor: 'Open the door',
  /** Live region: "Now at Work". {label} is the nav label. */
  nowAt: 'Now at {label}',

  // Album (static version) banners
  noWebgl: "Your browser can't draw the forest, so here's the paper version. Same content, no 3D.",
  reducedMotion: 'You asked for less motion, so this is the still version. Same content, no camera flight.',
  switchToStill: 'Still version',
  switchToForest: 'Walk the forest',
  /**
   * Banner line per album reason. content.md §7 only has the first two.
   * TODO(owner): the saveData, memory, pref and param lines are drafted, not from content.md.
   */
  albumReasons: {
    nowebgl: "Your browser can't draw the forest, so here's the paper version. Same content, no 3D.",
    reduced: 'You asked for less motion, so this is the still version. Same content, no camera flight.',
    saveData: "You're saving data, so this is the still version. Same content, no 3D download.",
    memory: "This device is short on memory, so here's the still version. Same content, no 3D.",
    pref: 'This is the still version you picked. Same content, no camera flight.',
    param: 'This is the still version. Same content, no camera flight.',
    slow: "The forest was running slowly, so here's the still version.",
    error: "Your browser can't draw the forest, so here's the paper version. Same content, no 3D.",
  } satisfies Record<AlbumReason, string>,

  // Toasts
  contextLost: '3D paused. Tap to restart.',
  slowDevice: "The forest was running slowly, so here's the still version.",
  // TODO(owner): design.md §13.2 button label; content.md has "Walk the forest".
  slowDeviceAction: 'Walk the forest anyway',
  dismiss: 'Dismiss',

  // Bottom-right cluster and settings (design.md §4.1, §4.2)
  sound: 'Sound',
  settings: 'Settings',
  closeSettings: 'Close settings',
  quality: 'Quality',
  qualityOptions: { auto: 'Auto', low: 'Low', high: 'High' },
} as const
