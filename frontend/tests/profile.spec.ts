import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// Traveller profile (reviews, ratings, votes = demo data) against the REAL backend for the profile.
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

test('owner opens a seeker’s profile from a join request and sees reviews + rating', async ({ browser, request }) => {
  const name = `Profile link test ${Date.now()}`;
  const created = await request.post(`${API}/api/groups`, {
    headers: { 'X-Traveller-Id': 'T-001' },
    data: { name, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000 },
  });
  const groupId = (await created.json()).group_id as string;
  await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: { 'X-Traveller-Id': 'T-002' } });

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await sarah.getByRole('article', { name: 'Join request from Priya Shah' })
    .getByRole('link', { name: 'View Priya Shah’s profile, reviews and rating' }).click();

  await expect(sarah).toHaveURL(/\/travellers\/T-002$/);
  await expect(sarah.getByRole('heading', { level: 1, name: 'Priya Shah' })).toBeVisible();
  await expect(sarah.getByRole('note')).toContainText('sample data');
  await expect(sarah.getByRole('heading', { name: 'Traveller rating' })).toBeVisible();
  await expect(sarah.getByRole('img', { name: /out of 5 stars/ }).first()).toBeVisible();
  await expect(sarah.getByRole('article', { name: /^Review by / }).first()).toBeVisible();

  await sarah.getByRole('link', { name: `Back to ${name}` }).click();
  await expect(sarah).toHaveURL(new RegExp(`/groups/${groupId}#join-requests$`));
});

test('Reddit-style votes: up, toggle off, switch to down, remembered after reload', async ({ browser }) => {
  const page = await pageAs(browser, 'T-004');
  await page.goto('/travellers/T-002');
  const profileVotes = page.getByRole('group', { name: 'Votes for Priya Shah' });
  const up = profileVotes.getByRole('button', { name: 'Upvote Priya Shah' });
  const down = profileVotes.getByRole('button', { name: 'Downvote Priya Shah' });
  const score = async () => Number((await profileVotes.locator('.pf-vote-score').innerText()).replace(/[^\d-]/g, ''));

  const start = await score();
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'true');
  expect(await score()).toBe(start + 1);

  await up.click(); // toggle off
  await expect(up).toHaveAttribute('aria-pressed', 'false');
  expect(await score()).toBe(start);

  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  expect(await score()).toBe(start - 1);

  await page.reload();
  await expect(page.getByRole('group', { name: 'Votes for Priya Shah' }).getByRole('button', { name: 'Downvote Priya Shah' })).toHaveAttribute('aria-pressed', 'true');

  // Review votes work the same way
  const firstReview = page.getByRole('article', { name: /^Review by / }).first();
  const reviewUp = firstReview.getByRole('button', { name: /^Upvote review by/ });
  await reviewUp.click();
  await expect(reviewUp).toHaveAttribute('aria-pressed', 'true');
});

test('reviews can be sorted and unknown travellers show not-found', async ({ page }) => {
  await page.goto('/travellers/T-002');
  await page.getByLabel('Sort by').selectOption('NEW');
  await expect(page.getByRole('article', { name: /^Review by / }).first()).toBeVisible();
  await page.goto('/travellers/T-99999');
  await expect(page.getByRole('heading', { name: 'Traveller not found' })).toBeVisible();
});

test('profile fits a phone screen without horizontal scroll', async ({ browser }) => {
  const page = await pageAs(browser, 'T-001');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/travellers/T-002');
  await expect(page.getByRole('heading', { level: 1, name: 'Priya Shah' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
