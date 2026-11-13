import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// TASK-X2 against the REAL backend: My groups shows the live trip status.
// Posts its own fresh Kyoto group (Sarah) with Priya approved, so seeded groups stay untouched.
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

test('My groups updates lobby → hotel shortlisted → booked without a reload', async ({ browser, request }) => {
  const name = `Kyoto live status ${Date.now()}`;
  const created = await request.post(`${API}/api/groups`, {
    headers: { 'X-Traveller-Id': 'T-001' },
    data: { name, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: 'Temples' },
  });
  const groupId = (await created.json()).group_id as string;
  const asked = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: { 'X-Traveller-Id': 'T-002' } });
  await request.post(`${API}/api/join-requests/${(await asked.json()).request_id}/approve`, { headers: { 'X-Traveller-Id': 'T-001' } });

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto('/my-groups');
  const card = sarah.getByRole('article').filter({ hasText: name });
  await expect(card.locator('.gp-pill')).toHaveText('Lobby open');
  await expect(sarah.getByText(/Live · updated/)).toBeVisible();

  // Priya saves a hotel elsewhere; Sarah's tab picks it up when it regains focus.
  await request.post(`${API}/api/groups/${groupId}/saved-options`, { headers: { 'X-Traveller-Id': 'T-002' }, data: { room_id: 'RM-KYO-001-A' } });
  await sarah.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card.locator('.gp-pill')).toHaveText('Hotel shortlisted');
  await expect(card.getByText(/1 stay on the shortlist/)).toBeVisible();

  // Priya finalises; the manual refresh shows the locked booking and Sarah's share.
  const booked = await request.post(`${API}/api/groups/${groupId}/booking`, { headers: { 'X-Traveller-Id': 'T-002' }, data: { room_id: 'RM-KYO-001-A' } });
  const bookingId = (await booked.json()).booking_id as string;
  await sarah.getByRole('button', { name: 'Refresh trip status' }).click();
  await expect(card.locator('.gp-pill')).toHaveText('Booked');
  await expect(card.getByText(new RegExp(`Gion Corner Hotel · Twin Room · 1 room · ${bookingId}`))).toBeVisible();
  await expect(card.getByText('₹11,900')).toBeVisible();

  // Status filter offers the new stages and the booked group survives a reload.
  await sarah.locator('#stage-filter').selectOption('BOOKED');
  await expect(card).toBeVisible();
  await sarah.reload();
  await expect(sarah.getByRole('article').filter({ hasText: name }).locator('.gp-pill')).toHaveText('Booked');

  // The public group page shows the same status.
  await sarah.goto(`/groups/${groupId}`);
  await expect(sarah.locator('.gp-hero .gp-pill')).toHaveText('Booked');
});
