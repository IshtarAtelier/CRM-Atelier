const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('dialog', async dialog => { console.log('DIALOG:', dialog.message()); await dialog.dismiss(); });

  // Login
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  const testData = {
    tipo_lente: 'Monofocal', labType: 'STOCK', codigoInterno: 'Fabian Sosa',
    od_esfera: '+2.75', oi_esfera: '+3.75', od_cilindro: '-0.50', oi_cilindro: '-0.75',
    od_eje: '180', oi_eje: '115', od_dp: '31', oi_dp: '32',
    od_altura: '27', oi_altura: '27', material: 'Orgánico', tratamiento: 'Filtro Azul',
    armazon: 'Armazón Atelier Metal Classic', tipo_aro: 'Aro completo',
    tipo_armazon: 'METALICO', observaciones: 'Test v6'
  };
  const encoded = encodeURIComponent(JSON.stringify(testData));
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded);
  await page.waitForTimeout(4000);

  // Click Monofocal
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => {
      if (b.innerText?.trim() === 'Monofocal') b.click();
    });
  });
  await page.waitForTimeout(2000);

  // === TEST 1: Click frame-type-select (Tipo de aro) ===
  console.log('\n=== TEST: TIPO DE ARO (frame-type-select) ===');
  await page.click('#frame-type-select');
  await page.waitForTimeout(1500);
  
  // Check all possible popup elements
  await page.evaluate(() => {
    // Check role=listbox
    var lbs = document.querySelectorAll('[role="listbox"]');
    console.log('role=listbox elements: ' + lbs.length);
    lbs.forEach((lb, i) => {
      var opts = lb.querySelectorAll('[role="option"], li');
      console.log('  listbox[' + i + '] id=' + (lb.id || 'none') + ' opts=' + opts.length);
      opts.forEach((o, j) => {
        console.log('    opt[' + j + ']: text="' + (o.innerText || '').trim() + '" data-value=' + o.getAttribute('data-value') + ' value=' + o.getAttribute('value'));
      });
    });
    
    // Check role=presentation (MUI popover backdrop)
    var presentations = document.querySelectorAll('[role="presentation"]');
    console.log('role=presentation elements: ' + presentations.length);
    presentations.forEach((p, i) => {
      var ul = p.querySelector('ul');
      if (ul) {
        var lis = ul.querySelectorAll('li');
        console.log('  presentation[' + i + '] has UL with ' + lis.length + ' LIs');
        lis.forEach((li, j) => {
          console.log('    li[' + j + ']: text="' + (li.innerText || '').trim() + '" data-value=' + li.getAttribute('data-value') + ' role=' + (li.getAttribute('role') || 'none'));
        });
      }
    });
    
    // Check MuiMenu/MuiPopover
    var menus = document.querySelectorAll('.MuiMenu-list, .MuiList-root');
    console.log('MUI menu lists: ' + menus.length);
    menus.forEach((m, i) => {
      var items = m.querySelectorAll('li, [role="option"], [role="menuitem"]');
      console.log('  menu[' + i + ']: ' + items.length + ' items, role=' + (m.getAttribute('role') || 'none'));
      items.forEach((item, j) => {
        console.log('    item[' + j + ']: text="' + (item.innerText || '').trim() + '" data-value=' + item.getAttribute('data-value'));
      });
    });
  });
  
  await page.screenshot({ path: 'test_dropdown_aro.png', fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // === TEST 2: Click pupillary-height-right-eye-select (Tipo armazón) ===
  console.log('\n=== TEST: TIPO ARMAZÓN (pupillary-height-right-eye-select) ===');
  // First scroll down to make it visible
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(500);
  
  await page.click('#pupillary-height-right-eye-select');
  await page.waitForTimeout(1500);
  
  await page.evaluate(() => {
    var lbs = document.querySelectorAll('[role="listbox"]');
    console.log('role=listbox elements: ' + lbs.length);
    lbs.forEach((lb, i) => {
      var opts = lb.querySelectorAll('[role="option"], li');
      console.log('  listbox[' + i + '] opts=' + opts.length);
      opts.forEach((o, j) => {
        console.log('    opt[' + j + ']: text="' + (o.innerText || '').trim() + '" data-value=' + o.getAttribute('data-value'));
      });
    });
    
    var menus = document.querySelectorAll('.MuiMenu-list, .MuiList-root');
    console.log('MUI menus: ' + menus.length);
    menus.forEach((m, i) => {
      var items = m.querySelectorAll('li');
      console.log('  menu[' + i + ']: ' + items.length + ' items');
      items.forEach((item, j) => {
        console.log('    item[' + j + ']: "' + (item.innerText || '').trim() + '" data-value=' + item.getAttribute('data-value'));
      });
    });
  });
  
  await page.screenshot({ path: 'test_dropdown_armazon.png', fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // === TEST 3: Check the hidden select/input element that MUI uses ===
  console.log('\n=== TEST: HIDDEN INPUT/SELECT ELEMENTS ===');
  await page.evaluate(() => {
    // MUI Select uses a hidden <input> element
    var hiddenInputs = document.querySelectorAll('input[type="hidden"], input[name]');
    console.log('Hidden/named inputs: ' + hiddenInputs.length);
    hiddenInputs.forEach((inp, i) => {
      console.log('  input[' + i + ']: name=' + (inp.name || 'none') + ' id=' + (inp.id || 'none') + ' type=' + inp.type + ' value="' + inp.value + '"');
    });
    
    // Check for native select elements
    var selects = document.querySelectorAll('select');
    console.log('Native selects: ' + selects.length);
    
    // Check the aria-controls on the combobox to find the listbox id
    var frameType = document.getElementById('frame-type-select');
    if (frameType) {
      console.log('frame-type-select aria-controls: ' + frameType.getAttribute('aria-controls'));
      console.log('frame-type-select aria-expanded: ' + frameType.getAttribute('aria-expanded'));
      console.log('frame-type-select aria-labelledby: ' + frameType.getAttribute('aria-labelledby'));
    }
    var pupillary = document.getElementById('pupillary-height-right-eye-select');
    if (pupillary) {
      console.log('pupillary-height-right-eye-select aria-controls: ' + pupillary.getAttribute('aria-controls'));
      console.log('pupillary-height-right-eye-select aria-expanded: ' + pupillary.getAttribute('aria-expanded'));
    }
  });

  // === TEST 4: Try programmatic MUI Select interaction ===
  console.log('\n=== TEST: PROGRAMMATIC MUI SELECT ===');
  // For MUI Select, we need to use mousedown event
  await page.evaluate(() => {
    var el = document.getElementById('frame-type-select');
    if (el) {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      console.log('Dispatched mousedown on frame-type-select');
    }
  });
  await page.waitForTimeout(1500);
  
  await page.evaluate(() => {
    var lbs = document.querySelectorAll('[role="listbox"]');
    console.log('After mousedown - listboxes: ' + lbs.length);
    lbs.forEach((lb, i) => {
      var opts = lb.querySelectorAll('[role="option"], li');
      console.log('  listbox[' + i + '] opts=' + opts.length + ' id=' + (lb.id || 'none'));
      opts.forEach((o, j) => {
        console.log('    opt[' + j + ']: "' + (o.innerText || '').trim() + '" data-value=' + o.getAttribute('data-value'));
      });
    });
    
    // Also check all UL elements
    var allULs = document.querySelectorAll('ul');
    allULs.forEach((ul, i) => {
      var role = ul.getAttribute('role') || 'none';
      if (role === 'listbox' || role === 'menu') {
        var items = ul.querySelectorAll('li');
        console.log('UL[' + i + '] role=' + role + ' items=' + items.length);
        items.forEach((li, j) => {
          if (j < 5) console.log('  li[' + j + ']: "' + (li.innerText || '').trim() + '"');
        });
      }
    });
  });
  
  await page.screenshot({ path: 'test_dropdown_mousedown.png', fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // === TEST 5: Try mousedown on tipo armazon ===
  console.log('\n=== TEST: MOUSEDOWN ON TIPO ARMAZON ===');
  await page.evaluate(() => {
    var el = document.getElementById('pupillary-height-right-eye-select');
    if (el) {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      console.log('Dispatched mousedown on pupillary-height-right-eye-select');
    }
  });
  await page.waitForTimeout(1500);
  
  await page.evaluate(() => {
    var lbs = document.querySelectorAll('[role="listbox"]');
    console.log('After mousedown tipo armazon - listboxes: ' + lbs.length);
    lbs.forEach((lb, i) => {
      var opts = lb.querySelectorAll('[role="option"], li');
      console.log('  listbox[' + i + '] opts=' + opts.length);
      opts.forEach((o, j) => {
        console.log('    opt[' + j + ']: "' + (o.innerText || '').trim() + '"');
      });
    });
  });
  
  await page.screenshot({ path: 'test_dropdown_armazon_mousedown.png', fullPage: false });

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
