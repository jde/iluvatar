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

test('picker modal: choose a ready-made sound for an existing sound, and add one', async ({ page }) => {
  await page.getByTestId('pick-preset-surge').click();
  await expect(page.getByTestId('preset-picker')).toBeVisible();
  await expect(page.getByTestId('preview-ode-to-joy')).toBeDisabled(); // audio not started: previews wait
  await page.getByTestId('browser-search').fill('elise');
  await expect(page.getByTestId('preset-fur-elise')).toBeVisible();
  await expect(page.getByTestId('preset-ode-to-joy')).toHaveCount(0);
  await page.getByTestId('use-fur-elise').click();
  await expect(page.getByTestId('preset-picker')).toHaveCount(0);
  await expect(page.getByTestId('instrument-surge')).toHaveValue('acoustic_grand_piano');
  await expect(page.getByTestId('notes-surge')).toHaveValue(/^g5 f#5 g5 f#5 g5 d5 f5 d#5 | c5:3/); // A minor, brought to C
  await expect(page.getByTestId('credit-surge')).toHaveText('from Für Elise — Ludwig van Beethoven, 1810');
  await page.getByTestId('notes-surge').fill('c5 e5');
  await expect(page.getByTestId('credit-surge')).toContainText('edited from Für Elise');

  const sounds = page.locator('[data-testid^="sound-"]');
  const before = await sounds.count();
  await page.getByTestId('add-sound-library').click();
  await page.getByTestId('browser-category').selectOption('carols');
  await page.getByTestId('use-silent-night').click();
  await expect(sounds).toHaveCount(before + 1);
  await expect(sounds.last()).toContainText('from Silent Night');
  await expect(sounds.last().locator('input.label')).toHaveValue('Silent Night');
  await page.reload();
  await expect(page.locator('[data-testid^="sound-"]')).toHaveCount(before + 1); // saved with the score
});

test('library page: browse, make a new sound, save it, reload, use it from the composer', async ({ page }) => {
  await page.getByTestId('nav-library').click();
  await expect(page.locator('[data-page="library"]')).toBeVisible();
  await expect(page.getByTestId('preset-browser')).toContainText('Ode to Joy');
  await page.getByTestId('preset-greensleeves').click();
  await expect(page.getByTestId('preset-detail')).toContainText('Greensleeves');
  await expect(page.getByTestId('preset-detail')).toContainText('written in A, shown here in C');

  await page.getByTestId('new-preset').click();
  await page.getByTestId('editor-title').fill('Night riff');
  await page.getByTestId('editor-instrument').selectOption('vibraphone');
  await page.getByTestId('editor-kind').selectOption('loop');
  await page.getByTestId('editor-notes').fill('c5 xx');
  await expect(page.getByTestId('preset-editor')).toContainText('unknown token "xx"');
  await expect(page.getByTestId('editor-save')).toBeDisabled();
  await page.getByTestId('editor-notes').fill('c5 . eb5 . g5 . bb5 .');
  await page.getByTestId('editor-save').click();
  await expect(page.getByTestId('preset-detail')).toContainText('Night riff');
  await expect(page.getByTestId('preset-detail')).toContainText('vibraphone · loop');
  await page.reload();
  await page.getByTestId('browser-category').selectOption('mine');
  await expect(page.getByTestId('preset-browser')).toContainText('Night riff'); // saved in the browser

  await page.getByTestId('nav-composer').click();
  await page.getByTestId('pick-preset-pad').click();
  await page.getByTestId('browser-category').selectOption('mine');
  const mineId = (await page.locator('[data-testid^="use-mine-"]').first().getAttribute('data-testid'))!.replace('use-', '');
  await page.getByTestId(`use-${mineId}`).click();
  await expect(page.getByTestId('sound-pad')).toContainText('loop (repeats)');
  await expect(page.getByTestId('instrument-pad')).toHaveValue('vibraphone');
  await expect(page.getByTestId('notes-pad')).toHaveValue('c5 . eb5 . g5 . bb5 .');
});

test('previews play once audio is started', async ({ page }) => {
  test.slow();
  await page.getByTestId('nav-library').click();
  await page.getByTestId('start-audio').click();
  await expect(page.getByTestId('start-audio')).toHaveCount(0, { timeout: 20_000 });
  await page.getByTestId('preview-twinkle').click();
  await expect(page.getByTestId('preview-twinkle')).toHaveText('■', { timeout: 60_000 }); // instrument loaded, notes scheduled
  await expect(page.getByTestId('preview-twinkle')).toHaveText('▶', { timeout: 30_000 }); // and finished
});
