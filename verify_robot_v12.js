const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/robot.html');
  await page.waitForTimeout(2000);
  const href = await page.evaluate(() => document.getElementById('robotLink').getAttribute('href'));
  
  var testData = {
    tipo_lente: 'Monofocal', labType: '', codigoInterno: 'Test Robot v12',
    od_esfera: '+2.75', oi_esfera: '+3.75',
    od_cilindro: '-0.50', oi_cilindro: '-0.75',
    od_eje: '180', oi_eje: '115',
    od_dp: '31', oi_dp: '32',
    od_altura: '27', oi_altura: '27',
    material: 'Orgánico', tratamiento: 'Filtro Azul',
    armazon: 'Armazón Atelier lectura Lectura - Lapicero',
    observaciones: 'test v12',
    tipo_aro: 'Calibrado Aro Entero',
    tipo_armazon: 'PLÁSTICO'
  };
  
  const page2 = await browser.newPage();
  page2.on('console', msg => console.log('SL:', msg.text()));
  await page2.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page2.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page2.fill('input[type="password"]', 'atelier');
  await page2.click('button[type="submit"]');
  await page2.waitForTimeout(3000);
  
  var encoded = encodeURIComponent(JSON.stringify(testData));
  await page2.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded);
  await page2.waitForTimeout(3000);
  
  var jsCode = href.replace(/^javascript:void\(/, '').replace(/\)$/, '');
  console.log('\nEXECUTING BOOKMARKLET CODE FROM ROBOT v12...');
  try {
    await page2.evaluate((code) => { eval(code); }, jsCode);
  } catch(e) { console.log('EVAL ERROR:', e.message); }
  
  await page2.waitForTimeout(15000); // Wait for all combobox interactions
  
  await page2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: '/tmp/robot_v12_bottom.png' });
  
  await browser.close();
  console.log('DONE');
}
main().catch(console.error);
