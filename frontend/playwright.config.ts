import { defineConfig } from '@playwright/test'

const origin = 'http://127.0.0.1:4317'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    launchOptions: process.env.ZIP_PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.ZIP_PLAYWRIGHT_CHROMIUM } : undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4317 --strictPort',
    url: origin,
    env: { VITE_USE_MOCK: 'false', VITE_API_BASE_URL: '/api' },
  },
})
