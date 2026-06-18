const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Load the robot.html page
  await page.goto('http://localhost:3000/robot.html');
  await page.waitForTimeout(2000);
  
  // Get the href from the link
  const href = await page.evaluate(() => {
    return document.getElementById('robotLink').getAttribute('href');
  });
  
  console.log('HREF LENGTH:', href.length);
  console.log('STARTS WITH javascript:', href.startsWith('javascript:'));
  console.log('FIRST 200 CHARS:', href.substring(0, 200));
  
  // Now test: go to SmartLab with test data and execute the href code
  var testData = {
    tipo_lente: 'Monofocal', labType: '', codigoInterno: 'Test Robot v7',
    od_esfera: '+2.75', oi_esfera: '+3.75',
    od_cilindro: '-0.50', oi_cilindro: '-0.75',
    od_eje: '180', oi_eje: '115',
    od_dp: '31', oi_dp: '32',
    od_altura: '27', oi_altura: '27',
    material: 'Orgánico', tratamiento: 'Filtro Azul',
    armazon: 'Atelier Metal Classic',
    observaciones: 'test v7'
  };
  
  // Login
  const page2 = await browser.newPage();
  page2.on('console', msg => console.log('SL:', msg.text()));
  page2.on('dialog', async d => { console.log('ALERT:', d.message()); await d.accept(); });
  
  await page2.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page2.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page2.fill('input[type="password"]', 'atelier');
  await page2.click('button[type="submit"]');
  await page2.waitForTimeout(3000);
  
  var encoded = encodeURIComponent(JSON.stringify(testData));
  await page2.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded);
  await page2.waitForTimeout(3000);
  
  // Extract the actual JS code from the href (remove "javascript:void(" prefix and ")" suffix)
  var jsCode = href.replace(/^javascript:void\(/, '').replace(/\)$/, '');
  
  console.log('\nEXECUTING BOOKMARKLET CODE FROM ROBOT.HTML...');
  try {
    await page2.evaluate((code) => {
      eval(code);
    }, jsCode);
  } catch(e) {
    console.log('EVAL ERROR:', e.message);
  }
  
  await page2.waitForTimeout(15000);
  await page2.screenshot({ path: '/tmp/robot_v7_verify.png', fullPage: false });
  await page2.evaluate(() => window.scrollTo(0, 400));
  await page2.waitForTimeout(300);
  await page2.screenshot({ path: '/tmp/robot_v7_verify_mid.png', fullPage: false });
  
  await browser.close();
  console.log('DONE');
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
