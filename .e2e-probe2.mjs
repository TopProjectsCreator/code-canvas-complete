import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/editor', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const skip = page.getByText("Skip, I'll explore").first();
if (await skip.count()) { await skip.click(); await page.waitForTimeout(1000); }
console.log('navigator.onLine =', await page.evaluate(() => navigator.onLine));
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => b.textContent?.includes('Blank Canvas'));
  return btns.map(b => ({ disabled: b.disabled, cls: b.className.slice(0, 60) }));
});
console.log('blank buttons:', JSON.stringify(info));
// try clicking the actual <button>
const btn = page.locator('button:has-text("Blank Canvas")').first();
await btn.click({ timeout: 5000 }).catch(e => console.log('click err:', e.message.slice(0, 100)));
await page.waitForTimeout(4000);
const pickerGone = await page.evaluate(() => !document.body.textContent?.includes('Create a Canvas'));
console.log('picker dismissed:', pickerGone);
console.log('model picker present:', await page.locator('button[aria-label*="Change model"]').count());
await browser.close();
process.exit(0);
