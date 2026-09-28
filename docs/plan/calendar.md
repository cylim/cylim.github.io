# Calendar engine for the Grove Qimen chart

Decided 2026-09-28. Scope: how the site computes the solar-term instants and the four sexagenary pillars that the live 时家奇门 转盘 拆补法 chart needs.

## Decision

Use **tyme4ts 1.5.2** by 6tail, MIT, and import it only inside the lazy-loaded Grove chunk. Put it behind one adapter module, `src/grove/calendar.ts`. The adapter owns all timezone handling, and nothing else in the app imports tyme4ts.

I picked it because it was the most accurate candidate I tested. Over the 240 terms HKO publishes for 2019 to 2028, tyme4ts rounds to the HKO minute in 236 cases. The 4 misses sit within 1.2 s of a :30 rounding edge. For 2026 it matches 24 of 24. It also ships the pillar rules the chart needs: the year changes at the 立春 instant, the month at each 节 instant, and the 子时 day boundary can be set to 23:00 or 00:00. It is TypeScript-native, and its last release was in June 2026.

The cost is weight: about **75 KB gzip** added to the Grove chunk (257 KB minified, built with Vite 8.3.1). That is fine for a section we already lazy-load behind a fog dive. It is still roughly 25 times heavier than a hand-written solver of equal minute-level accuracy. If the Grove chunk goes over budget on the low mobile tier, use the fallback at the end of this doc. It swaps the adapter's internals for a 2.8 KB self-implemented solver and keeps tyme4ts as a dev-only test oracle. The adapter interface does not change.

## What the chart needs from the calendar

- The solar term in effect at the instant, plus its exact start. 拆补法 picks 阴遁/阳遁 and the 局 from the current 节气, which changes at the exact instant.
- The sexagenary day index, 0 to 59 with 0 = 甲子. The 符头 gives 上/中/下元: `yuan = Math.floor(dayIndex / 5) % 3` gives 0 上, 1 中, 2 下.
- The hour pillar, which sets 旬首 and 值符/值使.
- Year and month pillars, displayed on the chart.
- A choice of 子时 day boundary. Default to 23:00, the usual Qimen convention. Keep 00:00 as an option.
- Correct results for a visitor in any timezone.

## Candidates

| | tyme4ts | lunar-javascript | lunar-typescript | astronomy-engine | Self: VSOP87D truncated | Self: Meeus ch. 25 low accuracy |
|---|---|---|---|---|---|---|
| Version checked | 1.5.2, 2026-06-12 | 1.7.7, 2025-11-05 | 1.8.6, 2025-11-05 | 2.1.19, 2023-12-14 | n/a | n/a |
| License | MIT | MIT | MIT | MIT | ours; VSOP87 data is public | ours |
| Types | bundled `.d.ts` | none | bundled | bundled | ours | ours |
| Maintenance | active: 40 releases since 2024-01, repo pushed 2026-08, 506 stars. The author calls it the successor to Lunar. | still patched, but superseded by tyme4ts | same | no release since 2023-12 | us | us |
| Solar-term algorithm | 寿星天文历 port by 许剑伟: truncated VSOP87 Earth series + nutation + aberration + ΔT table | same 寿星 code | same | own VSOP87 truncation | VSOP87D Earth L series with 93+6+2 terms, abridged nutation, aberration, FK5 correction, ΔT table | mean-anomaly series |
| Pillars, 子时 option | yes: `DefaultEightCharProvider` / `LunarSect2EightCharProvider` | yes: `EightChar.setSect(1/2)` | yes | no | ~40 lines ours | ours |
| Bundle, min / gzip / brotli | 219 / 70 / 58 KB with esbuild; 257 / 75 / 60 KB with Vite 8 plus the adapter | 332 / 101 / 83 KB | 325 / 100 / 81 KB | 30 / 13 / 11 KB for `SearchSunLongitude` alone | 5.3 / 2.8 / 2.4 KB | < 1 KB |
| Max error vs HKO, 2019–2028 | 31.2 s | 31.0 s | same as JS | 59.5 s | 32.7 s | 827 s = 13.8 min |
| Rounds to HKO minute, 240 terms | **236** | 233 | same as JS | 194 | 235 | 9 |

