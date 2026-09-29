// Types for collect-cjk.mjs, so TypeScript tests and tools can import it.

export declare const ROOT: string
export declare const SCAN: readonly string[]
export declare const CHART_GLYPHS: string
export declare const CJK_PUNCT: string
export declare const CJK_ASCII: string
export declare const DISPLAY_GLYPHS: string

export interface ScanOptions {
  /** Directory the scan paths are relative to. Defaults to the repo root. */
  root?: string
  paths?: readonly string[]
}

export declare function isCjk(codePoint: number): boolean
export declare function stripComments(source: string): string
export declare function scanSources(options?: ScanOptions): Promise<{ file: string; text: string }[]>
export declare function collectCjk(options?: ScanOptions): Promise<string>
export declare function collectNonCjkExtras(options?: ScanOptions): Promise<string>
export declare function cjkOrigins(options?: ScanOptions): Promise<Map<string, string>>
