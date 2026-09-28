# 时家奇门 · 转盘 · 拆补法: implementation spec

Status: authoritative, 2026-09-28. This file replaces `qimen-spec-A.md` (classical-sources lens) and `qimen-spec-B.md` (implementations lens). Keep those two only as research notes. `calendar.md` still decides the calendar engine; §4.3 says how this spec plugs into it.

Scope: the live Qimen chart in the Grove. The module takes one instant plus options and returns a fully resolved hour chart. It does no I/O and uses no randomness. §14 is a TypeScript reference implementation that passes every vector in §16. The vectors are also in `docs/plan/qimen-vectors.json`.

## 0. How this was checked

- The two earlier reference implementations, `qm_ref.py` from spec A and `ref.py` from spec B, agree on every plate and meta field they share for 40,000 random charts from 1950 to 2090. A quarter of them fall at 23:xx, and both 子-hour conventions the two share were run.
- The TypeScript listing in §14 reproduces all 29 vectors published in specs A and B, cell for cell. It also matches `ref.py` on 5,998 random instants from 1995 to 2040, in five UTC offsets and all three 子-hour modes, on every field including 暗干. It passes the property tests in §14.4 on 20,000 more instants.
- I cross-checked the 29 final vectors in §16 against four independent programs and two online charting tools. The programs are qimen-rs 0.2.0, kinqimen 0.0.6.6, 3meta 2.6.0 and taobi 0.4.5. The online tools are yixinsoft.com and china95.net (元亨利贞), both queried today. Every disagreement traces to a known, documented defect or convention in the other tool. §16.2 lists them.
- Two vectors come from classical tables: 《烟波钓叟歌》句解 and 《古今图书集成·艺术典》. §15 derives four vectors by hand.

## 1. Decisions at a glance

| Topic | Default | Options | Why, in one line |
|---|---|---|---|
| Clock for day and hour pillars | `civil`: the visitor's zone as the clock shows it, DST included | `standard` (DST removed), `trueSolar` (needs longitude); `utcOffsetMinutes` pins a fixed zone such as +480 | Every tool tested charts the wall time you type. Same as `calendar.md`. D1, D2 |
| Clock for solar term, year, month | The absolute instant | none | Terms are astronomical events. Both specs agree |
| 23:00–23:59 | `zi23`: day pillar and hour both belong to the next day | `split` (早晚子), `midnight` (夜子 uses the same day) | kinqimen, qimen-rs, 3meta, yixinsoft, tyme4ts default all use zi23. D3 |
| Term switch | At the exact instant, even inside a 时辰 | none | Both specs, all tools. §6 |
| Term ephemeris | tyme4ts values, as `calendar.md` decided | build-time table (recommended) or runtime adapter | Matches HKO to the minute in 236 of 240 terms. D9 |
| 元 | 拆补: 符头 = latest 甲 or 己 day; its branch gives 上/中/下. No 置闰 | none | Both specs, all tools except the mislabelled `qimen-dunjia` npm package |
| Palace 5 | Stars, doors and deities lodge in 坤2 (中五寄坤二) in both 遁 | none | 3meta's 阳遁→艮8 rejected. D7 |
| 旬首 in palace 5 | 值符 = 天禽, 值使 = 死门; the 值使 count starts at 5 | none | 古今图书集成 119/119, every tool but 3meta. D6 |
| 天禽 | Rides with 天芮 and carries palace 5's earth stem as a second heaven stem | none | Both specs, all tools |
| 八神 | Start at the lodged 值符 palace; 阳遁 clockwise, 阴遁 counter-clockwise | none | Both specs, all tools, 句解 worked examples |
| 八神 names | `huXuan`: 白虎 and 玄武 in both 遁 | `gouQue`: 阳遁 slots 4 and 5 read 勾陈 and 朱雀 | Both specs default to it; 元亨利贞, qimen-rs, 3meta, taobi print it. D5 |
| 暗干 | Optional, not rendered in v1. Rule: start the hour stem at the 值使 palace; if that palace's earth stem is the same stem, start at 中五 | none | yixinsoft, qimen-rs, qimen-go agree; spec A's variant rejected. D8 |
| Extras | 旬空 of the hour and the day, 驿马 from the hour, 伏吟/反吟 flags | none | D12 |

## 2. Constants and indexing

### 2.1 Cycles

Stems `甲乙丙丁戊己庚辛壬癸` have index 0 to 9. Branches `子丑寅卯辰巳午未申酉戌亥` have index 0 to 11. A sexagenary index `i`, 0 = 甲子 to 59 = 癸亥, has stem `i mod 10` and branch `i mod 12`. From a stem `s` and branch `b` of the same parity, `i = mod(6s − 5b, 60)`.

`mod(a, n)` is always the non-negative remainder, `((a % n) + n) % n` in JS.

### 2.2 Palaces

| No | Trigram | Direction | Azimuth° | Element | Branches | 二十四山 | Home star | Home door |
|---|---|---|---|---|---|---|---|---|
| 1 | 坎 | N | 0 | 水 | 子 | 壬子癸 | 天蓬 | 休门 |
| 8 | 艮 | NE | 45 | 土 | 丑 寅 | 丑艮寅 | 天任 | 生门 |
| 3 | 震 | E | 90 | 木 | 卯 | 甲卯乙 | 天冲 | 伤门 |
| 4 | 巽 | SE | 135 | 木 | 辰 巳 | 辰巽巳 | 天辅 | 杜门 |
| 9 | 离 | S | 180 | 火 | 午 | 丙午丁 | 天英 | 景门 |
| 2 | 坤 | SW | 225 | 土 | 未 申 | 未坤申 | 天芮 | 死门 |
| 7 | 兑 | W | 270 | 金 | 酉 | 庚酉辛 | 天柱 | 惊门 |
| 6 | 乾 | NW | 315 | 金 | 戌 亥 | 戌乾亥 | 天心 | 开门 |
| 5 | 中 | centre | none | 土 | none | none | 天禽 | none |

Each outer palace spans its azimuth ±22.5°, which is what the device-compass mode needs. The home positions are the 起例诗 "坎居一位是蓬休，芮死坤宫第二流。更有冲伤并辅杜，震三巽四总为头。禽星死五开心六，惊柱常从七兑游。"

This data is static. Keep it in a constants module; the chart output does not repeat it.

Display grid, south at the top as in every Chinese chart:

```
4 9 2
3 5 7
8 1 6
```

### 2.3 The ring

`RING = [1, 8, 3, 4, 9, 2, 7, 6]`, which is 坎 艮 震 巽 离 坤 兑 乾, or N NE E SE S SW W NW. "Clockwise" means forward in `RING`. That is increasing compass bearing, and it is also clockwise on the south-up grid above, because that grid is the north-up map turned 180°. `ringIdx(p)` is the position of palace `p` in `RING`.

`lodge(p)` is `p === 5 ? 2 : p` (中五寄坤二). It is used for every star, door and deity placement.

### 2.4 Sequences

- 三奇六仪 laying order: `QIYI = 戊己庚辛壬癸丁丙乙`.
- The 仪 each 甲 hides under: 甲子戊, 甲戌己, 甲申庚, 甲午辛, 甲辰壬, 甲寅癸. For 旬 number `x = 0..5` the 仪 is `QIYI[x]`.
- 八神 slots 0 to 7: 值符, 螣蛇, 太阴, 六合, 白虎, 玄武, 九地, 九天. Use the glyph 螣蛇; yixinsoft prints 腾蛇, the same deity.
- Solar terms from 冬至: `TERMS = [冬至, 小寒, 大寒, 立春, 雨水, 惊蛰, 春分, 清明, 谷雨, 立夏, 小满, 芒种, 夏至, 小暑, 大暑, 立秋, 处暑, 白露, 秋分, 寒露, 霜降, 立冬, 小雪, 大雪]`. Term `t` starts when the Sun's apparent geocentric ecliptic longitude reaches `mod(270 + 15t, 360)` degrees. Odd `t` are 节, the month boundaries. This index order is tyme4ts `SolarTerm#getIndex()` and sxtwl `jqIndex`.

English glosses are not part of this spec. `content.md` owns them, keyed by the Chinese names used here.

## 3. Inputs and the time basis

### 3.1 Inputs

```ts
buildChart(instantMs: number, terms: TermRow[], options: QimenOptions)
```

- `instantMs`: the absolute moment. The live chart passes `Date.now()`.
- `terms`: sorted solar-term start instants, §4.3.
- `options`: see §13. The zone comes from `timeZone` (IANA name, default `Intl.DateTimeFormat().resolvedOptions().timeZone`) or from `utcOffsetMinutes`, which wins when both are set.

### 3.2 Two clocks

1. The absolute instant decides the solar term, the year pillar and the month pillar. It does not depend on the visitor's zone.
2. The basis wall clock decides the day and hour pillars. `timeBasis` picks it.

Keep them apart. kinqimen, 3meta and yixinsoft all assume the typed wall time is Beijing time. A visitor in London on a term day would get the term boundary 8 hours off if the code did the same. Vector Q26 is the test: at 2026-06-20 20:30 in New York the instant is 00:30 UTC on the 21st, still 芒种, while the pillars follow the New York date.

### 3.3 `timeBasis`

| Value | Basis wall clock | Offset used |
|---|---|---|
| `civil` (default) | The clock as the visitor's device shows it | `offsetMinutesFor(instant, timeZone)`, DST included, or `utcOffsetMinutes` |
| `standard` | The zone's standard time, DST removed | `min(offset at Jan 1, offset at Jul 1)` of the instant's UTC year, or `utcOffsetMinutes` |
| `trueSolar` | Local apparent solar time | `4 × longitude + EoT` minutes, §3.4 |

Wall fields come from shifting epoch milliseconds by the offset and reading the `getUTC*()` getters. Never call `new Date(y, m, d, h)`: it applies the browser's own zone and falls into that zone's DST gaps.

For Malaysia and China, `civil` and `standard` are the same clock. For Penang, `trueSolar` runs about 79 ± 16 minutes behind the clock, so its hour pillar differs from the civil one most of the time (Q28 against Q01).

### 3.4 True solar time

NOAA "General Solar Position Calculations" equation of time, good to about one minute:

```
doy    = day of year of the UTC date (1 = Jan 1)
hr     = UTC hour as a decimal
g      = 2π/365 × (doy − 1 + (hr − 12)/24)
eotMin = 229.18 × (0.000075 + 0.001868 cos g − 0.032077 sin g − 0.014615 cos 2g − 0.040849 sin 2g)
offset = 4 × longitudeDegEast + eotMin        // minutes; basis wall = UTC + offset
```

For Q28 this gives 08:51:34. yixinsoft prints 08:52 for the same input. Treat true solar time as good to about a minute.

## 4. Calendar

### 4.1 Day pillar

```
days     = Date.UTC(Y, M − 1, D) / 86 400 000         // basis wall date; 1970-01-01 is 辛巳 = 17
civilIdx = mod(days + 17, 60)                          // same as mod(JDN + 49, 60) = mod(JDN − 11, 60)
dayIdx   = (h == 23 && ziHour == 'zi23') ? mod(civilIdx + 1, 60) : civilIdx
```

Anchors for tests: 1949-10-01 甲子 (0), 2000-01-01 戊午 (54), 2024-02-10 甲辰 (40), 2026-09-28 乙巳 (41). Spec B checked the formula against sxtwl for 73,000 consecutive days from 1900 with no mismatch. The HKO Almanac 2026 prints the same day pillars (`calendar.md`).

### 4.2 Hour pillar and the 子 hour

```
b         = mod(floor((h + 1) / 2), 12)                // 23 and 0 → 子, 1 and 2 → 丑 … 21 and 22 → 亥
basisIdx  = (h == 23 && ziHour != 'midnight') ? mod(civilIdx + 1, 60) : civilIdx
hourIdx   = mod((basisIdx mod 5) × 12 + b, 60)         // 五鼠遁: 甲己还加甲，乙庚丙作初 …
```

Only minutes 23:00–23:59 are disputed. 00:00–00:59 is the 子 hour of the civil day in every school. A boundary instant belongs to the new hour: 01:00:00 is 丑.

| `ziHour` | Day pillar at 23:xx | Hour pillar at 23:xx | Used by |
|---|---|---|---|
| `zi23` (default) | next civil day | next day's 子 | kinqimen, qimen-rs default, 3meta, yixinsoft, tyme4ts `getSixtyCycleHour`, lunar-javascript `getDayInGanZhiExact`, 易运盘 default |
| `split` (早晚子) | same civil day | next day's 子 | qimen-rs `--day-boundary midnight`, lunar-javascript sect 2, `calendar.md`'s `'00:00'` |
| `midnight` | same civil day | same day's 子, the pillar of 00:00–00:59 that day | taobi, qimen-dunjia `夜子時: 當日` |

What changes between them:

- The day pillar feeds only the 符头, hence the 元, and the 日空. `zi23` and `split` give different charts only when the next civil day is a 甲 or 己 day. That 23:00 hour is then always a 甲子 hour, so both charts are 伏吟, in different 局 (Q23, Q24).
- `midnight` also changes the hour pillar, so the 旬首 and the whole plate move (Q25). Its hour cycle jumps backwards at 23:00, which is why spec A argued against it. It is a real school with live implementations, so it stays an option, but no UI should expose it unless CY follows it.

### 4.3 Solar terms

A term starts at the instant the Sun's apparent longitude reaches its angle. The chart switches at that instant, so the source must be good to well under a minute. Textbook low-precision formulas are up to 14 minutes off and are ruled out.

Source: tyme4ts 1.5.2, as `calendar.md` decided. It rounds to the HKO minute for 236 of 240 terms in 2019–2028 and 24 of 24 in 2026. Convert its Julian days exactly as `calendar.md` does: `ms = round((jd − 2440587.5) × 86400 − 480 × 60) × 1000`.

The core function only needs a sorted table of `{ startMs, index }`. Two ways to supply it, with identical values:

1. Recommended: generate the table at build time from tyme4ts (script in §14.2) and ship it as JSON. 2000–2060 is 1,464 rows, 7.6 KB gzip as epoch seconds, or 4.3 KB delta-encoded. tyme4ts stays a dev dependency and test oracle. This is 70 KB lighter than the runtime adapter.
2. Or build it at runtime through the `calendar.md` adapter (`SolarTerm.fromIndex` plus `tymeJdToDate`).

Lookup: the row with the largest `startMs ≤ instant`. Near 1 January that is the previous December's 冬至, so the table must span year ends. The year pillar also looks back for the latest 立春, so the table must start at least 24 rows before the instant and must contain the next term after it. Throw outside that range; do not extrapolate.

Precision: tyme4ts, sxtwl and yixinsoft agree within about 20 s (惊蛰 2026: 21:59:00, 21:58:42 and 21:58:43 +08:00). A chart within a minute of a term instant may differ between tools, and nothing fixes that. The vectors stay at least 5 minutes from any term.

### 4.4 Year pillar

`yearIdx = mod(Y − 4, 60)`, where `Y` is the UTC year of the latest 立春 (index 3) at or before the instant. 立春 falls on 3–5 February, so the UTC year is the calendar year. Switch at the instant, not the date. 3meta and 元亨利贞 switch at the start of the 立春 date, which is wrong for a few hours each year (Q21).

### 4.5 Month pillar

Take the latest 节 (odd index) at or before the instant. Its month offset is `m = mod((index − 3) / 2, 12)`, so 立春 is 0 (寅), 惊蛰 1 (卯), and so on to 大雪 10 (子) and 小寒 11 (丑).

```
monthBranch = mod(m + 2, 12)
monthStem   = mod((yearIdx mod 5) × 2 + 2 + m, 10)       // 五虎遁: 甲己之年丙作首 …
```

The 小寒 month belongs to the previous 立春 year, which the formula handles because `yearIdx` has not changed yet. kinqimen and 元亨利贞 pick the month by date, so they show 己丑 on the morning of 2026-01-05 before 小寒 at 16:23 (Q05, Q14). This spec's 戊子 is right. The year and month pillars are display only; the plates do not use them.

## 5. 阴阳遁 and the 局 table

Term index 0–11 (冬至 to 芒种) is 阳遁; 12–23 (夏至 to 大雪) is 阴遁.

| Term | Index | λ☉ | 遁 | 上元 | 中元 | 下元 |
|---|---|---|---|---|---|---|
| 冬至 | 0 | 270 | 阳 | 1 | 7 | 4 |
| 小寒 | 1 | 285 | 阳 | 2 | 8 | 5 |
| 大寒 | 2 | 300 | 阳 | 3 | 9 | 6 |
| 立春 | 3 | 315 | 阳 | 8 | 5 | 2 |
| 雨水 | 4 | 330 | 阳 | 9 | 6 | 3 |
| 惊蛰 | 5 | 345 | 阳 | 1 | 7 | 4 |
| 春分 | 6 | 0 | 阳 | 3 | 9 | 6 |
| 清明 | 7 | 15 | 阳 | 4 | 1 | 7 |
| 谷雨 | 8 | 30 | 阳 | 5 | 2 | 8 |
| 立夏 | 9 | 45 | 阳 | 4 | 1 | 7 |
| 小满 | 10 | 60 | 阳 | 5 | 2 | 8 |
| 芒种 | 11 | 75 | 阳 | 6 | 3 | 9 |
| 夏至 | 12 | 90 | 阴 | 9 | 3 | 6 |
| 小暑 | 13 | 105 | 阴 | 8 | 2 | 5 |
| 大暑 | 14 | 120 | 阴 | 7 | 1 | 4 |
| 立秋 | 15 | 135 | 阴 | 2 | 5 | 8 |
| 处暑 | 16 | 150 | 阴 | 1 | 4 | 7 |
| 白露 | 17 | 165 | 阴 | 9 | 3 | 6 |
| 秋分 | 18 | 180 | 阴 | 7 | 1 | 4 |
| 寒露 | 19 | 195 | 阴 | 6 | 9 | 3 |
| 霜降 | 20 | 210 | 阴 | 5 | 8 | 2 |
| 立冬 | 21 | 225 | 阴 | 6 | 9 | 3 |
| 小雪 | 22 | 240 | 阴 | 5 | 8 | 2 |
| 大雪 | 23 | 255 | 阴 | 4 | 7 | 1 |