Notes:

- Tree-shaking barely helps tyme4ts. Importing only `SolarTime`, `SolarTerm` and `LunarHour` bundles to 219 KB versus 222 KB for `export *`. Methods on the time classes reach almost every class, and static data tables count as side effects. The weight comes from the Earth VSOP87 table `XL0` (30 K chars), the Moon table `XL1` (23 K chars), the almanac 宜忌/神煞 strings and the holiday data.
- lunar-javascript and lunar-typescript run the same 寿星 code as tyme4ts and land within about 1 s of it, but they are 30 KB gzip heavier and lunar-javascript has no types. Nothing favours them over tyme4ts.
- astronomy-engine is light, but it misses the HKO minute on 46 of 240 terms and has no calendar layer. You would pay its size and still write the pillar code yourself.
- The Meeus low-accuracy formula is up to 14 minutes off. That rules it out for 节 boundaries.
- In the self-implemented solver the limit is nutation, not VSOP87 truncation. With all 1,080 VSOP87D Earth longitude terms it misses HKO 8 times, with 101 terms 5 times. The abridged 4-term nutation, good to ±0.5", accounts for ±12 s.

## How I measured

All scratch work is in `/tmp/calendar-eval`, which is not kept.

- **Accuracy authority.** The Hong Kong Observatory 24-solar-term tables in HKT = UTC+8, minute-rounded, for every year it still serves: 2019 to 2028, 240 terms. The source is `https://www.hko.gov.hk/en/gts/astronomy/data/files/24SolarTerms_<year>.xml`, the data behind `https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm`. HKO says the data comes from HM Nautical Almanac Office and USNO. It rounds to the nearest minute: 大寒 2026 is 09:44:56 exact and HKO prints 09:45. So a method is minute-correct when its instant rounds to the HKO value. Under that rule, errors up to ±30 s against the printed minute are expected.
- **Cross-check.** USNO seasons API, `https://aa.usno.navy.mil/api/seasons?year=2026`, UTC. tyme4ts gives 14:45:59, 08:24:30, 00:05:14 and 20:50:14. USNO lists 14:46, 08:24, 00:05 and 20:50. The June solstice sits right on the half-minute: HKO rounds it up to 16:25 HKT, USNO shows 08:24 UTC.
- **Pillar authority.** The HKO Almanac 2026 monthly calendars print the day 干支 under every date: `https://www.hko.gov.hk/en/gts/astron2026/files/2026cal02.pdf`, `2026cal09.pdf` and `2026cal12.pdf`. The year change 乙巳 to 丙午 is in the same pages. Month pillars follow from the 五虎遁 rule plus the HKO 节 instant. Hour pillars follow from the 五鼠遁 rule.
- **Bundle size.** Each candidate went through esbuild 0.28.2 with `--bundle --minify --format=esm`, importing only the functions the chart needs. The chosen adapter also went through Vite 8.3.1 in library mode. Sizes are `gzip -9`. GitHub Pages serves gzip.
- **Runtime cost**, Node 26 on desktop x64. Importing and evaluating the tyme4ts bundle takes 3 to 4.5 ms. The first `snapshot()` call takes 5 to 7 ms, and later calls about 0.2 ms each. On mid-range phones, expect several times that. Import it during the fog dive, not on the frame the chart appears.
- **Boundary test**, 1901–2100, all 4,800 terms. `SolarTime#getTerm()` flips at the exact second in 4,798 cases. The 2 failures are 1912 and 1913, see caveats. The month pillar flips exactly at every 节 instant, and the year pillar exactly at every 立春 instant.
- **Property test.** 21,200 instants: 20,000 random ones in 2000–2050, plus ±1 s around every 节 in that range. Each ran through the adapter with both day boundaries in 9 zones, including +05:30, +05:45, Chatham +12:45/+13:45 and St John's −03:30/−02:30. I compared every result with an independent calculation: term instants, then 五虎遁 and 五鼠遁, then day number = (JDN − 11) mod 60. There were 0 mismatches.

## The tyme4ts calls the adapter uses

Units and conventions, taken from reading the 1.5.2 source, not just the docs:

