import { defineConfig, devices } from '@playwright/test';

// MSW-mocked frontend integration tests — no backend process is started; any request that
// escapes the mock worker falls through to Vite's /api proxy (:3000, not running), which
// responds with its own error rather than silently succeeding against a real server. The
// leak-guard fixture (tests-integration/helpers/leak-guard.ts) detects this. See
// tests-integration/README.md.
export default defineConfig({
  testDir: './tests-integration',
  outputDir: './tests-integration/test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? 'github'
    : [['html', { outputFolder: 'tests-integration/playwright-report' }]],

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm --filter @mercado/web dev --port 5174 --mode test-integration',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    cwd: '../../',
    env: { VITE_API_MOCKING: 'enabled' },
  },
});
