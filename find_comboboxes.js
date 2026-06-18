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
  for (var b of btns) { var t = await b.innerText(); if (t.trim() === 'Monofocal') { await b.click(); break; } }
  await page.waitForTimeout(2000);
  
  const data = await page.evaluate(() => {
    var results = [];
    var labels = Array.from(document.querySelectorAll('label, p, span, div')).filter(el => {
      var t = (el.innerText||'').trim();
      return t === 'Tipo de aro' || t === 'Tipo armazón' || t === 'Observación';
    });
    
    labels.forEach(lbl => {
      var parent = lbl.closest('div');
      // get html of the parent and next sibling to analyze
      results.push({
        text: lbl.innerText.trim(),
        parentHtml: parent ? parent.innerHTML.substring(0, 200) : null,
        nextHtml: parent && parent.nextElementSibling ? parent.nextElementSibling.innerHTML.substring(0, 200) : null
      });
    });
    return results;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}
main().catch(console.error);