- `SolarTime.fromYmdHms(y, m, d, h, mi, s)` builds a **naive wall-clock** time. tyme4ts has no timezone concept.
- `solarTime.getTerm(): SolarTerm` returns the term in effect at that second. It checks the day's term, then compares against the exact instant.
- `solarTerm.getJulianDay(): JulianDay` gives the **exact start**. `.getDay()` is a float Julian Day and `.getSolarTime()` is a wall time rounded to the second. Both are in UTC+8, see "Timezone handling".
- `solarTerm.next(n)`, `.getIndex()`, `.getName()`, `.isJie()` and `.isQi()`. Index 0 = 冬至, 1 = 小寒, 3 = 立春, 11 = 芒种, 12 = 夏至, 23 = 大雪. Odd indices are 节: `isJie()` is `index % 2 === 1`. 阳遁 covers indices 0–11 and 阴遁 covers 12–23.
- `SolarTerm.fromIndex(year, index)` uses a year that begins at the previous December's 冬至. `fromIndex(2026, 0)` is 冬至 on 2025-12-21 at 23:03:05. `fromIndex(2026, 1..23)` is 小寒 to 大雪 of 2026. `fromIndex(2026, 24)`, the same as `fromIndex(2027, 0)`, is 冬至 on 2026-12-22 at 04:50:14.
- `solarTime.getSixtyCycleHour(): SixtyCycleHour` exposes `.getYear()`, `.getMonth()`, `.getDay()`, `.getSixtyCycle()` for the hour, and `.getEightChar()`. Each returns a `SixtyCycle` with `.getIndex()` from 0 to 59, 0 = 甲子, `.getName()`, `.getHeavenStem().getIndex()` from 0 to 9 and `.getEarthBranch().getIndex()` from 0 to 11. This path uses the default provider, so **the day rolls over at 23:00**.
- For a 00:00 boundary, get the day pillar from `SolarDay.fromYmd(y, m, d).getSixtyCycleDay().getSixtyCycle()`. That is a pure day count from 2000-01-07 = 甲子, the same as (JDN − 11) mod 60. The library's own switch is global state, `LunarHour.provider = new LunarSect2EightCharProvider()`, and it only affects `LunarHour#getEightChar()`. The adapter does not use it.
- The sexagenary day index is `pillars.day.index`, which is `SixtyCycle#getIndex()`.

Two traps:

1. Do not take month or year pillars from `SolarDay#getSixtyCycleDay()` or `SolarDay#getTerm()`. They resolve the term per day, not per second. For 2026-02-04 they return 庚寅 for the whole day, but before 04:02:08 the month is still 己丑. Always go through `SolarTime#getSixtyCycleHour()`.
2. From 23:00 to 23:59, tyme4ts always takes the hour stem from the **next** day, under either boundary. For example, 壬戌 day at 23:30 gives 壬子 with the 00:00 boundary. Some 夜子时 schools use the current day's stem instead, which would give 庚子. If the owner follows that school, compute that one hour stem by hand. It is not a library option.

## Timezone handling

What tyme4ts actually does:

- Every date and time object holds naive wall-clock fields.
- The astronomy is pinned to **UTC+8**. `ShouXingUtil.qiAccurate` returns `JD(TT) − ΔT + 1/3 day`, which is JD(UT) plus 8 hours. So `SolarTerm#getJulianDay().getDay()` is a "UTC+8 wall-clock Julian Day", not a true astronomical JD. To convert: `unixMs = (jd − 2440587.5) × 86 400 000 − 8 × 3 600 000`. UT here is UT1. It differs from UTC by less than 0.9 s, which I ignore. The library's ΔT for 2026 is 68.99 s, within a fraction of a second of the IERS-derived value.
- `SolarTime#getTerm()` and `SolarTime#getSixtyCycleHour()` compare your naive fields with those UTC+8 instants. If you pass a New York wall time straight in, every term boundary lands 13 hours late.

The rule the adapter follows:

1. The solar term, the year pillar at 立春 and the month pillar at each 节 depend on an **absolute instant**. Evaluate them from the instant's **UTC+8** wall fields, whatever the visitor's zone.
2. The day and hour pillars depend on the **chart's local civil clock**. Evaluate them from the instant's wall fields at the chart's UTC offset.
3. Build wall fields by shifting epoch milliseconds and reading the `getUTC*()` getters. Never call `new Date(y, m, d, h)`, because it applies the browser's own zone and hits that zone's DST gaps.

