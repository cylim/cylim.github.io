/**
 * Calendar helpers built on the Qimen engine's clock and term table. Owner: qimen.
 * - shichen: the current 时辰, its range, the next turn, stepping (table-free, cheap to import).
 * - colophon: the finale's dated inscription (imports the term table, about 7 KB gzip).
 */

export { localStamp, shichenAt, shiftShichen, type Shichen } from './shichen'
export { colophonDate, formatColophon, termPhraseEn, type ColophonCopy, type ColophonDate, type TermDay } from './colophon'
