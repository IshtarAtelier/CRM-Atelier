const { chromium } = require('playwright');
const fs = require('fs');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'atelier');
  await page.fill('input[type="password"]', 'Atelier2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(3000);
  
  const domInfo = await page.evaluate(() => {
    // Collect all elements that look like they could be Monofocal buttons
    const buttons = Array.from(document.querySelectorAll('div, span, button')).filter(e => e.innerText && e.innerText.trim() === 'Monofocal').map(e => ({
      tag: e.tagName, className: e.className, text: e.innerText
    }));
    return { buttons };
  });
  
  console.log(JSON.stringify(domInfo, null, 2));
  await browser.close();
}
main().catch(console.error);
