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
