const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(3000);

  const btns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(t => t.length > 0);
  });
  console.log(btns);
  await browser.close();
}
main().catch(console.error);
