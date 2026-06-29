const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to visit live storefront...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to https://crm-atelier-production-ae72.up.railway.app/tienda...");
  await page.goto('https://crm-atelier-production-ae72.up.railway.app/tienda', { waitUntil: 'networkidle', timeout: 60000 });

  console.log("Extracting product codes from the page...");
  // Let's scroll down to load infinite scroll or paginated items if any
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1000);
  }

  const products = await page.evaluate(() => {
    // Let's find all product cards/links on the store page.
    // Usually they are inside anchors or card titles. Let's look for text or links containing '/producto/'.
    const links = Array.from(document.querySelectorAll('a'));
    const prodLinks = links.filter(a => a.href.includes('/producto/'));
    
    // Extract unique product info
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

  console.log(`\nFound ${products.length} products on the live storefront:\n`);
  products.forEach((p, idx) => {
    console.log(`${idx + 1}. Name: "${p.name}" | URL: ${p.url}`);
  });

  await browser.close();
}

main().catch(console.error);
