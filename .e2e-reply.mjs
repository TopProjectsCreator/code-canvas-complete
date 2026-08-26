import { chromium } from 'playwright';
import fs from 'node:fs';
const SHOTS = '/home/runner/workspace/screenshots/e2e';
const log = (s) => { fs.appendFileSync('/tmp/opencode/uitest/reply.log', s + '\n'); console.log(s); };
fs.writeFileSync('/tmp/opencode/uitest/reply.log', '');

const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 150)));

log('[1] open editor (persistent profile -> model cached)');
await page.goto('http://127.0.0.1:4173/editor', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(6000);
const skip = page.getByText("Skip, I'll explore").first();
if (await skip.count()) await skip.first().evaluate(el => el.click()).catch(() => {});
await page.waitForTimeout(1000);
const blank = page.locator('button:has-text("Blank Canvas")').first();
if (await blank.count()) await blank.evaluate(el => el.click()).catch(() => {});
await page.waitForTimeout(4000);
await page.locator('[aria-label="Toggle AI chat"]').first().evaluate(el => el.click()).catch(() => {});
await page.waitForTimeout(2500);

// model picker -> offline section should list Gemma as Downloaded; select it
log('[2] select Gemma 3 270M (already downloaded)');
await page.locator('button[aria-label*="Change model"]').first().evaluate(el => el.click());
await page.waitForTimeout(1500);
const row = page.getByText('Gemma 3 270M').first();
await row.evaluate(el => el.click());
await page.waitForTimeout(2000);

log('[3] send message');
const before = await page.evaluate(() => document.querySelectorAll('.justify-start').length);
const input = page.locator('textarea[placeholder*="Ask"]').first();
await input.fill('Use ask_prompt to ask me what the file should be named');
await input.press('Enter');
log(`    sent (assistant bubbles before: ${before})`);

let reply = ''; let newCount = before;
for (let i = 0; i < 240; i++) {
  await page.waitForTimeout(2000);
  const s = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.justify-start')];
    return { n: a.length, last: a.length ? a[a.length - 1].innerText.slice(0, 500) : '' };
  }).catch(() => ({ n: before, last: '' }));
  if (s.n > before) { newCount = s.n; reply = s.last; }
  if (i % 30 === 29) log(`    ...waiting (${Math.round(i * 2)}s), bubbles=${s.n}, len=${s.last.length}`);
  // done when a NEW bubble exists, mentions ask_prompt or has 80+ chars, and stable across 3 polls
  if (s.n > before && s.last.length > 80) {
    const again = await page.evaluate(() => {
      const a = [...document.querySelectorAll('.justify-start')];
      return a.length ? a[a.length - 1].innerText.slice(0, 500) : '';
    });
    if (again === s.last) { reply = again; break; }
  }
}
log(`[4] NEW ASSISTANT BUBBLES: ${newCount - before}`);
log(`[4] REPLY (first 500 chars):\n${reply}`);
const userB = await page.evaluate(() => { const b = [...document.querySelectorAll('.justify-end')]; return b.length ? b[b.length - 1].innerText.slice(0, 100) : 'MISSING'; });
log(`[4] USER BUBBLE: "${userB}"`);
log(`[4] page errors: ${errs.length}`);
try { await page.screenshot({ path: `${SHOTS}/13-reply-final.png`, timeout: 120000 }); } catch {}
await browser.close();
log('REPLY TEST COMPLETE');
process.exit(0);