Feeding a zone:

- For the visitor's zone, call `Intl.DateTimeFormat().resolvedOptions().timeZone`, for example `"Europe/London"`. That is the adapter default.
- For a named IANA zone, `offsetMinutesFor(instant, tz)` reads `Intl.DateTimeFormat#formatToParts` with `hourCycle: 'h23'` and returns the offset at that instant, DST included. It handles offsets like +05:45 and +12:45. Evergreen browsers support it, and it needs no timezone database in the bundle.
- For a fixed offset, pass `utcOffsetMinutes`. Use +480 for "cast in Penang/Beijing time" and −300 for EST.
- Some practitioners strip daylight saving time. If we offer that, use `min(offset(Jan 1), offset(Jul 1))` for the year as the standard offset. True solar time needs the visitor's longitude, and a portfolio should not ask for geolocation, so leave it out of v1.

Worked example, sample 7 in the verification run. A visitor in New York opens the Grove at 2026-02-03 15:05 EST, which is 20:05 UTC. In UTC+8 that is 2026-02-04 04:05, three minutes after 立春, so the year is 丙午 and the month is 庚寅. The local civil date is still Feb 3, so the day is 戊申. 15:05 falls in 申时, and a 戊 day starts its hours from 壬子, so the hour is 庚申. Result: 丙午 庚寅 戊申 庚申. A naive UTC+8 cast would give 丙午 庚寅 己酉 丙寅, which is wrong for this visitor.

## Adapter prototype, verified: `src/grove/calendar.ts`

```ts
// Prototype of src/grove/calendar.ts, a thin adapter over tyme4ts that owns timezone handling.
import { SolarTime, SolarTerm, SolarDay } from 'tyme4ts';
import type { SixtyCycle } from 'tyme4ts';

/** tyme4ts works in naive wall-clock time; its astronomy is pinned to UTC+8 (China Standard Time). */
const TYME_OFFSET_MIN = 480;

export type DayBoundary = '23:00' | '00:00';
export interface GanZhi { index: number; name: string; stem: number; branch: number }
export interface TermInfo { index: number; name: string; isJie: boolean; start: Date }
export interface CalendarSnapshot {
  offsetMinutes: number;            // chart's UTC offset actually used
  localWallTime: string;            // chart-local wall time, e.g. 2026-02-03 15:05:00
  term: TermInfo;                   // solar term in effect at the instant (exact to the second)
  nextTerm: TermInfo;
  pillars: { year: GanZhi; month: GanZhi; day: GanZhi; hour: GanZhi };
  dayIndex: number;                 // 0..59 sexagenary day, 0 = 甲子, honours dayBoundary
}

const gz = (c: SixtyCycle): GanZhi => ({
  index: c.getIndex(), name: c.getName(),
  stem: c.getHeavenStem().getIndex(), branch: c.getEarthBranch().getIndex(),
});

/** UTC offset (minutes east of UTC) of an IANA zone at an instant, via Intl (works in all evergreen browsers). */
export function offsetMinutesFor(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Naive wall-clock SolarTime for an instant at a fixed UTC offset. */
function wallTime(instantMs: number, offsetMin: number): SolarTime {
  const d = new Date(Math.floor(instantMs / 1000) * 1000 + offsetMin * 60000);
  return SolarTime.fromYmdHms(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

/** tyme4ts JulianDay values are JD(UT) + 8h, i.e. a UTC+8 wall-clock JD. */
export const tymeJdToDate = (jd: number): Date =>
  new Date(Math.round((jd - 2440587.5) * 86400 - TYME_OFFSET_MIN * 60) * 1000);

const termInfo = (t: SolarTerm): TermInfo => ({
  index: t.getIndex(), name: t.getName(), isJie: t.isJie(), start: tymeJdToDate(t.getJulianDay().getDay()),
});

export function snapshot(instant: Date, opts: { timeZone?: string; utcOffsetMinutes?: number; dayBoundary?: DayBoundary } = {}): CalendarSnapshot {
  const ms = instant.getTime();
  const offset = opts.utcOffsetMinutes ?? offsetMinutesFor(instant, opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const boundary = opts.dayBoundary ?? '23:00';

  // 1) Everything tied to an absolute astronomical instant (term, year pillar @立春, month pillar @节):
  //    evaluate in tyme4ts's native UTC+8 frame, whatever the visitor's zone.
  const cst = wallTime(ms, TYME_OFFSET_MIN);
  const term = cst.getTerm();
  const cstHour = cst.getSixtyCycleHour();

  // 2) Everything tied to the civil clock (day + hour pillars): evaluate in the chart's local wall time.
  const local = wallTime(ms, offset);
  const localHour = local.getSixtyCycleHour();              // default provider: day rolls over at 23:00
  const day = boundary === '23:00'
    ? localHour.getDay()
    : SolarDay.fromYmd(local.getYear(), local.getMonth(), local.getDay()).getSixtyCycleDay().getSixtyCycle();

  const pillars = { year: gz(cstHour.getYear()), month: gz(cstHour.getMonth()), day: gz(day), hour: gz(localHour.getSixtyCycle()) };
  return {
    offsetMinutes: offset,
    localWallTime: `${local.getSolarDay().getYear()}-${String(local.getMonth()).padStart(2, '0')}-${String(local.getDay()).padStart(2, '0')} ${local.getName()}`,
    term: termInfo(term), nextTerm: termInfo(term.next(1)),
    pillars, dayIndex: pillars.day.index,
  };
}
```

