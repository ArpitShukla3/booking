import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

// X4 photo gallery against the REAL backend, PostgreSQL and MinIO (npm run db:up starts both).
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';
const KEY = 'group_match_active_traveller';
const as = (id: string) => ({ 'X-Traveller-Id': id });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function pageAs(browser: Browser, travellerId: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ traveller_id: id, expires_at: Date.now() + 86_400_000 }));
  }, [KEY, travellerId] as const);
  return context.newPage();
}

async function bookedGroup(request: APIRequestContext, book = true) {
  const created = await request.post(`${API}/api/groups`, {
    headers: as('T-001'),
    data: { name: `Photo test ${Date.now()}`, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000 },
  });
  const groupId = (await created.json()).group_id as string;
  const req = await request.post(`${API}/api/groups/${groupId}/join-requests`, { headers: as('T-002') });
  await request.post(`${API}/api/join-requests/${(await req.json()).request_id}/approve`, { headers: as('T-001') });
  if (book) {
    const search = await (await request.get(`${API}/api/groups/${groupId}/hotels`, { headers: as('T-001') })).json();
    const option = search.hotels.flatMap((h: { options: { room_id: string; available: boolean }[] }) => h.options).find((o: { available: boolean }) => o.available);
    await request.post(`${API}/api/groups/${groupId}/booking`, { headers: as('T-001'), data: { room_id: option.room_id } });
  }
  return groupId;
}

test('Trip photos is locked before booking', async ({ browser, request }) => {
  const groupId = await bookedGroup(request, false);
  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}`);
  await expect(sarah.getByRole('button', { name: /Trip photos/ })).toBeDisabled();
  await sarah.goto(`/groups/${groupId}/photos`);
  await expect(sarah.getByRole('heading', { name: 'The photo gallery isn’t open yet' })).toBeVisible();
});

test('member uploads with a caption; the other member opens it, browses and the organiser deletes it', async ({ browser, request }) => {
  const groupId = await bookedGroup(request);
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}`);
  await priya.getByRole('link', { name: /Trip photos/ }).click();
  await expect(priya).toHaveURL(new RegExp(`/groups/${groupId}/photos$`));
  await expect(priya.getByText('No photos yet')).toBeVisible();

  await priya.getByLabel('Choose photos to upload').setInputFiles({ name: 'sunrise.png', mimeType: 'image/png', buffer: PNG });
  await priya.getByLabel('Caption for sunrise.png').fill('Sunrise at Fushimi Inari');
  await priya.getByRole('button', { name: 'Upload 1 photo' }).click();
  await expect(priya.getByRole('status').filter({ hasText: '1 photo added.' })).toBeVisible();
  const tile = priya.getByRole('link', { name: /Sunrise at Fushimi Inari/ });
  await expect(tile).toBeVisible();
  // The image really loads from MinIO through the signed link.
  await expect.poll(() => tile.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  const sarah = await pageAs(browser, 'T-001');
  await sarah.goto(`/groups/${groupId}/photos`);
  await sarah.getByRole('link', { name: /Sunrise at Fushimi Inari/ }).click();
  await expect(sarah).toHaveURL(new RegExp(`/groups/${groupId}/photos/P-\\d{4,}$`));
  await expect(sarah.getByRole('heading', { name: 'Sunrise at Fushimi Inari' })).toBeVisible();
  await expect(sarah.getByText('Photo 1 of 1')).toBeVisible();
  await sarah.getByRole('button', { name: 'Delete photo' }).click();
  await sarah.getByRole('dialog').getByRole('button', { name: 'Delete photo' }).click();
  await expect(sarah).toHaveURL(new RegExp(`/groups/${groupId}/photos$`));
  await expect(sarah.getByText('No photos yet')).toBeVisible();
});

test('rejects a non-image in the browser; non-members get "Members only"', async ({ browser, request }) => {
  const groupId = await bookedGroup(request);
  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/groups/${groupId}/photos`);
  await priya.getByLabel('Choose photos to upload').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(priya.getByRole('alert')).toContainText('"notes.txt" is not a JPEG, PNG or WebP image.');

  const stranger = await pageAs(browser, 'T-004');
  await stranger.goto(`/groups/${groupId}/photos`);
  await expect(stranger.getByRole('heading', { name: 'Members only' })).toBeVisible();
});
