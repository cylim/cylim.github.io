/** Renders the sample set off the main thread (samples.ts) and transfers it back. One request per worker. */

import { renderSamples, transferables } from './samples'

self.addEventListener('message', (e: MessageEvent<{ sampleRate: number; seed: number }>) => {
  const set = renderSamples(e.data.sampleRate, e.data.seed)
  self.postMessage(set, { transfer: transferables(set) })
})
