import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

// M5 follow-ups against the REAL backend + PostgreSQL: request note, cancel, leave,
// auto-close when full, and the cost-split warning after booking. Each test uses its own group.
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';
const as = (id: string) => ({ 'X-Traveller-Id': id });

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

async function freshGroup(request: APIRequestContext, maxSize = 3) {
  const res = await request.post(`${API}/api/groups`, {
    headers: as('T-001'),
    data: { name: `Lifecycle ${Date.now()}`, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: maxSize, budget_inr: 60000 },
  });
  return (await res.json()) as { group_id: string; name: string };
}

async function join(request: APIRequestContext, groupId: string, seeker: string) {
  const sent = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: as(seeker) });
  const id = (await sent.json()).request_id as string;
  await request.post(`${API}/api/join-requests/${id}/approve`, { headers: as('T-001') });
}

async function book(request: APIRequestContext, groupId: string) {
  const search = await (await request.get(`${API}/api/groups/${groupId}/hotels`, { headers: as('T-001') })).json();
  const option = search.hotels.flatMap((h: { options: { room_id: string; available: boolean }[] }) => h.options).find((o: { available: boolean }) => o.available);
  expect((await request.post(`${API}/api/groups/${groupId}/booking`, { headers: as('T-001'), data: { room_id: option.room_id } })).status()).toBe(201);
}

test('seeker sends a note, owner sees it; seeker cancels and asks again', async ({ browser, request }) => {
  const group = await freshGroup(request);
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${group.group_id}`);
  await priya.getByRole('button', { name: 'Interested' }).click();
  await priya.getByRole('dialog').getByLabel(/Note to the organiser/).fill('I know great ramen spots!');
  await priya.getByRole('dialog').getByRole('button', { name: 'Send request' }).click();
  await expect(priya.getByRole('button', { name: 'Request pending' })).toBeDisabled();

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${group.group_id}`);
  await expect(sarah.getByRole('article', { name: 'Join request from Priya Shah' })).toContainText('I know great ramen spots!');

  await priya.getByRole('button', { name: 'Cancel request' }).click();
  await expect(priya.getByRole('button', { name: 'Ask to join again' })).toBeEnabled();
  await priya.goto('/my-requests');
  await expect(priya.getByRole('article').filter({ hasText: group.name }).getByText('Cancelled', { exact: true })).toBeVisible();

  await priya.goto(`/groups/${group.group_id}`);
  await priya.getByRole('button', { name: 'Ask to join again' }).click();
  await priya.getByRole('dialog').getByRole('button', { name: 'Send request' }).click();
  await expect(priya.getByRole('button', { name: 'Request pending' })).toBeDisabled();
});

test('a member leaves the group and sees "Ask to join again"', async ({ browser, request }) => {
  const group = await freshGroup(request);
  await join(request, group.group_id, 'T-002');
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${group.group_id}`);
  await expect(priya.getByText('Who’s going · 2/3')).toBeVisible();
  await priya.getByRole('button', { name: 'Leave group' }).click();
  await priya.getByRole('dialog').getByRole('button', { name: 'Leave group' }).click();
  await expect(priya.getByText(new RegExp(`You left ${group.name}`))).toBeVisible();
  await expect(priya.getByText('Who’s going · 1/3')).toBeVisible();
  await expect(priya.getByRole('button', { name: 'Ask to join again' })).toBeEnabled();

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${group.group_id}`);
  await expect(sarah.getByRole('button', { name: 'Leave group' })).toHaveCount(0); // the organiser can't leave
});

test('approving the last spot closes the other pending request', async ({ browser, request }) => {
  const group = await freshGroup(request, 2); // owner + 1
  await request.post(`${API}/api/groups/${group.group_id}/join-requests`, { headers: as('T-002') });
  await request.post(`${API}/api/groups/${group.group_id}/join-requests`, { headers: as('T-003') });
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${group.group_id}`);
  await sarah.getByRole('article', { name: 'Join request from Priya Shah' }).getByRole('button', { name: 'Approve' }).click();
  await expect(sarah.getByText(/The group is now full, so 1 other pending request was closed/)).toBeVisible();

  const other = await pageAs(browser, 'T-003');
  await other.goto('/my-requests');
  await expect(other.getByRole('article').filter({ hasText: group.name }).getByText('Group filled', { exact: true })).toBeVisible();
});

test('after booking, removing a member warns about the new cost split and applies it', async ({ browser, request }) => {
  const group = await freshGroup(request);
  await join(request, group.group_id, 'T-002');
  await book(request, group.group_id);
  const before = (await (await request.get(`${API}/api/groups/${group.group_id}/booking`, { headers: as('T-001') })).json()).booking;

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${group.group_id}`);
  await sarah.getByRole('button', { name: 'Remove Priya Shah from the group' }).click();
  const dialog = sarah.getByRole('dialog');
  await expect(dialog.getByRole('note')).toContainText('already booked');
  await expect(dialog.getByRole('note')).toContainText('1 remaining members will pay');
  await dialog.getByRole('button', { name: 'Remove member' }).click();
  await expect(sarah.getByText(/Priya Shah was removed from the group\. The hotel total stays/)).toBeVisible();

  const after = (await (await request.get(`${API}/api/groups/${group.group_id}/booking`, { headers: as('T-001') })).json()).booking;
  expect(after.total_inr).toBe(before.total_inr);
  expect(after.members_count).toBe(1);
  expect(after.per_member_inr).toBe(before.total_inr);
});
