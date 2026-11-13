import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// G1 match filters and G2 profile trips against the REAL backend + PostgreSQL.
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

test('G1: gender-mix and shared-interest filters narrow the matches and live in the URL', async ({ browser, request }) => {
  const name = `Filter e2e ${Date.now()}`;
  await request.post(`${API}/api/groups`, { headers: as('T-001'), data: { name, city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 4, budget_inr: 60000 } });
  const search = await (await request.post(`${API}/api/searches`, {
    headers: as('T-002'),
    data: { home_city: 'Mumbai', city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender_preference: 'ANY' },
  })).json();

  const priya = await pageAs(browser, 'T-002');
  await priya.goto(`/group-match?search=${search.search_id}`);
  const panel = priya.getByRole('region', { name: /Refine results/ });
  await expect(panel).toBeVisible();
  await expect(priya.getByRole('article').filter({ hasText: name })).toContainText('Women only');

  await panel.getByRole('button', { name: /^Women only/ }).click();
  await expect(priya).toHaveURL(/mix=WOMEN_ONLY/);
  await expect(panel.getByRole('button', { name: /^Women only/ })).toHaveAttribute('aria-pressed', 'true');
  for (const card of await priya.getByRole('article').all()) await expect(card).toContainText('Women only');

  await panel.getByRole('button', { name: /^Temples/ }).click();
  await expect(priya).toHaveURL(/must=TEMPLES/);
  await priya.reload();
  await expect(panel.getByRole('button', { name: /^Temples/ })).toHaveAttribute('aria-pressed', 'true');

  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await expect(priya).not.toHaveURL(/mix=|must=/);
});

test('G2: profile lists the trips a traveller organises and joined; member names link to profiles', async ({ browser }) => {
  const sarah = await pageAs(browser, 'T-002');
  await sarah.goto('/travellers/T-001');
  const trips = sarah.getByRole('region', { name: 'Group trips' });
  await expect(trips.getByRole('heading', { name: /Organising \(\d+\)/ })).toBeVisible();
  const first = trips.getByRole('link').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(sarah).toHaveURL(/\/groups\/G-/);

  await sarah.goto('/groups/G-01');
  await sarah.getByRole('link', { name: /Sarah Thomas.*view profile/ }).click();
  await expect(sarah).toHaveURL(/\/travellers\/T-001$/);
});
