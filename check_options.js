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

  const data = await page.evaluate(async () => {
    let results = {};
    
    async function getOptions(lblTxt) {
      var all = document.querySelectorAll('label,span,p');
      var box = null;
      for(var i=0; i<all.length; i++){
        if((all[i].innerText||'').trim() === lblTxt){
          var p = all[i].closest('div');
          if(p){
            box = p.querySelector("[role='combobox']");
            break;
          }
        }
      }
      if(!box) return null;
      box.click();
      await new Promise(r => setTimeout(r, 1000)); // wait for dropdown
      var lb = document.querySelector("[role='listbox']");
      if(!lb) return [];
      var opts = lb.querySelectorAll("[role='option']");
      var texts = Array.from(opts).map(o => o.innerText.trim());
      // Click again or click body to close
      document.body.click();
      await new Promise(r => setTimeout(r, 500));
      return texts;
    }
    
    results.tipo_aro = await getOptions('Tipo de aro');
    results.tipo_armazon = await getOptions('Tipo armazón');
    return results;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}
main().catch(console.error);