Verses, from the 《烟波钓叟歌》句解:

> 阳遁歌：冬至惊蛰一七四，小寒二八五同推。春分大寒三九六，芒种六三九是真。谷雨小满五二八，立春八五二相随。立夏清明四一七，九六三从雨水期。
>
> 阴遁歌：夏至白露九三六，小暑八二五重逢。秋分大暑七一四，立秋二五八流通。霜降小雪五八二，大雪四七一相同。处暑排来一四七，立冬寒露六九三。

Ship the literal table and unit-test it against its generator. With `s = +1` for 阳 and −1 for 阴:

- `中 = mod(上 − 1 + 6s, 9) + 1` and `下 = mod(中 − 1 + 6s, 9) + 1`.
- The terms form eight groups of three starting at index 0, 3, 6, … 21. A group's first 上元 is the palace of its 八节: 冬至 1, 立春 8, 春分 3, 立夏 4, 夏至 9, 立秋 2, 秋分 7, 立冬 6. Within a group, `上[k] = mod(上[k−1] − 1 + s, 9) + 1`.

Specs A and B print the same table cell for cell, and so do kinqimen, qimen-rs, qimen-go, bigfishmarquis, 3meta, taobi and yixinsoft.

## 6. 拆补法: the 元

```
fuTouIdx = dayIdx − (dayIdx mod 5)        // latest 甲 or 己 day, inclusive
yuan     = floor(dayIdx / 5) mod 3        // 0 上元, 1 中元, 2 下元
ju       = JU[termIndexAtInstant][yuan]
```

The 符头's branch gives the 元: 子午卯酉 上, 寅申巳亥 中, 辰戌丑未 下. In order the twelve 符头 are 甲子上, 己巳中, 甲戌下, 己卯上, 甲申中, 己丑下, 甲午上, 己亥中, 甲辰下, 己酉上, 甲寅中, 己未下.

Rules:

- `dayIdx` is the day pillar after the 子-hour rule of §4.1.
- The term is the one in effect at the instant, not the one in effect on the 符头 day. No 置闰, 超神, 接气 or 闰奇. Those belong to the 置闰法.
- The new term applies from its exact instant, even partway through a 时辰. Q17 and Q18 are the same 丙申 hour on either side of 夏至 2026; Q19 and Q20 the same 庚辰 hour on either side of 秋分.
- A term rarely starts on a 上元 day. 秋分 2026 begins on 庚子, a 中元 day, and runs 中元 from 09-23, 下元 from 09-27 甲辰, 上元 from 10-02 己酉, and 中元 again from 10-07 甲寅 until 寒露 at 10-08 14:29. The 元 comes from the day and the term from the instant, so this needs no extra code. That split-and-borrow pattern is what 拆 and 补 describe.

Do not copy the npm package `qimen-dunjia` (arc119226). Its "拆補" assigns the 元 by days since the term instant, which is the 茅山法.

## 7. 地盘 (earth plate)

```
s = 阳 ? +1 : −1
for k in 0..8:  earth[ mod(ju − 1 + s·k, 9) + 1 ] = QIYI[k]
```

戊 starts at the palace numbered `ju`; the rest follow the Luo Shu numbers forward for 阳 and backward for 阴. Palace 5 is an ordinary step. There are only 18 earth plates:

| 局 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 |
|---|---|---|---|---|---|---|---|---|---|
| 阳1 | 戊 | 己 | 庚 | 辛 | 壬 | 癸 | 丁 | 丙 | 乙 |
| 阳2 | 乙 | 戊 | 己 | 庚 | 辛 | 壬 | 癸 | 丁 | 丙 |
| 阳3 | 丙 | 乙 | 戊 | 己 | 庚 | 辛 | 壬 | 癸 | 丁 |
| 阳4 | 丁 | 丙 | 乙 | 戊 | 己 | 庚 | 辛 | 壬 | 癸 |
| 阳5 | 癸 | 丁 | 丙 | 乙 | 戊 | 己 | 庚 | 辛 | 壬 |
| 阳6 | 壬 | 癸 | 丁 | 丙 | 乙 | 戊 | 己 | 庚 | 辛 |
| 阳7 | 辛 | 壬 | 癸 | 丁 | 丙 | 乙 | 戊 | 己 | 庚 |
| 阳8 | 庚 | 辛 | 壬 | 癸 | 丁 | 丙 | 乙 | 戊 | 己 |
| 阳9 | 己 | 庚 | 辛 | 壬 | 癸 | 丁 | 丙 | 乙 | 戊 |
| 阴1 | 戊 | 乙 | 丙 | 丁 | 癸 | 壬 | 辛 | 庚 | 己 |
| 阴2 | 己 | 戊 | 乙 | 丙 | 丁 | 癸 | 壬 | 辛 | 庚 |
| 阴3 | 庚 | 己 | 戊 | 乙 | 丙 | 丁 | 癸 | 壬 | 辛 |
| 阴4 | 辛 | 庚 | 己 | 戊 | 乙 | 丙 | 丁 | 癸 | 壬 |
| 阴5 | 壬 | 辛 | 庚 | 己 | 戊 | 乙 | 丙 | 丁 | 癸 |
| 阴6 | 癸 | 壬 | 辛 | 庚 | 己 | 戊 | 乙 | 丙 | 丁 |
| 阴7 | 丁 | 癸 | 壬 | 辛 | 庚 | 己 | 戊 | 乙 | 丙 |
| 阴8 | 丙 | 丁 | 癸 | 壬 | 辛 | 庚 | 己 | 戊 | 乙 |
| 阴9 | 乙 | 丙 | 丁 | 癸 | 壬 | 辛 | 庚 | 己 | 戊 |

The 阴九局 row matches the one printed in the yi958 article. The table equals the formula; ship either and test one against the other.

## 8. 旬首, 值符 and 值使

```
xun       = floor(hourIdx / 10)            // 0 甲子, 1 甲戌, 2 甲申, 3 甲午, 4 甲辰, 5 甲寅
xunYi     = QIYI[xun]                      // 戊 己 庚 辛 壬 癸
P0        = earth palace of xunYi          // 1..9, may be 5
home      = lodge(P0)                      // rotation origin for stars and doors
zhiFuStar = HOME_STAR[P0]                  // P0 = 5 → 天禽
zhiShiDoor= HOME_DOOR[home]                // P0 = 5 → 死门
```

烟波钓叟歌: "九宫逢甲为直符，八门值使自分明。符上之门为直使，十时一易堪凭据". The 句解 spells out the centre case: "又换甲辰在中宫，天禽为值符，则死门为值使". All 119 hours in the 古今图书集成 tables whose 旬首 sits in 中5 list 禽 and 死.

When `P0 = 5`, label the 值符 天禽. It is drawn in whichever palace the 天芮/天禽 pair lands. A display string such as "值符 天禽 (寄坤, 随天芮)" works; kinqimen's habit of writing 禽 in 天芮's slot is the same data.

## 9. 天盘 (heaven plate)

### 9.1 Where the 值符 lands

"值符常遣加时干": the 值符 star goes to the palace where the hour stem sits on the earth plate.

```
hStem   = STEMS[hourIdx mod 10]
useStem = (hStem == 甲) ? xunYi : hStem     // 甲 hides under its 仪
PtRaw   = earth palace of useStem           // may be 5
Pt      = lodge(PtRaw)
```

The 句解: "此时六戊在五宫寄坤二，以值符加时干，即六戊临二宫". yixinsoft's text header prints the raw palace ("值符天冲星落五宫") while its grid draws the star in 坤2. Output both.

### 9.2 Rotating the stars

```
r = mod(ringIdx(Pt) − ringIdx(home), 8)
for i in 0..7:
    src = RING[i]; dst = RING[(i + r) mod 8]
    stars[dst]  = [HOME_STAR[src]]
    heaven[dst] = [earth[src]]                    // a star carries its home palace's earth stem
    if src == 2: stars[dst].push(天禽); heaven[dst].push(earth[5])
```

- The rotation is rigid in both 遁. Never reverse the star list for 阴遁. kinqimen reverses both the ring and the list, which is equivalent.
- 天禽 and palace 5's earth stem ride with 天芮 in every chart, not only when 天禽 is the 值符. That palace shows two stars and two heaven stems in the order [天芮's, 天禽's].
- Palace 5 has no star and no heaven stem. 3meta repeats 天禽 there; do not.
- Every 甲 hour has `r = 0`: the heaven plate equals the earth plate. `r = 0` also happens when `Pt == home` for other reasons, for example 旬首 in 坤2 with the hour stem in 中5. kinqimen scrambles the heaven stems in exactly that case.

## 10. 八门 (doors)

```
n     = hourIdx mod 10                           // hours since the 旬首 hour
DtRaw = mod(P0 − 1 + s·n, 9) + 1                 // count from the RAW P0, through 5 like any palace
Dt    = lodge(DtRaw)
rd    = mod(ringIdx(Dt) − ringIdx(home), 8)
for i in 0..7:  doors[RING[(i + rd) mod 8]] = HOME_DOOR[RING[i]]
```

"值使逆顺遁宫去". The 句解's example: "假如冬至上元阳一局，图内乙庚日申时，就以伤门为值使，乃时干甲申居三宫也。阳遁顺飞，阴遁逆飞".

Traps, each seen in a real implementation:

1. Starting from `lodge(P0)` when `P0 = 5`. 3meta does this (Q08, Q09, Q10). The 古今图书集成 row 阴七局 丁亥 "禽一死二" only works counting from 5: 5, 4, 3, 2.
2. Skipping palace 5 while counting. It is a step.
3. Sending a landing on 5 anywhere but 坤2. 3meta sends it to 艮8 in 阳遁 (Q14, Q21).
4. Reversing the door order for 阴遁.

Every 甲 hour has `n = 0` and every 癸 hour has `n = 9`, a full lap. Both put the doors at home (门伏吟, Q04).

## 11. 八神 (deities, 转盘 set)

```
for k in 0..7:  deity[ RING[mod(ringIdx(Pt) + s·k, 8)] ] = SLOT[k]     // 阳 clockwise, 阴 counter-clockwise
```

Slot 0, 值符, sits with the 值符 star at `Pt`, after lodging. 烟波钓叟歌: "值符前三六合位，太阴之神在前二。后一宫中为九天，后二之神为九地", where 前 is the direction of the 遁. The 句解's two worked examples are both reproduced: 阳遁一局 丙寅时 gives 值符 8, 九天 1, 九地 6, 太阴 4, 六合 9 (Q05), and 阴遁九局 丙寅时 gives 值符 2, 九天 7, 九地 6, 太阴 4, 六合 3.

Names by `deityNames`:

| Option | Slot 4 | Slot 5 |
|---|---|---|
| `huXuan` (default) | 白虎 | 玄武 |
| `gouQue` | 阳遁 勾陈, 阴遁 白虎 | 阳遁 朱雀, 阴遁 玄武 |

Positions never change; only two labels do. Store `deitySlot` so logic never depends on the label.

## 12. Extras

### 12.1 旬空

For a sexagenary index `i`, the void branches are `b0 = mod(floor(i / 10) × 10 + 10, 12)` and `b0 + 1`: 甲子旬 戌亥, 甲戌旬 申酉, 甲申旬 午未, 甲午旬 辰巳, 甲辰旬 寅卯, 甲寅旬 子丑. Map branches to palaces with 子1 丑8 寅8 卯3 辰4 巳4 午9 未2 申2 酉7 戌6 亥6, dedupe, sort ascending. 戌亥 gives `[6]` and 辰巳 gives `[4]`.

Compute it for the hour pillar (时空, the one Qimen reading uses) and for the day pillar (日空). yixinsoft prints both.

### 12.2 驿马

From the hour branch: 申子辰 → 寅 (8), 寅午戌 → 申 (2), 巳酉丑 → 亥 (6), 亥卯未 → 巳 (4). 3meta maps 亥卯未 to 申, which is wrong.

### 12.3 伏吟 and 反吟

`fuYin.stars = (r == 0)`, `fanYin.stars = (r == 4)`, `fuYin.doors = (rd == 0)`, `fanYin.doors = (rd == 4)`. In 转盘 the heaven stems ride with the stars, so a stem 伏吟 is the same event as a star 伏吟.

### 12.4 暗干 (optional, not rendered in v1)

Method 时干加值使, with the 中五 fallback:

```
k0          = QIYI.indexOf(useStem)                      // 甲 already replaced by the 旬首仪
hiddenStart = (earth[Dt] == useStem) ? 5 : Dt           // 重干起中五
hidden[p]   = QIYI[ mod(k0 + s·(p − hiddenStart), 9) ]   // over palace numbers 1..9, palace 5 included
```

This is the same as laying `QIYI` from `useStem` at `hiddenStart` along palace numbers, ascending for 阳 and descending for 阴. Palace 5 gets its own hidden stem; yixinsoft prints it inside 坤2 next to 坤2's own. Only one other school is common, 门下藏干, where each door carries its home palace's earth stem. It is not implemented. §17 D8 explains why spec A's variant was rejected.

### 12.5 Lodged earth stem

Under 中五寄坤二 the centre earth stem also lives in 坤2. Output it as `lodgedEarth` on palace 2 and let the UI decide whether to draw it. yixinsoft does not draw it; qimen-rs and 3meta do.

### 12.6 When the chart changes

The chart can only change at a 时辰 boundary of the basis clock or at a term instant. `nextChangeUtc` is the earliest of:

- the next term start;
- the next odd hour `hh:00:00` of the basis clock, and also the next 00:00 when `ziHour` is `split` or `midnight`, because the day pillar and the 符头 change then.

After the timer fires, rebuild the chart rather than trusting the old offset; that absorbs DST jumps. Also rebuild on `visibilitychange`, since mobile browsers throttle timers.

## 13. Output data structure

```ts
export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type PalaceNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type OuterPalaceNo = Exclude<PalaceNo, 5>;
export type Star = '天蓬' | '天芮' | '天冲' | '天辅' | '天禽' | '天心' | '天柱' | '天任' | '天英';
export type Door = '休门' | '生门' | '伤门' | '杜门' | '景门' | '死门' | '惊门' | '开门';
export type Deity = '值符' | '螣蛇' | '太阴' | '六合' | '白虎' | '玄武' | '九地' | '九天' | '勾陈' | '朱雀';

export interface QimenOptions {
  timeZone?: string;                              // IANA zone; default: Intl resolved zone of the device
  utcOffsetMinutes?: number;                      // fixed offset, minutes east of UTC; overrides timeZone
  timeBasis?: 'civil' | 'standard' | 'trueSolar'; // default 'civil'
  longitude?: number;                             // degrees east; required when timeBasis = 'trueSolar'
  ziHour?: 'zi23' | 'split' | 'midnight';         // default 'zi23'
  deityNames?: 'huXuan' | 'gouQue';               // default 'huXuan'
}
export type ResolvedOptions = Required<Omit<QimenOptions, 'timeZone' | 'utcOffsetMinutes' | 'longitude'>> & {
  timeZone: string | null; utcOffsetMinutes: number | null; longitude: number | null;
};

/** One row per solar term: start instant (epoch ms, UTC) and index 0..23 with 0 = 冬至. Sorted by startMs. */
export interface TermRow { startMs: number; index: number }
export interface GanZhi { index: number; stem: Stem; branch: Branch; name: string }
export interface Wall { y: number; mo: number; d: number; h: number; mi: number; s: number }
```

`buildChart` returns:

| Field | Meaning |
|---|---|
| `instantUtc` | The input instant, ISO 8601 |
| `basis` | `{ timeBasis, offsetMinutes, local }`: the wall clock used for the day and hour pillars. `offsetMinutes` is fractional for `trueSolar` |
| `options` | The resolved options |
| `pillars` | `{ year, month, day, hour }`, each `{ index, stem, branch, name }` |
| `solarTerm` | `{ index, name, startUtc, next: { index, name, startUtc } }` |
| `dun`, `yuan`, `ju` | `'yang' \| 'yin'`, `'upper' \| 'middle' \| 'lower'`, 1–9 |
| `fuTou` | The 符头 pillar |
| `xunShou` | `{ head, yi, palace }`, for example 甲戌, 己, 3. `palace` may be 5 |
| `zhiFu` | `{ star, homePalace, stem, palaceRaw, palace }`. `homePalace` is `P0` and may be 5; `stem` is `useStem`; `palace` is lodged |
| `zhiShi` | `{ door, homePalace, steps, palaceRaw, palace }`. `homePalace` is `lodge(P0)`; `steps` is `n` |
| `rotation` | `{ stars: r, doors: rd }`, clockwise ring steps 0–7 |
| `fuYin`, `fanYin` | `{ stars, doors }` booleans |
| `void` | `{ hour, hourPalaces, day, dayPalaces }` |
| `horse` | `{ branch, palace }` |
| `hiddenStart` | Start palace of the 暗干 |
| `nextChangeUtc` | §12.6 |
| `palaces` | `Record<1..9, { earth, heaven, stars, door, deity, deitySlot, hidden, lodgedEarth, flags }>`. Palace 5 has `heaven: []`, `stars: []`, `door: null`, `deity: null`. `flags` is `{ zhiFu, zhiShi, hourVoid, dayVoid, horse }` |

Values are the Chinese names, because `content.md` keys its glosses by them and every tool prints them. Static palace data (trigram, direction, azimuth, element, branches, mountains) comes from the §2.2 constants.

## 14. Reference implementation

### 14.1 `qimen.ts`

Verified: passes all 29 vectors in §16, matches spec B's Python reference on 5,998 random instants on every field, and passes the property tests in §14.4.