Integration notes:

- Load it with `const cal = await import('./calendar')` from the Grove chunk entry, started when the fog dive toward `#grove` begins.
- Recompute on a timer. Fire at the earliest of `nextTerm.start`, the next odd-hour boundary in the chart zone, and the next minute if the UI shows a clock. A snapshot costs about 0.2 ms, so no worker is needed.
- The DOM/SEO layer renders the same snapshot as text. There is no build-time prerender of the chart, because it depends on the current time.

## Verification snippet and output

I ran this with Node 26.5.0 and tyme4ts 1.5.2 as `node verify.ts`. Node strips the TS types natively. The package is `"type": "module"`, next to `calendar.ts` above.

```ts
// Run: node verify.ts   (Node >= 22.18 strips TS types natively; tyme4ts@1.5.2)
import { SolarTerm } from 'tyme4ts';
import { snapshot, tymeJdToDate } from './calendar.ts';

// Authority 1: Hong Kong Observatory, 24 solar terms 2026, HKT (UTC+8), rounded to the minute:
// https://www.hko.gov.hk/en/gts/astronomy/data/files/24SolarTerms_2026.xml  and HKO Almanac 2026, 2026SolarTerms24.pdf
const HKO_2026 = ['01-05 16:23','01-20 09:45','02-04 04:02','02-18 23:52','03-05 21:59','03-20 22:46','04-05 02:40','04-20 09:39',
  '05-05 19:49','05-21 08:37','06-05 23:48','06-21 16:25','07-07 09:57','07-23 03:13','08-07 19:43','08-23 10:19','09-07 22:41',
  '09-23 08:05','10-08 14:29','10-23 17:38','11-07 17:52','11-22 15:23','12-07 10:53','12-22 04:50'];
const utc8 = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);

console.log('2026 solar terms, UTC+8 | tyme4ts (exact) | HKO (rounded) | error min | rounds to HKO?');
let worst = 0, misses = 0;
HKO_2026.forEach((hko, i) => {
  const term = SolarTerm.fromIndex(2026, i + 1);             // index 1 = 小寒 ... 24 = 冬至 of Dec 2026
  const t = tymeJdToDate(term.getJulianDay().getDay());
  const [md, hm] = hko.split(' ');
  const hkoMs = Date.parse(`2026-${md}T${hm}:00+08:00`);
  const errMin = (t.getTime() - hkoMs) / 60000;
  const ok = Math.round(t.getTime() / 60000) * 60000 === hkoMs;
  worst = Math.max(worst, Math.abs(errMin)); if (!ok) misses++;
  console.log(`${term.getName()}\t${utc8(t)}\t2026-${hko}\t${errMin >= 0 ? '+' : ''}${errMin.toFixed(2)}\t${ok ? 'yes' : 'NO'}`);
});
console.log(`max |error| = ${worst.toFixed(2)} min (HKO rounding alone allows 0.50); rounding mismatches = ${misses}/24\n`);

// Authority 2: day stem-branches printed in the HKO Almanac 2026 monthly calendars
// (https://www.hko.gov.hk/en/gts/astron2026/files/2026cal02.pdf, cal09.pdf, cal12.pdf):
//   Feb 3 戊申, Feb 4 己酉, Feb 17 壬戌, Feb 18 癸亥, Sep 28 乙巳, Dec 7 乙卯; year 乙巳 → 丙午 at 立春.
// Month pillar = 五虎遁 from the year stem, switching at the HKO 节 instant; hour pillar = 五鼠遁 from the day stem.
const samples: Array<[string, string, Parameters<typeof snapshot>[1], string]> = [
  ['1 min before 立春 (HKO 04:02)',      '2026-02-04T04:01:00+08:00', { utcOffsetMinutes: 480 }, '乙巳 己丑 己酉 丙寅'],
  ['1 min after 立春',                   '2026-02-04T04:03:00+08:00', { utcOffsetMinutes: 480 }, '丙午 庚寅 己酉 丙寅'],
  ['Lunar NY 23:30, day rolls at 23:00', '2026-02-17T23:30:00+08:00', { timeZone: 'Asia/Shanghai', dayBoundary: '23:00' }, '丙午 庚寅 癸亥 壬子'],
  ['Lunar NY 23:30, day rolls at 00:00', '2026-02-17T23:30:00+08:00', { timeZone: 'Asia/Shanghai', dayBoundary: '00:00' }, '丙午 庚寅 壬戌 壬子'],
  ['32 s before 大雪 (HKO 10:53)',        '2026-12-07T10:52:00+08:00', { timeZone: 'Asia/Kuala_Lumpur' }, '丙午 己亥 乙卯 辛巳'],
  ['today, Penang 14:30',                '2026-09-28T14:30:00+08:00', { timeZone: 'Asia/Kuala_Lumpur' }, '丙午 丁酉 乙巳 癸未'],
  ['New York 15:05 EST = 立春 +3 min',    '2026-02-03T15:05:00-05:00', { timeZone: 'America/New_York' }, '丙午 庚寅 戊申 庚申'],
];
console.log('sample | chart-local wall time (offset) | term in effect (start, UTC) | pillars | expected | ok');
let fails = 0;
for (const [label, iso, opts, expected] of samples) {
  const s = snapshot(new Date(iso), opts);
  const got = [s.pillars.year, s.pillars.month, s.pillars.day, s.pillars.hour].map((p) => p.name).join(' ');
  const ok = got === expected; if (!ok) fails++;
  console.log(`${label}\t${s.localWallTime} (${s.offsetMinutes >= 0 ? '+' : ''}${s.offsetMinutes / 60}h)\t${s.term.name} ${s.term.start.toISOString().slice(0, 19)}Z\t${got}\t${expected}\t${ok ? 'ok' : 'FAIL'}\tdayIndex=${s.dayIndex}`);
}
console.log(fails ? `${fails} FAILED` : 'all pillar samples match');
```

