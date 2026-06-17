const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login first
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate with hash
  var testHash = '#ATELIER_DATA=test123';
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new' + testHash);
  await page.waitForTimeout(3000);

  // Check if hash is preserved
  var currentUrl = page.url();
  var currentHash = await page.evaluate(() => window.location.hash);
  console.log('URL:', currentUrl);
  console.log('Hash:', currentHash);
  console.log('Hash preserved?', currentHash.includes('ATELIER_DATA'));

  await browser.close();
}
main();