```ts
// 时家奇门 · 转盘 · 拆补法: reference implementation of docs/plan/qimen-spec.md.
// Pure: no I/O, no Date.now(). Solar terms are injected as a sorted table.

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type PalaceNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type OuterPalaceNo = Exclude<PalaceNo, 5>;
export type Star = '天蓬' | '天芮' | '天冲' | '天辅' | '天禽' | '天心' | '天柱' | '天任' | '天英';
export type Door = '休门' | '生门' | '伤门' | '杜门' | '景门' | '死门' | '惊门' | '开门';
export type Deity = '值符' | '螣蛇' | '太阴' | '六合' | '白虎' | '玄武' | '九地' | '九天' | '勾陈' | '朱雀';

export interface QimenOptions {
  timeZone?: string;                              // IANA zone; default: Intl resolved zone of the device
  utcOffsetMinutes?: number;                      // fixed offset, minutes east of UTC; overrides timeZone
  timeBasis?: 'civil' | 'standard' | 'trueSolar'; // default 'civil'
  longitude?: number;                             // degrees east; required when timeBasis = 'trueSolar'
  ziHour?: 'zi23' | 'split' | 'midnight';         // default 'zi23'
  deityNames?: 'huXuan' | 'gouQue';               // default 'huXuan'
}
export type ResolvedOptions = Required<Omit<QimenOptions, 'timeZone' | 'utcOffsetMinutes' | 'longitude'>> & {
  timeZone: string | null; utcOffsetMinutes: number | null; longitude: number | null;
};

/** One row per solar term: start instant (epoch ms, UTC) and index 0..23 with 0 = 冬至. Sorted by startMs. */
export interface TermRow { startMs: number; index: number }
export interface GanZhi { index: number; stem: Stem; branch: Branch; name: string }
export interface Wall { y: number; mo: number; d: number; h: number; mi: number; s: number }

export const STEMS = '甲乙丙丁戊己庚辛壬癸';
export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
export const TERM_NAMES = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];
/** [上元, 中元, 下元] 局 by term index (0 = 冬至). */
export const JU_TABLE: readonly (readonly [number, number, number])[] = [
  [1, 7, 4], [2, 8, 5], [3, 9, 6], [8, 5, 2], [9, 6, 3], [1, 7, 4], [3, 9, 6], [4, 1, 7], [5, 2, 8], [4, 1, 7], [5, 2, 8], [6, 3, 9],
  [9, 3, 6], [8, 2, 5], [7, 1, 4], [2, 5, 8], [1, 4, 7], [9, 3, 6], [7, 1, 4], [6, 9, 3], [5, 8, 2], [6, 9, 3], [5, 8, 2], [4, 7, 1],
];
const QIYI = '戊己庚辛壬癸丁丙乙';                  // 六仪 then 三奇; QIYI[x] is also the 仪 hiding 旬 x's 甲
const RING: OuterPalaceNo[] = [1, 8, 3, 4, 9, 2, 7, 6]; // 坎艮震巽离坤兑乾 = clockwise
const HOME_STAR: Record<PalaceNo, Star> = { 1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英' };
const HOME_DOOR: Record<OuterPalaceNo, Door> = { 1: '休门', 8: '生门', 3: '伤门', 4: '杜门', 9: '景门', 2: '死门', 7: '惊门', 6: '开门' };
const DEITIES: Deity[] = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];
const BRANCH_PALACE: PalaceNo[] = [1, 8, 8, 3, 4, 4, 9, 2, 2, 7, 6, 6]; // 子..亥
const HORSE_OF: number[] = [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5];  // hour branch → 驿马 branch (申子辰→寅, 巳酉丑→亥, 寅午戌→申, 亥卯未→巳)

export const mod = (a: number, n: number) => ((a % n) + n) % n;
const lodge = (p: PalaceNo): OuterPalaceNo => (p === 5 ? 2 : p) as OuterPalaceNo;   // 中五寄坤二
const ringIdx = (p: OuterPalaceNo) => RING.indexOf(p);
export const gz = (i: number): GanZhi => {
  const index = mod(i, 60);
  const stem = STEMS[index % 10] as Stem, branch = BRANCHES[index % 12] as Branch;
  return { index, stem, branch, name: stem + branch };
};

// ---------------------------------------------------------------- §2 time basis
/** UTC offset (minutes east) of an IANA zone at an instant. */
export function offsetMinutesFor(instantMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric',
    day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = Object.fromEntries(dtf.formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]));
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wallAsUtc - Math.floor(instantMs / 1000) * 1000) / 60000);
}
const wallOf = (ms: number): Wall => {
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
};
/** NOAA equation of time, minutes. */
export function equationOfTimeMin(instantMs: number): number {
  const d = new Date(instantMs);
  const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  const hr = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const g = (2 * Math.PI / 365) * (doy - 1 + (hr - 12) / 24);
  return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
}
/** Wall clock that drives the day and hour pillars (§2). offsetMinutes = basis − UTC. */
export function basisClock(instantMs: number, o: ResolvedOptions): { wall: Wall; offsetMinutes: number } {
  let off: number;
  if (o.timeBasis === 'trueSolar') {
    if (o.longitude == null) throw new Error('trueSolar needs longitude');
    off = 4 * o.longitude + equationOfTimeMin(instantMs);
  } else if (o.utcOffsetMinutes != null) {
    off = o.utcOffsetMinutes;
  } else if (o.timeBasis === 'standard') {
    const y = new Date(instantMs).getUTCFullYear();
    off = Math.min(offsetMinutesFor(Date.UTC(y, 0, 1), o.timeZone!), offsetMinutesFor(Date.UTC(y, 6, 1), o.timeZone!));
  } else {
    off = offsetMinutesFor(instantMs, o.timeZone!);
  }
  return { wall: wallOf(Math.floor(instantMs / 1000) * 1000 + Math.round(off * 60000)), offsetMinutes: off };
}

// ---------------------------------------------------------------- §3 calendar
/** Index of the last row with startMs <= t. The table must extend past t and start a year or more before it. */
function termAt(terms: TermRow[], t: number): number {
  let lo = 0, hi = terms.length - 1;
  if (t < terms[24].startMs || t >= terms[hi].startMs) throw new RangeError('instant outside term table');
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (terms[mid].startMs <= t) lo = mid; else hi = mid - 1; }
  return lo;
}
const civilDays = (w: Wall) => Date.UTC(w.y, w.mo - 1, w.d) / 86400000;   // days since 1970-01-01 (辛巳 = 17)

// ---------------------------------------------------------------- chart
export function buildChart(instantMs: number, terms: TermRow[], opts: QimenOptions = {}) {
  const o: ResolvedOptions = {
    timeZone: opts.utcOffsetMinutes != null ? null : (opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
    utcOffsetMinutes: opts.utcOffsetMinutes ?? null, timeBasis: opts.timeBasis ?? 'civil',
    longitude: opts.longitude ?? null, ziHour: opts.ziHour ?? 'zi23', deityNames: opts.deityNames ?? 'huXuan',
  };
  const { wall, offsetMinutes } = basisClock(instantMs, o);

  // §3.1–3.2 day and hour pillars (basis wall clock)
  const late = wall.h === 23;
  const civilIdx = mod(civilDays(wall) + 17, 60);
  const dayIdx = late && o.ziHour === 'zi23' ? mod(civilIdx + 1, 60) : civilIdx;
  const hourBasisIdx = late && o.ziHour !== 'midnight' ? mod(civilIdx + 1, 60) : civilIdx;
  const hb = mod(Math.floor((wall.h + 1) / 2), 12);
  const hourIdx = mod((hourBasisIdx % 5) * 12 + hb, 60);

  // §3.3–3.5 term, year, month (absolute instant)
  const ti = termAt(terms, instantMs);
  const term = terms[ti], next = terms[ti + 1];
  let j = ti; while (terms[j].index !== 3) j--;                                // latest 立春
  const yearIdx = mod(new Date(terms[j].startMs).getUTCFullYear() - 4, 60);
  j = ti; while (terms[j].index % 2 === 0) j--;                                // latest 节 (odd index)
  const m = mod((terms[j].index - 3) / 2, 12);                                 // 0 = 寅 month (立春)
  const monthIdx = mod(6 * mod((yearIdx % 5) * 2 + 2 + m, 10) - 5 * mod(m + 2, 12), 60);

  // §4–5 遁, 元, 局
  const yang = term.index < 12, s = yang ? 1 : -1;
  const yuan = Math.floor(dayIdx / 5) % 3;                                     // 0 上 1 中 2 下
  const ju = JU_TABLE[term.index][yuan];

  // §6 earth plate
  const earth = {} as Record<PalaceNo, Stem>;
  for (let k = 0; k < 9; k++) earth[(mod(ju - 1 + s * k, 9) + 1) as PalaceNo] = QIYI[k] as Stem;
  const palaceOf = (st: string) => (Number(Object.keys(earth).find((p) => earth[+p as PalaceNo] === st)) as PalaceNo);

  // §7 旬首, 值符, 值使
  const xun = Math.floor(hourIdx / 10);
  const xunYi = QIYI[xun] as Stem;
  const p0 = palaceOf(xunYi);                     // may be 5
  const home = lodge(p0);
  const hStem = STEMS[hourIdx % 10];
  const useStem = (hStem === '甲' ? xunYi : hStem) as Stem;

  // §8 heaven plate
  const ptRaw = palaceOf(useStem), pt = lodge(ptRaw);
  const r = mod(ringIdx(pt) - ringIdx(home), 8);
  // §9 doors
  const n = hourIdx % 10;
  const dtRaw = (mod(p0 - 1 + s * n, 9) + 1) as PalaceNo, dt = lodge(dtRaw);
  const rd = mod(ringIdx(dt) - ringIdx(home), 8);

  // §11.3 暗干: 值使落宫起时干; if that palace's earth stem equals the stem, start at 中五 instead
  const hiddenStart = (earth[dt] === useStem ? 5 : dt) as PalaceNo;
  const k0 = QIYI.indexOf(useStem);

  // §11.1–11.2 voids and horse
  const voidOf = (idx: number) => { const b0 = mod(Math.floor(idx / 10) * 10 + 10, 12); return [b0, b0 + 1]; };
  const vh = voidOf(hourIdx), vd = voidOf(dayIdx);
  const toPal = (bs: number[]) => [...new Set(bs.map((b) => BRANCH_PALACE[b]))].sort((a, b) => a - b);
  const horseB = HORSE_OF[hb];

  const names = DEITIES.slice();
  if (yang && o.deityNames === 'gouQue') { names[4] = '勾陈'; names[5] = '朱雀'; }

  const palaces = {} as Record<PalaceNo, {
    earth: Stem; heaven: Stem[]; stars: Star[]; door: Door | null; deity: Deity | null; deitySlot: number | null;
    hidden: Stem; lodgedEarth: Stem | null;
    flags: { zhiFu: boolean; zhiShi: boolean; hourVoid: boolean; dayVoid: boolean; horse: boolean };
  }>;
  for (let q = 1; q <= 9; q++) {
    const p = q as PalaceNo;
    palaces[p] = { earth: earth[p], heaven: [], stars: [], door: null, deity: null, deitySlot: null,
      hidden: QIYI[mod(k0 + s * (p - hiddenStart), 9)] as Stem, lodgedEarth: p === 2 ? earth[5] : null,
      flags: { zhiFu: p === pt, zhiShi: p === dt, hourVoid: toPal(vh).includes(p), dayVoid: toPal(vd).includes(p), horse: BRANCH_PALACE[horseB] === p } };
  }
  RING.forEach((src, i) => {
    const dst = palaces[RING[(i + r) % 8]];
    dst.stars.push(HOME_STAR[src]); dst.heaven.push(earth[src]);
    if (src === 2) { dst.stars.push('天禽'); dst.heaven.push(earth[5]); }    // 天禽 rides with 天芮
    palaces[RING[(i + rd) % 8]].door = HOME_DOOR[src];
  });
  names.forEach((name, k) => {
    const P = palaces[RING[mod(ringIdx(pt) + s * k, 8)]];
    P.deity = name; P.deitySlot = k;
  });

  // next change: next 时辰 boundary of the basis clock (odd hours; also 00:00 unless zi23) or next term
  const wallMs = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s);
  const hrStart = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h);
  let nb = hrStart + (wall.h % 2 === 1 ? 2 : 1) * 3600000;
  if (o.ziHour !== 'zi23' && wall.h === 23) nb = hrStart + 3600000;
  const nextChangeMs = Math.min(next.startMs, Math.floor(instantMs / 1000) * 1000 + (nb - wallMs));

  const iso = (ms: number) => new Date(ms).toISOString().replace('.000', '');
  const pad = (x: number) => String(x).padStart(2, '0');
  return {
    instantUtc: iso(instantMs),
    basis: { timeBasis: o.timeBasis, offsetMinutes, local: `${wall.y}-${pad(wall.mo)}-${pad(wall.d)}T${pad(wall.h)}:${pad(wall.mi)}:${pad(wall.s)}` },
    options: o,
    pillars: { year: gz(yearIdx), month: gz(monthIdx), day: gz(dayIdx), hour: gz(hourIdx) },
    solarTerm: { index: term.index, name: TERM_NAMES[term.index], startUtc: iso(term.startMs),
      next: { index: next.index, name: TERM_NAMES[next.index], startUtc: iso(next.startMs) } },
    dun: (yang ? 'yang' : 'yin') as 'yang' | 'yin',
    yuan: (['upper', 'middle', 'lower'] as const)[yuan],
    ju,
    fuTou: gz(dayIdx - (dayIdx % 5)),
    xunShou: { head: gz(xun * 10), yi: xunYi, palace: p0 },
    zhiFu: { star: HOME_STAR[p0], homePalace: p0, stem: useStem, palaceRaw: ptRaw, palace: pt },
    zhiShi: { door: HOME_DOOR[home], homePalace: home, steps: n, palaceRaw: dtRaw, palace: dt },
    rotation: { stars: r, doors: rd },
    fuYin: { stars: r === 0, doors: rd === 0 },
    fanYin: { stars: r === 4, doors: rd === 4 },
    void: { hour: vh.map((b) => BRANCHES[b]) as Branch[], hourPalaces: toPal(vh), day: vd.map((b) => BRANCHES[b]) as Branch[], dayPalaces: toPal(vd) },
    horse: { branch: BRANCHES[horseB] as Branch, palace: BRANCH_PALACE[horseB] },
    hiddenStart,
    nextChangeUtc: iso(nextChangeMs),
    palaces,
  };
}
export type QimenChart = ReturnType<typeof buildChart>;
```

### 14.2 Term table at build time

```ts
// scripts/build-terms.mts: run at build time (node >= 22.18). Writes src/grove/terms.json as [startMs, index][].
// tyme4ts JulianDay values are JD(UT) + 8 h; the conversion is calendar.md's tymeJdToDate.
import { SolarTerm } from 'tyme4ts';
import { writeFileSync } from 'node:fs';

const FIRST = 1999, LAST = 2061;                 // covers instants from 2000 to the end of 2060
const rows: [number, number][] = [];
for (let y = FIRST; y <= LAST; y++) {
  for (let k = 0; k < 24; k++) {                 // fromIndex(y, 0) is the 冬至 of December y − 1
    const jd = SolarTerm.fromIndex(y, k).getJulianDay().getDay();
    rows.push([Math.round((jd - 2440587.5) * 86400 - 480 * 60) * 1000, k]);
  }
}
rows.sort((a, b) => a[0] - b[0]);
writeFileSync(process.argv[2] ?? 'terms.json', JSON.stringify(rows));
```

In the app: `const TERMS = termsJson.map(([startMs, index]) => ({ startMs, index }))`.

### 14.3 Vector harness

```ts
// Vector harness from qimen-spec.md §14.3 (node:assert version; the Vitest version is the same body).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildChart, type TermRow } from './qimen.ts';

const TERMS: TermRow[] = JSON.parse(readFileSync('terms.json', 'utf8')).map(([startMs, index]: [number, number]) => ({ startMs, index }));
const vectors = JSON.parse(readFileSync(process.argv[2] ?? 'qimen-vectors.json', 'utf8'));
const within60s = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 60_000;

for (const v of vectors) {
  const c = buildChart(Date.parse(v.input.datetime), TERMS, { timeZone: v.input.tz, ...v.input.options });
  const { basisLocal, solarTerm, ...meta } = v.expected.meta;
  // Instants may differ by seconds between ephemerides and true-solar approximations.
  assert.ok(within60s(c.solarTerm.startUtc, solarTerm.startUtc), `${v.id} term start`);
  assert.ok(within60s(c.basis.local + 'Z', basisLocal + 'Z'), `${v.id} basis clock`);
  assert.equal(c.solarTerm.name, solarTerm.name);
  assert.equal(c.solarTerm.index, solarTerm.index);
  // Everything else is exact.
  assert.deepEqual({
    pillars: { year: c.pillars.year.name, month: c.pillars.month.name, day: c.pillars.day.name, hour: c.pillars.hour.name },
    dun: c.dun, yuan: c.yuan, ju: c.ju, fuTou: c.fuTou.name,
    xunShou: { head: c.xunShou.head.name, yi: c.xunShou.yi, palace: c.xunShou.palace },
    zhiFu: c.zhiFu, zhiShi: c.zhiShi, rotation: c.rotation, fuYin: c.fuYin, fanYin: c.fanYin,
    void: c.void, horse: c.horse, hiddenStart: c.hiddenStart,
  }, meta, `${v.id} meta`);
  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const { earth, heaven, stars, door, deity, hidden } = c.palaces[p];
    assert.deepEqual({ earth, heaven, stars, door, deity, hidden }, v.expected.palaces[p], `${v.id} palace ${p}`);
  }
}
console.log(`${vectors.length} vectors passed`);
```

### 14.4 Property tests

Each must hold for random instants in every mode:

- The 局 table equals its generator (§5), including the eight group starts.
- The earth plate equals the §7 table.
- The multiset of heaven stems, 天禽's stem included, equals the multiset of the nine earth stems.
- `rotation.stars == 0` exactly when every outer heaven stem equals its earth stem.
- Every 甲 hour has both rotations 0. Every 癸 hour has `rotation.doors == 0`.
- The 值符 deity sits in `zhiFu.palace`, which holds `zhiFu.star`. `zhiShi.palace` holds `zhiShi.door`.
- The eight outer palaces hold nine stars, eight distinct doors and eight deities; palace 5 holds none.
- The nine hidden stems are distinct and `palaces[hiddenStart].hidden == zhiFu.stem`.

## 15. Hand derivations

### 15.1 Q08: 阳遁, 旬首仪 in palace 5

Input 2026-01-07 14:30 +08:00, civil, zi23.

