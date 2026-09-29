import { describe, expect, it } from 'vitest'
import { motion } from '../theme/tokens'
import { toastLifetime } from './toast'

const noop = () => {}

describe('toastLifetime (QM-3)', () => {
  it('keeps a tap-to-act toast until the visitor acts: the lost-context restart never times out', () => {
    expect(toastLifetime({ message: '3D paused. Tap to restart.', onAction: noop })).toBeNull()
  })

  it('honours an explicit duration, and Infinity means stay', () => {
    expect(toastLifetime({ message: 'x', durationMs: 1500 })).toBe(1500)
    expect(toastLifetime({ message: 'x', durationMs: Number.POSITIVE_INFINITY })).toBeNull()
  })

  it('times out plain toasts after 4 s and toasts with a labelled button after 8 s', () => {
    expect(toastLifetime({ message: 'x' })).toBe(motion.toast)
    expect(toastLifetime({ message: 'x', actionLabel: 'Walk the forest anyway', onAction: noop })).toBe(motion.toast * 2)
  })
})
