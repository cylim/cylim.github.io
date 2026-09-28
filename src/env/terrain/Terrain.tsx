import { useEffect, useMemo } from 'react'
import { FrontSide, ShaderMaterial, Vector3, Vector4 } from 'three'
import { grove, pathZone } from '../../core/world/layout'
import fragGlsl from '../glsl/ground.frag.glsl'
import vertGlsl from '../glsl/ink.vert.glsl'
import { applyInkAttributeDefaults, baseDefines, inkPrelude } from '../materials/createInkMaterial'
import { envMaterial } from '../materials/portal'
import { worldUniforms } from '../materials/uniforms'
import { PATH_ENDS, PATH_HALF_WIDTH, PATH_TABLE, pathTable } from '../paths'
import { buildGround } from './groundGeometry'

/** Ground ink weight: a pale wash, so the paper-white path still reads against it. */
const GROUND_INK = 0.17

const glslFloat = (v: number) => v.toFixed(3)

function createGroundMaterial(): ShaderMaterial {
  const table = pathTable()
  const vec4s = Math.ceil(table.length / 4)
  const path = Array.from({ length: vec4s }, (_, i) => new Vector4(table[i * 4] ?? PATH_TABLE.noPath, table[i * 4 + 1] ?? PATH_TABLE.noPath, table[i * 4 + 2] ?? PATH_TABLE.noPath, table[i * 4 + 3] ?? PATH_TABLE.noPath))
  const mat = new ShaderMaterial({
    name: 'ground',
    vertexShader: vertGlsl,
    fragmentShader: `${inkPrelude()}\n${fragGlsl}`,
    defines: {
      ...baseDefines(),
      PATH_VEC4S: vec4s,
      PATH_COUNT: PATH_TABLE.count,
      PATH_Z0: glslFloat(PATH_TABLE.z0),
      PATH_STEP: glslFloat(PATH_TABLE.step),
      PATH_NONE: glslFloat(PATH_TABLE.noPath),
    },
    uniforms: {
      ...worldUniforms,
      uInkWeight: { value: GROUND_INK },
      uPath: { value: path },
      uPathEnds: { value: new Vector4(PATH_ENDS.toCabin[0], PATH_ENDS.toCabin[1], PATH_ENDS.toGrove[0], PATH_ENDS.toGrove[1]) },
      uPathHalf: { value: PATH_HALF_WIDTH },
      uStream: { value: new Vector3(pathZone.stream.centreZ, pathZone.stream.width / 2, 0) },
      uGrove: { value: new Vector3(grove.centre[0], grove.centre[2], grove.clearingRadius) },
    },
    side: FrontSide,
  })
  applyInkAttributeDefaults(mat)
  return envMaterial(mat)
}

/**
 * The ground from the northern meadow to the lowland under the ledge (design §5.1): paper toned,
 * following `terrainHeight`, with both path splines and the stream written as blank paper (留白).
 * The grove section draws the stream's ripples and stones on top.
 */
export function Terrain() {
  const geometry = useMemo(() => buildGround(), [])
  const material = useMemo(() => createGroundMaterial(), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  return <mesh name="ground" geometry={geometry} material={material} frustumCulled={false} />
}