Output:

```
2026 solar terms, UTC+8 | tyme4ts (exact) | HKO (rounded) | error min | rounds to HKO?
小寒	2026-01-05 16:23:10	2026-01-05 16:23	+0.17	yes
大寒	2026-01-20 09:44:56	2026-01-20 09:45	-0.07	yes
立春	2026-02-04 04:02:08	2026-02-04 04:02	+0.13	yes
雨水	2026-02-18 23:51:56	2026-02-18 23:52	-0.07	yes
惊蛰	2026-03-05 21:59:00	2026-03-05 21:59	+0.00	yes
春分	2026-03-20 22:45:59	2026-03-20 22:46	-0.02	yes
清明	2026-04-05 02:40:00	2026-04-05 02:40	+0.00	yes
谷雨	2026-04-20 09:39:08	2026-04-20 09:39	+0.13	yes
立夏	2026-05-05 19:48:44	2026-05-05 19:49	-0.27	yes
小满	2026-05-21 08:36:45	2026-05-21 08:37	-0.25	yes
芒种	2026-06-05 23:48:21	2026-06-05 23:48	+0.35	yes
夏至	2026-06-21 16:24:30	2026-06-21 16:25	-0.50	yes
小暑	2026-07-07 09:56:57	2026-07-07 09:57	-0.05	yes
大暑	2026-07-23 03:13:05	2026-07-23 03:13	+0.08	yes
立秋	2026-08-07 19:42:43	2026-08-07 19:43	-0.28	yes
处暑	2026-08-23 10:18:49	2026-08-23 10:19	-0.18	yes
白露	2026-09-07 22:41:16	2026-09-07 22:41	+0.27	yes
秋分	2026-09-23 08:05:14	2026-09-23 08:05	+0.23	yes
寒露	2026-10-08 14:29:17	2026-10-08 14:29	+0.28	yes
霜降	2026-10-23 17:37:57	2026-10-23 17:38	-0.05	yes
立冬	2026-11-07 17:52:05	2026-11-07 17:52	+0.08	yes
小雪	2026-11-22 15:23:21	2026-11-22 15:23	+0.35	yes
大雪	2026-12-07 10:52:32	2026-12-07 10:53	-0.47	yes
冬至	2026-12-22 04:50:14	2026-12-22 04:50	+0.23	yes
max |error| = 0.50 min (HKO rounding alone allows 0.50); rounding mismatches = 0/24

sample | chart-local wall time (offset) | term in effect (start, UTC) | pillars | expected | ok
1 min before 立春 (HKO 04:02)	2026-02-04 04:01:00 (+8h)	大寒 2026-01-20T01:44:56Z	乙巳 己丑 己酉 丙寅	乙巳 己丑 己酉 丙寅	ok	dayIndex=45
1 min after 立春	2026-02-04 04:03:00 (+8h)	立春 2026-02-03T20:02:08Z	丙午 庚寅 己酉 丙寅	丙午 庚寅 己酉 丙寅	ok	dayIndex=45
Lunar NY 23:30, day rolls at 23:00	2026-02-17 23:30:00 (+8h)	立春 2026-02-03T20:02:08Z	丙午 庚寅 癸亥 壬子	丙午 庚寅 癸亥 壬子	ok	dayIndex=59
Lunar NY 23:30, day rolls at 00:00	2026-02-17 23:30:00 (+8h)	立春 2026-02-03T20:02:08Z	丙午 庚寅 壬戌 壬子	丙午 庚寅 壬戌 壬子	ok	dayIndex=58
32 s before 大雪 (HKO 10:53)	2026-12-07 10:52:00 (+8h)	小雪 2026-11-22T07:23:21Z	丙午 己亥 乙卯 辛巳	丙午 己亥 乙卯 辛巳	ok	dayIndex=51
today, Penang 14:30	2026-09-28 14:30:00 (+8h)	秋分 2026-09-23T00:05:14Z	丙午 丁酉 乙巳 癸未	丙午 丁酉 乙巳 癸未	ok	dayIndex=41
New York 15:05 EST = 立春 +3 min	2026-02-03 15:05:00 (-5h)	立春 2026-02-03T20:02:08Z	丙午 庚寅 戊申 庚申	丙午 庚寅 戊申 庚申	ok	dayIndex=44
all pillar samples match
```

