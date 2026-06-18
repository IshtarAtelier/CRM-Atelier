const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/robot.html');
  await page.waitForTimeout(2000);
  const href = await page.evaluate(() => document.getElementById('robotLink').getAttribute('href'));
  
  var testData = {
    tipo_lente: 'Monofocal', labType: '', codigoInterno: 'Test',
    od_esfera: '+2.75', oi_esfera: '+3.75',
    material: 'Orgánico',
    armazon: 'Armazón Atelier lectura Lectura - Lapicero',
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
  console.log('EXECUTING v13...');
  
  // Set up console intercept
  page.on('console', async msg => {
    console.log('BROWSER:', msg.text());
  });
  
  try {
    // Inject code so we can see errors in node
    await page.evaluate((code) => { 
      try {
        eval(code); 
      } catch(e) {
        console.error("EVAL ERROR:", e.message);
      }
    }, "(" + jsCode + "())");
  } catch(e) { console.log('PW ERROR:', e.message); }
  
  await page.waitForTimeout(10000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/robot_v13.png' });
  
  await browser.close();
  console.log('DONE v13');
}
main().catch(console.error);
