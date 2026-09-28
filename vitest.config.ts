import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mts}'],
            exclude: ['src/dom/**', 'node_modules/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/dom/**/*.test.{ts,tsx}'],
          },
        },
      ],
    },
  }),
)
