import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.SMOKE_PORT || 4173)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The suite runs against the production build, not the dev server: a broken
    // production bundle is exactly what a smoke test should catch.
    command: `npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
