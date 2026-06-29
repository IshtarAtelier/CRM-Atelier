const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to inspect config images...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Logging in to Kazwini...");
  await page.goto('https://kazwiniopticalgroup.com', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const emailInput = document.getElementById('landing-login-email');
    const passInput = document.getElementById('landing-login-password');
    if (emailInput) emailInput.value = 'pissano@kazwini.com';
    if (passInput) passInput.value = 'pissano2025';
    
    const form = document.getElementById('landing-login-form');
    if (form) {
      const event = new Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(event);
    }
  });

  await page.waitForTimeout(5000);

  const testCodes = ['Q5005', 'TL5217', 'YX05'];
  console.log(`\nSearching for: ${testCodes.join(', ')}`);

  for (const code of testCodes) {
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(code)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    try {
      await page.waitForSelector('.card', { timeout: 5000 });
    } catch (e) {
      console.log(`- Card not found for "${code}"`);
      continue;
    }

    const configs = await page.evaluate((targetBase) => {
      const card = Array.from(document.querySelectorAll('.card')).find(c => {
        const h5 = c.querySelector('.product-header h5');
        if (!h5) return false;
        return h5.textContent.replace('◆', '').trim().toLowerCase() === targetBase.toLowerCase();
      });

      if (!card) return null;

      const variantInputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input, input[data-js-product-cover]'));
      const list = [];

      variantInputs.forEach(input => {
        const configStr = input.getAttribute('data-js-config');
        if (!configStr) return;
        try {
          const config = JSON.parse(configStr);
          list.push({
            color: config.color_name || 'default',
            imagesCount: (config.images || []).length,
            images: config.images || []
          });
        } catch (e) {}
      });

      return list;
    }, code);

    console.log(`\nResults for "${code}":`);
    if (configs) {
      configs.forEach(cfg => {
        console.log(`- Color: "${cfg.color}" | Images found in config: ${cfg.imagesCount}`);
        cfg.images.forEach(img => {
          console.log(`  * Path: ${img.pathUrl || img}`);
        });
      });
    } else {
      console.log("- No matching card configs found.");
    }
  }

  await browser.close();
}

main().catch(console.error);
