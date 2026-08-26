import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGE-ERR:', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:4173/editor', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const skip = page.getByText("Skip, I'll explore").first();
if (await skip.count()) { await skip.click(); await page.waitForTimeout(1000); }

const res = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent?.includes('Blank Canvas'));
  if (!b) return 'no button';
  b.click();
  return 'js-click dispatched';
});
console.log(res);
await page.waitForTimeout(3500);
console.log('picker dismissed:', await page.evaluate(() => !document.body.textContent?.includes('Create a Canvas')));
console.log('model picker present:', await page.locator('button[aria-label*="Change model"]').count());
await page.screenshot({ path: '/home/runner/workspace/screenshots/e2e/probe3.png' });
await browser.close();
process.exit(0);
