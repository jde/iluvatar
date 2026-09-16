import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e', timeout: 60_000, retries: 0,
  use: { baseURL: 'http://localhost:5173', launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 30_000 },
});
