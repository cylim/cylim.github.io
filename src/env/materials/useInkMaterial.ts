import { useEffect, useMemo } from 'react'
import { createInkMaterial, type InkMaterial, type InkMaterialOptions } from './createInkMaterial'

/**
 * An ink world material for a section's props (cabin shell, signpost, lantern, grove stones), created
 * once per distinct option set and disposed on unmount. Pass it as `material={mat}`; never as a
 * JSX `<shaderMaterial uniforms>` (R3F 9.6+ copies uniforms, which unshares the world uniforms).
 */
export function useInkMaterial(opts: InkMaterialOptions = {}): InkMaterial {
  const key = JSON.stringify(opts)
  const mat = useMemo(() => createInkMaterial(JSON.parse(key) as InkMaterialOptions), [key])
  useEffect(() => () => mat.dispose(), [mat])
  return mat
}
