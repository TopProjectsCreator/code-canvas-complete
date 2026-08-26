import { chromium } from 'playwright';
import fs from 'node:fs';

const SHOTS = '/home/runner/workspace/screenshots/e2e';
fs.mkdirSync(SHOTS, { recursive: true });
const log = (s) => { fs.appendFileSync('/tmp/opencode/uitest/run.log', s + '\n'); console.log(s); };
const shot = async (name) => { try { await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 120000 }); } catch (e) { log(`    [shot failed: ${name}]`); } };
fs.writeFileSync('/tmp/opencode/uitest/run.log', '');

const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 180)); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 180)));

// Mouse clicks proved flaky on this page; JS clicks drive the same React handlers.
const jsClick = async (locator, label) => {
  await locator.first().waitFor({ state: 'visible', timeout: 15000 });
  await locator.first().evaluate((el) => el.click());
  log(`    clicked: ${label}`);
};

log('[1] open /editor');
await page.goto('http://127.0.0.1:4173/editor', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
await shot(`01-editor.png`);

const skip = page.getByText("Skip, I'll explore").first();
if (await skip.count()) {
  log('[1b] dismiss welcome overlay');
  await jsClick(skip, 'Skip');
  await page.waitForTimeout(1200);
}

const blank = page.locator('button:has-text("Blank Canvas")').first();
if (await blank.count()) {
  log('[1c] select Blank Canvas');
  await jsClick(blank, 'Blank Canvas');
  await page.waitForTimeout(5000);
  await shot(`02-editor-real.png`);
}

log('[2] open AI chat panel');
await jsClick(page.locator('[aria-label="Toggle AI chat"]'), 'Toggle AI chat');
await page.waitForTimeout(2500);
await shot(`03-chat-open.png`);

log('[3] open model picker');
await jsClick(page.locator('button[aria-label*="Change model"]'), 'Change model');
await page.waitForTimeout(1200);
await shot(`04-model-picker.png`);

log('[4] open Local LLM Manager');
await jsClick(page.getByText('Manage', { exact: true }), 'Manage');
await page.waitForTimeout(1500);
await shot(`05-manager-dialog.png`);

log('[5] download Gemma 3 270M (real ~600MB)');
const gemmaCard = page.locator('div.rounded-lg', { hasText: 'Gemma 3 270M' }).last();
await jsClick(gemmaCard.getByRole('button', { name: 'Download', exact: true }), 'Download Gemma');
let done = false;
for (let i = 0; i < 150; i++) {
  await page.waitForTimeout(4000);
  const txt = await gemmaCard.innerText().catch(() => '');
  if (/Downloaded/i.test(txt) && !/Not downloaded/i.test(txt)) { done = true; break; }
  if (i % 5 === 0) {
    log(`    ...${txt.match(/(\d+)%/)?.[1] ?? '?'}%`);
    if (i === 20) await shot(`06-download-progress.png`);
  }
}
log(`[5] download complete: ${done}`);
await shot(`07-downloaded.png`);

log('[6] close manager, select Gemma as active model');
await jsClick(page.getByRole('button', { name: 'Done' }), 'Done');
await page.waitForTimeout(1000);
await jsClick(page.locator('button[aria-label*="Change model"]'), 'Change model');
await page.waitForTimeout(1000);
await shot(`08-picker-downloaded.png`);
await jsClick(page.getByText('Gemma 3 270M').first(), 'Gemma 3 270M row');
await page.waitForTimeout(1500);
await shot(`09-offline-active.png`);

log('[7] send real message');
const input = page.locator('textarea[placeholder*="Ask"]').first();
await input.fill('Use ask_prompt to ask me what the file should be named');
await shot(`10-typed.png`);
await input.press('Enter');

log('[8] wait for reply');
let reply = '';
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(2000);
  const state = await page.evaluate(() => {
    const assistant = [...document.querySelectorAll('.justify-start')];
    const last = assistant[assistant.length - 1];
    return last ? last.innerText.slice(0, 400) : '';
  }).catch(() => '');
  if (i % 15 === 14) await shot(`11-streaming.png`);
  reply = state;
  if (state && !/Thinking|Generating|Loading/.test(state) && state.length > 2) {
    // require some stability: same text twice in a row
    const again = await page.evaluate(() => {
      const a = [...document.querySelectorAll('.justify-start')];
      return a.length ? a[a.length - 1].innerText.slice(0, 400) : '';
    });
    if (again === state) break;
  }
}
await page.waitForTimeout(2000);
await shot(`12-final.png`);

const userBubble = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.justify-end')];
  return b.length ? b[b.length - 1].innerText.slice(0, 150) : '(MISSING)';
});
log(`[9] USER BUBBLE: "${userBubble.replace(/\n/g, ' | ')}"`);
log(`[9] ASSISTANT: "${reply.replace(/\n/g, ' | ').slice(0, 200)}"`);

log(`[10] console errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 8).forEach(e => log('   - ' + e));

await browser.close();
log('UI TEST COMPLETE');
process.exit(0);
