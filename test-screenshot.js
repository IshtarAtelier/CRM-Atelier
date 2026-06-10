const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://crm-atelier-production-ae72.up.railway.app/');
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
})();
