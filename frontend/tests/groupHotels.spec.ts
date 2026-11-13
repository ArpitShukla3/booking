import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

// M6 journeys against the REAL backend + PostgreSQL (start it with `npm run dev` in backend/).
// Each test posts a fresh Kyoto group (Sarah) and approves Priya, so the seeded G-01 is untouched.
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

/** Sarah's Kyoto 10–15 Apr group with Priya approved: the G-01 worked example. */
async function sarahAndPriyaGroup(request: APIRequestContext, name: string) {
  const created = await request.post(`${API}/api/groups`, {
    headers: { 'X-Traveller-Id': 'T-001' },
    data: { name, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: 'Temples' },
  });
  expect(created.status()).toBe(201);
  const groupId = (await created.json()).group_id as string;
  const asked = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: { 'X-Traveller-Id': 'T-002' } });
  const approved = await request.post(`${API}/api/join-requests/${(await asked.json()).request_id}/approve`, { headers: { 'X-Traveller-Id': 'T-001' } });
  expect(approved.status()).toBe(200);
  return groupId;
}

test('members search, filter by price, see inside, shortlist and finalise one locked booking', async ({ browser, request }) => {
  const groupId = await sarahAndPriyaGroup(request, `Kyoto hotels test ${Date.now()}`);
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}`);

  const hotels = priya.getByRole('region', { name: /Stays in Kyoto for your group/ });
  await expect(hotels).toBeVisible();
  await expect(hotels.getByText(/properties found/)).toBeVisible();

  // Search bar narrows the list instantly.
  await hotels.getByRole('searchbox').fill('Gion Corner');
  const gion = hotels.getByRole('article', { name: 'Gion Corner Hotel' });
  await expect(gion).toBeVisible();
  await expect(gion.getByText('₹23,800')).toBeVisible();
  await expect(gion.getByText('₹11,900 per member')).toBeVisible();

  // Amazon-style price bracket: nothing in Kyoto costs over ₹40k/night for this stay.
  await hotels.getByRole('searchbox').fill('');
  await hotels.getByRole('button', { name: 'Under ₹5,000' }).click();
  await expect(hotels.getByRole('button', { name: 'Under ₹5,000' })).toHaveAttribute('aria-pressed', 'true');
  await expect(gion).toBeVisible();
  await hotels.getByRole('button', { name: 'Clear price' }).click();

  // Save to the shortlist via the heart.
  await gion.getByRole('button', { name: 'Save Gion Corner Hotel to the group shortlist' }).click();
  const shortlist = hotels.getByRole('region', { name: /Group shortlist/ });
  await expect(shortlist.getByText('1/2 prefer this')).toBeVisible();

  // See inside → details, map, rooms and reviews.
  await gion.getByRole('link', { name: 'See inside Gion Corner Hotel' }).click();
  await expect(priya).toHaveURL(new RegExp(`/groups/${groupId}/hotels/HTL-KYO-001$`));
  await expect(priya.getByRole('heading', { level: 1, name: 'Gion Corner Hotel' })).toBeVisible();
  await expect(priya.locator('iframe[title^="Map showing Gion Corner Hotel"]')).toBeAttached();
  const twin = priya.getByRole('row', { name: /Twin Room/ });
  await expect(twin.getByText('₹11,900')).toBeVisible();

  // Reddit-style vote persists in this browser.
  const reviews = priya.getByRole('region', { name: 'Guest reviews' });
  const firstUp = reviews.getByRole('button', { name: /^Upvote review/ }).first();
  await firstUp.click();
  await expect(firstUp).toHaveAttribute('aria-pressed', 'true');
  await priya.reload();
  await expect(priya.getByRole('region', { name: 'Guest reviews' }).getByRole('button', { name: /^Upvote review/ }).first()).toHaveAttribute('aria-pressed', 'true');

  // Finalise with the confirmation popup.
  await priya.getByRole('button', { name: 'Finalise Twin Room at Gion Corner Hotel' }).click();
  const dialog = priya.getByRole('dialog', { name: 'Finalise this hotel for the group?' });
  await expect(dialog.getByText('Total ₹23,800')).toBeVisible();
  await expect(dialog.getByText('₹11,900')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(priya.getByText(/Hotel finalised · Booking BK-\d+/)).toBeVisible();

  // Locked for everyone, also after a refresh, and for the owner.
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await expect(sarah.getByText(/Hotel finalised · Booking BK-\d+/)).toBeVisible();
  await expect(sarah.getByRole('button', { name: 'Finalise' })).toHaveCount(0);
  await expect(sarah.getByRole('link', { name: 'View the booked hotel' })).toBeVisible();
});

test('non-members see a members-only message instead of hotels', async ({ browser, request }) => {
  const groupId = await sarahAndPriyaGroup(request, `Kyoto members only ${Date.now()}`);
  const outsider = await pageAs(browser, 'T-009');
  await outsider.goto(`/groups/${groupId}`);
  await expect(outsider.getByRole('heading', { name: 'Hotels are for members only' })).toBeVisible();
  await outsider.goto(`/groups/${groupId}/hotels/HTL-KYO-001`);
  await expect(outsider.getByRole('heading', { name: 'Members only' })).toBeVisible();
});
