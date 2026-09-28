/// <reference types="vite/client" />

// Shared GLSL is imported as source text and concatenated (stack.md §5).
// `?raw` is Vite's own loader; bare `.glsl` goes through the glsl-as-string plugin in vite.config.ts.
declare module '*.glsl?raw' {
  const source: string
  export default source
}

declare module '*.glsl' {
  const source: string
  export default source
}
