import { expect, test } from '@playwright/test';
const KEY = 'group_match_active_traveller';
const TTL = 7 * 24 * 60 * 60 * 1000;
const API = process.env.IDENTITY_TEST_API_URL || 'http://localhost:4000';

test('real signup persists in PostgreSQL, reveals ID, remembers seven days, logs out and signs in again', async ({ page, request, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/signup');
  await page.getByLabel('Full Name', { exact: true }).fill('Rahul Browser Demo');
  await page.getByLabel('Age', { exact: true }).fill('24');
  await page.getByLabel('Gender', { exact: true }).selectOption('MALE');
  await page.getByLabel('Home City', { exact: true }).fill('Delhi');
  await page.getByLabel('Home Airport', { exact: true }).fill('DEL');
  await page.getByRole('checkbox', { name: 'Adventure sports', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Street food and markets', exact: true }).check();
  const before = Date.now();
  await page.getByRole('button', { name: 'Create traveller profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your traveller profile is ready!' })).toBeVisible();
  const id = (await page.getByTestId('traveller-id').textContent())!;
  expect(id).toMatch(/^T-\d{3,}$/);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
  expect(stored.traveller_id).toBe(id); expect(stored.expires_at).toBeGreaterThanOrEqual(before + TTL); expect(stored.expires_at).toBeLessThanOrEqual(Date.now() + TTL);
  const saved = await request.get(`${API}/api/travellers/${id}`); expect(saved.status()).toBe(200); expect(await saved.json()).toMatchObject({ traveller_id: id, name: 'Rahul Browser Demo', age: 24, home_airport: 'DEL', interests: ['ADVENTURE', 'STREET_FOOD'] });
  await page.getByRole('button', { name: 'Copy Traveller ID', exact: true }).click(); await expect(page.getByRole('button', { name: 'Traveller ID copied' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Rahul Browser Demo' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Welcome, Rahul Browser Demo' })).toBeVisible();
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY)).expires_at).toBe(stored.expires_at);
  await page.getByRole('main').getByRole('button', { name: 'Logout', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull(); expect((await request.get(`${API}/api/travellers/${id}`)).status()).toBe(200);
  await page.getByLabel('Traveller ID', { exact: true }).fill(id); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/'); await expect(page).toHaveURL(/\/dashboard$/);
});

test('seeded ID login works, unknown ID preserves input and does not silently register', async ({ page }) => {
  await page.goto('/dashboard'); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Traveller ID', { exact: true }).fill('T-99999999'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Traveller ID not found'); await expect(page.getByLabel('Traveller ID', { exact: true })).toHaveValue('T-99999999');
  await page.getByLabel('Traveller ID', { exact: true }).fill('T-001'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Sarah Thomas' })).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
});

test('signup validates required fields before writing and loads its catalog from the backend', async ({ page }) => {
  let catalogRead = false; page.on('response', response => { if (response.url().endsWith('/api/interests') && response.status() === 200) catalogRead = true; });
  await page.goto('/signup'); await page.getByRole('button', { name: 'Create traveller profile', exact: true }).click();
  await expect(page.getByText('Enter your full name', { exact: true })).toBeVisible(); await expect(page.getByText('Enter your age', { exact: true })).toBeVisible(); await expect(page.getByText('Choose your gender', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Full Name', { exact: true })).toBeFocused(); expect(catalogRead).toBe(true);
});

for (const raw of ['not JSON', JSON.stringify({ traveller_id: 'T-001', expires_at: 1000 }), JSON.stringify({ traveller_id: 'T-001', expires_at: 'tomorrow' })]) {
  test(`clears invalid or expired remembered identity ${raw}`, async ({ page }) => {
    await page.goto('/login'); await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: KEY, raw }); await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/); expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
  });
}

test('clears a remembered ID that is not in PostgreSQL', async ({ page }) => {
  await page.goto('/login'); await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ traveller_id: 'T-99999999', expires_at: Date.now() + 100000 })), KEY); await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('status')).toContainText('Traveller ID not found'); expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
});

test('temporary restoration failure keeps expiry and supports an actual backend retry', async ({ page }) => {
  await page.goto('/login'); const expiry = Date.now() + 100000;
  await page.evaluate(({ key, expiry }) => localStorage.setItem(key, JSON.stringify({ traveller_id: 'T-001', expires_at: expiry })), { key: KEY, expiry });
  await page.route('**/api/travellers/T-001', route => route.abort('connectionrefused')); await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'We couldn’t restore your profile' })).toBeVisible();
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY)).expires_at).toBe(expiry);
  await page.unroute('**/api/travellers/T-001'); await page.getByRole('button', { name: 'Retry profile restoration' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Sarah Thomas' })).toBeVisible();
});

test('an open dashboard expires without a refresh', async ({ page }) => {
  await page.clock.install(); await page.goto('/login');
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ traveller_id: 'T-001', expires_at: Date.now() + 60000 })), KEY); await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Sarah Thomas' })).toBeVisible();
  await page.clock.fastForward(60001); await expect(page).toHaveURL(/\/login$/); expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
});

test('network failures keep the Traveller ID input and give a retryable error', async ({ page }) => {
  await page.goto('/login'); await page.route('**/api/travellers/sign-in', route => route.abort('connectionrefused'));
  await page.getByLabel('Traveller ID', { exact: true }).fill('T-001'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach the backend'); await expect(page.getByLabel('Traveller ID', { exact: true })).toHaveValue('T-001');
});

test('account pages work on a 360px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  for (const route of ['/signup', '/login']) { await page.goto(route); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByLabel('Traveller ID', { exact: true }).fill('T-001'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
