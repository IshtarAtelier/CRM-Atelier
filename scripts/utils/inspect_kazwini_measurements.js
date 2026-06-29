const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to inspect Kazwini measurements...");
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
  console.log(`\nSearching for models to inspect: ${testCodes.join(', ')}`);

  for (const code of testCodes) {
    console.log(`\n--- Inspecting: "${code}" ---`);
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(code)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    // Check if card contains measurements
    const cardData = await page.evaluate(() => {
      const card = document.querySelector('.card');
      if (!card) return null;
      
      const text = card.textContent;
      const html = card.innerHTML;
      
      // Let's look for common patterns like 50-18-140 or 52-20 or similar
      const regex = /\d{2}[-\s□\u25A1]\d{2}[-\s]\d{3}/;
      const match = text.match(regex);
      
      // Also get all text elements in card body
      const bodyElements = Array.from(card.querySelectorAll('.card-body *, p, span, div')).map(el => el.textContent.trim());
      
      // Check if there is a link to details
      const detailLink = card.querySelector('a[href*="/product/"], a.product-image-link');
      
      return {
        text: text,
        match: match ? match[0] : null,
        bodyElements: bodyElements.filter(t => t.length > 0 && t.length < 100),
        detailHref: detailLink ? detailLink.href : null
      };
    });

    if (!cardData) {
      console.log(`- Card not found for "${code}"`);
      continue;
    }

    console.log(`- Card match on search page:`, cardData.match);
    console.log(`- Snippets of card body:`, cardData.bodyElements.slice(0, 10));

    if (cardData.detailHref) {
      console.log(`- Detail link found: ${cardData.detailHref}. Navigating...`);
      await page.goto(cardData.detailHref, { waitUntil: 'networkidle' });
      
      const detailData = await page.evaluate(() => {
        const text = document.body.textContent;
        const regex = /\d{2}[-\s□\u25A1]\d{2}[-\s]\d{3}/;
        const match = text.match(regex);
        
        // Look for tables or spec lists
        const listItems = Array.from(document.querySelectorAll('li, tr, td, p, span, th')).map(el => el.textContent.trim());
        const specKeywords = listItems.filter(t => 
          t.toLowerCase().includes('medida') || 
          t.toLowerCase().includes('calibre') || 
          t.toLowerCase().includes('puente') || 
          t.toLowerCase().includes('patilla') || 
          t.toLowerCase().includes('talle') ||
          t.toLowerCase().includes('ancho')
        );

        return {
          match: match ? match[0] : null,
          keywords: specKeywords.slice(0, 15),
          title: document.title
        };
      });

      console.log(`- Detail page match:`, detailData.match);
      console.log(`- Specifications keywords found:`, detailData.keywords);
    }
  }

  await browser.close();
}

main().catch(console.error);
