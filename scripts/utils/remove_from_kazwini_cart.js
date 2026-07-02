const { chromium } = require('playwright');

const itemsToRemove = [
  '7103 C2',
  'Q5205-C8',
  'TL5206 C4',
  '9004M C5',
  'R12221 C1',
  'test',
  'TL5207 C4',
  '9001S C3',
  'MLT25029 C2',
  'MLT25029 C4',
  '8125S C4'
];

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

  console.log("Navigating to cart...");
  await page.goto('https://kazwiniopticalgroup.com/cart', { waitUntil: 'networkidle' });
  
  console.log("Looking for items to remove...");
  
  for (const itemName of itemsToRemove) {
     const normalizedName = itemName.replace('-', ' ').toLowerCase();
     
     const removed = await page.evaluate(async (targetName) => {
         const rows = Array.from(document.querySelectorAll('.cart-item, tr, .row, .product-cart-item'));
         for (const row of rows) {
             const text = row.textContent.toLowerCase();
             if (text.includes(targetName) || (targetName.includes(' ') && text.includes(targetName.split(' ')[0]))) {
                 // Try to find a remove button
                 const removeBtn = row.querySelector('button.remove, a.remove, .btn-danger, .trash-icon, [data-action="remove"], button:has-text("Eliminar")');
                 if (removeBtn) {
                     removeBtn.click();
                     await new Promise(resolve => setTimeout(resolve, 2000));
                     return true;
                 }
                 
                 // If no remove button, maybe quantity input can be set to 0
                 const qtyInput = row.querySelector('input[name="quantity"]');
                 if (qtyInput) {
                     qtyInput.value = 0;
                     qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
                     await new Promise(resolve => setTimeout(resolve, 2000));
                     return true;
                 }
             }
         }
         return false;
     }, normalizedName);
     
     if (removed) {
        console.log(`Removed ${itemName} from cart.`);
     } else {
        console.log(`Could not automatically remove ${itemName}. Please check manually.`);
     }
  }

  console.log("\nFinished cleaning up cart.");
  console.log("=========================================================================");
  console.log("INSTRUCTIONS:");
  console.log("1. Review the cart directly in the Chromium browser window.");
  console.log("2. Press ENTER in this terminal to close the browser and exit.");
  console.log("=========================================================================");

  await new Promise(resolve => process.stdin.once('data', resolve));
  await browser.close();
}

main().catch(console.error);
