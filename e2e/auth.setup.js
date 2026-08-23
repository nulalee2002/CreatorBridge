import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { AUTH_DIR, authFile, requireQaEnvironment, signInQa } from './helpers/qa.js';

setup('authenticate dedicated client, creator, and admin QA accounts', async ({ page }) => {
  const env = requireQaEnvironment();
  await mkdir(AUTH_DIR, { recursive: true, mode: 0o700 });
  const projectRef = new URL(env.url).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  for (const role of ['client', 'creator', 'admin']) {
    const { session } = await signInQa(role);
    await page.goto('/');
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, value);
    }, { key: storageKey, value: JSON.stringify(session) });
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
    await page.context().storageState({ path: authFile(role) });
  }
});
