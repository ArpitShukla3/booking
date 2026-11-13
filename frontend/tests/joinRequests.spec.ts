import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// M5 journeys against the REAL backend + PostgreSQL (start it with `npm run dev` in backend/).
// Each test posts its own fresh group so the seeded G-01 is never changed.
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

async function freshGroup(request: import('@playwright/test').APIRequestContext, name: string) {
  const res = await request.post(`${API}/api/groups`, {
    headers: { 'X-Traveller-Id': 'T-001' },
    data: { name, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: 'Temples and street food' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).group_id as string;
}

test('Scenario B: Priya is interested → Sarah is notified → approves → group shows 2/3', async ({ browser, request }) => {
  const name = `Kyoto join test ${Date.now()}`;
  const groupId = await freshGroup(request, name);

  // Seeker
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}`);
  await expect(priya.getByRole('heading', { level: 1, name })).toBeVisible();
  await priya.getByRole('button', { name: 'Interested' }).click();
  await expect(priya.getByText('Request sent!')).toBeVisible();
  await expect(priya.getByRole('button', { name: 'Request pending' })).toBeDisabled();
  await priya.reload();
  await expect(priya.getByRole('button', { name: 'Request pending' })).toBeDisabled();

  // Owner: header bell + notification on My groups + badge on the card
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto('/my-groups');
  await expect(sarah.getByRole('link', { name: /new join request/ })).toBeVisible();
  const notice = sarah.getByRole('region', { name: /want.? to join your trips/ });
  await expect(notice.getByRole('listitem').filter({ hasText: name }).getByText('Priya Shah')).toBeVisible();
  const card = sarah.getByRole('article').filter({ hasText: name });
  await expect(card.getByRole('link', { name: `1 pending join requests for ${name}` })).toBeVisible();
  await notice.getByRole('link', { name: `Review Priya Shah’s request for ${name}` }).click();

  await expect(sarah).toHaveURL(new RegExp(`/groups/${groupId}#join-requests$`));
  const requestCard = sarah.getByRole('article', { name: 'Join request from Priya Shah' });
  await expect(requestCard.getByText(/shared interest/)).toBeVisible();
  await expect(requestCard.getByText('Mumbai')).toBeVisible();
  await requestCard.getByRole('button', { name: 'Approve' }).click();
  await expect(sarah.getByText('Priya Shah joined your group.')).toBeVisible();
  await expect(sarah.getByText('Who’s going · 2/3')).toBeVisible();

  // Saved: API, owner refresh, seeker view
  const saved = await (await request.get(`${API}/api/groups/${groupId}`)).json();
  expect(saved.member_ids).toEqual(['T-001', 'T-002']);
  await sarah.reload();
  await expect(sarah.getByText('Who’s going · 2/3')).toBeVisible();
  await expect(sarah.getByText('No pending requests. You’re all caught up.')).toBeVisible();

  await priya.goto('/my-requests');
  const mine = priya.getByRole('article').filter({ hasText: name });
  await expect(mine.getByText('Approved', { exact: true })).toBeVisible();
  await priya.goto(`/groups/${groupId}`);
  await expect(priya.getByText('You’re a member', { exact: true })).toBeVisible();
});

test('declined request is saved; the seeker sees "Request declined" and cannot ask again', async ({ browser, request }) => {
  const name = `Kyoto decline test ${Date.now()}`;
  const groupId = await freshGroup(request, name);
  const sent = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: { 'X-Traveller-Id': 'T-003' } });
  expect(sent.status()).toBe(201);

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  const requestCard = sarah.getByRole('article', { name: /Join request from/ });
  await requestCard.getByRole('button', { name: 'Decline' }).click();
  await sarah.getByRole('dialog').getByRole('button', { name: 'Decline request' }).click();
  await expect(sarah.getByText(/You declined .*’s request\./)).toBeVisible();
  await expect(sarah.getByText('Past decisions (1)')).toBeVisible();

  const seeker = await pageAs(browser, 'T-003');
  await seeker.goto(`/groups/${groupId}`);
  await expect(seeker.getByRole('button', { name: 'Request declined' })).toBeDisabled();
  await seeker.goto('/my-requests');
  await expect(seeker.getByRole('article').filter({ hasText: name }).getByText('Declined', { exact: true })).toBeVisible();
});

test('owner does not see an Interested button; a non-owner gets no request list', async ({ browser, request }) => {
  const groupId = await freshGroup(request, `Kyoto owner test ${Date.now()}`);
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await expect(sarah.getByRole('heading', { name: 'Join requests' })).toBeVisible();
  await expect(sarah.getByRole('button', { name: 'Interested' })).toHaveCount(0);

  const other = await pageAs(browser, 'T-004');
  await other.goto(`/groups/${groupId}`);
  await expect(other.getByRole('button', { name: 'Interested' })).toBeEnabled();
  await expect(other.getByRole('heading', { name: 'Join requests' })).toHaveCount(0);
});

test('My requests needs sign-in and fits a phone screen', async ({ browser, page }) => {
  await page.goto('/my-requests');
  await expect(page).toHaveURL(/\/login$/);
  const phone = await pageAs(browser, 'T-002');
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto('/my-requests');
  await expect(phone.getByRole('heading', { level: 1, name: 'My requests' })).toBeVisible();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('owner removes a member: spot reopens and the member sees "Removed from group"', async ({ browser, request }) => {
  const name = `Kyoto remove test ${Date.now()}`;
  const groupId = await freshGroup(request, name);
  const sent = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: { 'X-Traveller-Id': 'T-002' } });
  await request.post(`${API}/api/join-requests/${(await sent.json()).request_id}/approve`, { headers: { 'X-Traveller-Id': 'T-001' } });

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await expect(sarah.getByText('Who’s going · 2/3')).toBeVisible();
  await expect(sarah.getByRole('button', { name: 'Remove Sarah Thomas from the group' })).toHaveCount(0); // owner can't remove self
  await sarah.getByRole('button', { name: 'Remove Priya Shah from the group' }).click();
  await sarah.getByRole('dialog').getByRole('button', { name: 'Remove member' }).click();
  await expect(sarah.getByText('Priya Shah was removed from the group.')).toBeVisible();
  await expect(sarah.getByText('Who’s going · 1/3')).toBeVisible();

  const saved = await (await request.get(`${API}/api/groups/${groupId}`)).json();
  expect(saved.member_ids).toEqual(['T-001']);

  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}`);
  await expect(priya.getByRole('button', { name: 'Removed from group' })).toBeDisabled();
  await priya.goto('/my-requests');
  await expect(priya.getByRole('article').filter({ hasText: name }).getByText('Removed', { exact: true })).toBeVisible();
});

test('members (not owners) see no Remove buttons', async ({ browser, request }) => {
  const groupId = await freshGroup(request, `Kyoto member view ${Date.now()}`);
  const sent = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: { 'X-Traveller-Id': 'T-002' } });
  await request.post(`${API}/api/join-requests/${(await sent.json()).request_id}/approve`, { headers: { 'X-Traveller-Id': 'T-001' } });
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}`);
  await expect(priya.getByText('Who’s going · 2/3')).toBeVisible();
  await expect(priya.getByRole('button', { name: /^Remove / })).toHaveCount(0);
});