1. Day. `days = 20460`, `civilIdx = mod(20477, 60) = 17`, 辛巳. JDN 2461048 gives the same.
2. Hour. `b = floor(15/2) = 7`, 未. `hourIdx = (17 mod 5) × 12 + 7 = 31`, 乙未.
3. Term. 小寒 started 2026-01-05 16:23:10 +08:00 and 大寒 starts on the 20th, so index 1, 阳遁.
4. 元. `floor(17/5) mod 3 = 0`, 上元; 符头 index 15, 己卯. `JU[1][0] = 2`.
5. Earth, 阳二局: 乙1 戊2 己3 庚4 辛5 壬6 癸7 丁8 丙9.
6. 旬首. `xun = 3`, 甲午, 仪 辛, in palace 5. 值符 天禽, 值使 死门, `home = 2`.
7. 值符. 乙 is in palace 1. `r = mod(0 − 5, 8) = 3`. 芮+禽 2→1 carrying 戊+辛, 柱 7→8 癸, 心 6→3 壬, 蓬 1→4 乙, 任 8→9 丁, 冲 3→2 己, 辅 4→7 庚, 英 9→6 丙.
8. 值使. `n = 1`, 阳遁, from raw palace 5: 6. `rd = mod(7 − 5, 8) = 2`. 死 2→6, 惊 7→1, 开 6→8, 休 1→3, 生 8→4, 伤 3→9, 杜 4→2, 景 9→7. Counting from 坤2 instead lands on 3, which is what 3meta prints.
9. Deities, clockwise from 1: 值符 1, 螣蛇 8, 太阴 3, 六合 4, 白虎 9, 玄武 2, 九地 7, 九天 6.
10. Extras. Hour 旬 甲午 voids 辰巳, palace 4. Day 辛巳 is in 甲戌 旬, voids 申酉, palaces 2 and 7. Hour 未 gives 驿马 巳, palace 4.
11. 暗干. `Dt = 6`, `earth[6] = 壬 ≠ 乙`, so start at 6 with 乙 and run forward: 6乙 7戊 8己 9庚 1辛 2壬 3癸 4丁 5丙.

### 15.2 Q03: 阴遁 下元, ordinary

Input 2026-09-28 11:20 +08:00.

1. Day `mod(20724 + 17, 60) = 41`, 乙巳. Hour `b = 6`, 午; `hourIdx = 1 × 12 + 6 = 18`, 壬午. Check with 五鼠遁: 乙庚 start from 丙子, and the seventh hour is 壬午.
2. Term 秋分 (index 18, from 2026-09-23 08:05:14 +08:00), 阴遁. `floor(41/5) mod 3 = 2`, 下元, 符头 甲辰. `JU[18][2] = 4`.
3. Earth, 阴四局: 戊4 己3 庚2 辛1 壬9 癸8 丁7 丙6 乙5.
4. 旬首 甲戌, 仪 己 in 3: 值符 天冲, 值使 伤门, `home = 3`.
5. 壬 is in 9. `r = mod(4 − 2, 8) = 2`: 蓬 1→3, 任 8→4, 冲 3→9, 辅 4→2, 英 9→7, 芮+禽 2→6 carrying 庚+乙, 柱 7→1, 心 6→8.
6. `n = 8`, 阴遁 from 3: 2, 1, 9, 8, 7, 6, 5, 4. `Dt = 4`, `rd = 1`: 休→8, 生→3, 伤→4, 杜→9, 景→2, 死→7, 惊→6, 开→1.
7. Deities counter-clockwise from 9: 9 值符, 4 螣蛇, 3 太阴, 8 六合, 1 白虎, 6 玄武, 7 九地, 2 九天.
8. 时空 申酉 → 2, 7. 日空 寅卯 → 3, 8. 驿马 申 → 2. 暗干 start 4 (earth 戊 ≠ 壬), descending: 4壬 3癸 2丁 1丙 9乙 8戊 7己 6庚 5辛.

yixinsoft prints the same grid, heading "秋分下元阴遁四局 值符天冲星落九宫 值使伤门落四宫".

### 15.3 Q13: the 暗干 edge case

Input 2026-01-07 06:30 +08:00. Day 辛巳, hour `(17 mod 5) × 12 + 3 = 27`, 辛卯. 小寒 上元 阳二局, earth as in §15.1.

1. 旬首 甲申, 仪 庚 in 4: 值符 天辅, 值使 杜门.
2. 辛 sits in palace 5, so the 值符 lands raw 5 → 坤2. `r = mod(5 − 3, 8) = 2`.
3. `n = 7`, 阳遁 from 4: 4 + 7 = 11 → palace 2. `Dt = 2`, `rd = 2`. The 值符 and 值使 are both in 坤2.
4. 暗干 under this spec: `earth[2] = 戊 ≠ 辛`, start at 2: 2辛 3壬 4癸 5丁 6丙 7乙 8戊 9己 1庚.
5. Under spec A's rule, "值符值使同宫 → start at 中五": 5辛 6壬 7癸 8丁 9丙 1乙 2戊 3己 4庚. That puts 辛 over earth 辛 in palace 5, the very 伏吟 the rule exists to avoid.
6. yixinsoft shows 1庚 3壬 4癸 6丙 7乙 8戊 9己 and, in 坤2, 丁 and 辛: this spec's result.

### 15.4 Q28: true solar time in Penang

Input 2026-03-15 10:20 +08:00, longitude 100.3288° E.

1. UTC 02:20:00, `doy = 74`, `hr = 2.3333`, `g = 2π/365 × 72.597 = 1.2497` rad, `eotMin = −9.748`.
2. `offset = 4 × 100.3288 − 9.748 = 391.567` min = 6 h 31 m 34 s. True solar time 08:51:34, in 辰 (07–09); the civil clock is in 巳.
3. Day 戊子 (24) is unchanged. Hour `(24 mod 5) × 12 + 4 = 52`, 丙辰, where Q01 has 丁巳.
4. 惊蛰 中元 阳七局. Earth: 戊7 己8 庚9 辛1 壬2 癸3 丁4 丙5 乙6. 旬首 甲寅, 仪 癸 in 3: 天冲, 伤门.
5. 丙 sits in 5, so the 值符 lands raw 5 → 2, `r = 3`. `n = 2`, 3 → 4 → 5, so the 值使 also lands raw 5 → 2, `rd = 3`.

yixinsoft with its own 真太阳时 (08:52) prints the same 丙辰 hour and the same grid.

## 16. Test vectors

### 16.1 Summary

All 29 inputs are dated on or before 2026-09-28 so that yixinsoft, which refuses future dates, could check them. UTC+8 inputs use `Asia/Kuala_Lumpur`. "Checks" counts the independent confirmations listed in each vector's `confirmedBy`.

| ID | Input | Non-default options | 局 | Pillars (Y M D H) | 值符 → | 值使 → | Flags | Checks |
|---|---|---|---|---|---|---|---|---|
| Q01 | 2026-03-15 10:20:00+08:00 | - | 惊蛰 阳7 中元 | 丙午 辛卯 戊子 丁巳 | 天冲 → 4 | 伤门 → 6 | - | 9 |
| Q02 | 2026-02-17 10:30:00+08:00 | - | 立春 阳2 下元 | 丙午 庚寅 壬戌 乙巳 | 天心 → 1 | 开门 → 7 | - | 9 |
| Q03 | 2026-09-28 11:20:00+08:00 | - | 秋分 阴4 下元 | 丙午 丁酉 乙巳 壬午 | 天冲 → 9 | 伤门 → 4 | - | 10 |
| Q04 | 2026-09-28 14:30:00+08:00 | - | 秋分 阴4 下元 | 丙午 丁酉 乙巳 癸未 | 天冲 → 8 | 伤门 → 3 | 门伏吟 | 9 |
| Q05 | 2026-01-05 04:00:00+08:00 | - | 冬至 阳1 上元 | 乙巳 戊子 己卯 丙寅 | 天蓬 → 8 | 休门 → 3 | - | 9 |
| Q06 | 2026-06-25 16:30:00+08:00 | - | 夏至 阴3 中元 | 丙午 甲午 庚午 甲申 | 天蓬 → 1 | 休门 → 1 | 星伏吟 门伏吟 | 9 |
| Q07 | 2026-01-07 12:30:00+08:00 | - | 小寒 阳2 上元 | 乙巳 己丑 辛巳 甲午 | 天禽 → 2 (raw 5) | 死门 → 2 (raw 5) | 星伏吟 门伏吟 旬首@5 | 9 |
| Q08 | 2026-01-07 14:30:00+08:00 | - | 小寒 阳2 上元 | 乙巳 己丑 辛巳 乙未 | 天禽 → 1 | 死门 → 6 | 旬首@5 | 9 |
| Q09 | 2026-06-22 10:30:00+08:00 | - | 夏至 阴9 上元 | 丙午 甲午 丁卯 乙巳 | 天禽 → 1 | 死门 → 4 | 旬首@5 | 8 |
| Q10 | 2026-08-04 22:30:00+08:00 | - | 大暑 阴7 上元 | 丙午 乙未 庚戌 丁亥 | 天禽 → 1 | 死门 → 2 | 门伏吟 旬首@5 | 9 |
| Q11 | 2026-01-06 10:30:00+08:00 | - | 小寒 阳2 上元 | 乙巳 己丑 庚辰 辛巳 | 天冲 → 2 (raw 5) | 伤门 → 1 | - | 9 |
| Q12 | 2026-09-27 02:30:00+08:00 | - | 秋分 阴4 下元 | 丙午 丁酉 甲辰 乙丑 | 天辅 → 2 (raw 5) | 杜门 → 3 | - | 9 |
| Q13 | 2026-01-07 06:30:00+08:00 | - | 小寒 阳2 上元 | 乙巳 己丑 辛巳 辛卯 | 天辅 → 2 (raw 5) | 杜门 → 2 | - | 10 |
| Q14 | 2026-01-05 08:30:00+08:00 | - | 冬至 阳1 上元 | 乙巳 戊子 己卯 戊辰 | 天蓬 → 1 | 休门 → 2 (raw 5) | 星伏吟 | 8 |
| Q15 | 2026-09-28 09:20:00+08:00 | - | 秋分 阴4 下元 | 丙午 丁酉 乙巳 辛巳 | 天冲 → 1 | 伤门 → 2 (raw 5) | - | 9 |
| Q16 | 2026-01-07 18:30:00+08:00 | - | 小寒 阳2 上元 | 乙巳 己丑 辛巳 丁酉 | 天禽 → 8 | 死门 → 8 | 星反吟 门反吟 旬首@5 | 9 |
| Q17 | 2026-06-21 16:10:00+08:00 | - | 芒种 阳6 上元 | 丙午 甲午 丙寅 丙申 | 天英 → 4 | 景门 → 2 | - | 9 |
| Q18 | 2026-06-21 16:40:00+08:00 | - | 夏至 阴9 上元 | 丙午 甲午 丙寅 丙申 | 天心 → 2 | 开门 → 4 | 门反吟 | 8 |
| Q19 | 2026-09-23 07:50:00+08:00 | - | 白露 阴3 中元 | 丙午 丁酉 庚子 庚辰 | 天芮 → 1 | 死门 → 2 (raw 5) | 门伏吟 | 9 |
| Q20 | 2026-09-23 08:20:00+08:00 | - | 秋分 阴1 中元 | 丙午 丁酉 庚子 庚辰 | 天英 → 8 | 景门 → 3 | - | 8 |
| Q21 | 2026-02-04 03:57:00+08:00 | - | 大寒 阳3 上元 | 乙巳 己丑 己酉 丙寅 | 天冲 → 1 | 伤门 → 2 (raw 5) | - | 7 |
| Q22 | 2026-02-04 04:07:00+08:00 | - | 立春 阳8 上元 | 丙午 庚寅 己酉 丙寅 | 天任 → 6 | 生门 → 1 | - | 8 |
| Q23 | 2026-09-26 23:30:00+08:00 | - | 秋分 阴4 下元 | 丙午 丁酉 甲辰 甲子 | 天辅 → 4 | 杜门 → 4 | 星伏吟 门伏吟 | 8 |
| Q24 | 2026-09-26 23:30:00+08:00 | ziHour split | 秋分 阴1 中元 | 丙午 丁酉 癸卯 甲子 | 天蓬 → 1 | 休门 → 1 | 星伏吟 门伏吟 | 4 |
| Q25 | 2026-09-26 23:30:00+08:00 | ziHour midnight | 秋分 阴1 中元 | 丙午 丁酉 癸卯 壬子 | 天心 → 6 | 开门 → 7 | 星伏吟 | 3 |
| Q26 | 2026-06-20 20:30:00-04:00 America/New_York | - | 芒种 阳6 上元 | 丙午 甲午 乙丑 丙戌 | 天任 → 4 | 生门 → 1 | - | 4 |
| Q27 | 2026-06-20 21:30:00-04:00 America/New_York | timeBasis standard | 芒种 阳6 上元 | 丙午 甲午 乙丑 丙戌 | 天任 → 4 | 生门 → 1 | - | 4 |
| Q28 | 2026-03-15 10:20:00+08:00 | timeBasis trueSolar, lon 100.3288 | 惊蛰 阳7 中元 | 丙午 辛卯 戊子 丙辰 | 天冲 → 2 (raw 5) | 伤门 → 2 (raw 5) | - | 6 |
| Q29 | 2026-03-15 10:20:00+08:00 | deityNames gouQue | 惊蛰 阳7 中元 | 丙午 辛卯 戊子 丁巳 | 天冲 → 4 | 伤门 → 6 | - | 9 |

Coverage: 阳遁 Q01 Q02 Q05 Q07 Q08 Q11 Q13 Q14 Q16 Q17 Q21 Q22 Q26–Q29; 阴遁 the rest. 上元 Q05 Q07–Q11 Q13 Q14 Q16–Q18 Q21 Q22 Q26 Q27; 中元 Q01 Q06 Q19 Q20 Q24 Q25 Q28 Q29; 下元 Q02–Q04 Q12 Q15 Q23. Hour stem 甲: Q06 Q07 Q23 Q24. 旬首仪 in 5: Q07–Q10 Q16. Hour stem in 5: Q07 Q11–Q13 Q28. 值使 lands on 5: Q07 Q14 Q15 Q19 Q21 Q28. Term boundary within an hour: Q17/Q18 (夏至 ±15 min), Q19/Q20 (秋分 ±15 min), Q21/Q22 (立春 ±5 min, year and month switch too). 23:30: Q23–Q25. 伏吟: Q04 Q06 Q07 Q10 Q14 Q19 Q23–Q25. 反吟: Q16 Q18.

### 16.2 How they were confirmed

Every vector has at least three independent confirmations. None could be confirmed only one way. The three references are separate code by different authors:

- `ref-final-ts`: §14, tyme4ts terms.
- `ref-A-py`, `ref-B-py`: the Python references from specs A and B, sxtwl terms. `ref-A-py` has no `midnight` mode.

External checks:

- qimen-rs compares every field: pillars, term, 局, 符头, 值符 and 值使 with raw palaces, all plates, 时空, 日空, 驿马 and 暗干. It covers the non-UTC+8 and `split` vectors through `--utc-offset-minutes` and `--day-boundary midnight`, and Q28 when fed the true-solar wall clock.
- kinqimen, 3meta and taobi compare the grid. kinqimen compares only the first heaven stem in a palace.
- yixinsoft compares grid, pillars and 暗干, including Q28 through its own true-solar option.
- china95 (元亨利贞) compares the grid.

Known tool differences, all expected:

- 3meta differs on the door ring in Q08, Q09, Q10 (it counts the 值使 from 坤2), and Q14, Q21 (it sends a 阳遁 landing on 5 to 艮8).
- china95's term table is 20–40 minutes late: it still shows the old term in Q18, Q20, Q22. It also picks month and year by date (Q05, Q14, Q21). Its grid matches everywhere else.
- yixinsoft and kinqimen print 勾陈/朱雀 in 阳遁, so they match Q29 literally and the others after renaming.

The fewest confirmations: Q25 (`midnight`) has three, from `ref-final-ts`, `ref-B-py` and taobi. Q24, Q26 and Q27 have four, with qimen-rs as the only external tool, because the other tools cannot express a non-UTC+8 zone or the `split` convention.

### 16.3 Machine-readable vectors

Identical to `docs/plan/qimen-vectors.json`. Compare `solarTerm.startUtc` and `basisLocal` within 60 s and everything else exactly, as §14.3 does.

