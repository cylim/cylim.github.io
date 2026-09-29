import { useEffect, useLayoutEffect, useState } from 'react'
import { useJourney } from '../core/store/journey'
import { EnvDriver } from './EnvDriver'
import { Mist } from './mist/Mist'
import { Mountains } from './mountains/Mountains'
import { environmentMounted, environmentMounting } from './mountGate'
import { HeroPines } from './pines/HeroPines'
import { PineField } from './pines/PineField'
import { Rock } from './rock/Rock'
import { GroundStrokes } from './strokes/GroundStrokes'
import { Terrain } from './terrain/Terrain'

/** In mount order. Each builds its geometry in its first render, so each gets a task of its own. */
const LAYERS = [EnvDriver, Terrain, PineField, HeroPines, Rock, GroundStrokes, Mountains, Mist] as const

/**
 * The forest shared by every section, always mounted by core/render/Stage.tsx (design.md §5, §7.1,
 * §7.2): terrain and path strips, the pine field and hero pines, the rock, grass, fern and moss
 * strokes, the mountain ring and main peak, and the mist planes. Positions come from
 * core/world/layout.ts, counts from core/render/quality.ts TIERS.
 *
 * The layers mount one per task instead of in one long render (QM-P3: that render blocked the main
 * thread for a third of a second on a phone). The stage holds its first frame until the last one is
 * in (mountGate.ts), so nothing ever draws a partial forest.
 *
 * Hidden while the camera is inside the cabin: the hall's night shell covers everything then.
 */
export function Environment() {
  const inside = useJourney((s) => s.insideCabin)
  const [count, setCount] = useState(1)

  useLayoutEffect(() => {
    environmentMounting()
    return environmentMounted
  }, [])
  useEffect(() => {
    if (count >= LAYERS.length) return environmentMounted()
    const id = setTimeout(() => setCount((n) => n + 1), 0)
    return () => clearTimeout(id)
  }, [count])

  return (
    <group name="environment" visible={!inside}>
      {LAYERS.slice(0, count).map((Layer, i) => (
        // A fixed list that only grows, so the index is a stable key.
        <Layer key={i} />
      ))}
    </group>
  )
}
