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

test('free form: scenarios off, each tracked input gets a dial, derived slope follows, rules still fire', async ({ page }) => {
  await expect(page.getByTestId('value-traffic')).not.toHaveText('—', { timeout: 5000 });
  await page.getByTestId('mode-free').check();
  await expect(page.getByTestId('scenario')).toHaveCount(0);
  await expect(page.getByTestId('dial-traffic')).toBeVisible();
  await expect(page.getByTestId('dial-errors')).toBeVisible();
  await expect(page.getByTestId('dial-traffic_slope')).toHaveCount(0); // derived: no dial
  await expect(page.getByTestId('input-traffic_slope')).toContainText('follows the traffic dial');
  await page.getByTestId('dial-errors').fill('0.75');
  await expect(page.getByTestId('value-errors')).toHaveText('75.0 %'); // lands immediately
  await page.getByTestId('dial-traffic').fill('3');
  await expect(page.getByTestId('firings')).toContainText('introduce minor on pad', { timeout: 30_000 });
  await page.getByTestId('dial-traffic').fill('60');
  await expect(page.getByTestId('firings')).toContainText('release minor on pad', { timeout: 15_000 });
  await page.getByTestId('mode-scenario').check();
  await expect(page.getByTestId('scenario')).toBeVisible();
  await expect(page.getByTestId('dial-traffic')).toHaveCount(0);
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

test('outage loops: errors reach 100 %, fall back, and the cycle counter advances; the length slider sets the pace', async ({ page }) => {
  test.slow();
  await page.getByTestId('scenario').selectOption('outage');
  await page.getByTestId('scenario-duration').fill('30');
  await expect(page.getByTestId('scenario-duration-value')).toHaveText('30 s');
  await expect(page.getByTestId('value-errors')).toHaveText('100.0 %', { timeout: 20_000 });
  await expect(page.getByTestId('value-traffic')).toHaveText(/^[0-4]\.\d$/);
  // (At 30 s per cycle the outage is too short for the 20 s 'traffic below 12' hold — that is the nuance the slider exposes.)
  await expect(page.getByTestId('scenario-phase')).toContainText('cycle 2', { timeout: 30_000 });
  const errors = parseFloat((await page.getByTestId('value-errors').textContent())!);
  expect(errors).toBeLessThan(10);
  await expect(page.getByTestId('value-errors')).toHaveText('100.0 %', { timeout: 20_000 }); // second time round
});
