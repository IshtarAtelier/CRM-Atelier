const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to search Kazwini...");
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

  const testCodes = ['TL5217', 'YX05', '9006M', 'M7011', 'Q5005', '57201LJH'];
  console.log(`\nSearching Kazwini for test codes: ${testCodes.join(', ')}`);

  for (const code of testCodes) {
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(code)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    const cardCount = await page.locator('.card').count();
    console.log(`- Code: "${code}" | Found card count on Kazwini: ${cardCount}`);
  }

  await browser.close();
}

main().catch(console.error);
