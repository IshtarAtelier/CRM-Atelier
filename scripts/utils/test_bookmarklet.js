const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  console.log("1. Logging in...");
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to new order with test data in hash
  var testData = {
    tipo_lente: "Monofocal",
    labType: "STOCK",
    codigoInterno: "Cliente Test",
    paciente_nombre: "Cliente",
    paciente_apellido: "Test",
    od_esfera: "-1.75",
    oi_esfera: "-2.25",
    od_dp: "32",
    oi_dp: "31",
    material: "Orgánico",
    tratamiento: "Antirreflejo"
  };

  var encoded = encodeURIComponent(JSON.stringify(testData));
  var url = 'https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded;

  console.log("2. Going to new order page with data...");
  await page.goto(url);
  await page.waitForTimeout(4000);

  // Take screenshot before bookmarklet
  await page.screenshot({ path: 'smartlab_before.png' });
  console.log("3. Saved smartlab_before.png");

  // Now inject the bookmarklet code
  console.log("4. Running bookmarklet...");
  await page.evaluate(() => {
    try {
      var h = window.location.hash;
      var idx = h.indexOf('ATELIER_DATA=');
      if (idx < 0) { console.log('NO DATA'); return; }
      var j = decodeURIComponent(h.substring(idx + 13));
      var D = JSON.parse(j);
      var IS = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      var TS = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

      function SV(el, v) {
        if (!el) return;
        var s = el.tagName === 'TEXTAREA' ? TS : IS;
        if (s) s.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Click lens type
      if (D.tipo_lente) {
        var btns = document.querySelectorAll('button');
        for (var b = 0; b < btns.length; b++) {
          if (btns[b].innerText && btns[b].innerText.trim() === D.tipo_lente) {
            btns[b].click();
            console.log('Clicked: ' + D.tipo_lente);
            break;
          }
        }
      }

      // Código interno
      setTimeout(function() {
        var ce = document.getElementById('optical-code-text');
        if (ce) { SV(ce, D.codigoInterno || ''); console.log('Set código interno'); }
        else { console.log('optical-code-text NOT FOUND'); }

        // Stock toggle
        var ss = document.getElementById('switch-is-stock');
        if (ss) { console.log('switch-is-stock found, checked=' + ss.checked); if (!ss.checked) ss.click(); }
        else { console.log('switch-is-stock NOT FOUND'); }

        // Spherical OD
        var odEl = document.getElementById('right-eye-far-spherical-autocomplete');
        if (odEl) {
          odEl.focus(); odEl.click();
          SV(odEl, D.od_esfera);
          console.log('Set Esf OD = ' + D.od_esfera);
          setTimeout(function() {
            var lb = document.querySelector('[role="listbox"]');
            if (lb) {
              var opts = lb.querySelectorAll('[role="option"]');
              console.log('Listbox found with ' + opts.length + ' options');
              for (var o = 0; o < opts.length; o++) {
                if ((opts[o].innerText || '').indexOf(D.od_esfera) > -1) {
                  opts[o].click();
                  console.log('Picked option: ' + opts[o].innerText);
                  break;
                }
              }
            } else {
              console.log('No listbox found after typing');
            }
            odEl.blur();

            // Print all visible input IDs
            var allInputs = document.querySelectorAll('input[id]');
            console.log('--- All visible inputs with IDs ---');
            allInputs.forEach(function(inp) {
              console.log('  id=' + inp.id + ' type=' + inp.type + ' value=' + inp.value);
            });
          }, 600);
        } else {
          console.log('right-eye-far-spherical-autocomplete NOT FOUND');
        }
      }, 1500);
    } catch(e) {
      console.log('ERROR: ' + e.message);
    }
  });

  // Wait for everything to happen
  await page.waitForTimeout(5000);

  // Capture console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  // Take screenshot after
  await page.screenshot({ path: 'smartlab_after.png' });
  console.log("5. Saved smartlab_after.png");

  await browser.close();
  console.log("Done!");
}
main().catch(e => { console.error(e); process.exit(1); });
