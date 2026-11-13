import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// TASK-X3 "Ask the reviews" against the REAL backend + PostgreSQL (no model runs at request time).
const KEY = 'group_match_active_traveller';

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

test('ask a hotel\'s reviews: suggested question, free text, no match, jump to the review', async ({ browser }) => {
  const page = await pageAs(browser, 'T-019');
  await page.goto('/groups/G-11/hotels/HTL-AUH-002#reviews');
  const ask = page.getByRole('region', { name: 'Ask the reviews' });
  await expect(ask).toBeVisible({ timeout: 15_000 }); // the hotel page first loads the group's hotel search

  // Suggested question → ranked passages, the best one highlighted.
  await ask.getByRole('button', { name: 'Is it quiet at night?' }).click();
  const results = ask.locator('.ar-item');
  await expect(results.first()).toContainText(/quiet/i);
  await expect(ask.locator('.ar-mode')).toHaveText('Keywords + meaning');
  await expect(results.first().locator('mark').first()).toBeVisible();
  await expect(ask.locator('.ar-rank').first()).toHaveText('1');

  // Free text while typing (debounced), then the search context on demand.
  await ask.getByRole('searchbox').fill('front desk check-in');
  await expect(ask.getByText(/for “front desk check-in”/)).toBeVisible();
  await results.first().getByRole('button', { name: 'Show search context' }).click();
  await expect(results.first().locator('.ar-context')).toBeVisible();

  // "Read full review" scrolls to the thread.
  await results.first().getByRole('button', { name: 'Read full review' }).click();
  await expect(page.locator('.rd-post.ar-flash')).toBeInViewport();

  // Nothing matches → a recoverable empty state with suggestions; Escape clears.
  await ask.getByRole('searchbox').fill('zzzz qqqq');
  await expect(ask.getByText('No review mentions “zzzz qqqq”.')).toBeVisible();
  await ask.getByRole('searchbox').press('Escape');
  await expect(ask.getByRole('searchbox')).toHaveValue('');
});

test('ask a traveller\'s reviews on their profile', async ({ browser }) => {
  const page = await pageAs(browser, 'T-001');
  await page.goto('/travellers/T-002');
  const ask = page.getByRole('region', { name: 'Ask the reviews' });
  await ask.getByRole('searchbox').fill('trip');
  await expect(ask.locator('.ar-item').first()).toBeVisible();
  await expect(ask.locator('.ar-item').first().locator('.ar-meta')).toContainText('Trip to');
  await ask.getByRole('button', { name: 'Ask' }).click();
  // The question on screen is not repeated under "recent"; asking another one moves it there.
  await ask.getByRole('button', { name: 'Are they punctual?' }).click();
  await expect(ask.getByRole('group', { name: 'Recent questions' })).toContainText('trip');
});
