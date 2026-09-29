/**
 * Stage preparation (QM-P3). Before the stage mounts, the procedural data its first render needs is
 * built in workers: the forest plan (Poisson scatter, the biggest item), the needle atlas and the
 * paper grain. Their caches are primed, so the render that follows only wraps finished data in
 * three objects instead of blocking the main thread for hundreds of ms on a phone.
 *
 * Everything degrades to the old path: without workers, on a worker error or after the time limit,
 * the caches stay cold and the render builds what it needs itself, exactly as before.
 */

import { primePaperGrain } from '../core/render/textures/paperGrain'
import { primeForestPlan, type ForestPlan } from './pines/forest'
import { primeNeedleAtlas } from './pines/needleAtlas'

export type PrepareJob = 'forest' | 'needles' | 'grain'

/** A job's answer; null when the worker couldn't do it (the page then builds it itself). */
export type PrepareResult = { job: 'forest'; forest: ForestPlan | null } | { job: 'needles' | 'grain'; texels: Uint8Array | null }

const JOBS: readonly PrepareJob[] = ['forest', 'needles', 'grain']

/** A slow phone must not wait on a stalled worker: past this, the render builds the rest itself. */
const LIMIT_MS = 6000

/** Primes the cache a worker's answer belongs to. */
export function applyPrepared(result: PrepareResult): void {
  if (result.job === 'forest') {
    if (result.forest) primeForestPlan(result.forest)
  } else if (result.texels) {
    if (result.job === 'needles') primeNeedleAtlas(result.texels)
    else primePaperGrain(result.texels)
  }
}

function runJob(job: PrepareJob): Promise<void> {
  return new Promise((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./prepare.worker.ts', import.meta.url), { type: 'module', name: `prepare-${job}` })
    } catch {
      resolve()
      return
    }
    const done = () => {
      clearTimeout(timer)
      worker.terminate()
      resolve()
    }
    const timer = setTimeout(done, LIMIT_MS)
    worker.addEventListener('message', (e: MessageEvent<PrepareResult>) => {
      applyPrepared(e.data)
      done()
    })
    worker.addEventListener('error', done)
    worker.addEventListener('messageerror', done)
    worker.postMessage(job, [])
  })
}

let pending: Promise<void> | null = null

/** Builds the stage's procedural data off the main thread, once per page. Never rejects. */
export function prepareEnvironment(): Promise<void> {
  pending ??= typeof Worker === 'undefined' ? Promise.resolve() : Promise.all(JOBS.map(runJob)).then(() => undefined)
  return pending
}
