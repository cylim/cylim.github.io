/**
 * Navigation API for the DOM layer and scenes. Three-free; ships in the boot chunk.
 *
 * Plain links need nothing from here: `<a data-jump href="#grove">` fog-dives through the delegated
 * handler in initHashNav, and `<button data-scroll-jvh="742">` glides to a journey position. Call
 * these from code: the terminal's `grove`, the finale's "Walk again", map pins, the door click.
 *
 * The DOM follows along through the store (`dive`, `jvh`, `active`) and one event: `window` receives
 * `cy:announce` (core/events.ts; the detail is the message) when a jump or glide settles ("Now at
 * Work"). core/ can't import src/dom, so the live region listens for it.
 */

export { startScrollDriver, scrollToJvh, scrollRange, jvhAtScrollY, scrollYAtJvh } from './ScrollDriver'
export type { ScrollDriverOptions } from './ScrollDriver'
export { diveTo, NEAR_JUMP_JVH } from './dive'
export type { DiveOptions } from './dive'
export { initHashNav, jumpTo, sectionOfHash } from './hashNav'
