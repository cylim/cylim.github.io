import { generateTraceField, type TraceSpec } from './traceField'

/** Builds the CircuitWood trace texels off the main thread and hands the buffer back without a copy. */
self.addEventListener('message', (e: MessageEvent<TraceSpec>) => {
  const { data } = generateTraceField(e.data)
  self.postMessage(data, { transfer: [data.buffer] })
})
