import { expect, test, type Page } from '@playwright/test';

const MODELS = ['Fish', 'Boat', 'Penguin', 'Butterfly', 'Crane', 'Lotus', 'Sonobe cube'];

async function noErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** current step number shown under the paper */
const stepNo = (page: Page) => page.locator('.step-no .n').innerText();

test.describe('gallery', () => {
  test('shows every model, simple to hard, each drawn as real paper', async ({ page }) => {
    const errors = await noErrors(page);
    await page.goto('/');
    await expect(page.locator('.card h2')).toHaveText(MODELS);
    // every card has a finished model drawn with paper faces
    const counts = await page.locator('.card').evaluateAll((cards) => cards.map((c) => c.querySelectorAll('.paper polygon').length));
    for (const n of counts) expect(n).toBeGreaterThan(2);
    await expect(page.getByRole('link', { name: /adamkz007/ })).toHaveAttribute('href', 'https://github.com/adamkz007');
    expect(errors).toEqual([]);
  });

  test('every guide page loads', async ({ page }) => {
    const errors = await noErrors(page);
    for (const slug of ['fish', 'boat', 'penguin', 'butterfly', 'crane', 'lotus', 'sonobe']) {
      const res = await page.goto(`/m/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator('.stage-box svg .paper polygon').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('unknown models 404', async ({ page }) => {
    const res = await page.goto('/m/dragon');
    expect(res?.status()).toBe(404);
  });
});

test.describe('guide', () => {
  test('opens finished, unfolds to a blank sheet, then shows the first fold', async ({ page }) => {
    await page.goto('/m/fish');
    // the intro rewinds every fold, then draws the first fold's diagram
    await expect(page.locator('.hint')).toBeVisible({ timeout: 15_000 });
    // diagram group is shown (a horizontal fold line has a zero-height box, so check the group)
    await expect(page.locator('.overlay')).toBeVisible();
    expect(await page.locator('.overlay .crease.valley').count()).toBeGreaterThan(0);
    expect(await page.locator('.overlay .arrow.valley').count()).toBeGreaterThan(0);
    expect(await stepNo(page)).toBe('1');
  });

  test('scrolling moves one step at a time and keys/buttons/dots navigate', async ({ page, isMobile }) => {
    await page.goto('/m/crane');
    await expect(page.locator('.hint')).toBeVisible({ timeout: 15_000 });
    if (!isMobile) {
      await page.mouse.move(400, 300);
      await page.mouse.wheel(0, 120);
      await expect.poll(() => stepNo(page)).toBe('2');
      await page.mouse.wheel(0, 120);
      await expect.poll(() => stepNo(page)).toBe('3');
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => stepNo(page)).toBe('4');
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => stepNo(page)).toBe('3');
    }
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect.poll(() => stepNo(page)).not.toBe('1');
    await page.getByRole('button', { name: 'Step 8' }).click();
    await expect.poll(() => stepNo(page)).toBe('8');
    // the step's words are there for screen readers, matching the fold
    await expect(page.locator('.stage-box .sr-only')).toContainText('Petal fold');
  });

  test('finishing a model: mark completed, stamp in the gallery', async ({ page }) => {
    await page.goto('/m/penguin');
    await expect(page.locator('.hint')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: 'Mark completed' }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Mark completed' }).last().click();
    await expect(page.locator('.finale .pill.on')).toHaveText(/Completed/);
    expect(await page.evaluate(() => localStorage.getItem('origami.completed'))).toContain('penguin');
    await page.getByRole('link', { name: 'All models' }).click();
    await expect(page.locator('.card', { hasText: 'Penguin' }).locator('.done')).toBeVisible();
    await expect(page.locator('.progress')).toContainText('1/7');
  });

  test('share copies the link, sound toggles and persists, symbol key opens', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/m/boat');
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined }));
    await page.getByRole('button', { name: 'Share this guide' }).click();
    await expect(page.locator('.toast')).toHaveText('link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/m\/boat$/);
    await page.getByRole('button', { name: 'Sound off' }).click();
    expect(await page.evaluate(() => localStorage.getItem('origami.sound'))).toBe('true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sound on' })).toBeVisible();
    await page.getByRole('button', { name: 'Symbol key' }).click();
    await expect(page.getByRole('dialog', { name: 'Symbol key' })).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('valley');
  });

  test('the next-model link continues the path', async ({ page }) => {
    await page.goto('/m/fish');
    await expect(page.locator('.hint')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('End');
    await page.getByRole('link', { name: 'Next model: Boat' }).click();
    await expect(page).toHaveURL(/\/m\/boat$/);
    await expect(page.locator('h1')).toHaveText('Boat');
  });
});

test('reduced motion skips the intro and still folds on scroll', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4173/m/lotus');
  await expect(page.locator('.overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect.poll(() => page.locator('.step-no .n').innerText()).toBe('2');
  await ctx.close();
});
