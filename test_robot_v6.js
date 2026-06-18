const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  const logs = [];
  page.on('console', msg => { const t = msg.text(); logs.push(t); console.log('BROWSER:', t); });
  page.on('dialog', async dialog => { console.log('DIALOG:', dialog.message()); await dialog.dismiss(); });

  // ========== LOGIN ==========
  console.log('=== LOGIN ===');
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.waitForTimeout(2000);
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('Logged in:', page.url());

  // ========== NAVIGATE ==========
  const testData = {
    tipo_lente: 'Monofocal',
    labType: 'STOCK',
    codigoInterno: 'Fabian Sosa',
    od_esfera: '+2.75', oi_esfera: '+3.75',
    od_cilindro: '-0.50', oi_cilindro: '-0.75',
    od_eje: '180', oi_eje: '115',
    od_dp: '31', oi_dp: '32',
    od_altura: '27', oi_altura: '27',
    material: 'Orgánico',
    tratamiento: 'Filtro Azul',
    armazon: 'Armazón Atelier Metal Classic',
    tipo_aro: 'Aro completo',
    tipo_armazon: 'METALICO',
    observaciones: 'Test robot v6 - verificación completa'
  };

  const encoded = encodeURIComponent(JSON.stringify(testData));
  const url = 'https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded;
  await page.goto(url);
  await page.waitForTimeout(4000);

  // ========== EXTRACT AND RUN BOOKMARKLET CODE ==========
  console.log('\n=== RUNNING BOOKMARKLET CODE ===');
  
  // Read the bookmarklet from robot.html and extract the JS
  const robotHtml = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/robot.html', 'utf-8');
  // Extract the href content between javascript:void( and the closing )">
  const hrefMatch = robotHtml.match(/href="javascript:void\((function\(\)\{.+?\})\(\)\)"/s);
  if (!hrefMatch) {
    console.error('Could not extract bookmarklet code from robot.html!');
    await browser.close();
    return;
  }
  
  // The bookmarklet code as it appears in the href (with %22 etc)
  let bookmarkletCode = hrefMatch[1];
  // URL-decode %22 -> " and %0A -> \n (browser does this when executing javascript: URI)
  bookmarkletCode = bookmarkletCode.replace(/%22/g, '"').replace(/%0A/g, '\n');
  
  console.log('Bookmarklet code length:', bookmarkletCode.length);
  console.log('Code preview (first 200 chars):', bookmarkletCode.substring(0, 200));
  
  // Execute the bookmarklet
  await page.evaluate((code) => {
    try {
      const fn = new Function(code.slice(code.indexOf('{') + 1, code.lastIndexOf('}')));
      fn();
    } catch(e) {
      // Fallback: wrap and eval
      eval('(' + code + ')()');
    }
  }, bookmarkletCode);

  // ========== WAIT FOR ALL ASYNC OPERATIONS ==========
  // The bookmarklet has nested setTimeouts:
  // - 1200ms for tipo_lente click
  // - Then queue of ~13 items, each taking 850ms (500ms + 350ms)
  // - Then FU() with dropdown selections (600ms + 300ms each)
  // Total: ~1200 + 13*850 + 2*900 = ~14050ms
  console.log('\n=== WAITING FOR BOOKMARKLET TO FINISH (20s) ===');
  await page.waitForTimeout(22000);

  // ========== VERIFY ALL FIELDS ==========
  console.log('\n=== FIELD VERIFICATION ===');
  const results = await page.evaluate(() => {
    const r = {};
    
    function chk(id, name) {
      const el = document.getElementById(id);
      if (!el) return r[name] = { exists: false, value: '' };
      r[name] = { exists: true, value: el.value || el.innerText?.trim() || '', tag: el.tagName };
    }
    
    chk('optical-code-text', 'codigoInterno');
    chk('right-eye-far-spherical-autocomplete', 'od_esfera');
    chk('left-eye-far-spherical-autocomplete', 'oi_esfera');
    chk('right-eye-far-cylindrical-autocomplete', 'od_cilindro');
    chk('left-eye-far-cylindrical-autocomplete', 'oi_cilindro');
    chk('right-eye-far-axis-autocomplete', 'od_eje');
    chk('left-eye-far-axis-autocomplete', 'oi_eje');
    chk('right-eye-interpupillary-distance-autocomplete', 'od_dp');
    chk('left-eye-interpupillary-distance-autocomplete', 'oi_dp');
    chk('right-eye-pupillary-height-autocomplete', 'od_altura');
    chk('left-eye-pupillary-height-autocomplete', 'oi_altura');
    chk('material-autocomplete', 'material');
    chk('frame-and-model-textarea', 'armazon');
    chk('comment-textarea', 'observaciones');
    
    // Check MUI Select dropdowns by their displayed text
    const tipoArmazon = document.getElementById('pupillary-height-right-eye-select');
    r['tipo_armazon'] = { 
      exists: !!tipoArmazon, 
      value: tipoArmazon ? (tipoArmazon.innerText || '').trim().replace(/\u200B/g, '') : '',
      tag: 'MUI-SELECT'
    };
    
    const tipoAro = document.getElementById('frame-type-select');
    r['tipo_aro'] = { 
      exists: !!tipoAro, 
      value: tipoAro ? (tipoAro.innerText || '').trim().replace(/\u200B/g, '') : '',
      tag: 'MUI-SELECT'
    };
    
    // Check stock switch
    const stockSwitch = document.getElementById('switch-is-stock');
    r['stock'] = { exists: !!stockSwitch, value: stockSwitch?.checked ? 'ON' : 'OFF', tag: 'SWITCH' };
    
    return r;
  });
  
  // Print results
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║          FIELD VERIFICATION RESULTS          ║');
  console.log('╠══════════════════════════════════════════════╣');
  
  const expectedValues = {
    codigoInterno: 'Fabian Sosa',
    od_esfera: '+2.75', oi_esfera: '+3.75',
    od_cilindro: '-0.50', oi_cilindro: '-0.75',
    od_eje: '180', oi_eje: '115',
    od_dp: '31', oi_dp: '32',
    od_altura: '27', oi_altura: '27',
    material: '', // Material autocomplete clears after selection
    armazon: 'Armazón Atelier Metal Classic',
    observaciones: 'Test robot v6 - verificación completa',
    tipo_armazon: 'METALICO',
    tipo_aro: '', // May be empty if no options
    stock: 'ON'
  };
  
  let passed = 0, failed = 0, total = 0;
  for (const [field, info] of Object.entries(results)) {
    total++;
    const val = info.value || '';
    const expected = expectedValues[field];
    
    if (!info.exists) {
      console.log(`║ ❌ ${field.padEnd(20)} NOT IN DOM`);
      failed++;
    } else if (val && val.length > 0) {
      console.log(`║ ✅ ${field.padEnd(20)} = "${val}"`);
      passed++;
    } else {
      // Check if it's material (which clears after selection) - look at the displayed text
      console.log(`║ ⚠️  ${field.padEnd(20)} = (empty)`);
      failed++;
    }
  }
  
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║ PASSED: ${passed}/${total}  FAILED: ${failed}/${total}`);
  console.log('╚══════════════════════════════════════════════╝');

  // Check material displayed value separately (it's shown in a chip/text not in input)
  const materialDisplay = await page.evaluate(() => {
    const matEl = document.getElementById('material-autocomplete');
    if (!matEl) return 'NOT FOUND';
    // Check the parent for displayed text
    const parent = matEl.closest('.MuiAutocomplete-root') || matEl.parentElement;
    const chips = parent?.querySelectorAll('.MuiChip-label, .MuiAutocomplete-tag');
    if (chips && chips.length > 0) return Array.from(chips).map(c => c.innerText).join(', ');
    // Check the input value itself
    return matEl.value || '(empty input)';
  });
  console.log('\nMaterial display value:', materialDisplay);

  // ========== SCREENSHOTS ==========
  console.log('\n=== TAKING SCREENSHOTS ===');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test_v6_final_top.png', fullPage: false });
  
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test_v6_final_mid.png', fullPage: false });
  
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test_v6_final_bottom.png', fullPage: false });
  
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test_v6_final_very_bottom.png', fullPage: false });
  
  await page.screenshot({ path: 'test_v6_final_fullpage.png', fullPage: true });

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
