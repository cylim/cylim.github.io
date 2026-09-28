import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** `import src from './x.glsl'` yields the source string, same as `./x.glsl?raw`. */
function glslAsString(): Plugin {
  return {
    name: 'cy:glsl-as-string',
    transform(code, id) {
      if (!id.endsWith('.glsl')) return null
      return { code: `export default ${JSON.stringify(code)};`, map: null }
    },
  }
}

/**
 * @react-three/postprocessing's index does a top-level `import { N8AOPostPass } from 'n8ao'` for its
 * N8AO effect, which this site never uses. n8ao declares no `sideEffects`, so Rolldown kept all of it
 * in the stage chunk (about 3.7 kB gz, QM-P10). Its module body only defines classes and shaders, so
 * it is marked side-effect free and drops out with the unused export.
 */
function sideEffectFree(test: RegExp): Plugin {
  return {
    name: 'cy:side-effect-free',
    transform(_code, id) {
      return test.test(id) ? { moduleSideEffects: false } : null
    },
  }
}

/**
 * Every script in index.html carries `data-cfasync="false"`, which keeps Cloudflare's Rocket Loader
 * (on for the cy.my zone) from deferring it (QM-D3; index.html explains). Vite replaces the entry
 * `<script type="module" src="/src/main.tsx">` with its own tag and drops custom attributes, so the
 * built page gets the attribute back on every executable script that lacks it.
 */
export function withCfasyncOff(html: string): string {
  return html.replace(/<script\b(?![^>]*\bdata-cfasync=)(?![^>]*\btype="application\/ld\+json")/g, '<script data-cfasync="false"')
}

function cfasyncOff(): Plugin {
  return {
    name: 'cy:cfasync-off',
    transformIndexHtml: { order: 'post', handler: withCfasyncOff },
  }
}

/** The SSR build (dist-ssr/, read only by scripts/prerender.mjs) needs no copy of public/. */
function noPublicInSsr(): Plugin {
  return {
    name: 'cy:no-public-in-ssr',
    config: (_config, env) => (env.isSsrBuild ? { build: { copyPublicDir: false } } : null),
  }
}

export default defineConfig({
  // User site served at https://cy.my/, not a /repo/ project path.
  base: '/',
  plugins: [react(), glslAsString(), noPublicInSsr(), cfasyncOff(), sideEffectFree(/[\\/]node_modules[\\/]n8ao[\\/]/)],
  build: {
    sourcemap: 'hidden',
    assetsInlineLimit: 2048,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Groups also capture their modules' dependencies (Rolldown's includeDependenciesRecursively
          // defaults to true), so the r3f group would swallow react, scheduler and zustand, and the boot
          // entry would then import (and modulepreload) the r3f and three chunks. The boot vendors are
          // claimed first by a higher-priority group to keep 3D off the critical path.
          // check-budget asserts dist/index.html has no modulepreload for three-*.js or r3f-*.js.
          groups: [
            {
              name: 'boot-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/,
              priority: 30,
            },
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'r3f', test: /[\\/]node_modules[\\/]@react-three[\\/]fiber[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
