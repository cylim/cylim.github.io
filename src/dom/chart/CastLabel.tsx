import { useChart } from './chartSource'
import { castLabel } from './format'

/** G1's "Cast for {localDateTime}, {timeZone}" (design.md §8.6). Client-only, like the chart. */
export default function CastLabel() {
  const chart = useChart()?.chart
  return chart ? <>{castLabel(chart)}</> : null
}
