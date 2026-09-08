import { test, expect } from '@playwright/test';

async function emptySupabaseTables(page, tables) {
  for (const table of tables) {
    await page.route(new RegExp(`/rest/v1/${table}(?:\\?|$)`), route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: '[]',
    }));
  }
}

test('Network shows truthful first-use states without fabricated people or activity', async ({ page }) => {
  await emptySupabaseTables(page, ['creator_listings', 'portfolio_items', 'network_posts', 'network_replies', 'state_chat_messages']);
  await page.goto('/network');
  await expect(page.getByText(/No posts found in this lane|Network is unavailable because the data provider is not configured/).first()).toBeVisible();
  await expect(page.getByText(/No messages in #general yet|chat is unavailable because the data provider is not configured/).first()).toBeVisible();
  await expect(page.getByText(/No verified members have been active/)).toBeVisible();
  await expect(page.locator('[data-testid="fabricated-network-user"]')).toHaveCount(0);
});

test('public directory and Project Board stay honest when provider returns no records', async ({ page }) => {
  await emptySupabaseTables(page, ['creator_listings', 'creator_services', 'portfolio_items', 'packages', 'availability', 'projects']);
  await page.goto('/find');
  await expect(page.getByText('No creators found')).toBeVisible();

  await page.goto('/projects');
  await expect(page.getByText('No briefs match your filters')).toBeVisible();
});

test('landing creator benefits have one SEO description and working signup links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /free/i);
  const benefits = page.locator('section[aria-labelledby="for-creators-heading"]');
  await benefits.scrollIntoViewIfNeeded();
  await expect(benefits.getByRole('heading', { name: 'Keep more of what you earn, and actually get paid.' })).toBeAttached();
  const join = benefits.locator('a[href="/join-as-creator"]');
  await join.scrollIntoViewIfNeeded();
  await join.click();
  await expect(page).toHaveURL(/\/join-as-creator$/);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await page.goto('/login');
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
});