How to read it. "error min" is tyme4ts's exact instant minus HKO's rounded minute. All 24 terms round to the HKO value. The one entry at −0.50, 夏至, is 16:24:30 exact, the same half-minute edge where USNO prints 08:24 UTC and HKO prints 16:25 HKT. Pillars are categories, so the minute-level check is the boundary samples. The ones 60 s and 32 s from a term instant switch on the correct side.

Worth porting into the repo's tests: the property test described under "How I measured", which is tyme4ts against independent arithmetic, and the 7 samples above as a Vitest table.

## Caveats

- **Historical dates before 1929.** In 5 terms between 1912 and 1928, tyme4ts's day-level term table puts the term on a different civil date than the exact instant. The historical Chinese calendar used Beijing local mean time, UTC+7:45:40, back then. For 2 of them, 1912 小雪 and 1913 秋分, `getTerm()` returns the previous term for the last 12 and 7 minutes before midnight. A live chart never goes there. If we ever add a "cast any date" scrubber, clamp it to 1930 onward or accept this.
- **Future ΔT.** Any instant after about 2035 is a prediction, whatever library you use. ΔT extrapolations disagree by tens of seconds by 2050. My self-implemented solver and tyme4ts differ by up to 90 s in 2050–2100 purely from ΔT models. If we add a scrubber, show a note past 2035.
- **The 夜子时 hour stem** follows tyme4ts's convention, see the traps above. Confirm with the owner which school he follows before launch.
- **DST.** The default is the visitor's civil clock, DST included. Decide in the Grove copy whether to say "cast for your local time" or to offer a standard-time toggle.
- **The global provider.** Never set `LunarHour.provider` in app code. It is module-global state, and the adapter does not need it.

