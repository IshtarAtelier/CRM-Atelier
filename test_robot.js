const { chromium } = require('playwright');

// THIS IS THE EXACT BOOKMARKLET CODE - using single quotes in CSS selectors to avoid escaping hell
const BOOKMARKLET_CODE = function(D) {
  var IS = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  var TS = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  function SV(el, v) {
    if (!el) return;
    var s = el.tagName === 'TEXTAREA' ? TS : IS;
    if (s) s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  var done = [];
  // 1. Click lens type
  if (D.tipo_lente) {
    var btns = document.querySelectorAll('button');
    for (var b = 0; b < btns.length; b++) {
      if (btns[b].innerText && btns[b].innerText.trim() === D.tipo_lente) {
        btns[b].click(); done.push('Tipo: ' + D.tipo_lente); break;
      }
    }
  }
  setTimeout(function() {
    // 2. Codigo interno
    var ce = document.getElementById('optical-code-text');
    if (ce && D.codigoInterno) { SV(ce, D.codigoInterno); done.push('Codigo'); }
    // 3. Stock/Lab
    var lt = D.labType || 'STOCK';
    if (lt === 'STOCK') { var ss = document.getElementById('switch-is-stock'); if (ss && !ss.checked) { ss.click(); done.push('Stock'); } }
    else { var sl = document.getElementById('switch-is-laboratory'); if (sl && !sl.checked) { sl.click(); done.push('Lab'); } }
    // 4. Build queue of autocomplete fields
    var Q = [];
    function AQ(id, v, lb, fz) { if (v && v !== '') Q.push({ id: id, val: String(v), label: lb, fuzzy: fz || null }); }
    AQ('right-eye-far-spherical-autocomplete', D.od_esfera, 'Esf OD');
    AQ('left-eye-far-spherical-autocomplete', D.oi_esfera, 'Esf OI');
    AQ('right-eye-far-cylindrical-autocomplete', D.od_cilindro, 'Cil OD');
    AQ('left-eye-far-cylindrical-autocomplete', D.oi_cilindro, 'Cil OI');
    AQ('right-eye-far-axis-autocomplete', D.od_eje, 'Eje OD');
    AQ('left-eye-far-axis-autocomplete', D.oi_eje, 'Eje OI');
    AQ('right-eye-addition-autocomplete', D.od_adicion, 'Add OD');
    AQ('left-eye-addition-autocomplete', D.oi_adicion, 'Add OI');
    AQ('right-eye-interpupillary-distance-autocomplete', D.od_dp, 'DP OD');
    AQ('left-eye-interpupillary-distance-autocomplete', D.oi_dp, 'DP OI');
    AQ('right-eye-pupillary-height-autocomplete', D.od_altura, 'Alt OD');
    AQ('left-eye-pupillary-height-autocomplete', D.oi_altura, 'Alt OI');
    AQ('diameter-autocomplete', D.diametro, 'Diam');
    // Material fuzzy
    var ml = (D.material || '').toLowerCase(), tl = (D.tratamiento || '').toLowerCase(), fz = [];
    if (ml.indexOf('org') > -1) fz.push('org');
    if (ml.indexOf('poli') > -1) fz.push('poli');
    if (ml.indexOf('mineral') > -1) fz.push('mineral');
    if (tl.indexOf('blue') > -1 || tl.indexOf('azul') > -1) fz.push('blue');
    else if (tl.indexOf('foto') > -1 || tl.indexOf('transition') > -1) fz.push('foto');
    else if (tl.indexOf('antirreflejo') > -1 || tl.indexOf('ar') > -1) fz.push('c/ar');
    else if (fz.length > 0) fz.push('blanco');
    if (fz.length > 0 || D.material) AQ('material-autocomplete', D.material || ' ', 'Material', fz.length > 0 ? fz : null);
    // Process queue
    var qi = 0;
    function PN() {
      if (qi >= Q.length) { FU(); return; }
      var it = Q[qi], el = document.getElementById(it.id);
      if (!el) { qi++; PN(); return; }
      el.focus(); el.click();
      SV(el, it.id === 'material-autocomplete' ? ' ' : it.val);
      setTimeout(function() {
        var lb = document.querySelector("[role='listbox']"), pk = false;
        if (lb) {
          var opts = lb.querySelectorAll("[role='option']");
          if (opts.length > 0) {
            if (it.fuzzy && it.fuzzy.length > 0) {
              for (var o = 0; o < opts.length; o++) {
                var ot = (opts[o].innerText || '').toLowerCase(), mc = 0;
                for (var f = 0; f < it.fuzzy.length; f++) if (ot.indexOf(it.fuzzy[f]) > -1) mc++;
                if (mc === it.fuzzy.length) { opts[o].click(); pk = true; break; }
              }
              if (!pk && opts[0]) { opts[0].click(); pk = true; }
            } else {
              for (var o2 = 0; o2 < opts.length; o2++) {
                if ((opts[o2].innerText || '').toLowerCase().indexOf(it.val.toLowerCase()) > -1) { opts[o2].click(); pk = true; break; }
              }
              if (!pk && opts[0]) { opts[0].click(); pk = true; }
            }
          }
        }
        if (!pk) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        el.blur(); done.push(it.label); qi++; setTimeout(PN, 350);
      }, 500);
    }
    PN();
    // Final fields
    function FU() {
      if (D.observaciones) { var oe = document.getElementById('comment-textarea'); if (oe) { SV(oe, D.observaciones); done.push('Obs'); } }
      if (D.armazon) { var fe = document.getElementById('frame-and-model-textarea'); if (fe) { SV(fe, D.armazon); done.push('Armazon'); } }
      if (D.tipo_armazon) {
        var ls = document.querySelectorAll('label,span,p,div,li');
        for (var i = 0; i < ls.length; i++) {
          var t = (ls[i].innerText || '').trim();
          if (t === D.tipo_armazon) { ls[i].click(); done.push('TipoArm'); break; }
        }
      }
      console.log('DONE: ' + done.length + ' fields: ' + done.join(', '));
      alert('Campos completados (' + done.length + '): ' + done.join(', ') + '\n\nRevisa todo antes de Guardar.');
    }
  }, 1200);
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('dialog', async dialog => {
    console.log('ALERT:', dialog.message());
    await dialog.accept();
  });

  // Login
  console.log('1. Logging in...');
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Test data with ALL fields filled
  var testData = {
    tipo_lente: 'Monofocal',
    labType: '',
    codigoInterno: 'Fabian Sosa',
    od_esfera: '+2.75', oi_esfera: '+3.75',
    od_cilindro: '-0.50', oi_cilindro: '-0.75',
    od_eje: '180', oi_eje: '115',
    od_adicion: '', oi_adicion: '',
    od_dp: '31', oi_dp: '32',
    od_altura: '27', oi_altura: '27',
    material: 'Orgánico',
    tratamiento: 'Filtro Azul',
    armazon: 'Armazón Atelier Metal Classic',
    tipo_armazon: 'METALICO',
    observaciones: 'Test desde robot v7',
    diametro: ''
  };

  var encoded = encodeURIComponent(JSON.stringify(testData));
  console.log('2. Going to SmartLab new order...');
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded);
  await page.waitForTimeout(3000);

  console.log('3. Running bookmarklet code...');
  // Execute the bookmarklet function with the test data
  await page.evaluate((dataStr) => {
    var D = JSON.parse(dataStr);
    // ---- BEGIN BOOKMARKLET CODE ----
    var IS = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    var TS = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    function SV(el, v) {
      if (!el) return;
      var s = el.tagName === 'TEXTAREA' ? TS : IS;
      if (s) s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var done = [];
    if (D.tipo_lente) {
      var btns = document.querySelectorAll('button');
      for (var b = 0; b < btns.length; b++) {
        if (btns[b].innerText && btns[b].innerText.trim() === D.tipo_lente) {
          btns[b].click(); done.push('Tipo: ' + D.tipo_lente); break;
        }
      }
    }
    setTimeout(function() {
      var ce = document.getElementById('optical-code-text');
      if (ce && D.codigoInterno) { SV(ce, D.codigoInterno); done.push('Codigo'); }
      var lt = D.labType || 'STOCK';
      if (lt === 'STOCK') { var ss = document.getElementById('switch-is-stock'); if (ss && !ss.checked) { ss.click(); done.push('Stock'); } }
      else { var sl = document.getElementById('switch-is-laboratory'); if (sl && !sl.checked) { sl.click(); done.push('Lab'); } }
      var Q = [];
      function AQ(id, v, lb, fz) { if (v && v !== '') Q.push({ id: id, val: String(v), label: lb, fuzzy: fz || null }); }
      AQ('right-eye-far-spherical-autocomplete', D.od_esfera, 'Esf OD');
      AQ('left-eye-far-spherical-autocomplete', D.oi_esfera, 'Esf OI');
      AQ('right-eye-far-cylindrical-autocomplete', D.od_cilindro, 'Cil OD');
      AQ('left-eye-far-cylindrical-autocomplete', D.oi_cilindro, 'Cil OI');
      AQ('right-eye-far-axis-autocomplete', D.od_eje, 'Eje OD');
      AQ('left-eye-far-axis-autocomplete', D.oi_eje, 'Eje OI');
      AQ('right-eye-addition-autocomplete', D.od_adicion, 'Add OD');
      AQ('left-eye-addition-autocomplete', D.oi_adicion, 'Add OI');
      AQ('right-eye-interpupillary-distance-autocomplete', D.od_dp, 'DP OD');
      AQ('left-eye-interpupillary-distance-autocomplete', D.oi_dp, 'DP OI');
      AQ('right-eye-pupillary-height-autocomplete', D.od_altura, 'Alt OD');
      AQ('left-eye-pupillary-height-autocomplete', D.oi_altura, 'Alt OI');
      AQ('diameter-autocomplete', D.diametro, 'Diam');
      var ml = (D.material || '').toLowerCase(), tl = (D.tratamiento || '').toLowerCase(), fz = [];
      if (ml.indexOf('org') > -1) fz.push('org');
      if (ml.indexOf('poli') > -1) fz.push('poli');
      if (ml.indexOf('mineral') > -1) fz.push('mineral');
      if (tl.indexOf('blue') > -1 || tl.indexOf('azul') > -1) fz.push('blue');
      else if (tl.indexOf('foto') > -1 || tl.indexOf('transition') > -1) fz.push('foto');
      else if (tl.indexOf('antirreflejo') > -1 || tl.indexOf('ar') > -1) fz.push('c/ar');
      else if (fz.length > 0) fz.push('blanco');
      if (fz.length > 0 || D.material) AQ('material-autocomplete', D.material || ' ', 'Material', fz.length > 0 ? fz : null);
      var qi = 0;
      function PN() {
        if (qi >= Q.length) { FU(); return; }
        var it = Q[qi], el = document.getElementById(it.id);
        if (!el) { qi++; PN(); return; }
        el.focus(); el.click();
        SV(el, it.id === 'material-autocomplete' ? ' ' : it.val);
        setTimeout(function() {
          var lb = document.querySelector("[role='listbox']"), pk = false;
          if (lb) {
            var opts = lb.querySelectorAll("[role='option']");
            if (opts.length > 0) {
              if (it.fuzzy && it.fuzzy.length > 0) {
                for (var o = 0; o < opts.length; o++) {
                  var ot = (opts[o].innerText || '').toLowerCase(), mc = 0;
                  for (var f = 0; f < it.fuzzy.length; f++) if (ot.indexOf(it.fuzzy[f]) > -1) mc++;
                  if (mc === it.fuzzy.length) { opts[o].click(); pk = true; break; }
                }
                if (!pk && opts[0]) { opts[0].click(); pk = true; }
              } else {
                for (var o2 = 0; o2 < opts.length; o2++) {
                  if ((opts[o2].innerText || '').toLowerCase().indexOf(it.val.toLowerCase()) > -1) { opts[o2].click(); pk = true; break; }
                }
                if (!pk && opts[0]) { opts[0].click(); pk = true; }
              }
            }
          }
          if (!pk) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          el.blur(); done.push(it.label); qi++; setTimeout(PN, 350);
        }, 500);
      }
      PN();
      function FU() {
        if (D.observaciones) { var oe = document.getElementById('comment-textarea'); if (oe) { SV(oe, D.observaciones); done.push('Obs'); } }
        if (D.armazon) { var fe = document.getElementById('frame-and-model-textarea'); if (fe) { SV(fe, D.armazon); done.push('Armazon'); } }
        if (D.tipo_armazon) {
          var ls = document.querySelectorAll('label,span,p,div,li');
          for (var i = 0; i < ls.length; i++) {
            var t = (ls[i].innerText || '').trim();
            if (t === D.tipo_armazon) { ls[i].click(); done.push('TipoArm'); break; }
          }
        }
        console.log('DONE: ' + done.length + ' fields: ' + done.join(', '));
      }
    }, 1200);
    // ---- END BOOKMARKLET CODE ----
  }, JSON.stringify(testData));

  // Wait for all timeouts to complete
  await page.waitForTimeout(15000);

  // Take screenshots
  await page.screenshot({ path: '/tmp/robot_test_top.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/robot_test_mid.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/robot_test_bottom.png', fullPage: false });

  await browser.close();
  console.log('DONE - check screenshots');
}
main().catch(e => { console.error(e); process.exit(1); });
