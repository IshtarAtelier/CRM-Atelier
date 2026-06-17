const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'atelier');
  await page.fill('input[type="password"]', 'Atelier2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'smartlab_debug.png' });
  await browser.close();
}
main();
