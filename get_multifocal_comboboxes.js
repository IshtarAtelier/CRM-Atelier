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

  var btns = await page.$$('button');
  for (var b of btns) { var t = await b.innerText(); if (t.trim() === 'Multifocal') { await b.click(); break; } }
  await page.waitForTimeout(2000);

  const combos = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="combobox"], [role="button"][aria-haspopup="listbox"]')).map(el => {
      let label = '';
      let p = el.closest('div').parentElement;
      if (p) label = p.innerText.split('\n')[0];
      return { id: el.id, label: label, classes: el.className };
    });
  });
  console.log(combos);
  await browser.close();
}
main().catch(console.error);
