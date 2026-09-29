/** Compact timeline (content.md §3). A <table> with a caption that rolls past like credits in I4. */

export type TimelineKind = 'work' | 'education' | 'certification' | 'community'

export interface TimelineEntry {
  readonly kind: TimelineKind
  readonly start: number
  /** null for a single-year entry, 'now' for current roles. */
  readonly end: number | 'now' | null
  readonly org: string
  readonly role: string
  readonly note?: string
}

/** The table holds study, a certification and community rows too, so not "Where I've worked". */
export const timelineCaption = "Where I've been"

/**
 * One chronology, newest first by start date, all kinds together, so the years read in order down
 * the credits roll. Facts follow the LinkedIn export and public GitHub (github.com/cylim/talks).
 */
export const timeline: readonly TimelineEntry[] = [
  { kind: 'work', start: 2026, end: 'now', org: 'Miroma Project Factory', role: 'Software Engineer', note: 'Stage 3 of Pave, the quit-vaping app, for Cancer Institute NSW' },
  { kind: 'work', start: 2024, end: 2026, org: 'Tokenyze', role: 'Frontend Engineer', note: 'Agent dashboard for compliant gold trading' },
  { kind: 'work', start: 2022, end: 2023, org: 'Mercury Labs', role: 'Software Engineer', note: 'Tokenised wine and a supplier dashboard to tokenise anything' },
  { kind: 'work', start: 2022, end: 2023, org: 'atticc', role: 'Software Engineer', note: 'Web3 social network on CyberConnect and XMTP' },
  { kind: 'work', start: 2020, end: 2022, org: 'Miroma Project Factory', role: 'Software Engineer', note: 'Liv, a support app for people living with dementia' },
  {
    kind: 'work',
    start: 2019,
    end: 2026,
    org: 'Kysen Technologies',
    role: 'Software Engineer',
    note: 'PoS validators, and products like Cosmos Outpost, Harvest and Mirror Wallet',
  },
  // github.com/cylim/talks: 23 March 2019, "CI with Docker", Docker Bday #6 (Docker Penang).
  { kind: 'community', start: 2019, end: null, org: 'Docker Penang', role: 'Speaker', note: 'Talk on CI with Docker' },
  {
    kind: 'work',
    start: 2018,
    // Owner-confirmed: Cyants is his own studio and JRNY (2025–2026) is a Cyants product, so it runs
    // on past LinkedIn's Jun 2024 end date. TODO(owner): update LinkedIn to match, or give an end year.
    end: 'now',
    org: 'Cyants',
    role: 'Founder',
    note: 'My studio. Client apps, NFT launches on Ethereum and Aptos, NextRare, and our own products like JRNY',
  },
  {
    kind: 'community',
    // TODO(owner): keep this row? Organiser from November 2017 (résumé: "November 2017 - Stopped");
    // 2018 is the last JS Penang talk. The 2019 Docker talk has its own row.
    start: 2017,
    end: 2018,
    org: 'JavaScript Malaysia',
    role: 'Penang meetup organiser, speaker',
    note: 'Talks on SPAs, Socket.io, and React and Hooks',
  },
  { kind: 'work', start: 2017, end: 2018, org: 'TBSx3', role: 'Senior Software Engineer', note: 'Led the Penang team' },
  {
    kind: 'work',
    start: 2017,
    end: null,
    org: 'Lava X Technologies',
    role: 'Full Stack Developer',
    note: 'Remote. Led six-week client MVPs.',
  },
  { kind: 'education', start: 2016, end: null, org: 'University of Wollongong', role: 'BCompSc, Digital System Security' },
  {
    kind: 'work',
    start: 2015,
    end: null,
    org: 'Tableapp',
    role: 'iOS Developer (intern)',
    note: "Built a restaurant manager's app from scratch",
  },
  {
    kind: 'certification',
    // TODO(owner): confirm year. 2014 comes from the 2018 profile.json.
    start: 2014,
    end: null,
    org: 'Mile2',
    role: 'CPEH',
    note: 'Certified Professional Ethical Hacker',
  },
]

/** "2019–2026", "2026–now", "2017". */
export function yearsLabel(e: Pick<TimelineEntry, 'start' | 'end'>): string {
  if (e.end === null) return String(e.start)
  return `${e.start}–${e.end}`
}