## Fallback if the Grove chunk budget is exceeded

Swap the adapter's internals and keep `snapshot()` and its types unchanged:

- The solar term solver. Apparent solar longitude from VSOP87D Earth L0 to L2, truncated at 1e-7 rad × 0.1^power, which leaves 93 + 6 + 2 terms, plus R0/R1 terms ≥ 1e-5 AU for aberration. Add the FK5 correction of −0.09033", Meeus's 4-term nutation, aberration of −20.4898"/R, and a Newton solve for λ = k × 15°. For ΔT use an IERS-based table for 2000–2030 and the Espenak–Meeus polynomials outside it. Get the coefficients from the CDS mirror, `https://cdsarc.cds.unistra.fr/ftp/VI/81/VSOP87D.ear`, and generate them at build time. This measured 5.3 KB minified and 2.8 KB gzip. Against HKO 2019–2028 it has a max error of 32.7 s and rounds to HKO on 235 of 240 terms. It stays within 9 s of tyme4ts over the same years.
- Pillars as arithmetic. Year = (Gregorian year of the last 立春 − 4) mod 60. The month branch comes from the last 节, and its stem from 五虎遁: the 寅 month stem = (yearStem mod 5) × 2 + 2. Day = (JDN − 11) mod 60, with JDN taken from the chart-local date, plus one after 23:00 for the 23:00 boundary. Hour: branch = ⌊(h + 1) / 2⌋ mod 12, stem = (rolledDayStem mod 5) × 2 + branch. This is the logic the property test already uses as its oracle, and it passed all 42,400 checks.
- Move tyme4ts to `devDependencies` and keep the property test running against it in CI.

Cheaper improvement if we fall back: switching to the full IAU 1980 nutation series, 63 terms at about +1 KB, should close most of the remaining gap to tyme4ts. Nutation is the main error source, not VSOP87 truncation.

## Sources

- tyme4ts: https://github.com/6tail/tyme4ts, npm `tyme4ts@1.5.2`, docs https://6tail.cn/tyme.html. The EightCharProvider section documents "23:00-23:59日干支为明天" for the default provider and "为当天" for `LunarSect2EightCharProvider`. The README credits the solar-term algorithm to 许剑伟's 寿星天文历, https://github.com/sxwnl/sxwnl.
- lunar-javascript: https://github.com/6tail/lunar-javascript. lunar-typescript: https://github.com/6tail/lunar-typescript.
- astronomy-engine: https://github.com/cosinekitty/astronomy.
- HKO 24 solar terms: https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm and the XML data files `.../data/files/24SolarTerms_2019.xml` to `..._2028.xml`.
- HKO Almanac 2026: https://www.hko.gov.hk/en/gts/astron2026/almanac2026_index.htm, with the monthly calendars `files/2026calMM.pdf` and `files/2026SolarTerms24.pdf`.
- USNO seasons 2026: https://aa.usno.navy.mil/api/seasons?year=2026.
- VSOP87D: Bretagnon & Francou 1988, CDS catalogue VI/81, https://cdsarc.cds.unistra.fr/ftp/VI/81/.
- Meeus, *Astronomical Algorithms*, 2nd ed., ch. 22 for nutation, ch. 25 for solar coordinates and ch. 27 for equinoxes.
