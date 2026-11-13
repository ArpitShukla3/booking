import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

// S1 team chat against the REAL backend + PostgreSQL. Each test sets up its own Kyoto group:
// Sarah (T-001) owns it, Priya (T-002) is approved, and the group books a hotel through the M6 API.
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

async function groupWithPriya(request: APIRequestContext, book: boolean) {
  const created = await request.post(`${API}/api/groups`, {
    headers: as('T-001'),
    data: { name: `Chat test ${Date.now()}`, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000 },
  });
  const groupId = (await created.json()).group_id as string;
  const req = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: as('T-002') });
  await request.post(`${API}/api/join-requests/${(await req.json()).request_id}/approve`, { headers: as('T-001') });
  if (book) {
    const search = await (await request.get(`${API}/api/groups/${groupId}/hotels`, { headers: as('T-001') })).json();
    const option = search.hotels.flatMap((h: { options: { room_id: string; available: boolean }[] }) => h.options).find((o: { available: boolean }) => o.available);
    const booked = await request.post(`${API}/api/groups/${groupId}/booking`, { headers: as('T-001'), data: { room_id: option.room_id } });
    expect(booked.status()).toBe(201);
  }
  return groupId;
}

test('Chat with team is locked before booking and opens after', async ({ browser, request }) => {
  const groupId = await groupWithPriya(request, false);
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await expect(sarah.getByRole('button', { name: /Chat with team/ })).toBeDisabled();
  await sarah.goto(`/groups/${groupId}/chat`);
  await expect(sarah.getByRole('heading', { name: 'The team chat isn’t open yet' })).toBeVisible();
});

test('owner and member chat: messages with id + time, announcement, poll and votes', async ({ browser, request }) => {
  const groupId = await groupWithPriya(request, true);
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await sarah.getByRole('link', { name: /Chat with team/ }).click();
  await expect(sarah).toHaveURL(new RegExp(`/groups/${groupId}/chat$`));
  await expect(sarah.getByTitle('Chat ID')).toHaveText(/C-\d{4,}/);

  await sarah.getByLabel('Message', { exact: true }).fill('Welcome to Kyoto, team!');
  await sarah.getByRole('button', { name: 'Send message' }).click();
  const mine = sarah.getByRole('article', { name: 'Message from you' }).last();
  await expect(mine).toContainText('Welcome to Kyoto, team!');
  await expect(mine.getByTitle('Message ID')).toHaveText(/^M-\d{4,}$/);
  await expect(mine.locator('time')).toHaveText(/\d{2}:\d{2}/);

  await sarah.getByRole('tab', { name: /Announcement/ }).click();
  await sarah.getByLabel('Announcement', { exact: true }).fill('Meet at Kyoto Station, 9am');
  await sarah.getByRole('button', { name: 'Post announcement' }).click();
  await expect(sarah.getByRole('article', { name: /^Announcement from/ }).last()).toContainText('Meet at Kyoto Station, 9am');

  await sarah.getByRole('tab', { name: /Poll/ }).click();
  await sarah.getByLabel('Poll question').fill('Day trip?');
  await sarah.getByLabel('Option 1', { exact: true }).fill('Nara');
  await sarah.getByLabel('Option 2', { exact: true }).fill('Osaka');
  await sarah.getByRole('button', { name: 'Create poll' }).click();
  const poll = sarah.getByRole('article', { name: /^Poll from/ }).last();
  await expect(poll).toContainText('Day trip?');

  // Priya sees everything (after a poll cycle), cannot announce, votes, and replies.
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}/chat`);
  await expect(priya.getByText('Welcome to Kyoto, team!')).toBeVisible();
  await expect(priya.getByRole('tab', { name: /Announcement/ })).toBeDisabled();
  await priya.getByRole('button', { name: /^Nara: 0 votes/ }).click();
  await expect(priya.getByRole('button', { name: /^Nara: 1 vote, 100%, your vote/ })).toBeVisible();
  await priya.getByLabel('Message', { exact: true }).fill('Nara please!');
  await priya.keyboard.press('Enter');
  await expect(priya.getByRole('article', { name: 'Message from you' }).last()).toContainText('Nara please!');

  // Sarah receives Priya's message and vote through polling.
  await expect(sarah.getByText('Nara please!')).toBeVisible({ timeout: 10_000 });
  await expect(sarah.getByRole('button', { name: /^Nara: 1 vote/ })).toBeVisible({ timeout: 10_000 });

  // Persistence
  await priya.reload();
  await expect(priya.getByText('Meet at Kyoto Station, 9am')).toBeVisible();
  await expect(priya.getByRole('button', { name: /^Nara: 1 vote, 100%, your vote/ })).toBeVisible();
});

test('group settings: organiser-only messages lock the member composer', async ({ browser, request }) => {
  const groupId = await groupWithPriya(request, true);
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}/chat`);
  await sarah.getByRole('button', { name: 'Group settings' }).click();
  const dialog = sarah.getByRole('dialog');
  await dialog.getByRole('group', { name: 'Who can send messages' }).getByLabel('Only the organiser').check();
  await dialog.getByRole('group', { name: 'Who can create polls' }).getByLabel('Only the organiser').check();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(sarah.getByText(/Messages: organiser only/)).toBeVisible();

  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}/chat`);
  await expect(priya.getByRole('note')).toContainText('Only the organiser can post');
  await expect(priya.getByRole('button', { name: 'Group settings' })).toHaveCount(0);
});

test('non-members get a members-only page; chat fits a phone screen', async ({ browser, request }) => {
  const groupId = await groupWithPriya(request, true);
  const stranger = await pageAs(browser, 'T-004');
  await stranger.goto(`/groups/${groupId}/chat`);
  await expect(stranger.getByRole('heading', { name: 'Members only' })).toBeVisible();

  const phone = await pageAs(browser, 'T-002');
  await phone.setViewportSize({ width: 360, height: 800 });
  await phone.goto(`/groups/${groupId}/chat`);
  await expect(phone.getByRole('region', { name: 'Team chat' })).toBeVisible();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