```json
[
{"id":"Q01","description":"阳遁 中元, ordinary chart (star rotation 1, door rotation 5)","origin":"A-V1","input":{"datetime":"2026-03-15T10:20:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-03-15T10:20:00","pillars":{"year":"丙午","month":"辛卯","day":"戊子","hour":"丁巳"},"solarTerm":{"name":"惊蛰","index":5,"startUtc":"2026-03-05T13:59:00Z"},"dun":"yang","yuan":"middle","ju":7,"fuTou":"甲申","xunShou":{"head":"甲寅","yi":"癸","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"丁","palaceRaw":4,"palace":4},"zhiShi":{"door":"伤门","homePalace":3,"steps":3,"palaceRaw":6,"palace":6},"rotation":{"stars":1,"doors":5},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["子","丑"],"hourPalaces":[1,8],"day":["午","未"],"dayPalaces":[2,9]},"horse":{"branch":"亥","palace":6},"hiddenStart":6},"palaces":{"1":{"earth":"辛","heaven":["乙"],"stars":["天心"],"door":"杜门","deity":"玄武","hidden":"己"},"2":{"earth":"壬","heaven":["庚"],"stars":["天英"],"door":"休门","deity":"太阴","hidden":"庚"},"3":{"earth":"癸","heaven":["己"],"stars":["天任"],"door":"死门","deity":"九天","hidden":"辛"},"4":{"earth":"丁","heaven":["癸"],"stars":["天冲"],"door":"惊门","deity":"值符","hidden":"壬"},"5":{"earth":"丙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"癸"},"6":{"earth":"乙","heaven":["戊"],"stars":["天柱"],"door":"伤门","deity":"白虎","hidden":"丁"},"7":{"earth":"戊","heaven":["壬","丙"],"stars":["天芮","天禽"],"door":"生门","deity":"六合","hidden":"丙"},"8":{"earth":"己","heaven":["辛"],"stars":["天蓬"],"door":"景门","deity":"九地","hidden":"乙"},"9":{"earth":"庚","heaven":["丁"],"stars":["天辅"],"door":"开门","deity":"螣蛇","hidden":"戊"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q02","description":"阳遁 下元, ordinary chart","origin":"B-V1","input":{"datetime":"2026-02-17T10:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-02-17T10:30:00","pillars":{"year":"丙午","month":"庚寅","day":"壬戌","hour":"乙巳"},"solarTerm":{"name":"立春","index":3,"startUtc":"2026-02-03T20:02:08Z"},"dun":"yang","yuan":"lower","ju":2,"fuTou":"己未","xunShou":{"head":"甲辰","yi":"壬","palace":6},"zhiFu":{"star":"天心","homePalace":6,"stem":"乙","palaceRaw":1,"palace":1},"zhiShi":{"door":"开门","homePalace":6,"steps":1,"palaceRaw":7,"palace":7},"rotation":{"stars":1,"doors":7},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["寅","卯"],"hourPalaces":[3,8],"day":["子","丑"],"dayPalaces":[1,8]},"horse":{"branch":"亥","palace":6},"hiddenStart":7},"palaces":{"1":{"earth":"乙","heaven":["壬"],"stars":["天心"],"door":"生门","deity":"值符","hidden":"庚"},"2":{"earth":"戊","heaven":["丙"],"stars":["天英"],"door":"惊门","deity":"玄武","hidden":"辛"},"3":{"earth":"己","heaven":["丁"],"stars":["天任"],"door":"杜门","deity":"太阴","hidden":"壬"},"4":{"earth":"庚","heaven":["己"],"stars":["天冲"],"door":"景门","deity":"六合","hidden":"癸"},"5":{"earth":"辛","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"壬","heaven":["癸"],"stars":["天柱"],"door":"休门","deity":"九天","hidden":"丙"},"7":{"earth":"癸","heaven":["戊","辛"],"stars":["天芮","天禽"],"door":"开门","deity":"九地","hidden":"乙"},"8":{"earth":"丁","heaven":["乙"],"stars":["天蓬"],"door":"伤门","deity":"螣蛇","hidden":"戊"},"9":{"earth":"丙","heaven":["庚"],"stars":["天辅"],"door":"死门","deity":"白虎","hidden":"己"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q03","description":"阴遁 下元, ordinary chart (hand-derived in §15.2)","origin":"B-V2","input":{"datetime":"2026-09-28T11:20:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-28T11:20:00","pillars":{"year":"丙午","month":"丁酉","day":"乙巳","hour":"壬午"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"lower","ju":4,"fuTou":"甲辰","xunShou":{"head":"甲戌","yi":"己","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"壬","palaceRaw":9,"palace":9},"zhiShi":{"door":"伤门","homePalace":3,"steps":8,"palaceRaw":4,"palace":4},"rotation":{"stars":2,"doors":1},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["申","酉"],"hourPalaces":[2,7],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"申","palace":2},"hiddenStart":4},"palaces":{"1":{"earth":"辛","heaven":["丁"],"stars":["天柱"],"door":"开门","deity":"白虎","hidden":"丙"},"2":{"earth":"庚","heaven":["戊"],"stars":["天辅"],"door":"景门","deity":"九天","hidden":"丁"},"3":{"earth":"己","heaven":["辛"],"stars":["天蓬"],"door":"生门","deity":"太阴","hidden":"癸"},"4":{"earth":"戊","heaven":["癸"],"stars":["天任"],"door":"伤门","deity":"螣蛇","hidden":"壬"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"辛"},"6":{"earth":"丙","heaven":["庚","乙"],"stars":["天芮","天禽"],"door":"惊门","deity":"玄武","hidden":"庚"},"7":{"earth":"丁","heaven":["壬"],"stars":["天英"],"door":"死门","deity":"九地","hidden":"己"},"8":{"earth":"癸","heaven":["丙"],"stars":["天心"],"door":"休门","deity":"六合","hidden":"戊"},"9":{"earth":"壬","heaven":["己"],"stars":["天冲"],"door":"杜门","deity":"值符","hidden":"乙"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)","hand derivation (§15.2)"]},
{"id":"Q04","description":"阴遁 下元, 癸 hour: the 值使 walks a full lap of nine, doors 伏吟 while stars move","origin":"A-V2","input":{"datetime":"2026-09-28T14:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-28T14:30:00","pillars":{"year":"丙午","month":"丁酉","day":"乙巳","hour":"癸未"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"lower","ju":4,"fuTou":"甲辰","xunShou":{"head":"甲戌","yi":"己","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"癸","palaceRaw":8,"palace":8},"zhiShi":{"door":"伤门","homePalace":3,"steps":9,"palaceRaw":3,"palace":3},"rotation":{"stars":7,"doors":0},"fuYin":{"stars":false,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["申","酉"],"hourPalaces":[2,7],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"巳","palace":4},"hiddenStart":3},"palaces":{"1":{"earth":"辛","heaven":["癸"],"stars":["天任"],"door":"休门","deity":"螣蛇","hidden":"丙"},"2":{"earth":"庚","heaven":["丁"],"stars":["天柱"],"door":"死门","deity":"白虎","hidden":"丁"},"3":{"earth":"己","heaven":["戊"],"stars":["天辅"],"door":"伤门","deity":"九天","hidden":"癸"},"4":{"earth":"戊","heaven":["壬"],"stars":["天英"],"door":"杜门","deity":"九地","hidden":"壬"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"辛"},"6":{"earth":"丙","heaven":["辛"],"stars":["天蓬"],"door":"开门","deity":"太阴","hidden":"庚"},"7":{"earth":"丁","heaven":["丙"],"stars":["天心"],"door":"惊门","deity":"六合","hidden":"己"},"8":{"earth":"癸","heaven":["己"],"stars":["天冲"],"door":"生门","deity":"值符","hidden":"戊"},"9":{"earth":"壬","heaven":["庚","乙"],"stars":["天芮","天禽"],"door":"景门","deity":"玄武","hidden":"乙"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q05","description":"阳遁一局 上元 甲己日 丙寅时, the worked example in the 《烟波钓叟歌》句解 (值符 8, 九天 1, 九地 6, 太阴 4, 六合 9)","origin":"A-V10","input":{"datetime":"2026-01-05T04:00:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-05T04:00:00","pillars":{"year":"乙巳","month":"戊子","day":"己卯","hour":"丙寅"},"solarTerm":{"name":"冬至","index":0,"startUtc":"2025-12-21T15:03:05Z"},"dun":"yang","yuan":"upper","ju":1,"fuTou":"己卯","xunShou":{"head":"甲子","yi":"戊","palace":1},"zhiFu":{"star":"天蓬","homePalace":1,"stem":"丙","palaceRaw":8,"palace":8},"zhiShi":{"door":"休门","homePalace":1,"steps":2,"palaceRaw":3,"palace":3},"rotation":{"stars":1,"doors":2},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"申","palace":2},"hiddenStart":3},"palaces":{"1":{"earth":"戊","heaven":["癸"],"stars":["天心"],"door":"惊门","deity":"九天","hidden":"癸"},"2":{"earth":"己","heaven":["乙"],"stars":["天英"],"door":"杜门","deity":"白虎","hidden":"丁"},"3":{"earth":"庚","heaven":["丙"],"stars":["天任"],"door":"休门","deity":"螣蛇","hidden":"丙"},"4":{"earth":"辛","heaven":["庚"],"stars":["天冲"],"door":"生门","deity":"太阴","hidden":"乙"},"5":{"earth":"壬","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"戊"},"6":{"earth":"癸","heaven":["丁"],"stars":["天柱"],"door":"死门","deity":"九地","hidden":"己"},"7":{"earth":"丁","heaven":["己","壬"],"stars":["天芮","天禽"],"door":"景门","deity":"玄武","hidden":"庚"},"8":{"earth":"丙","heaven":["戊"],"stars":["天蓬"],"door":"开门","deity":"值符","hidden":"辛"},"9":{"earth":"乙","heaven":["辛"],"stars":["天辅"],"door":"伤门","deity":"六合","hidden":"壬"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","《烟波钓叟歌》句解 worked example: 值符 8, 九天 1, 九地 6, 太阴 4, 六合 9"],"knownToolDifferences":"china95 shows month 己丑 (it picks the month by date); its chart grid matches."},
{"id":"Q06","description":"hour stem 甲 (甲申 hour), 阴遁 中元: full 伏吟 (stars, stems and doors at home)","origin":"A-V3","input":{"datetime":"2026-06-25T16:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-06-25T16:30:00","pillars":{"year":"丙午","month":"甲午","day":"庚午","hour":"甲申"},"solarTerm":{"name":"夏至","index":12,"startUtc":"2026-06-21T08:24:30Z"},"dun":"yin","yuan":"middle","ju":3,"fuTou":"己巳","xunShou":{"head":"甲申","yi":"庚","palace":1},"zhiFu":{"star":"天蓬","homePalace":1,"stem":"庚","palaceRaw":1,"palace":1},"zhiShi":{"door":"休门","homePalace":1,"steps":0,"palaceRaw":1,"palace":1},"rotation":{"stars":0,"doors":0},"fuYin":{"stars":true,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["午","未"],"hourPalaces":[2,9],"day":["戌","亥"],"dayPalaces":[6]},"horse":{"branch":"寅","palace":8},"hiddenStart":5},"palaces":{"1":{"earth":"庚","heaven":["庚"],"stars":["天蓬"],"door":"休门","deity":"值符","hidden":"丁"},"2":{"earth":"己","heaven":["己","丙"],"stars":["天芮","天禽"],"door":"死门","deity":"六合","hidden":"癸"},"3":{"earth":"戊","heaven":["戊"],"stars":["天冲"],"door":"伤门","deity":"九地","hidden":"壬"},"4":{"earth":"乙","heaven":["乙"],"stars":["天辅"],"door":"杜门","deity":"玄武","hidden":"辛"},"5":{"earth":"丙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"庚"},"6":{"earth":"丁","heaven":["丁"],"stars":["天心"],"door":"开门","deity":"螣蛇","hidden":"己"},"7":{"earth":"癸","heaven":["癸"],"stars":["天柱"],"door":"惊门","deity":"太阴","hidden":"戊"},"8":{"earth":"壬","heaven":["壬"],"stars":["天任"],"door":"生门","deity":"九天","hidden":"乙"},"9":{"earth":"辛","heaven":["辛"],"stars":["天英"],"door":"景门","deity":"白虎","hidden":"丙"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q07","description":"阳遁 甲午 hour with the 旬首仪 in palace 5: 值符 天禽 lodged in 坤2, 值使 raw 5 -> 坤2, full 伏吟","origin":"B-V11","input":{"datetime":"2026-01-07T12:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-07T12:30:00","pillars":{"year":"乙巳","month":"己丑","day":"辛巳","hour":"甲午"},"solarTerm":{"name":"小寒","index":1,"startUtc":"2026-01-05T08:23:10Z"},"dun":"yang","yuan":"upper","ju":2,"fuTou":"己卯","xunShou":{"head":"甲午","yi":"辛","palace":5},"zhiFu":{"star":"天禽","homePalace":5,"stem":"辛","palaceRaw":5,"palace":2},"zhiShi":{"door":"死门","homePalace":2,"steps":0,"palaceRaw":5,"palace":2},"rotation":{"stars":0,"doors":0},"fuYin":{"stars":true,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["辰","巳"],"hourPalaces":[4],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"申","palace":2},"hiddenStart":2},"palaces":{"1":{"earth":"乙","heaven":["乙"],"stars":["天蓬"],"door":"休门","deity":"六合","hidden":"庚"},"2":{"earth":"戊","heaven":["戊","辛"],"stars":["天芮","天禽"],"door":"死门","deity":"值符","hidden":"辛"},"3":{"earth":"己","heaven":["己"],"stars":["天冲"],"door":"伤门","deity":"玄武","hidden":"壬"},"4":{"earth":"庚","heaven":["庚"],"stars":["天辅"],"door":"杜门","deity":"九地","hidden":"癸"},"5":{"earth":"辛","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"壬","heaven":["壬"],"stars":["天心"],"door":"开门","deity":"太阴","hidden":"丙"},"7":{"earth":"癸","heaven":["癸"],"stars":["天柱"],"door":"惊门","deity":"螣蛇","hidden":"乙"},"8":{"earth":"丁","heaven":["丁"],"stars":["天任"],"door":"生门","deity":"白虎","hidden":"戊"},"9":{"earth":"丙","heaven":["丙"],"stars":["天英"],"door":"景门","deity":"九天","hidden":"己"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q08","description":"阳遁 上元, 旬首仪 in palace 5: 值符 天禽, 值使 死门 counted from 5 (hand-derived in §15.1)","origin":"A-V4","input":{"datetime":"2026-01-07T14:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-07T14:30:00","pillars":{"year":"乙巳","month":"己丑","day":"辛巳","hour":"乙未"},"solarTerm":{"name":"小寒","index":1,"startUtc":"2026-01-05T08:23:10Z"},"dun":"yang","yuan":"upper","ju":2,"fuTou":"己卯","xunShou":{"head":"甲午","yi":"辛","palace":5},"zhiFu":{"star":"天禽","homePalace":5,"stem":"乙","palaceRaw":1,"palace":1},"zhiShi":{"door":"死门","homePalace":2,"steps":1,"palaceRaw":6,"palace":6},"rotation":{"stars":3,"doors":2},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["辰","巳"],"hourPalaces":[4],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"巳","palace":4},"hiddenStart":6},"palaces":{"1":{"earth":"乙","heaven":["戊","辛"],"stars":["天芮","天禽"],"door":"惊门","deity":"值符","hidden":"辛"},"2":{"earth":"戊","heaven":["己"],"stars":["天冲"],"door":"杜门","deity":"玄武","hidden":"壬"},"3":{"earth":"己","heaven":["壬"],"stars":["天心"],"door":"休门","deity":"太阴","hidden":"癸"},"4":{"earth":"庚","heaven":["乙"],"stars":["天蓬"],"door":"生门","deity":"六合","hidden":"丁"},"5":{"earth":"辛","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丙"},"6":{"earth":"壬","heaven":["丙"],"stars":["天英"],"door":"死门","deity":"九天","hidden":"乙"},"7":{"earth":"癸","heaven":["庚"],"stars":["天辅"],"door":"景门","deity":"九地","hidden":"戊"},"8":{"earth":"丁","heaven":["癸"],"stars":["天柱"],"door":"开门","deity":"螣蛇","hidden":"己"},"9":{"earth":"丙","heaven":["丁"],"stars":["天任"],"door":"伤门","deity":"白虎","hidden":"庚"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)","hand derivation (§15.1)"],"knownToolDifferences":"3meta differs on the door ring only: it counts the 值使 from 坤2 when the 旬首 is in 5 (rejected, §17 D6)."},
{"id":"Q09","description":"阴遁 上元, 旬首仪 in palace 5: 值符 天禽, 值使 死门 counted from 5","origin":"B-V4","input":{"datetime":"2026-06-22T10:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-06-22T10:30:00","pillars":{"year":"丙午","month":"甲午","day":"丁卯","hour":"乙巳"},"solarTerm":{"name":"夏至","index":12,"startUtc":"2026-06-21T08:24:30Z"},"dun":"yin","yuan":"upper","ju":9,"fuTou":"甲子","xunShou":{"head":"甲辰","yi":"壬","palace":5},"zhiFu":{"star":"天禽","homePalace":5,"stem":"乙","palaceRaw":1,"palace":1},"zhiShi":{"door":"死门","homePalace":2,"steps":1,"palaceRaw":4,"palace":4},"rotation":{"stars":3,"doors":6},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["寅","卯"],"hourPalaces":[3,8],"day":["戌","亥"],"dayPalaces":[6]},"horse":{"branch":"亥","palace":6},"hiddenStart":4},"palaces":{"1":{"earth":"乙","heaven":["丙","壬"],"stars":["天芮","天禽"],"door":"伤门","deity":"值符","hidden":"庚"},"2":{"earth":"丙","heaven":["丁"],"stars":["天冲"],"door":"开门","deity":"六合","hidden":"己"},"3":{"earth":"丁","heaven":["辛"],"stars":["天心"],"door":"景门","deity":"九地","hidden":"戊"},"4":{"earth":"癸","heaven":["乙"],"stars":["天蓬"],"door":"死门","deity":"玄武","hidden":"乙"},"5":{"earth":"壬","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丙"},"6":{"earth":"辛","heaven":["戊"],"stars":["天英"],"door":"生门","deity":"螣蛇","hidden":"丁"},"7":{"earth":"庚","heaven":["癸"],"stars":["天辅"],"door":"休门","deity":"太阴","hidden":"癸"},"8":{"earth":"己","heaven":["庚"],"stars":["天柱"],"door":"杜门","deity":"九天","hidden":"壬"},"9":{"earth":"戊","heaven":["己"],"stars":["天任"],"door":"惊门","deity":"白虎","hidden":"辛"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"],"knownToolDifferences":"3meta differs on the door ring only (counts from 坤2, rejected)."},
{"id":"Q10","description":"阴遁七局 丁亥 hour, 旬首仪 in palace 5; the 古今图书集成 table row reads 禽一死二","origin":"A-V9","input":{"datetime":"2026-08-04T22:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-08-04T22:30:00","pillars":{"year":"丙午","month":"乙未","day":"庚戌","hour":"丁亥"},"solarTerm":{"name":"大暑","index":14,"startUtc":"2026-07-22T19:13:05Z"},"dun":"yin","yuan":"upper","ju":7,"fuTou":"己酉","xunShou":{"head":"甲申","yi":"庚","palace":5},"zhiFu":{"star":"天禽","homePalace":5,"stem":"丁","palaceRaw":1,"palace":1},"zhiShi":{"door":"死门","homePalace":2,"steps":3,"palaceRaw":2,"palace":2},"rotation":{"stars":3,"doors":0},"fuYin":{"stars":false,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["午","未"],"hourPalaces":[2,9],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"巳","palace":4},"hiddenStart":2},"palaces":{"1":{"earth":"丁","heaven":["癸","庚"],"stars":["天芮","天禽"],"door":"休门","deity":"值符","hidden":"丙"},"2":{"earth":"癸","heaven":["壬"],"stars":["天冲"],"door":"死门","deity":"六合","hidden":"丁"},"3":{"earth":"壬","heaven":["己"],"stars":["天心"],"door":"伤门","deity":"九地","hidden":"癸"},"4":{"earth":"辛","heaven":["丁"],"stars":["天蓬"],"door":"杜门","deity":"玄武","hidden":"壬"},"5":{"earth":"庚","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"辛"},"6":{"earth":"己","heaven":["丙"],"stars":["天英"],"door":"开门","deity":"螣蛇","hidden":"庚"},"7":{"earth":"戊","heaven":["辛"],"stars":["天辅"],"door":"惊门","deity":"太阴","hidden":"己"},"8":{"earth":"乙","heaven":["戊"],"stars":["天柱"],"door":"生门","deity":"九天","hidden":"戊"},"9":{"earth":"丙","heaven":["乙"],"stars":["天任"],"door":"景门","deity":"白虎","hidden":"乙"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)","古今图书集成 艺术典 阴七局 丁亥 row: 禽一 死二"],"knownToolDifferences":"3meta differs on the door ring only (counts from 坤2, rejected)."},
{"id":"Q11","description":"阳遁, hour stem sits in palace 5: 值符 lands raw 5 -> 坤2","origin":"A-V7","input":{"datetime":"2026-01-06T10:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-06T10:30:00","pillars":{"year":"乙巳","month":"己丑","day":"庚辰","hour":"辛巳"},"solarTerm":{"name":"小寒","index":1,"startUtc":"2026-01-05T08:23:10Z"},"dun":"yang","yuan":"upper","ju":2,"fuTou":"己卯","xunShou":{"head":"甲戌","yi":"己","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"辛","palaceRaw":5,"palace":2},"zhiShi":{"door":"伤门","homePalace":3,"steps":7,"palaceRaw":1,"palace":1},"rotation":{"stars":3,"doors":6},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["申","酉"],"hourPalaces":[2,7],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"亥","palace":6},"hiddenStart":1},"palaces":{"1":{"earth":"乙","heaven":["戊","辛"],"stars":["天芮","天禽"],"door":"伤门","deity":"六合","hidden":"辛"},"2":{"earth":"戊","heaven":["己"],"stars":["天冲"],"door":"开门","deity":"值符","hidden":"壬"},"3":{"earth":"己","heaven":["壬"],"stars":["天心"],"door":"景门","deity":"玄武","hidden":"癸"},"4":{"earth":"庚","heaven":["乙"],"stars":["天蓬"],"door":"死门","deity":"九地","hidden":"丁"},"5":{"earth":"辛","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丙"},"6":{"earth":"壬","heaven":["丙"],"stars":["天英"],"door":"生门","deity":"太阴","hidden":"乙"},"7":{"earth":"癸","heaven":["庚"],"stars":["天辅"],"door":"休门","deity":"螣蛇","hidden":"戊"},"8":{"earth":"丁","heaven":["癸"],"stars":["天柱"],"door":"杜门","deity":"白虎","hidden":"己"},"9":{"earth":"丙","heaven":["丁"],"stars":["天任"],"door":"惊门","deity":"九天","hidden":"庚"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q12","description":"阴遁, hour stem sits in palace 5: 值符 lands raw 5 -> 坤2","origin":"B-V7","input":{"datetime":"2026-09-27T02:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-27T02:30:00","pillars":{"year":"丙午","month":"丁酉","day":"甲辰","hour":"乙丑"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"lower","ju":4,"fuTou":"甲辰","xunShou":{"head":"甲子","yi":"戊","palace":4},"zhiFu":{"star":"天辅","homePalace":4,"stem":"乙","palaceRaw":5,"palace":2},"zhiShi":{"door":"杜门","homePalace":4,"steps":1,"palaceRaw":3,"palace":3},"rotation":{"stars":2,"doors":7},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"亥","palace":6},"hiddenStart":3},"palaces":{"1":{"earth":"辛","heaven":["丁"],"stars":["天柱"],"door":"生门","deity":"玄武","hidden":"己"},"2":{"earth":"庚","heaven":["戊"],"stars":["天辅"],"door":"惊门","deity":"值符","hidden":"戊"},"3":{"earth":"己","heaven":["辛"],"stars":["天蓬"],"door":"杜门","deity":"六合","hidden":"乙"},"4":{"earth":"戊","heaven":["癸"],"stars":["天任"],"door":"景门","deity":"太阴","hidden":"丙"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"丙","heaven":["庚","乙"],"stars":["天芮","天禽"],"door":"休门","deity":"九地","hidden":"癸"},"7":{"earth":"丁","heaven":["壬"],"stars":["天英"],"door":"开门","deity":"九天","hidden":"壬"},"8":{"earth":"癸","heaven":["丙"],"stars":["天心"],"door":"伤门","deity":"白虎","hidden":"辛"},"9":{"earth":"壬","heaven":["己"],"stars":["天冲"],"door":"死门","deity":"螣蛇","hidden":"庚"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q13","description":"阳遁, hour stem in palace 5 and 值使 lands in 坤2: the case where the two 暗干 rules disagree (this spec: start at 坤2)","origin":"new","input":{"datetime":"2026-01-07T06:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-07T06:30:00","pillars":{"year":"乙巳","month":"己丑","day":"辛巳","hour":"辛卯"},"solarTerm":{"name":"小寒","index":1,"startUtc":"2026-01-05T08:23:10Z"},"dun":"yang","yuan":"upper","ju":2,"fuTou":"己卯","xunShou":{"head":"甲申","yi":"庚","palace":4},"zhiFu":{"star":"天辅","homePalace":4,"stem":"辛","palaceRaw":5,"palace":2},"zhiShi":{"door":"杜门","homePalace":4,"steps":7,"palaceRaw":2,"palace":2},"rotation":{"stars":2,"doors":2},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["午","未"],"hourPalaces":[2,9],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"巳","palace":4},"hiddenStart":2},"palaces":{"1":{"earth":"乙","heaven":["癸"],"stars":["天柱"],"door":"惊门","deity":"六合","hidden":"庚"},"2":{"earth":"戊","heaven":["庚"],"stars":["天辅"],"door":"杜门","deity":"值符","hidden":"辛"},"3":{"earth":"己","heaven":["乙"],"stars":["天蓬"],"door":"休门","deity":"玄武","hidden":"壬"},"4":{"earth":"庚","heaven":["丁"],"stars":["天任"],"door":"生门","deity":"九地","hidden":"癸"},"5":{"earth":"辛","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"壬","heaven":["戊","辛"],"stars":["天芮","天禽"],"door":"死门","deity":"太阴","hidden":"丙"},"7":{"earth":"癸","heaven":["丙"],"stars":["天英"],"door":"景门","deity":"螣蛇","hidden":"乙"},"8":{"earth":"丁","heaven":["壬"],"stars":["天心"],"door":"开门","deity":"白虎","hidden":"戊"},"9":{"earth":"丙","heaven":["己"],"stars":["天冲"],"door":"伤门","deity":"九天","hidden":"己"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)","hand derivation of 暗干 (§15.3)"]},
{"id":"Q14","description":"阳遁, 值使 count lands on 5 -> 坤2 (not 艮8); 古今图书集成 阳一局 戊辰 蓬一休五","origin":"A-V8","input":{"datetime":"2026-01-05T08:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-05T08:30:00","pillars":{"year":"乙巳","month":"戊子","day":"己卯","hour":"戊辰"},"solarTerm":{"name":"冬至","index":0,"startUtc":"2025-12-21T15:03:05Z"},"dun":"yang","yuan":"upper","ju":1,"fuTou":"己卯","xunShou":{"head":"甲子","yi":"戊","palace":1},"zhiFu":{"star":"天蓬","homePalace":1,"stem":"戊","palaceRaw":1,"palace":1},"zhiShi":{"door":"休门","homePalace":1,"steps":4,"palaceRaw":5,"palace":2},"rotation":{"stars":0,"doors":5},"fuYin":{"stars":true,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"寅","palace":8},"hiddenStart":2},"palaces":{"1":{"earth":"戊","heaven":["戊"],"stars":["天蓬"],"door":"杜门","deity":"值符","hidden":"乙"},"2":{"earth":"己","heaven":["己","壬"],"stars":["天芮","天禽"],"door":"休门","deity":"玄武","hidden":"戊"},"3":{"earth":"庚","heaven":["庚"],"stars":["天冲"],"door":"死门","deity":"太阴","hidden":"己"},"4":{"earth":"辛","heaven":["辛"],"stars":["天辅"],"door":"惊门","deity":"六合","hidden":"庚"},"5":{"earth":"壬","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"辛"},"6":{"earth":"癸","heaven":["癸"],"stars":["天心"],"door":"伤门","deity":"九天","hidden":"壬"},"7":{"earth":"丁","heaven":["丁"],"stars":["天柱"],"door":"生门","deity":"九地","hidden":"癸"},"8":{"earth":"丙","heaven":["丙"],"stars":["天任"],"door":"景门","deity":"螣蛇","hidden":"丁"},"9":{"earth":"乙","heaven":["乙"],"stars":["天英"],"door":"开门","deity":"白虎","hidden":"丙"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","古今图书集成 艺术典 阳一局 戊辰 row: 蓬一 休五 (避五), deities 天6 地7 阴3 合4"],"knownToolDifferences":"3meta differs on the door ring only: it sends a 阳遁 值使 landing on 5 to 艮8 (rejected, §17 D7). china95 shows month 己丑 (by date)."},
{"id":"Q15","description":"阴遁, 值使 count lands on 5 -> 坤2","origin":"B-V8","input":{"datetime":"2026-09-28T09:20:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-28T09:20:00","pillars":{"year":"丙午","month":"丁酉","day":"乙巳","hour":"辛巳"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"lower","ju":4,"fuTou":"甲辰","xunShou":{"head":"甲戌","yi":"己","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"辛","palaceRaw":1,"palace":1},"zhiShi":{"door":"伤门","homePalace":3,"steps":7,"palaceRaw":5,"palace":2},"rotation":{"stars":6,"doors":3},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["申","酉"],"hourPalaces":[2,7],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"亥","palace":6},"hiddenStart":2},"palaces":{"1":{"earth":"辛","heaven":["己"],"stars":["天冲"],"door":"死门","deity":"值符","hidden":"壬"},"2":{"earth":"庚","heaven":["丙"],"stars":["天心"],"door":"伤门","deity":"六合","hidden":"辛"},"3":{"earth":"己","heaven":["壬"],"stars":["天英"],"door":"开门","deity":"九地","hidden":"庚"},"4":{"earth":"戊","heaven":["庚","乙"],"stars":["天芮","天禽"],"door":"休门","deity":"玄武","hidden":"己"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"戊"},"6":{"earth":"丙","heaven":["癸"],"stars":["天任"],"door":"景门","deity":"螣蛇","hidden":"乙"},"7":{"earth":"丁","heaven":["辛"],"stars":["天蓬"],"door":"杜门","deity":"太阴","hidden":"丙"},"8":{"earth":"癸","heaven":["戊"],"stars":["天辅"],"door":"惊门","deity":"九天","hidden":"丁"},"9":{"earth":"壬","heaven":["丁"],"stars":["天柱"],"door":"生门","deity":"白虎","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q16","description":"star and door 反吟 (both rotations 4), 旬首仪 in 5","origin":"A-V11","input":{"datetime":"2026-01-07T18:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-01-07T18:30:00","pillars":{"year":"乙巳","month":"己丑","day":"辛巳","hour":"丁酉"},"solarTerm":{"name":"小寒","index":1,"startUtc":"2026-01-05T08:23:10Z"},"dun":"yang","yuan":"upper","ju":2,"fuTou":"己卯","xunShou":{"head":"甲午","yi":"辛","palace":5},"zhiFu":{"star":"天禽","homePalace":5,"stem":"丁","palaceRaw":8,"palace":8},"zhiShi":{"door":"死门","homePalace":2,"steps":3,"palaceRaw":8,"palace":8},"rotation":{"stars":4,"doors":4},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":true,"doors":true},"void":{"hour":["辰","巳"],"hourPalaces":[4],"day":["申","酉"],"dayPalaces":[2,7]},"horse":{"branch":"亥","palace":6},"hiddenStart":5},"palaces":{"1":{"earth":"乙","heaven":["丙"],"stars":["天英"],"door":"景门","deity":"九天","hidden":"庚"},"2":{"earth":"戊","heaven":["丁"],"stars":["天任"],"door":"生门","deity":"白虎","hidden":"辛"},"3":{"earth":"己","heaven":["癸"],"stars":["天柱"],"door":"惊门","deity":"螣蛇","hidden":"壬"},"4":{"earth":"庚","heaven":["壬"],"stars":["天心"],"door":"开门","deity":"太阴","hidden":"癸"},"5":{"earth":"辛","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"壬","heaven":["庚"],"stars":["天辅"],"door":"杜门","deity":"九地","hidden":"丙"},"7":{"earth":"癸","heaven":["己"],"stars":["天冲"],"door":"伤门","deity":"玄武","hidden":"乙"},"8":{"earth":"丁","heaven":["戊","辛"],"stars":["天芮","天禽"],"door":"死门","deity":"值符","hidden":"戊"},"9":{"earth":"丙","heaven":["乙"],"stars":["天蓬"],"door":"休门","deity":"六合","hidden":"己"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q17","description":"14 min before 夏至 (2026-06-21 16:24 +08): still 芒种 上元 阳遁6局","origin":"A-V5a/B-V10a","input":{"datetime":"2026-06-21T16:10:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-06-21T16:10:00","pillars":{"year":"丙午","month":"甲午","day":"丙寅","hour":"丙申"},"solarTerm":{"name":"芒种","index":11,"startUtc":"2026-06-05T15:48:21Z"},"dun":"yang","yuan":"upper","ju":6,"fuTou":"甲子","xunShou":{"head":"甲午","yi":"辛","palace":9},"zhiFu":{"star":"天英","homePalace":9,"stem":"丙","palaceRaw":4,"palace":4},"zhiShi":{"door":"景门","homePalace":9,"steps":2,"palaceRaw":2,"palace":2},"rotation":{"stars":7,"doors":1},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["辰","巳"],"hourPalaces":[4],"day":["戌","亥"],"dayPalaces":[6]},"horse":{"branch":"寅","palace":8},"hiddenStart":2},"palaces":{"1":{"earth":"壬","heaven":["庚"],"stars":["天任"],"door":"开门","deity":"玄武","hidden":"丁"},"2":{"earth":"癸","heaven":["己"],"stars":["天柱"],"door":"景门","deity":"太阴","hidden":"丙"},"3":{"earth":"丁","heaven":["丙"],"stars":["天辅"],"door":"生门","deity":"九天","hidden":"乙"},"4":{"earth":"丙","heaven":["辛"],"stars":["天英"],"door":"伤门","deity":"值符","hidden":"戊"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"己"},"6":{"earth":"戊","heaven":["壬"],"stars":["天蓬"],"door":"惊门","deity":"白虎","hidden":"庚"},"7":{"earth":"己","heaven":["戊"],"stars":["天心"],"door":"死门","deity":"六合","hidden":"辛"},"8":{"earth":"庚","heaven":["丁"],"stars":["天冲"],"door":"休门","deity":"九地","hidden":"壬"},"9":{"earth":"辛","heaven":["癸","乙"],"stars":["天芮","天禽"],"door":"杜门","deity":"螣蛇","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q18","description":"16 min after 夏至, same 丙申 hour: 夏至 上元 阴遁9局, doors 反吟","origin":"A-V5b/B-V10b","input":{"datetime":"2026-06-21T16:40:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-06-21T16:40:00","pillars":{"year":"丙午","month":"甲午","day":"丙寅","hour":"丙申"},"solarTerm":{"name":"夏至","index":12,"startUtc":"2026-06-21T08:24:30Z"},"dun":"yin","yuan":"upper","ju":9,"fuTou":"甲子","xunShou":{"head":"甲午","yi":"辛","palace":6},"zhiFu":{"star":"天心","homePalace":6,"stem":"丙","palaceRaw":2,"palace":2},"zhiShi":{"door":"开门","homePalace":6,"steps":2,"palaceRaw":4,"palace":4},"rotation":{"stars":6,"doors":4},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":true},"void":{"hour":["辰","巳"],"hourPalaces":[4],"day":["戌","亥"],"dayPalaces":[6]},"horse":{"branch":"寅","palace":8},"hiddenStart":4},"palaces":{"1":{"earth":"乙","heaven":["丁"],"stars":["天冲"],"door":"景门","deity":"玄武","hidden":"己"},"2":{"earth":"丙","heaven":["辛"],"stars":["天心"],"door":"生门","deity":"值符","hidden":"戊"},"3":{"earth":"丁","heaven":["戊"],"stars":["天英"],"door":"惊门","deity":"六合","hidden":"乙"},"4":{"earth":"癸","heaven":["丙","壬"],"stars":["天芮","天禽"],"door":"开门","deity":"太阴","hidden":"丙"},"5":{"earth":"壬","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"辛","heaven":["己"],"stars":["天任"],"door":"杜门","deity":"九地","hidden":"癸"},"7":{"earth":"庚","heaven":["乙"],"stars":["天蓬"],"door":"伤门","deity":"九天","hidden":"壬"},"8":{"earth":"己","heaven":["癸"],"stars":["天辅"],"door":"死门","deity":"白虎","hidden":"辛"},"9":{"earth":"戊","heaven":["庚"],"stars":["天柱"],"door":"休门","deity":"螣蛇","hidden":"庚"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)"],"knownToolDifferences":"china95 still shows 芒种 阳遁6局: its term table puts 夏至 at 16:59, 35 min late."},
{"id":"Q19","description":"15 min before 秋分 (2026-09-23 08:05 +08): 白露 中元 阴遁3局, 值使 raw 5","origin":"B-V5a","input":{"datetime":"2026-09-23T07:50:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-23T07:50:00","pillars":{"year":"丙午","month":"丁酉","day":"庚子","hour":"庚辰"},"solarTerm":{"name":"白露","index":17,"startUtc":"2026-09-07T14:41:16Z"},"dun":"yin","yuan":"middle","ju":3,"fuTou":"己亥","xunShou":{"head":"甲戌","yi":"己","palace":2},"zhiFu":{"star":"天芮","homePalace":2,"stem":"庚","palaceRaw":1,"palace":1},"zhiShi":{"door":"死门","homePalace":2,"steps":6,"palaceRaw":5,"palace":2},"rotation":{"stars":3,"doors":0},"fuYin":{"stars":false,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["申","酉"],"hourPalaces":[2,7],"day":["辰","巳"],"dayPalaces":[4]},"horse":{"branch":"寅","palace":8},"hiddenStart":2},"palaces":{"1":{"earth":"庚","heaven":["己","丙"],"stars":["天芮","天禽"],"door":"休门","deity":"值符","hidden":"辛"},"2":{"earth":"己","heaven":["戊"],"stars":["天冲"],"door":"死门","deity":"六合","hidden":"庚"},"3":{"earth":"戊","heaven":["丁"],"stars":["天心"],"door":"伤门","deity":"九地","hidden":"己"},"4":{"earth":"乙","heaven":["庚"],"stars":["天蓬"],"door":"杜门","deity":"玄武","hidden":"戊"},"5":{"earth":"丙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"乙"},"6":{"earth":"丁","heaven":["辛"],"stars":["天英"],"door":"开门","deity":"螣蛇","hidden":"丙"},"7":{"earth":"癸","heaven":["乙"],"stars":["天辅"],"door":"惊门","deity":"太阴","hidden":"丁"},"8":{"earth":"壬","heaven":["癸"],"stars":["天柱"],"door":"生门","deity":"九天","hidden":"癸"},"9":{"earth":"辛","heaven":["壬"],"stars":["天任"],"door":"景门","deity":"白虎","hidden":"壬"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q20","description":"15 min after 秋分, same 庚辰 hour and 符头: 秋分 中元 阴遁1局","origin":"B-V5b","input":{"datetime":"2026-09-23T08:20:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-23T08:20:00","pillars":{"year":"丙午","month":"丁酉","day":"庚子","hour":"庚辰"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"middle","ju":1,"fuTou":"己亥","xunShou":{"head":"甲戌","yi":"己","palace":9},"zhiFu":{"star":"天英","homePalace":9,"stem":"庚","palaceRaw":8,"palace":8},"zhiShi":{"door":"景门","homePalace":9,"steps":6,"palaceRaw":3,"palace":3},"rotation":{"stars":5,"doors":6},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["申","酉"],"hourPalaces":[2,7],"day":["辰","巳"],"dayPalaces":[4]},"horse":{"branch":"寅","palace":8},"hiddenStart":3},"palaces":{"1":{"earth":"戊","heaven":["丁"],"stars":["天辅"],"door":"伤门","deity":"螣蛇","hidden":"壬"},"2":{"earth":"乙","heaven":["戊"],"stars":["天蓬"],"door":"开门","deity":"白虎","hidden":"辛"},"3":{"earth":"丙","heaven":["乙","癸"],"stars":["天芮","天禽"],"door":"景门","deity":"九天","hidden":"庚"},"4":{"earth":"丁","heaven":["辛"],"stars":["天柱"],"door":"死门","deity":"九地","hidden":"己"},"5":{"earth":"癸","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"戊"},"6":{"earth":"壬","heaven":["丙"],"stars":["天冲"],"door":"生门","deity":"太阴","hidden":"乙"},"7":{"earth":"辛","heaven":["庚"],"stars":["天任"],"door":"休门","deity":"六合","hidden":"丙"},"8":{"earth":"庚","heaven":["己"],"stars":["天英"],"door":"杜门","deity":"值符","hidden":"丁"},"9":{"earth":"己","heaven":["壬"],"stars":["天心"],"door":"惊门","deity":"玄武","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)"],"knownToolDifferences":"china95 still shows 白露: its term table is late for 秋分."},
{"id":"Q21","description":"5 min before 立春 (2026-02-04 04:02 +08): year 乙巳, month 己丑, 大寒 上元 阳遁3局","origin":"new","input":{"datetime":"2026-02-04T03:57:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-02-04T03:57:00","pillars":{"year":"乙巳","month":"己丑","day":"己酉","hour":"丙寅"},"solarTerm":{"name":"大寒","index":2,"startUtc":"2026-01-20T01:44:56Z"},"dun":"yang","yuan":"upper","ju":3,"fuTou":"己酉","xunShou":{"head":"甲子","yi":"戊","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"丙","palaceRaw":1,"palace":1},"zhiShi":{"door":"伤门","homePalace":3,"steps":2,"palaceRaw":5,"palace":2},"rotation":{"stars":6,"doors":3},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"申","palace":2},"hiddenStart":2},"palaces":{"1":{"earth":"丙","heaven":["戊"],"stars":["天冲"],"door":"死门","deity":"值符","hidden":"丁"},"2":{"earth":"乙","heaven":["辛"],"stars":["天心"],"door":"伤门","deity":"玄武","hidden":"丙"},"3":{"earth":"戊","heaven":["丁"],"stars":["天英"],"door":"开门","deity":"太阴","hidden":"乙"},"4":{"earth":"己","heaven":["乙","庚"],"stars":["天芮","天禽"],"door":"休门","deity":"六合","hidden":"戊"},"5":{"earth":"庚","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"己"},"6":{"earth":"辛","heaven":["癸"],"stars":["天任"],"door":"景门","deity":"九天","hidden":"庚"},"7":{"earth":"壬","heaven":["丙"],"stars":["天蓬"],"door":"杜门","deity":"九地","hidden":"辛"},"8":{"earth":"癸","heaven":["己"],"stars":["天辅"],"door":"惊门","deity":"螣蛇","hidden":"壬"},"9":{"earth":"丁","heaven":["壬"],"stars":["天柱"],"door":"生门","deity":"白虎","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)"],"knownToolDifferences":"3meta differs on the door ring only (阳遁 5 -> 艮8). china95 shows year/month 丙午 庚寅 because it switches them by date, not at the 立春 instant."},
{"id":"Q22","description":"5 min after 立春, same 丙寅 hour: year 丙午, month 庚寅, 立春 上元 阳遁8局","origin":"new","input":{"datetime":"2026-02-04T04:07:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-02-04T04:07:00","pillars":{"year":"丙午","month":"庚寅","day":"己酉","hour":"丙寅"},"solarTerm":{"name":"立春","index":3,"startUtc":"2026-02-03T20:02:08Z"},"dun":"yang","yuan":"upper","ju":8,"fuTou":"己酉","xunShou":{"head":"甲子","yi":"戊","palace":8},"zhiFu":{"star":"天任","homePalace":8,"stem":"丙","palaceRaw":6,"palace":6},"zhiShi":{"door":"生门","homePalace":8,"steps":2,"palaceRaw":1,"palace":1},"rotation":{"stars":6,"doors":7},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"申","palace":2},"hiddenStart":1},"palaces":{"1":{"earth":"庚","heaven":["壬"],"stars":["天冲"],"door":"生门","deity":"螣蛇","hidden":"丙"},"2":{"earth":"辛","heaven":["丙"],"stars":["天心"],"door":"惊门","deity":"九地","hidden":"乙"},"3":{"earth":"壬","heaven":["己"],"stars":["天英"],"door":"杜门","deity":"六合","hidden":"戊"},"4":{"earth":"癸","heaven":["辛","丁"],"stars":["天芮","天禽"],"door":"景门","deity":"白虎","hidden":"己"},"5":{"earth":"丁","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"庚"},"6":{"earth":"丙","heaven":["戊"],"stars":["天任"],"door":"休门","deity":"值符","hidden":"辛"},"7":{"earth":"乙","heaven":["庚"],"stars":["天蓬"],"door":"开门","deity":"九天","hidden":"壬"},"8":{"earth":"戊","heaven":["癸"],"stars":["天辅"],"door":"伤门","deity":"太阴","hidden":"癸"},"9":{"earth":"己","heaven":["乙"],"stars":["天柱"],"door":"死门","deity":"玄武","hidden":"丁"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)"],"knownToolDifferences":"china95 still shows 大寒 阳遁3局: its term table is late for 立春."},
{"id":"Q23","description":"23:30 on a 癸卯 day, default zi23: day 甲辰, hour 甲子, 下元, full 伏吟","origin":"B-V6a","input":{"datetime":"2026-09-26T23:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-26T23:30:00","pillars":{"year":"丙午","month":"丁酉","day":"甲辰","hour":"甲子"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"lower","ju":4,"fuTou":"甲辰","xunShou":{"head":"甲子","yi":"戊","palace":4},"zhiFu":{"star":"天辅","homePalace":4,"stem":"戊","palaceRaw":4,"palace":4},"zhiShi":{"door":"杜门","homePalace":4,"steps":0,"palaceRaw":4,"palace":4},"rotation":{"stars":0,"doors":0},"fuYin":{"stars":true,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["寅","卯"],"dayPalaces":[3,8]},"horse":{"branch":"寅","palace":8},"hiddenStart":5},"palaces":{"1":{"earth":"辛","heaven":["辛"],"stars":["天蓬"],"door":"休门","deity":"六合","hidden":"壬"},"2":{"earth":"庚","heaven":["庚","乙"],"stars":["天芮","天禽"],"door":"死门","deity":"九地","hidden":"辛"},"3":{"earth":"己","heaven":["己"],"stars":["天冲"],"door":"伤门","deity":"螣蛇","hidden":"庚"},"4":{"earth":"戊","heaven":["戊"],"stars":["天辅"],"door":"杜门","deity":"值符","hidden":"己"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"戊"},"6":{"earth":"丙","heaven":["丙"],"stars":["天心"],"door":"开门","deity":"白虎","hidden":"乙"},"7":{"earth":"丁","heaven":["丁"],"stars":["天柱"],"door":"惊门","deity":"玄武","hidden":"丙"},"8":{"earth":"癸","heaven":["癸"],"stars":["天任"],"door":"生门","deity":"太阴","hidden":"丁"},"9":{"earth":"壬","heaven":["壬"],"stars":["天英"],"door":"景门","deity":"九天","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","china95.net 元亨利贞 转盘 拆补无闰 (grid)"]},
{"id":"Q24","description":"same instant, ziHour split (早晚子): day stays 癸卯, hour 甲子, 中元","origin":"B-V6b","input":{"datetime":"2026-09-26T23:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"split","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-26T23:30:00","pillars":{"year":"丙午","month":"丁酉","day":"癸卯","hour":"甲子"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"middle","ju":1,"fuTou":"己亥","xunShou":{"head":"甲子","yi":"戊","palace":1},"zhiFu":{"star":"天蓬","homePalace":1,"stem":"戊","palaceRaw":1,"palace":1},"zhiShi":{"door":"休门","homePalace":1,"steps":0,"palaceRaw":1,"palace":1},"rotation":{"stars":0,"doors":0},"fuYin":{"stars":true,"doors":true},"fanYin":{"stars":false,"doors":false},"void":{"hour":["戌","亥"],"hourPalaces":[6],"day":["辰","巳"],"dayPalaces":[4]},"horse":{"branch":"寅","palace":8},"hiddenStart":5},"palaces":{"1":{"earth":"戊","heaven":["戊"],"stars":["天蓬"],"door":"休门","deity":"值符","hidden":"壬"},"2":{"earth":"乙","heaven":["乙","癸"],"stars":["天芮","天禽"],"door":"死门","deity":"六合","hidden":"辛"},"3":{"earth":"丙","heaven":["丙"],"stars":["天冲"],"door":"伤门","deity":"九地","hidden":"庚"},"4":{"earth":"丁","heaven":["丁"],"stars":["天辅"],"door":"杜门","deity":"玄武","hidden":"己"},"5":{"earth":"癸","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"戊"},"6":{"earth":"壬","heaven":["壬"],"stars":["天心"],"door":"开门","deity":"螣蛇","hidden":"乙"},"7":{"earth":"辛","heaven":["辛"],"stars":["天柱"],"door":"惊门","deity":"太阴","hidden":"丙"},"8":{"earth":"庚","heaven":["庚"],"stars":["天任"],"door":"生门","deity":"九天","hidden":"丁"},"9":{"earth":"己","heaven":["己"],"stars":["天英"],"door":"景门","deity":"白虎","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马"]},
{"id":"Q25","description":"same instant, ziHour midnight: day 癸卯, hour 壬子 (same-day 子)","origin":"B-V6c","input":{"datetime":"2026-09-26T23:30:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"midnight","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-09-26T23:30:00","pillars":{"year":"丙午","month":"丁酉","day":"癸卯","hour":"壬子"},"solarTerm":{"name":"秋分","index":18,"startUtc":"2026-09-23T00:05:14Z"},"dun":"yin","yuan":"middle","ju":1,"fuTou":"己亥","xunShou":{"head":"甲辰","yi":"壬","palace":6},"zhiFu":{"star":"天心","homePalace":6,"stem":"壬","palaceRaw":6,"palace":6},"zhiShi":{"door":"开门","homePalace":6,"steps":8,"palaceRaw":7,"palace":7},"rotation":{"stars":0,"doors":7},"fuYin":{"stars":true,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["寅","卯"],"hourPalaces":[3,8],"day":["辰","巳"],"dayPalaces":[4]},"horse":{"branch":"寅","palace":8},"hiddenStart":7},"palaces":{"1":{"earth":"戊","heaven":["戊"],"stars":["天蓬"],"door":"生门","deity":"九天","hidden":"己"},"2":{"earth":"乙","heaven":["乙","癸"],"stars":["天芮","天禽"],"door":"惊门","deity":"太阴","hidden":"戊"},"3":{"earth":"丙","heaven":["丙"],"stars":["天冲"],"door":"杜门","deity":"玄武","hidden":"乙"},"4":{"earth":"丁","heaven":["丁"],"stars":["天辅"],"door":"景门","deity":"白虎","hidden":"丙"},"5":{"earth":"癸","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"丁"},"6":{"earth":"壬","heaven":["壬"],"stars":["天心"],"door":"休门","deity":"值符","hidden":"癸"},"7":{"earth":"辛","heaven":["辛"],"stars":["天柱"],"door":"开门","deity":"螣蛇","hidden":"壬"},"8":{"earth":"庚","heaven":["庚"],"stars":["天任"],"door":"伤门","deity":"九地","hidden":"辛"},"9":{"earth":"己","heaven":["己"],"stars":["天英"],"door":"死门","deity":"六合","hidden":"庚"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-B-py (spec B reference, sxtwl terms)","taobi 0.4.5 (grid)"]},
{"id":"Q26","description":"New York visitor in EDT, civil basis: pillars from the New York wall clock, term from the absolute instant (00:30 UTC, before 夏至)","origin":"B-V9","input":{"datetime":"2026-06-20T20:30:00-04:00","tz":"America/New_York","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-06-20T20:30:00","pillars":{"year":"丙午","month":"甲午","day":"乙丑","hour":"丙戌"},"solarTerm":{"name":"芒种","index":11,"startUtc":"2026-06-05T15:48:21Z"},"dun":"yang","yuan":"upper","ju":6,"fuTou":"甲子","xunShou":{"head":"甲申","yi":"庚","palace":8},"zhiFu":{"star":"天任","homePalace":8,"stem":"丙","palaceRaw":4,"palace":4},"zhiShi":{"door":"生门","homePalace":8,"steps":2,"palaceRaw":1,"palace":1},"rotation":{"stars":2,"doors":7},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["午","未"],"hourPalaces":[2,9],"day":["戌","亥"],"dayPalaces":[6]},"horse":{"branch":"申","palace":2},"hiddenStart":1},"palaces":{"1":{"earth":"壬","heaven":["己"],"stars":["天柱"],"door":"生门","deity":"玄武","hidden":"丙"},"2":{"earth":"癸","heaven":["丙"],"stars":["天辅"],"door":"惊门","deity":"太阴","hidden":"乙"},"3":{"earth":"丁","heaven":["壬"],"stars":["天蓬"],"door":"杜门","deity":"九天","hidden":"戊"},"4":{"earth":"丙","heaven":["庚"],"stars":["天任"],"door":"景门","deity":"值符","hidden":"己"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"庚"},"6":{"earth":"戊","heaven":["癸","乙"],"stars":["天芮","天禽"],"door":"休门","deity":"白虎","hidden":"辛"},"7":{"earth":"己","heaven":["辛"],"stars":["天英"],"door":"开门","deity":"六合","hidden":"壬"},"8":{"earth":"庚","heaven":["戊"],"stars":["天心"],"door":"伤门","deity":"九地","hidden":"癸"},"9":{"earth":"辛","heaven":["丁"],"stars":["天冲"],"door":"死门","deity":"螣蛇","hidden":"丁"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马"]},
{"id":"Q27","description":"New York in EDT with timeBasis standard: 21:30 EDT is 20:30 EST, so 戌 hour instead of the civil 亥","origin":"new","input":{"datetime":"2026-06-20T21:30:00-04:00","tz":"America/New_York","options":{"timeBasis":"standard","ziHour":"zi23","deityNames":"huXuan"}},"expected":{"meta":{"basisLocal":"2026-06-20T20:30:00","pillars":{"year":"丙午","month":"甲午","day":"乙丑","hour":"丙戌"},"solarTerm":{"name":"芒种","index":11,"startUtc":"2026-06-05T15:48:21Z"},"dun":"yang","yuan":"upper","ju":6,"fuTou":"甲子","xunShou":{"head":"甲申","yi":"庚","palace":8},"zhiFu":{"star":"天任","homePalace":8,"stem":"丙","palaceRaw":4,"palace":4},"zhiShi":{"door":"生门","homePalace":8,"steps":2,"palaceRaw":1,"palace":1},"rotation":{"stars":2,"doors":7},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["午","未"],"hourPalaces":[2,9],"day":["戌","亥"],"dayPalaces":[6]},"horse":{"branch":"申","palace":2},"hiddenStart":1},"palaces":{"1":{"earth":"壬","heaven":["己"],"stars":["天柱"],"door":"生门","deity":"玄武","hidden":"丙"},"2":{"earth":"癸","heaven":["丙"],"stars":["天辅"],"door":"惊门","deity":"太阴","hidden":"乙"},"3":{"earth":"丁","heaven":["壬"],"stars":["天蓬"],"door":"杜门","deity":"九天","hidden":"戊"},"4":{"earth":"丙","heaven":["庚"],"stars":["天任"],"door":"景门","deity":"值符","hidden":"己"},"5":{"earth":"乙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"庚"},"6":{"earth":"戊","heaven":["癸","乙"],"stars":["天芮","天禽"],"door":"休门","deity":"白虎","hidden":"辛"},"7":{"earth":"己","heaven":["辛"],"stars":["天英"],"door":"开门","deity":"六合","hidden":"壬"},"8":{"earth":"庚","heaven":["戊"],"stars":["天心"],"door":"伤门","deity":"九地","hidden":"癸"},"9":{"earth":"辛","heaven":["丁"],"stars":["天冲"],"door":"死门","deity":"螣蛇","hidden":"丁"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马"]},
{"id":"Q28","description":"Penang true solar time (lon 100.3288): 10:20 MYT is about 08:51 local apparent time, 辰 hour; 值符 and 值使 both land raw 5 -> 坤2","origin":"A-V12","input":{"datetime":"2026-03-15T10:20:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"trueSolar","ziHour":"zi23","deityNames":"huXuan","longitude":100.3288}},"expected":{"meta":{"basisLocal":"2026-03-15T08:51:34","pillars":{"year":"丙午","month":"辛卯","day":"戊子","hour":"丙辰"},"solarTerm":{"name":"惊蛰","index":5,"startUtc":"2026-03-05T13:59:00Z"},"dun":"yang","yuan":"middle","ju":7,"fuTou":"甲申","xunShou":{"head":"甲寅","yi":"癸","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"丙","palaceRaw":5,"palace":2},"zhiShi":{"door":"伤门","homePalace":3,"steps":2,"palaceRaw":5,"palace":2},"rotation":{"stars":3,"doors":3},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["子","丑"],"hourPalaces":[1,8],"day":["午","未"],"dayPalaces":[2,9]},"horse":{"branch":"寅","palace":8},"hiddenStart":2},"palaces":{"1":{"earth":"辛","heaven":["壬","丙"],"stars":["天芮","天禽"],"door":"死门","deity":"六合","hidden":"丁"},"2":{"earth":"壬","heaven":["癸"],"stars":["天冲"],"door":"伤门","deity":"值符","hidden":"丙"},"3":{"earth":"癸","heaven":["乙"],"stars":["天心"],"door":"开门","deity":"玄武","hidden":"乙"},"4":{"earth":"丁","heaven":["辛"],"stars":["天蓬"],"door":"休门","deity":"九地","hidden":"戊"},"5":{"earth":"丙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"己"},"6":{"earth":"乙","heaven":["庚"],"stars":["天英"],"door":"景门","deity":"太阴","hidden":"庚"},"7":{"earth":"戊","heaven":["丁"],"stars":["天辅"],"door":"杜门","deity":"螣蛇","hidden":"辛"},"8":{"earth":"己","heaven":["戊"],"stars":["天柱"],"door":"惊门","deity":"白虎","hidden":"壬"},"9":{"earth":"庚","heaven":["己"],"stars":["天任"],"door":"生门","deity":"九天","hidden":"癸"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","yixinsoft.com 时家奇门 转盘 拆补 (grid, pillars, 暗干)","hand derivation of true solar time (§15.4)"]},
{"id":"Q29","description":"Q01 with deityNames gouQue: 阳遁 slots 4 and 5 read 勾陈 and 朱雀 (display option only)","origin":"A-V1","input":{"datetime":"2026-03-15T10:20:00+08:00","tz":"Asia/Kuala_Lumpur","options":{"timeBasis":"civil","ziHour":"zi23","deityNames":"gouQue"}},"expected":{"meta":{"basisLocal":"2026-03-15T10:20:00","pillars":{"year":"丙午","month":"辛卯","day":"戊子","hour":"丁巳"},"solarTerm":{"name":"惊蛰","index":5,"startUtc":"2026-03-05T13:59:00Z"},"dun":"yang","yuan":"middle","ju":7,"fuTou":"甲申","xunShou":{"head":"甲寅","yi":"癸","palace":3},"zhiFu":{"star":"天冲","homePalace":3,"stem":"丁","palaceRaw":4,"palace":4},"zhiShi":{"door":"伤门","homePalace":3,"steps":3,"palaceRaw":6,"palace":6},"rotation":{"stars":1,"doors":5},"fuYin":{"stars":false,"doors":false},"fanYin":{"stars":false,"doors":false},"void":{"hour":["子","丑"],"hourPalaces":[1,8],"day":["午","未"],"dayPalaces":[2,9]},"horse":{"branch":"亥","palace":6},"hiddenStart":6},"palaces":{"1":{"earth":"辛","heaven":["乙"],"stars":["天心"],"door":"杜门","deity":"朱雀","hidden":"己"},"2":{"earth":"壬","heaven":["庚"],"stars":["天英"],"door":"休门","deity":"太阴","hidden":"庚"},"3":{"earth":"癸","heaven":["己"],"stars":["天任"],"door":"死门","deity":"九天","hidden":"辛"},"4":{"earth":"丁","heaven":["癸"],"stars":["天冲"],"door":"惊门","deity":"值符","hidden":"壬"},"5":{"earth":"丙","heaven":[],"stars":[],"door":null,"deity":null,"hidden":"癸"},"6":{"earth":"乙","heaven":["戊"],"stars":["天柱"],"door":"伤门","deity":"勾陈","hidden":"丁"},"7":{"earth":"戊","heaven":["壬","丙"],"stars":["天芮","天禽"],"door":"生门","deity":"六合","hidden":"丙"},"8":{"earth":"己","heaven":["辛"],"stars":["天蓬"],"door":"景门","deity":"九地","hidden":"乙"},"9":{"earth":"庚","heaven":["丁"],"stars":["天辅"],"door":"开门","deity":"螣蛇","hidden":"戊"}}},"confirmedBy":["ref-final-ts (this spec, §14)","ref-A-py (spec A reference, sxtwl terms)","ref-B-py (spec B reference, sxtwl terms)","qimen-rs 0.2.0 incl. 暗干, 旬空, 驿马","kinqimen 0.0.6.6 (grid, first heaven stem)","3meta 2.6.0 (grid)","taobi 0.4.5 (grid)","yixinsoft.com (deity names literally)","kinqimen 0.0.6.6 (deity names literally)"],"knownToolDifferences":"kinqimen and yixinsoft print 勾陈/朱雀 in 阳遁, so they confirm this naming literally."}
]
```

