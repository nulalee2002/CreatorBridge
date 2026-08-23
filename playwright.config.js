import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'output/playwright/test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'output/playwright/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'public-desktop',
      testMatch: /(?:admin-access|public-empty-states)\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public-mobile',
      testMatch: /public-empty-states\.spec\.js/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    {
      name: 'authenticated-desktop',
      testMatch: /(?<!mobile-)project-completion\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authenticated-mobile',
      testMatch: /mobile-project-completion\.spec\.js/,
      dependencies: ['auth-setup'],
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
});
