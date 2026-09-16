import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('feeds tick, the screen shows live values and sparklines', async ({ page }) => {
  await expect(page.getByTestId('value-traffic')).not.toHaveText('—', { timeout: 5000 });
  const a = await page.getByTestId('value-traffic').textContent();
  await page.waitForTimeout(2500);
  const b = await page.getByTestId('value-traffic').textContent();
  expect(a).not.toEqual(b); // the quiet scenario breathes
  await expect(page.getByTestId('value-errors')).toContainText('%');
});

test('surge scenario fires the slope-trigger rule on the timeline', async ({ page }) => {
  await page.getByTestId('scenario').selectOption('surge');
  await expect(page.getByTestId('firings')).toContainText('trigger surge', { timeout: 55_000 });
  const slope = await page.getByTestId('value-traffic_slope').textContent();
  expect(parseFloat(slope!)).toBeGreaterThan(40);
});

test('manual traffic below the bound introduces the minor concept after the hold', async ({ page }) => {
  await page.getByTestId('scenario').selectOption('manual');
  await page.getByTestId('manual-traffic').fill('3');
  await expect(page.getByTestId('firings')).toContainText('introduce minor on pad', { timeout: 30_000 });
  await page.getByTestId('manual-traffic').fill('60');
  await expect(page.getByTestId('firings')).toContainText('release minor on pad', { timeout: 15_000 });
});

test('composer can add a rule, change its condition, pick an instrument and write a motif', async ({ page }) => {
  const rules = page.locator('[data-testid^="rule-r"]:not([data-testid*="-input-"]):not([data-testid*="-when-"]):not([data-testid*="-do-"]):not([data-testid*="-threshold-"])');
  const before = await rules.count();
  await page.getByTestId('add-rule').click();
  await expect(rules).toHaveCount(before + 1);
  const id = (await rules.last().getAttribute('data-testid'))!.replace('rule-', '');
  await page.getByTestId(`rule-when-${id}`).selectOption('above');
  await page.getByTestId(`rule-threshold-${id}`).fill('100');
  await page.getByTestId(`rule-do-${id}`).selectOption('trigger');
  await expect(page.getByTestId(`rule-${id}`)).toContainText('on the next');
  // The score survives a reload (localStorage).
  await page.reload();
  await expect(page.getByTestId(`rule-${id}`)).toBeVisible();

  await page.getByTestId('instrument-surge').selectOption('marimba');
  await expect(page.getByTestId('instrument-surge')).toHaveValue('marimba');
  await page.getByTestId('notes-surge').fill('c5 e5 xx g5');
  await expect(page.getByTestId('sound-surge')).toContainText('unknown token "xx"');
  await page.getByTestId('notes-surge').fill('c5 e5 g5:2');
  await expect(page.getByTestId('sound-surge')).toContainText('3 notes over 4 steps');
});

test('audio starts and instruments load from the soundfont CDN', async ({ page }) => {
  test.slow();
  await page.getByTestId('start-audio').click();
  await expect(page.getByTestId('play-pause')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('audition-bass')).toBeEnabled({ timeout: 60_000 });
  await page.getByTestId('audition-bass').click();
  const state = await page.evaluate(() => (window as any).Tone?.getContext?.().state ?? 'unknown');
  expect(['running', 'unknown']).toContain(state);
});