## 17. Decisions and discrepancies

Specs A and B agree on every rule that decides the default chart. All 29 vectors they published, 14 from A and 15 from B, come out identical under this spec, and their two Python references agree on 40,000 random charts. The only overlapping vectors, A-V5a/b and B-V10a/b, agree. The earth-plate and 局 tables match cell for cell. So nearly every item below is a convention, an option or a representation. D18 is a factual slip in one of B's worked examples.

**D1. Default clock basis.** A defaulted to `standard` (DST removed); B to `civil` (DST included). Decision: `civil`. Every tool tested charts the wall time typed into it, and a visitor comparing the site with an app types their phone's clock. `calendar.md` already chose it. For UTC+8, the owner's zone and the likeliest practitioner zone, the two are identical. A's argument has merit: 八字 practice removes China's 1986–91 DST, and DST has no astronomical meaning. So `standard` stays an option (Q27).

**D2. Time-basis option set.** A: `standard | civil | trueSolar`. B: `civil | fixedOffset | trueSolar`. Decision: `civil | standard | trueSolar`, with the zone given separately as `timeZone` or `utcOffsetMinutes`. B's `fixedOffset` is a zone choice, not a basis; "cast in Penang time" is `utcOffsetMinutes: 480`. `trueSolar` is in the core because it is four lines, but the v1 UI does not ask for geolocation, as `calendar.md` decided.

