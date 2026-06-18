const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('dialog', async dialog => { console.log('DIALOG:', dialog.message()); await dialog.dismiss(); });

  // Login
  console.log('=== LOGIN ===');
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // Navigate
  console.log('=== NAVIGATE ===');
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

  // Click Monofocal first to load the form fully
  await page.evaluate(() => {
    var btns = document.querySelectorAll('button');
    for (var b = 0; b < btns.length; b++) {
      if (btns[b].innerText && btns[b].innerText.trim() === 'Monofocal') {
        btns[b].click(); break;
      }
    }
  });
  await page.waitForTimeout(2000);

  // Deep DOM exploration for dropdowns
  console.log('\n=== DEEP DOM EXPLORATION ===');
  await page.evaluate(() => {
    // Find all labels and their associated form elements
    var labels = document.querySelectorAll('label');
    console.log('=== ALL LABELS ===');
    labels.forEach((l, i) => {
      var txt = (l.innerText || '').trim();
      if (!txt) return;
      // Find closest parent with an id
      var parent = l.parentElement;
      var parentInfo = '';
      while (parent && !parent.id) parent = parent.parentElement;
      if (parent) parentInfo = 'parent_id=' + parent.id;
      
      // Find sibling elements
      var container = l.parentElement;
      var siblings = container ? Array.from(container.children).map(c => c.tagName + (c.id ? '#' + c.id : '') + (c.getAttribute('role') ? '[role=' + c.getAttribute('role') + ']' : '')).join(', ') : 'none';
      
      console.log('Label[' + i + ']: "' + txt + '" ' + parentInfo + ' siblings=[' + siblings + ']');
    });

    // Specifically explore combobox DIVs
    console.log('\n=== COMBOBOX DIVs (dropdowns) ===');
    var comboboxDivs = document.querySelectorAll('div[role="combobox"]');
    comboboxDivs.forEach((cb, i) => {
      var label = cb.closest('div')?.querySelector('label') || cb.parentElement?.querySelector('label');
      var labelText = 'no-label';
      // Search up for label
      var p = cb.parentElement;
      for (var j = 0; j < 5 && p; j++) {
        var lbl = p.querySelector('label');
        if (lbl) { labelText = lbl.innerText.trim(); break; }
        p = p.parentElement;
      }
      console.log('ComboboxDiv[' + i + ']: id=' + cb.id + ' label="' + labelText + '" text="' + (cb.innerText || '').trim().substring(0, 30) + '"');
    });

    // Now try clicking frame-type-select to see what options appear
    console.log('\n=== EXPLORING frame-type-select (Tipo armazón?) ===');
    var frameTypeEl = document.getElementById('frame-type-select');
    if (frameTypeEl) {
      console.log('frame-type-select found! tag=' + frameTypeEl.tagName + ' role=' + frameTypeEl.getAttribute('role'));
      console.log('  innerHTML preview: ' + frameTypeEl.innerHTML.substring(0, 200));
      console.log('  innerText: "' + (frameTypeEl.innerText || '').trim() + '"');
      
      // Find label above it
      var container = frameTypeEl.closest('div');
      while (container) {
        var lbl = container.querySelector('label');
        if (lbl && lbl.innerText.trim()) {
          console.log('  Associated label: "' + lbl.innerText.trim() + '"');
          break;
        }
        container = container.parentElement;
      }
    }
  });

  // Try clicking the frame-type-select dropdown
  console.log('\n=== CLICKING frame-type-select ===');
  const frameType = await page.$('#frame-type-select');
  if (frameType) {
    await frameType.click();
    await page.waitForTimeout(1000);
    
    // Check what listbox appeared
    await page.evaluate(() => {
      var listboxes = document.querySelectorAll('[role="listbox"]');
      console.log('Listboxes after clicking frame-type-select: ' + listboxes.length);
      listboxes.forEach((lb, i) => {
        var opts = lb.querySelectorAll('[role="option"]');
        console.log('  Listbox[' + i + '] options (' + opts.length + '):');
        opts.forEach((o, j) => {
          console.log('    opt[' + j + ']: "' + (o.innerText || '').trim() + '" data-value=' + o.getAttribute('data-value'));
        });
      });
    });
    
    // Close by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Now find the Tipo de aro dropdown
  console.log('\n=== FINDING TIPO DE ARO DROPDOWN ===');
  await page.evaluate(() => {
    // Look for all elements near "Tipo de aro" label
    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].innerText.trim() === 'Tipo de aro') {
        console.log('Found "Tipo de aro" label');
        var parent = labels[i].parentElement;
        console.log('Parent tag: ' + parent.tagName + ' id: ' + (parent.id || 'none'));
        console.log('Parent children:');
        Array.from(parent.children).forEach((c, j) => {
          console.log('  child[' + j + ']: ' + c.tagName + ' id=' + (c.id || 'none') + ' role=' + (c.getAttribute('role') || 'none') + ' text="' + (c.innerText || '').trim().substring(0, 30) + '"');
        });
        // Check grandparent
        var gp = parent.parentElement;
        if (gp) {
          console.log('Grandparent: ' + gp.tagName + ' id=' + (gp.id || 'none'));
          // Look for combobox in siblings
          var siblings = gp.querySelectorAll('[role="combobox"]');
          console.log('Comboboxes near Tipo de aro: ' + siblings.length);
          siblings.forEach((s, j) => {
            console.log('  combobox[' + j + ']: id=' + (s.id || 'none') + ' tag=' + s.tagName);
          });
        }
        break;
      }
    }
  });

  // Look for ALL select-like elements by exploring the structure near known dropdowns
  console.log('\n=== EXPLORING ALL DROPDOWN SELECTS ===');
  await page.evaluate(() => {
    var targetLabels = ['Tipo de aro', 'Tipo armazón', 'Altura Pupilar Ojo Derecho', 'Altura Pupilar Ojo Izquierdo'];
    targetLabels.forEach(targetLabel => {
      var labels = document.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].innerText.trim() === targetLabel) {
          var parent = labels[i].parentElement;
          // Find the closest select/combobox
          var selects = parent.querySelectorAll('select, [role="combobox"], [role="listbox"]');
          console.log('"' + targetLabel + '": ' + selects.length + ' selects/comboboxes');
          selects.forEach((s, j) => {
            console.log('  [' + j + ']: tag=' + s.tagName + ' id=' + (s.id || 'none') + ' role=' + (s.getAttribute('role') || 'none'));
          });
          // Also check parent's parent
          var gp = parent.parentElement;
          if (gp) {
            var gpSelects = gp.querySelectorAll('select, [role="combobox"]');
            if (gpSelects.length > selects.length) {
              console.log('  (grandparent has more: ' + gpSelects.length + ')');
              gpSelects.forEach((s, j) => {
                console.log('    gp[' + j + ']: tag=' + s.tagName + ' id=' + (s.id || 'none'));
              });
            }
          }
          break;
        }
      }
    });
  });

  // Now test clicking "Tipo de aro" to find its dropdown mechanism
  console.log('\n=== CLICKING NEAR TIPO DE ARO ===');
  // Find by clicking the element after the label
  await page.evaluate(() => {
    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].innerText.trim() === 'Tipo de aro') {
        var parent = labels[i].parentElement;
        // Click the first div[role=combobox] in parent or siblings
        var cb = parent.querySelector('[role="combobox"]');
        if (!cb) {
          // Look wider
          var allDivs = parent.querySelectorAll('div');
          for (var d = 0; d < allDivs.length; d++) {
            if (allDivs[d].getAttribute('role') === 'combobox' || allDivs[d].classList.contains('MuiSelect-select')) {
              cb = allDivs[d]; break;
            }
          }
        }
        if (cb) {
          console.log('Found Tipo de aro combobox: id=' + (cb.id || 'none'));
          cb.click();
        } else {
          console.log('No combobox found for Tipo de aro, trying to click label parent');
          // Maybe there's a select element?
          var selectEl = parent.querySelector('select');
          if (selectEl) {
            console.log('Found select: id=' + (selectEl.id || 'none'));
          }
          // Try MUI-style approach - look for div with aria-haspopup
          var hasPopup = parent.querySelector('[aria-haspopup]');
          if (hasPopup) {
            console.log('Found aria-haspopup: id=' + (hasPopup.id || 'none') + ' tag=' + hasPopup.tagName);
            hasPopup.click();
          }
        }
        break;
      }
    }
  });
  await page.waitForTimeout(1000);

  // Check for listbox
  await page.evaluate(() => {
    var listboxes = document.querySelectorAll('[role="listbox"]');
    console.log('Listboxes after Tipo de aro click: ' + listboxes.length);
    listboxes.forEach((lb, i) => {
      var opts = lb.querySelectorAll('[role="option"]');
      console.log('  Listbox[' + i + '] options (' + opts.length + '):');
      opts.forEach((o, j) => {
        console.log('    opt[' + j + ']: "' + (o.innerText || '').trim() + '"');
      });
    });
    // Also check for MUI Popper/Paper
    var papers = document.querySelectorAll('.MuiPaper-root ul, .MuiMenu-paper, .MuiPopover-paper');
    console.log('MUI Papers: ' + papers.length);
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Check the Tipo armazon label relationship
  console.log('\n=== TIPO ARMAZON STRUCTURE ===');
  await page.evaluate(() => {
    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      if (labels[i].innerText.trim() === 'Tipo armazón') {
        var parent = labels[i].parentElement;
        console.log('Tipo armazón parent: ' + parent.tagName + ' id=' + (parent.id || 'none'));
        console.log('Full parent HTML (first 500 chars): ' + parent.innerHTML.substring(0, 500));
        break;
      }
    }
  });

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
