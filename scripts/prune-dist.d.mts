// Types for prune-dist.mjs, so its test can import it.

/** True for a dist/-relative path (`/` separated) that must not ship to Pages. */
export declare function isPruned(path: string): boolean

/** Deletes the pruned files under `dist`; `dangling` lists shipped files that still reference one. */
export declare function pruneDist(dist: string): Promise<{ removed: string[]; dangling: string[] }>
