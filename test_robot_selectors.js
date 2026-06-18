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
    let res = {};
    
    function testSelByLabel(lblTxt) {
      var all = document.querySelectorAll('label,span,p');
      var box = null;
      var foundLabel = false;
      var hasParentDiv = false;
      var foundCombobox = false;
      var parentHtml = "";
      
      for(var i=0; i<all.length; i++){
        if((all[i].innerText||'').trim() === lblTxt){
          foundLabel = true;
          var p = all[i].closest('div');
          // Actually, if label is inside a Grid item div, and the input is in the SAME div:
          // But maybe the label is sibling to the input wrapper, so they share a parent div?
          if(p){
            hasParentDiv = true;
            parentHtml = p.innerHTML;
            box = p.querySelector("[role='combobox']");
            if(box) foundCombobox = true;
            break;
          }
        }
      }
      return { foundLabel, hasParentDiv, foundCombobox, parentHtml: parentHtml.substring(0, 300) };
    }
    
    res.tipo_aro = testSelByLabel('Tipo de aro');
    res.tipo_armazon = testSelByLabel('Tipo armazón');
    return res;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}
main().catch(console.error);
