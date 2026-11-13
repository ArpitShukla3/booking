import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Live Group Match (M3 + M4) against the REAL backend + PostgreSQL.
// Start the backend first: `cd backend && npm run dev`.
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';

async function signInAs(page: Page, travellerId: string) {
  await page.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
}

async function fillPriyaSearch(page: Page) {
  await page.getByLabel('Destination').selectOption('Kyoto');
  await page.getByLabel('Check-in').fill('2027-04-09');
  await page.getByLabel('Check-out').fill('2027-04-16');
  await page.getByLabel('Home city').selectOption('Mumbai');
  await page.getByLabel('Budget per person (INR)').fill('62000');
  for (const label of ['Temples', 'Street food', 'Adventure']) {
    const box = page.getByRole('checkbox', { name: new RegExp(label, 'i') }).first();
    if (!(await box.isChecked())) await box.check();
  }
  await page.getByLabel('Gender preference').selectOption('SAME_GENDER');
}

test('Group Match needs a signed-in traveller', async ({ page }) => {
  await page.goto('/group-match');
  await expect(page).toHaveURL(/\/login$/);
});

test('Priya searches Kyoto, the search is saved, G-01 is shown with clear reasons', async ({ page, request }) => {
  await signInAs(page, 'T-002');
  await page.goto('/group-match');
  await expect(page.getByText('Tell us about your trip')).toBeVisible();
  await expect(page.getByText(/Matching as female/)).toBeVisible();

  await fillPriyaSearch(page);
  await expect(page.getByText('7 nights')).toBeVisible();
  await page.getByRole('button', { name: 'Search Groups' }).click();

  await expect(page).toHaveURL(/search=S-\d+/);
  const searchId = new URL(page.url()).searchParams.get('search')!;
  const card = page.getByRole('article').filter({ hasText: 'Kyoto Spring Temples' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Sarah Thomas');
  await expect(card).toContainText('1/3 travellers');
  await expect(card).toContainText('5 shared nights');
  await expect(card).toContainText('₹2,000');
  await expect(card).toContainText(/2 shared interests/);
  await expect(card).toContainText(/2 spots left/);

  // saved in PostgreSQL and readable through the API
  const saved = await request.get(`${API}/api/searches/${searchId}`, { headers: { 'X-Traveller-Id': 'T-002' } });
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toMatchObject({ city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, gender: 'FEMALE' });

  // survives a refresh, shows in recent searches, and the form is pre-filled
  await page.reload();
  await expect(card).toBeVisible();
  await expect(page.getByLabel('Destination')).toHaveValue('Kyoto');
  await expect(page.getByRole('region', { name: 'Recent searches' })).toContainText('Kyoto');

  // the card opens the Group Details page
  await card.getByRole('link', { name: 'View Details' }).click();
  await expect(page).toHaveURL(/\/groups\/G-01$/);
});

test('invalid searches get clear messages and are not saved', async ({ page }) => {
  await signInAs(page, 'T-002');
  await page.goto('/group-match');
  await fillPriyaSearch(page);
  await page.getByLabel('Check-out').fill('2027-04-09');
  await page.getByRole('button', { name: 'Search Groups' }).click();
  await expect(page.getByText('Check-out must be after check-in')).toBeVisible();
  await expect(page).not.toHaveURL(/search=/);

  // a backend rejection is shown next to its field (simulated response)
  await page.getByLabel('Check-out').fill('2027-04-16');
  await page.route('**/api/searches', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 400, json: { error: { message: 'Please check the highlighted fields', fields: { city: 'City not available: "Kyoto".' } } } })
    : route.continue());
  await page.getByRole('button', { name: 'Search Groups' }).click();
  await expect(page.getByText('City not available: "Kyoto".')).toBeVisible();
});

test('no matches shows helpful suggestions', async ({ page }) => {
  await signInAs(page, 'T-002');
  await page.goto('/group-match');
  await fillPriyaSearch(page);
  await page.getByLabel('Destination').selectOption('Abu Dhabi');
  await page.getByLabel('Budget per person (INR)').fill('5000000');
  await page.getByRole('button', { name: 'Search Groups' }).click();
  await expect(page.getByText(/match all six conditions yet/)).toBeVisible();
  await expect(page.getByText(/Widen your dates/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Start your own group/ })).toBeVisible();
});

test('sorting by shared nights keeps the search and reorders', async ({ page }) => {
  await signInAs(page, 'T-002');
  await page.goto('/group-match');
  await fillPriyaSearch(page);
  await page.getByRole('button', { name: 'Search Groups' }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  await page.getByLabel('Sort by').selectOption('overlap');
  await expect(page).toHaveURL(/sort=overlap/);
  await expect(page).toHaveURL(/search=S-\d+/);
  await expect(page.getByRole('article').first()).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await signInAs(page, 'T-002');
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/group-match');
    await expect(page.getByRole('button', { name: 'Search Groups' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}
