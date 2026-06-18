const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(2000);
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('smartlab.html', html);
  await browser.close();
  console.log("Done");
}
main();
