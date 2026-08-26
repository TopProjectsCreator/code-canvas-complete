import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
page.on('pageerror', e => console.log('PAGE-ERR:', String(e).slice(0, 160)));
page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('URL:', page.url()); });

await page.goto('http://127.0.0.1:4173/editor', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const skip = page.getByText("Skip, I'll explore").first();
if (await skip.count()) { await skip.click(); await page.waitForTimeout(1200); }
console.log('URL after skip:', page.url());

const blank = page.getByText('Blank Canvas').first();
console.log('blank count:', await blank.count());
if (await blank.count()) {
  // click the card container (parent of the text) like a real user would
  await blank.click();
  console.log('clicked Blank Canvas text');
  await page.waitForTimeout(3000);
  console.log('URL after click:', page.url());
  // try clicking parent card if still here
  if (page.url().includes('editor')) {
    const card = page.locator('div.cursor-pointer', { hasText: 'Blank Canvas' }).first();
    console.log('card-div count:', await card.count());
    if (await card.count()) { await card.click({ position: { x: 100, y: 100 } }); console.log('clicked card div'); }
    await page.waitForTimeout(5000);
    console.log('URL final:', page.url());
  }
}
// what's visible now?
const btns = await page.locator('button[aria-label*="Change model"]').count();
console.log('model-picker count:', btns);
await page.screenshot({ path: '/home/runner/workspace/screenshots/e2e/probe.png' });
await browser.close();
process.exit(0);
