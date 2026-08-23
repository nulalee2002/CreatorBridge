import { test, expect } from '@playwright/test';

test('an unauthenticated visitor cannot render administrator tools', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administrator sign-in required' })).toBeVisible();
  await expect(page.getByText('Admin Control Hub')).toHaveCount(0);
  await expect(page.getByText('Admin operations active')).toHaveCount(0);
});
