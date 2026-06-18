const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  var testData = { tipo_lente: 'Multifocal', labType: '', codigoInterno: 'Test' };
  var encoded = encodeURIComponent(JSON.stringify(testData));
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded);
  await page.waitForTimeout(4000);
  
  // Click "Multifocal" to ensure the fields appear
  await page.click('text="Multifocal"');
  await page.waitForTimeout(2000);
  
  const combos = await page.evaluate(() => {
    let res = [];
    document.querySelectorAll('[role="combobox"]').forEach(c => {
      let label = '';
      let p = c.parentElement;
      while(p && !label) {
        let l = p.querySelector('label, p, span');
        if(l && l.innerText && l.innerText.trim().length > 0) label = l.innerText.trim();
        p = p.parentElement;
      }
      res.push({ id: c.id, label: label, name: c.getAttribute('name') });
    });
    return res;
  });
  
  console.log("COMBOBOXES:");
  console.log(JSON.stringify(combos, null, 2));
  
  const inputs = await page.evaluate(() => {
    let res = [];
    document.querySelectorAll('input').forEach(c => {
      res.push({ id: c.id, type: c.type, name: c.name });
    });
    return res;
  });
  
  console.log("INPUTS:");
  console.log(JSON.stringify(inputs, null, 2));

  await browser.close();
}
main().catch(console.error);
