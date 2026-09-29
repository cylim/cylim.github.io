/**
 * Cabin terminal copy (content.md §3 "In-cabin terminal", design.md §10): the prompt, banner and
 * labels, and the two outputs the no-JS static transcript shows. The command table lives in
 * terminalCommands.ts, so the first screen doesn't carry it.
 */

import { features } from './features'

export const terminal = {
  prompt: 'cy@cabin:~$',
  banner: ["cabin terminal. type 'help' to see what it knows."],
  /** {input} is replaced with what the visitor typed. */
  notFound: "{input}: command not found. Try 'help'.",
  inputAriaLabel: 'Cabin terminal. Type a command and press Enter.',
  placeholder: "type 'help'",
  /** Mobile command chips above the input (design.md §10.2). `stack` stands in for `qimen` while the
   * grove is paused (content/features.ts). */
  chips: ['help', 'whoami', 'services', 'projects', features.grove ? 'qimen' : 'stack', 'contact'],
  /** With JavaScript off the section shows these commands' output as a static transcript. */
  staticTranscript: ['whoami', 'contact'],
  /** Delay before a `navigate` action dives. */
  navigateDelayMs: 600,
  scrollback: 200,
  /** Printed after the input line on Ctrl+C. */
  interrupt: '^C',
  /** Mobile sheet (design.md §10.2). */
  closeSheet: 'Close terminal',
  chipsLabel: 'Commands',
  /** Visible label before the input in the album and the sheet (the prompt already says who you are). */
  logLabel: 'Terminal output',
} as const

/** `whoami` output; also the no-JS static transcript. */
export const whoamiOutput: readonly string[] = [
  'CY Lim (Chee Yeong Lim)',
  'Full stack software engineer in Penang, Malaysia. Shipping since 2017.',
  'React and TypeScript by default. Blockchain frontends since 2019.',
  'Runs Cyants, a small software studio.',
  'Also practises fengshui and Qimen Dunjia.',
]

/** `contact` output; also the no-JS static transcript. */
export const contactOutput: readonly string[] = [
  'GitHub    github.com/cylim',
  'X         x.com/seewhy',
  'LinkedIn  linkedin.com/in/cylim226',
  'Résumé    cy.my/resources/resume-en.pdf',
  '',
  'Have something to build? Message me on LinkedIn or X.',
]
