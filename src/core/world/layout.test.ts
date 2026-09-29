import { describe, expect, it } from 'vitest'
import { bearingBetween, bearingToDir, dirToBearing, exit, grove, inKeepOut, ringSlotDir, terrainHeight, threshold } from './layout'

const toXZ = (v: readonly [number, number, number]) => [v[0], v[2]] as const
const close = (a: readonly number[], b: readonly number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i]!))

describe('compass (design.md §0)', () => {
  it('north is +Z, east is −X, south is −Z, west is +X', () => {
    close(bearingToDir(0), [0, 0, 1])
    close(bearingToDir(90), [-1, 0, 0])
    close(bearingToDir(180), [0, 0, -1])
    close(bearingToDir(270), [1, 0, 0])
  })

  it('round-trips bearings', () => {
    for (const b of [0, 15, 90, 181.6, 270, 345]) {
      const d = bearingToDir(b)
      expect(dirToBearing(d[0], d[2])).toBeCloseTo(b)
    }
  })

  it('puts the lantern in the 午 mountain of the fire palace, bearing ≈ 181.6° from the grove', () => {
    const b = bearingBetween(toXZ(grove.centre), toXZ(exit.lantern.base))
    expect(b).toBeCloseTo(181.6, 1)
    expect(b).toBeGreaterThan(172.5)
    expect(b).toBeLessThan(187.5)
  })

  it('ring slot 4 (离9) points south, slot 6 (兑7) west', () => {
    expect(ringSlotDir(4)[2]).toBeCloseTo(-1)
    expect(ringSlotDir(6)[0]).toBeCloseTo(1)
    expect(grove.ringPalaces[4]).toBe(9)
    expect(grove.ringPalaces[6]).toBe(7)
  })

  it('palace centres are compass-true: 离9 south of 坎1, 震3 east of 兑7', () => {
    expect(grove.palaceCentre[9][2]).toBeLessThan(grove.palaceCentre[1][2])
    expect(grove.palaceCentre[3][0]).toBeLessThan(grove.palaceCentre[7][0])
  })
})

describe('terrain', () => {
  it('is flat, crests at 1.8 m, and drops past the ledge', () => {
    expect(terrainHeight(0, 24)).toBe(0)
    expect(terrainHeight(0, -90)).toBe(0)
    expect(terrainHeight(0, -120)).toBeCloseTo(1.8)
    expect(terrainHeight(0, -150)).toBe(0)
    expect(terrainHeight(0, -200)).toBe(-25)
  })
})

describe('keep-outs', () => {
  it('protect the path, the lantern sightline, the cabin and the grove; hero pines are placed by hand', () => {
    expect(inKeepOut(0, 6)).toBe(true)
    expect(inKeepOut(0.5, -100)).toBe(true)
    expect(inKeepOut(4, -63)).toBe(true)
    expect(inKeepOut(10, -150)).toBe(true)
    expect(inKeepOut(30, 10)).toBe(false)
    expect(threshold.cornerPineA.base[0]).toBe(4.6)
  })
})
