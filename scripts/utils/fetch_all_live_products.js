const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to visit live storefront...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to https://crm-atelier-production-ae72.up.railway.app/tienda...");
  await page.goto('https://crm-atelier-production-ae72.up.railway.app/tienda', { waitUntil: 'networkidle', timeout: 60000 });

  console.log("Looping to click 'Cargar más' and load all products...");
  
  let loadMoreExists = true;
  let clickCount = 0;
  
  while (loadMoreExists && clickCount < 10) {
    // Try to find the button containing "Cargar más" or "cargar"
    const loadMoreButton = await page.locator('button:has-text("Cargar más"), button:has-text("cargar más")').first();
    const count = await loadMoreButton.count();
    
    if (count > 0 && await loadMoreButton.isVisible()) {
      console.log(`Clicking 'Cargar más' button #${clickCount + 1}...`);
      await loadMoreButton.click();
      clickCount++;
      await page.waitForTimeout(1500);
      // Scroll down
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(1000);
    } else {
      console.log("No more 'Cargar más' button visible.");
      loadMoreExists = false;
    }
  }

  console.log("Extracting product codes from the page...");
  const products = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const prodLinks = links.filter(a => a.href.includes('/producto/'));
    
    const seen = new Set();
    const list = [];
    
    prodLinks.forEach(a => {
      const href = a.href;
      if (seen.has(href)) return;
      seen.add(href);

      // Find the name text in the card
      const nameEl = a.querySelector('h3, h4, h5, .product-name, .title') || a;
      const name = nameEl.textContent.trim();
      list.push({ name, url: href });
    });
    
    return list;
  });

  console.log(`\nFound ${products.length} products on the live storefront after loading all pages:\n`);
  products.forEach((p, idx) => {
    console.log(`${idx + 1}. Name: "${p.name}" | URL: ${p.url}`);
  });

  await browser.close();
}

main().catch(console.error);
