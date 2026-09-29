/**
 * R3F receives pointer events through #root, so a pointer over a DOM card, link or the terminal
 * also raycasts whatever 3D sits behind it. A 3D hover must not steal focus from the DOM element
 * the visitor is actually pointing at (a DOM card's hover would otherwise light a different scroll).
 */
const DOM_CONTENT = '[data-card], a, button, input, textarea, select, [role="log"], header, nav'

export function overDomContent(e: { nativeEvent: Event }): boolean {
  const t = e.nativeEvent.target
  return t instanceof Element && t.closest(DOM_CONTENT) !== null
}
