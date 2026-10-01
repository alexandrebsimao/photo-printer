import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  reporter: 'list',
  grepInvert: /\[electron\]/,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'npm run preview:renderer', url: 'http://127.0.0.1:4173', reuseExistingServer: true }
})
