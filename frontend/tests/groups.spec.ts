import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// M2 journeys against the REAL backend + PostgreSQL (start it with `npm run dev` in backend/).
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';

async function signInAs(page: Page, travellerId: string) {
  await page.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
}

test('Sarah creates her Kyoto group, sees it live, it persists and shows in My groups', async ({ page, request }) => {
  await signInAs(page, 'T-001');
  await page.goto('/groups/new');
  await expect(page.getByRole('heading', { name: 'Create a group trip' })).toBeVisible();

  const name = `Kyoto temples & street food ${Date.now()}`;
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('radio', { name: /Kyoto/ }).click();
  await page.getByLabel('Check-in').fill('2027-04-10');
  await page.getByLabel('Check-out').fill('2027-04-15');
  await expect(page.getByText('5 nights', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /^3/ }).click();
  await page.getByLabel(/Approx budget per person/).fill('60000');
  await page.getByLabel(/Proposed itinerary/).fill('Day 1: Fushimi Inari\nDay 2: Nishiki market');
  await page.getByRole('button', { name: 'Post group' }).click();

  await expect(page).toHaveURL(/\/groups\/G-\d{4,}$/);
  const groupId = page.url().split('/').pop()!;
  await expect(page.getByText('Your group is live!')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('Who’s going · 1/3')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Trip progress' }).getByRole('listitem')).toHaveCount(5);

  const saved = await request.get(`${API}/api/groups/${groupId}`);
  expect(saved.status()).toBe(200);
  expect(await saved.json()).toMatchObject({ member_ids: ['T-001'], city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000 });

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('Your group is live!')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Booking categories' }).getByRole('link', { name: 'My groups' }).click();
  await expect(page).toHaveURL(/\/my-groups$/);
  const card = page.getByRole('article').filter({ hasText: name });
  await expect(card).toBeVisible();
  await expect(card.getByText('Owner')).toBeVisible();
  await card.getByRole('link', { name: 'View group' }).click();
  await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
});

test('form blocks invalid input on the client and shows backend field errors', async ({ page }) => {
  await signInAs(page, 'T-001');
  await page.goto('/groups/new');
  await page.getByRole('button', { name: 'Post group' }).click();
  await expect(page.getByText('Give your group a name')).toBeVisible();
  await expect(page.getByText('Choose a destination')).toBeVisible();

  await page.getByLabel('Group name').fill('Bad dates');
  await page.getByRole('radio', { name: /Osaka/ }).click();
  await page.getByLabel('Check-in').fill('2027-04-15');
  await page.getByLabel('Check-out').fill('2027-04-12');
  await page.getByLabel(/Approx budget per person/).fill('50000');
  await page.getByRole('button', { name: 'Post group' }).click();
  await expect(page.getByText('Check-out must be after check-in')).toBeVisible();

  // Server-side rule surfaces next to the field (simulated backend response).
  await page.route('**/api/groups', (route) => route.fulfill({ status: 400, json: { error: { message: 'Please check the highlighted fields', fields: { city: 'We don\'t have trips to "Osaka". Choose one of the destinations in the list.' } } } }));
  await page.getByLabel('Check-out').fill('2027-04-18');
  await page.getByRole('button', { name: 'Post group' }).click();
  await expect(page.getByText(/We don't have trips to "Osaka"/)).toBeVisible();
  await expect(page.getByLabel('Group name')).toHaveValue('Bad dates');
});

test('details page works for seeded G-01 and shows not-found for unknown groups', async ({ page }) => {
  await signInAs(page, 'T-001');
  await page.goto('/groups/G-01');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Proposed itinerary')).toBeVisible();
  await expect(page.getByText(/Organised by Sarah/)).toBeVisible();
  await page.goto('/groups/G-999999');
  await expect(page.getByRole('heading', { name: 'Group not found' })).toBeVisible();
});

test('My groups and Create pages need a signed-in traveller', async ({ page }) => {
  await page.goto('/my-groups');
  await expect(page).toHaveURL(/\/login$/);
});

test('create page fits a phone screen without horizontal scroll', async ({ page }) => {
  await signInAs(page, 'T-001');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/groups/new');
  await expect(page.getByRole('button', { name: 'Post group' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
