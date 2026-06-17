const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  // Login
  console.log("1. Logging in...");
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Test data with ALL new fields
  var testData = {
    tipo_lente: "Monofocal",
    labType: "STOCK",
    codigoInterno: "Fabian Sosa",
    paciente_fullname: "Fabian Sosa",
    od_esfera: "+2.75",
    oi_esfera: "+3.75",
    od_cilindro: "-0.50",
    oi_cilindro: "-0.75",
    od_eje: "180",
    oi_eje: "115",
    od_dp: "31",
    oi_dp: "32",
    od_altura: "27",
    oi_altura: "27",
    material: "Orgánico",
    tratamiento: "Filtro Azul",
    armazon: "Armazón Atelier Metal Classic",
    tipo_aro: "Aro completo",
    tipo_armazon: "METALICO"
  };

  var encoded = encodeURIComponent(JSON.stringify(testData));
  var url = 'https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded;

  console.log("2. Going to new order page...");
  await page.goto(url);
  await page.waitForTimeout(4000);

  console.log("3. Running bookmarklet...");
  
  // Run the FULL bookmarklet logic step by step with logging
  await page.evaluate(() => {
    window._debugLog = [];
    window._dl = function(msg) { window._debugLog.push(msg); console.log('DBG: ' + msg); };
  });

  await page.evaluate(() => {
    try {
      var h = window.location.hash;
      var idx = h.indexOf('ATELIER_DATA=');
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

      // Click Monofocal
      var btns = document.querySelectorAll('button');
      for (var b = 0; b < btns.length; b++) {
        if (btns[b].innerText && btns[b].innerText.trim() === D.tipo_lente) {
          btns[b].click();
          console.log('CLICKED tipo_lente: ' + D.tipo_lente);
          break;
        }
      }

      setTimeout(function() {
        // Click "Nuevo Paciente (Opcional)"
        var allBtns = document.querySelectorAll('button');
        var clickedNewPat = false;
        for (var nb = 0; nb < allBtns.length; nb++) {
          var btnTxt = allBtns[nb].innerText || '';
          if (btnTxt.indexOf('Nuevo Paciente') > -1) {
            allBtns[nb].click();
            clickedNewPat = true;
            console.log('CLICKED Nuevo Paciente button');
            break;
          }
        }
        if (!clickedNewPat) console.log('ERROR: Nuevo Paciente button NOT FOUND');

        // Codigo interno
        var ce = document.getElementById('optical-code-text');
        if (ce) { SV(ce, D.codigoInterno); console.log('SET codigo interno'); }
        else console.log('ERROR: optical-code-text NOT FOUND');

        // Stock
        var ss = document.getElementById('switch-is-stock');
        if (ss) { if (!ss.checked) ss.click(); console.log('SET stock'); }
        else console.log('ERROR: switch-is-stock NOT FOUND');

        setTimeout(function() {
          // After "Nuevo Paciente" click, look for name input
          var allInputs = document.querySelectorAll('input[type="text"]');
          console.log('Found ' + allInputs.length + ' text inputs after Nuevo Paciente click');
          
          // Print all labels near inputs
          allInputs.forEach(function(inp, i) {
            var par = inp.closest('div');
            var lbl = par ? par.querySelector('label') : null;
            var lblText = lbl ? lbl.innerText : 'no-label';
            console.log('  Input[' + i + ']: id=' + inp.id + ' label="' + lblText + '" placeholder="' + (inp.placeholder||'') + '"');
          });

          // Try material
          var matEl = document.getElementById('material-autocomplete');
          if (matEl) {
            console.log('FOUND material-autocomplete');
            matEl.focus();
            matEl.click();
            SV(matEl, ' ');
            setTimeout(function() {
              var lb = document.querySelector('[role="listbox"]');
              if (lb) {
                var opts = lb.querySelectorAll('[role="option"]');
                console.log('Material listbox has ' + opts.length + ' options:');
                for (var o = 0; o < Math.min(opts.length, 10); o++) {
                  console.log('  Option[' + o + ']: ' + opts[o].innerText);
                }
                // Try fuzzy match for "org" + "blanco" or "org" + "blue"
                var fz = ['org'];
                if (D.tratamiento && D.tratamiento.toLowerCase().indexOf('azul') > -1) fz.push('blue');
                else fz.push('blanco');
                console.log('Fuzzy terms: ' + JSON.stringify(fz));
                
                for (var o2 = 0; o2 < opts.length; o2++) {
                  var ot = (opts[o2].innerText || '').toLowerCase();
                  var mc = 0;
                  for (var f = 0; f < fz.length; f++) {
                    if (ot.indexOf(fz[f]) > -1) mc++;
                  }
                  if (mc === fz.length) {
                    console.log('MATCHED material: ' + opts[o2].innerText);
                    opts[o2].click();
                    break;
                  }
                }
              } else {
                console.log('ERROR: No material listbox appeared');
              }
              matEl.blur();

              // Try tipo_aro
              var labels = document.querySelectorAll('label, span, p');
              console.log('Looking for "Aro completo" in ' + labels.length + ' labels');
              for (var l = 0; l < labels.length; l++) {
                var lt = (labels[l].innerText || '').trim();
                if (lt === 'Aro completo' || lt.toLowerCase().indexOf('aro completo') > -1) {
                  console.log('FOUND Aro completo at label[' + l + ']');
                  labels[l].click();
                  break;
                }
              }

              // Try tipo_armazon
              for (var l2 = 0; l2 < labels.length; l2++) {
                var lt2 = (labels[l2].innerText || '').trim();
                if (lt2 === 'METALICO' || lt2 === 'PLÁSTICO') {
                  console.log('FOUND tipo_armazon: ' + lt2);
                  labels[l2].click();
                  break;
                }
              }

              // Armazon y Modelo
              var fe = document.getElementById('frame-and-model-textarea');
              if (fe) { SV(fe, D.armazon); console.log('SET armazon'); }
              else console.log('ERROR: frame-and-model-textarea NOT FOUND');

            }, 800);
          } else {
            console.log('ERROR: material-autocomplete NOT FOUND');
          }
        }, 1000);
      }, 1500);
    } catch(e) {
      console.log('EXCEPTION: ' + e.message);
    }
  });

  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'test_full_before_scroll.png', fullPage: false });
  
  // Scroll down to see more
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_full_after_scroll.png', fullPage: false });
  
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test_full_bottom.png', fullPage: false });

  await browser.close();
  console.log("Done!");
}
main().catch(e => { console.error(e); process.exit(1); });
