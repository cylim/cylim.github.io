import { defineConfig, devices } from '@playwright/test'

// stack.md §12. Runs against `vite preview` of a built dist/, so `npm run build` first.
// CHROMIUM_PATH=/usr/bin/chromium locally; CI uses Playwright's bundled Chromium, and screenshot
// baselines come from CI only (local Arch Chromium differs): run `--grep-invert @visual` locally.
const executablePath = process.env.CHROMIUM_PATH || undefined
const gl = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const ci = !!process.env.CI

export default defineConfig({
  testDir: 'tests/e2e',
  // SwiftShader compiles the ink shaders on the CPU, so the first stage mount is slow.
  timeout: 60_000,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !ci,
  },
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath, args: gl } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath, args: gl } } },
    {
      name: 'reduced-motion',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce', launchOptions: { executablePath, args: gl } },
    },
    {
      // No WebGL2 at all: exercises the static (album) fallback.
      name: 'no-webgl',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath, args: ['--disable-gpu', '--disable-software-rasterizer'] },
      },
    },
  ],
})
