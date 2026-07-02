const { chromium } = require('playwright');

async function main() {
  console.log("Launching Chromium in headful mode (headless: false)...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.setDefaultTimeout(30000);

  console.log("Navigating to Kazwini homepage...");
  await page.goto('https://kazwiniopticalgroup.com', { waitUntil: 'networkidle' });
  
  console.log("Logging in...");
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

  console.log("Waiting for login redirect...");
  await page.waitForTimeout(5000);
  
  // Search for Clip on
  console.log("Searching for Clip-ons...");
  await page.goto('https://kazwiniopticalgroup.com/shop/search?s=clip+on', { waitUntil: 'networkidle' });
  
  // Wait to see if there are cards
  try {
    await page.waitForSelector('.card', { timeout: 10000 });
  } catch (err) {
    console.log("No clip-ons found in search. Let's try navigating to the shop and finding a category...");
  }
  
  // Let's get all product links from the search page
  const cardsCount = await page.locator('.card').count();
  console.log(`Found ${cardsCount} products in the search.`);
  
  if (cardsCount > 0) {
    for (let i = 0; i < cardsCount; i++) {
       console.log(`Processing clip-on card ${i + 1}/${cardsCount}...`);
       
       const result = await page.evaluate(async ({ cardIndex }) => {
          const card = document.querySelectorAll('.card')[cardIndex];
          if (!card) return { success: false, reason: "Card element not found" };

          // Find the radio inputs for variants
          const inputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input, input[data-js-product-cover]'));
          
          if (inputs.length === 0) {
             // Maybe there's only one variant? Just click the sum button directly
             const qtyInput = card.querySelector('input[name="quantity"]');
             if (!qtyInput) return { success: false, reason: "Quantity input field not found" };
             const currentQty = parseInt(qtyInput.value || qtyInput.getAttribute('data-js-real-value') || '0', 10);
             const clicksNeeded = Math.max(0, 5 - currentQty);
             
             if (clicksNeeded === 0) return { success: true, reason: `Already has 5 units.` };
             
             const plusBtn = card.querySelector('button[data-js-sum="1"]');
             if (!plusBtn) return { success: false, reason: "Sum button (+) not found" };
             
             for (let c = 0; c < clicksNeeded; c++) {
               plusBtn.click();
               await new Promise(resolve => setTimeout(resolve, 1500));
             }
             return { success: true, addedCount: clicksNeeded, reason: "Added default variant." };
          }
          
          // If multiple variants, add 5 of each!
          let totalAdded = 0;
          for (const input of inputs) {
             input.click();
             await new Promise(resolve => setTimeout(resolve, 1000));
             
             const qtyInput = card.querySelector('input[name="quantity"]');
             if (!qtyInput) continue;
             const currentQty = parseInt(qtyInput.value || qtyInput.getAttribute('data-js-real-value') || '0', 10);
             const clicksNeeded = Math.max(0, 5 - currentQty);
             
             if (clicksNeeded > 0) {
                 const plusBtn = card.querySelector('button[data-js-sum="1"]');
                 if (plusBtn) {
                     for (let c = 0; c < clicksNeeded; c++) {
                       plusBtn.click();
                       await new Promise(resolve => setTimeout(resolve, 1500));
                     }
                     totalAdded += clicksNeeded;
                 }
             }
          }
          
          return { success: true, addedCount: totalAdded };

        }, { cardIndex: i });
        
        console.log(`Result for card ${i + 1}: ${result.success ? 'Success' : 'Failed'} - Added ${result.addedCount || 0} units.`);
    }
  }

  console.log("\nFinished processing clip-ons. Navigating to the shopping cart page...");
  await page.goto('https://kazwiniopticalgroup.com/cart', { waitUntil: 'networkidle' });
  console.log("\nCart prepared successfully in the open browser window!");
  
  // Keep process alive until user presses Enter in terminal
  await new Promise(resolve => process.stdin.once('data', resolve));

  console.log("Closing browser and exiting...");
  await browser.close();
}

main().catch(console.error);
