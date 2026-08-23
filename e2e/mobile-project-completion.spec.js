import { test, expect } from '@playwright/test';
import { authFile, cleanupQaProjects, seedCompletionProjects } from './helpers/qa.js';

test('creator can open formal delivery controls in the mobile master-detail flow', async ({ browser }) => {
  const fixture = await seedCompletionProjects();
  const project = fixture.projects[0];
  const context = await browser.newContext({
    storageState: authFile('creator'),
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto('/projects');
    await page.getByText(project.title, { exact: true }).first().click();
    await expect(page.getByRole('button', { name: /Back to briefs/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Submit finished deliverables' })).toBeVisible();
    await expect(page.getByText('External links do not count')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit final delivery' })).toBeVisible();
    const box = await page.getByRole('button', { name: 'Submit final delivery' }).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
    await cleanupQaProjects(fixture.admin, fixture.projectIds);
  }
});