**D3. 子 hour.** A offered 23:00 or 00:00 and said never to implement the same-day-stem 夜子 hour. B offered `zi23 | split | midnight`. A's `0` equals B's `split` and `calendar.md`'s `'00:00'`; the vectors confirm it (A-V6-zi0 equals this spec's `split`). Decision: default `zi23`, options `split` and `midnight`. `midnight` has two live implementations, taobi and qimen-dunjia's 當日 option, and costs one line. A's objection, that it breaks the continuity of the hour cycle, is recorded in §4.2. Do not expose `midnight` in the UI unless CY follows that school.

**D4. 元 formula.** A wrote `floor((dayIdx mod 15) / 5)`; B wrote `floor(dayIdx / 5) mod 3`. Identical for 0–59: with `dayIdx = 15q + r`, both equal `floor(r / 5)`. The spec uses B's form, which `calendar.md` also uses.

**D5. Deity naming.** Both default to 白虎/玄武 in both 遁, but they label the alternative in opposite ways: A calls 白虎/玄武 "classical" and 勾陈/朱雀 the 张志春 school; B calls 勾陈/朱雀 "classical". Both label sets have old sources. The 句解 lists "值符、腾蛇、太阴、六合、白虎、元武、九地、九天" for both 遁; the 飞盘 九神 lists put 勾陈 and 朱雀 in 阳遁, and 张志春's 转盘 school, which yixinsoft follows, uses them in 阳遁 too. Tools split: china95 (checked today), qimen-rs, 3meta and taobi print 白虎/玄武; yixinsoft, kinqimen and qimen-dunjia print 勾陈/朱雀 in 阳遁. Decision: default `huXuan`, option `gouQue`, and neither is called "classical". It keeps one set of eight glyphs in the UI and matches `content.md`, which already uses 白虎/玄武 with a `TODO(owner)`.

