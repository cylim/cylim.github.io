/**
 * Environment mounts its layers one task at a time (QM-P3); the stage holds its first frame until
 * they are all in, then compiles them. This is the handshake: Environment opens the gate as it
 * mounts and closes it when the last layer has committed (or it unmounts first).
 */

let pending: Promise<void> = Promise.resolve()
let release: (() => void) | null = null

export function environmentMounting(): void {
  release?.()
  pending = new Promise((resolve) => {
    release = resolve
  })
}

export function environmentMounted(): void {
  release?.()
  release = null
}

/** Resolves once every Environment layer has mounted; at once when no Environment is mounting. */
export const whenEnvironmentMounted = (): Promise<void> => pending
