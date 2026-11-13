import { expect, test } from '@playwright/test'

test('home offers only static booking content and working Group Match navigation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your next great stay')
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Flights', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('visual navigation item')
  await page.getByRole('button', { name: 'Got it' }).click()
  await page.getByRole('link', { name: 'Group Match New', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Find your perfect travel companions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kyoto Spring Temples', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('search changes eligible groups and URL, preserves filters on back, and sorts', async ({ page }) => {
  await page.goto('/group-match')
  await page.getByLabel('Destination', { exact: true }).selectOption('Dubai')
  await page.getByRole('button', { name: 'Search Groups', exact: true }).click()
  await expect(page).toHaveURL(/city=Dubai/)
  await expect(page.getByRole('heading', { name: 'Your people may be on a different plan' })).toBeVisible()
  await page.getByRole('button', { name: 'Try the Kyoto sample search' }).click()
  await expect(page.getByRole('heading', { name: 'Kyoto Spring Temples', exact: true })).toBeVisible()
  await page.getByLabel('Sort by', { exact: true }).selectOption('budget')
  await expect(page).toHaveURL(/sort=budget/)
  const group = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Kyoto Spring Temples', exact: true }) })
  await group.getByRole('link', { name: 'View Details' }).click()
  await expect(page).toHaveURL(/groups\/G-01/)
  await page.getByRole('link', { name: 'Back to matching groups' }).click()
  await expect(page.getByLabel('Destination', { exact: true })).toHaveValue('Kyoto')
})

test('form validation reports dates, budget and insufficient interests', async ({ page }) => {
  await page.goto('/group-match')
  await page.getByLabel('Budget per person (INR)').fill('0')
  await page.getByLabel('Check-out', { exact: true }).fill('2027-04-09')
  await page.getByRole('checkbox', { name: 'Street food and markets', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Photography', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Search Groups', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Enter a budget greater' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Check-out must be after' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Choose at least two' })).toBeVisible()
  await expect(page.getByLabel('Check-out', { exact: true })).toBeFocused()
})

test('Interested becomes pending, survives refresh, and is traveller-specific', async ({ page }) => {
  await page.goto('/group-match/groups/G-01')
  await page.getByRole('button', { name: 'Interested', exact: true }).click()
  await expect(page.getByText('Request pending', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Request pending', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Switch sample traveller' }).click()
  await page.getByRole('button', { name: /Sarah Thomas/ }).click()
  await expect(page.getByText('You are hosting this group.')).toBeVisible()
  await expect(page.getByText('Request pending', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('You are hosting this group.')).toBeVisible()
})

test('unknown records and invalid URL searches have recoverable errors', async ({ page }) => {
  await page.goto('/group-match/groups/missing')
  await expect(page.getByRole('alert')).toContainText('Group not found')
  await page.goto('/group-match?budget_inr=-1')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.goto('/not-a-page')
  await expect(page.getByRole('heading', { name: 'This page has taken a different route' })).toBeVisible()
})

for (const width of [360, 390, 768, 1440]) {
  test(`responsive layouts, images and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/group-match', '/group-match/groups/G-01']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete))
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth, brokenImages: Array.from(document.images).filter(image => image.naturalWidth === 0).map(image => image.src) }))
      expect(layout.overflow, `${route} horizontal overflow`).toBe(false)
      expect(layout.brokenImages).toEqual([])
    }
    await page.goto('/group-match')
    if (width < 760) {
      await page.getByText('Search filters', { exact: true }).click()
      await expect(page.getByLabel('Destination', { exact: true })).toBeHidden()
      await page.getByText('Search filters', { exact: true }).click()
      await expect(page.getByLabel('Destination', { exact: true })).toBeVisible()
    }
  })
}