**D6. 值使 start when the 旬首 is in 5.** Both count from 5 by default. A added an option `zhiShiStartWhenXunInCenter: 'kun2'`; B had none. Decision: no option. Counting from 坤2 is found only in 3meta, mingyu-core before its issue #368, and one yi958 table. Counting from 5 is what the 古今图书集成 shows in 119 of 119 entries and what kinqimen, qimen-rs, taobi, bigfishmarquis, yixinsoft and china95 do (Q08, Q09, Q10). An option would only let the site disagree with every mainstream chart.

**D7. 值使 landing on 5 in 阳遁.** Both send it to 坤2. 3meta sends it to 艮8. Kept: 坤2 in both 遁. The 古今图书集成 deity columns put a 值符 that lands on 5 in 坤2 in 59 of 60 阳遁 rows and in 艮8 in none, and every other tool agrees (Q14, Q21).

**D8. 暗干 rule.** A used the zyqmdj.com wording as 3meta implements it: in a 甲 hour start at 中五 unless the 旬首仪 equals `earth[5]`, and when the 值符 and 值使 share a palace start at 中五. B used the qimen-rs rule: start at 中五 when `earth[Dt]` equals the stem. They differ only when the hour stem sits in 中五 and the 值使 lands in 坤2, about 2.6 % of hours in 2026. Decision: B's rule, for two reasons.

- yixinsoft agrees with B on that exact case (Q13, checked today), as do qimen-rs and qimen-go.
- zyqmdj itself gives the purpose: "避免暗干与地盘干组成伏吟". In the edge case A's rule places the hour stem in palace 5 on top of the same earth stem, creating that 伏吟 (§15.3). B's rule is the purpose stated as a test.

A wanted 暗干 left out of v1; B called it nice to have. Decision: compute it, test it, do not render it in v1.

**D9. Term source.** A recommended a build-time table from astronomy-engine; B used tyme4ts through `calendar.md`. Decision: tyme4ts values. `calendar.md` measured astronomy-engine missing the HKO minute on 46 of 240 terms against tyme4ts's 4. But A's packaging idea is good: a build-time tyme4ts table (§14.2) gives the same numbers in 4–8 KB gzip instead of 75 KB. That amends `calendar.md`'s bundle plan without changing its engine choice or its adapter interface.

**D10. Output representation.** A used Chinese strings; B used ASCII IDs (`'peng'`, `'rest'`, `'tiger'`). Decision: Chinese strings, plus `deitySlot` for naming-independent logic. `content.md` and `content.draft.ts` key their glosses by the Chinese names, the vectors compare directly with every tool, and there is one fewer mapping table.

**D11. Palace-5 representation.** A output only the earth stem for palace 5; B output empty plates. Decision: a full palace object with `heaven: []`, `stars: []`, `door: null`, `deity: null`, plus its `hidden` stem. A's `lodgedEarthStem` and B's optional `earthHostedStem` become `lodgedEarth`, always present on palace 2 and `null` elsewhere.

**D12. Voids.** A computed 时空 and 日空; B made 时空 essential and 日空 nice to have. Both are cheap and yixinsoft prints both, so both are in the output. B deduped void palaces and A did not say; they are deduped and sorted.

**D13. `zhiFu`/`zhiShi` fields.** A had `homePalace`, `palaceRaw`, `palace`; B had `landingPalace`, `rawPalace`, `stemUsed`. Merged as in §13. `zhiFu.homePalace` is raw `P0`, 5 possible, as B wanted, so the UI can say "天禽 from 中五". `zhiShi.homePalace` is `lodge(P0)`, since a door's home is always an outer palace.

**D14. 值符 label when the 旬首 is in 5.** B left it open (天禽 or 天芮). Decision: 天禽. The 句解 says "天禽为值符", the 古今图书集成 writes 禽, and yixinsoft and qimen-rs print 天禽.

**D15. Enumerations.** A wrote 元 as 上元/中元/下元, B as 上/中/下, and both wrote 遁 differently in JSON. Decision: `'upper' | 'middle' | 'lower'` and `'yang' | 'yin'` in data. Chinese labels are display strings.

**D16. `nextChangeUtc`.** A's `validUntilUtc` and B's `nextChangeUtc` are the same thing, and A left out the 00:00 boundary that `split` and `midnight` need. Kept B's name with that boundary added (§12.6).

**D17. Glosses.** A and B proposed different English glosses (天冲 Charge or Impulse, 惊门 Alarm or Fear). This spec has none. `content.md` has final wording already, and it follows B.

**D18. A factual slip in spec B.** B §4 says "秋分 2026 never has a 上元". It does: 10-02 己酉 to 10-06 is 秋分 上元 阴遁7局, checked with this spec's code. The rule B states is right; only the example was wrong. §6 has the corrected sequence.

**D19. Vector set.** The 29 published vectors are 27 distinct charts, because A-V5a/b and B-V10a/b are the same two. The final set keeps 24 of them. It drops A-V6 and its `zi0` twin, which test the same thing as B-V6, and B-V3, which repeats A-V3. It adds five: Q13 for D8, Q21 and Q22 for the year and month switch at 立春, Q27 for the `standard` basis, and Q29 for `gouQue`. Spec B's claim that qimen-rs `--day-boundary midnight` implements `split` holds (Q24).

## 18. Remaining risks and questions for CY

1. **Charts near a term instant.** Tools disagree by up to about 20 s (tyme4ts, sxtwl, yixinsoft) and china95 by 20–40 minutes. A chart cast within a minute of a term can differ from someone's app. This is inherent. Past about 2035 every ephemeris extrapolates ΔT, so instants drift by tens of seconds.
2. **Clock basis.** CY decides whether the Grove says "cast for your local time" (`civil`) or offers a Penang true-solar reading. True solar time changes the Penang 时辰 most of the time.
3. **Lineage choices.** `deityNames`, `ziHour` and the 暗干 school are display or option questions for CY; `content.md` already flags the deity names.
4. **True solar near a 时辰 boundary.** The NOAA formula is good to about a minute, so a true-solar chart within a minute of a 时辰 boundary may not match another app.
5. **DST edge hours.** In `civil`, the repeated or skipped hour on a DST change day follows the device clock. Nobody checks this; it is accepted.
6. **Single external check.** Q24, Q26 and Q27 were confirmed externally only by qimen-rs, and Q25 only by taobi. The references cover them, but a second outside program would be welcome if one supporting those conventions turns up.

## 19. Sources

Classical and teaching texts:

- 《烟波钓叟歌》, Wikisource: https://zh.wikisource.org/zh-hans/%E7%83%9F%E6%B3%A2%E9%92%93%E5%8F%9F%E6%AD%8C
- 《烟波钓叟歌》句解, yzthome: https://www.yzthome.com/thread-9.htm
- 《钦定古今图书集成·博物汇编·艺术典》卷709–712, Wikisource: https://zh.wikisource.org/zh-hant/%E6%AC%BD%E5%AE%9A%E5%8F%A4%E4%BB%8A%E5%9C%96%E6%9B%B8%E9%9B%86%E6%88%90/%E5%8D%9A%E7%89%A9%E5%BD%99%E7%B7%A8/%E8%97%9D%E8%A1%93%E5%85%B8/%E7%AC%AC709%E5%8D%B7
- yi958, 奇门术的相关讲解之二 (拆补 rule): https://m.yi958.com/qimen/posts/1697
- yi958, 奇门遁甲三种定局方法杂谈: https://qimen.yi958.com/Article_8733.html
- 诚易堂, 图解置闰法、拆补法定局法: https://blog.sina.com.cn/s/blog_5bc171940102wefr.html
- 易宇山人, 暗干的排盘方法: http://www.zyqmdj.com/2128.html
- 河冰, 奇门遁甲排盘依据真太阳时: https://qimen.yi958.com/qmfp/5527
- NOAA, General Solar Position Calculations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF

Software and tools:

- qimen-rs 0.2.0: https://github.com/SpenserCai/qimen-rs (`docs/algorithm-sources.md`, `docs/extensions.md`)
- kinqimen 0.0.6.6: https://github.com/kentang2017/kinqimen
- 3meta 2.6.0: https://github.com/3metaJun/3meta
- taobi 0.4.5: https://github.com/Taogram/taobi (run with `{elements: 1}` for 拆补 and `TZ=Asia/Shanghai`)
- mingyu issue on the 值使 start: https://github.com/Brhiza/mingyu/issues/368
- tyme4ts 1.5.2: https://github.com/6tail/tyme4ts
- sxtwl: https://github.com/yuangu/sxtwl_cpp
- yixinsoft 时家奇门, 转盘 拆补: https://yixinsoft.com/qimen/shi
- 元亨利贞 奇门排盘, 转盘 拆补无闰法: https://www.china95.net/paipan/qimen/

Scratch work, not in the repo: `/tmp/qm-final/` holds `qimen.ts`, `terms.json`, `gen.mts`, the comparison scripts (`cmp_refs.py`, `cmp_ext.py`, `cmp_web.py`, `rand_cmp.py`, `props.mts`) and cached tool pages in `cache/`. The earlier references are `/tmp/qm-ref/qm_ref.py` and `/tmp/qm-ref/ref.py`.
