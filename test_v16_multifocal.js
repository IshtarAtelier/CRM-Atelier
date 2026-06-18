const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/robot.html');
  await page.waitForTimeout(2000);
  const href = await page.evaluate(() => document.getElementById('robotLink').getAttribute('href'));
  
  var testData = {
    tipo_lente: 'Multifocal', labType: '', codigoInterno: 'Test Multifocal v16',
    od_esfera: '+1.00', oi_esfera: '+1.50',
    od_adicion: '+2.50', oi_adicion: '+2.50',
    od_altura: '28', oi_altura: '28',
    material: 'Orgánico',
    armazon: 'Test Frame',
    tipo_aro: 'Calibrado Aro Entero',
    tipo_armazon: 'PLÁSTICO'
  };
  
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  var encoded = encodeURIComponent(JSON.stringify(testData));
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA=' + encoded);
  await page.waitForTimeout(3000);
  
  var jsCode = href.replace(/^javascript:void\(/, '').replace(/\)$/, '');
  console.log('EXECUTING v16...');
  
  try {
    await page.evaluate((code) => { 
      try {
        eval(code); 
      } catch(e) {
        console.error("EVAL ERROR:", e.message);
      }
    }, "(" + jsCode + "())");
  } catch(e) { console.log('PW ERROR:', e.message); }
  
  // Wait enough time for all interactions to finish
  await page.waitForTimeout(12000);
  
  // take screenshot of top half
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/robot_v16_top.png' });

  // take screenshot of middle half (prescription fields)
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/robot_v16_mid.png' });
  
  // take screenshot of bottom half
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/robot_v16_bottom.png' });
  
  await browser.close();
  console.log('DONE v16 test');
}
main().catch(console.error);
