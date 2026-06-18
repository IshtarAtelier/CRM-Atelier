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
    
    async function getOpts(lblTxt) {
      var all=document.querySelectorAll('label,span,p,div');var box=null;
      for(var i=0;i<all.length;i++){if((all[i].innerText||'').trim().toLowerCase()===lblTxt.toLowerCase()){
        var next=all[i].nextElementSibling;
        if(next){box=next.querySelector("[role='combobox']")||(next.getAttribute('role')==='combobox'?next:null);}
        if(!box){var p=all[i].parentElement;if(p)box=p.querySelector("[role='combobox']");}
        if(!box){var p2=all[i].closest('div');if(p2)box=p2.querySelector("[role='combobox']");}
        if(box)break;
      }}
      if(!box) return null;
      box.click();
      await new Promise(r => setTimeout(r, 1000));
      var lb = document.querySelector("[role='listbox']");
      if(!lb) return "No listbox";
      var opts = Array.from(lb.querySelectorAll("[role='option']")).map(o => o.innerText);
      document.body.click();
      await new Promise(r => setTimeout(r, 500));
      return opts;
    }
    
    results.aro = await getOpts('Tipo de aro');
    results.armazon = await getOpts('Tipo armazón');
    return results;
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}
main().catch(console.error);
