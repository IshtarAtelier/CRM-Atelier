const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  // Click Monofocal first to load the full form
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(3000);
  var btns = await page.$$('button');
  for (var b of btns) { var t = await b.innerText(); if (t.trim() === 'Monofocal') { await b.click(); break; } }
  await page.waitForTimeout(2000);
  // Find ALL select elements and nearby labels
  const selects = await page.evaluate(() => {
    var results = [];
    // Check actual <select> elements
    document.querySelectorAll('select').forEach(el => {
      var opts = Array.from(el.options).map(o => o.text + '=' + o.value);
      var label = '';
      var prev = el.closest('div');
      if (prev) { var lbl = prev.querySelector('label,p,span'); if (lbl) label = lbl.innerText; }
      results.push({ tag: 'select', id: el.id, name: el.name, label: label.trim(), options: opts.slice(0, 10) });
    });
    // Check divs/spans near "Tipo de aro", "Tipo armazón", "Observación"
    var labels = ['Tipo de aro', 'Tipo armazón', 'Observación', 'Tipo teñido', 'Color de teñido'];
    labels.forEach(lbl => {
      var allEls = document.querySelectorAll('label, p, span, div');
      for (var el of allEls) {
        if ((el.innerText || '').trim() === lbl) {
          var parent = el.closest('div');
          if (parent) {
            var inputs = parent.querySelectorAll('input, select, [role="combobox"], [role="listbox"]');
            var siblings = [];
            inputs.forEach(inp => siblings.push({ tag: inp.tagName, id: inp.id, role: inp.getAttribute('role'), type: inp.type }));
            // Also check next sibling div
            var next = parent.nextElementSibling;
            if (next) {
              var ninputs = next.querySelectorAll('input, select, [role="combobox"]');
              ninputs.forEach(inp => siblings.push({ tag: inp.tagName, id: inp.id, role: inp.getAttribute('role'), type: inp.type, loc: 'nextSibling' }));
            }
            results.push({ label: lbl, foundAt: el.tagName, siblings: siblings });
          }
          break;
        }
      }
    });
    // Also look for textareas
    document.querySelectorAll('textarea').forEach(el => {
      results.push({ tag: 'textarea', id: el.id, name: el.name, placeholder: el.placeholder });
    });
    return results;
  });
  console.log(JSON.stringify(selects, null, 2));
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
