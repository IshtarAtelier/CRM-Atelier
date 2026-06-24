const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCRATCH_DIR = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch';

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to homepage...");
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

  console.log("Waiting for login session...");
  await page.waitForTimeout(5000);
  
  console.log("Navigating to catalog page...");
  await page.goto('https://kazwiniopticalgroup.com/catalog/188-top-luxury-acetato-kazwini-mazzucchelli', { waitUntil: 'networkidle' });
  console.log("Current URL is:", page.url());
  
  // Ensure scratch dir exists
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // Save page content for inspection
  const content = await page.content();
  fs.writeFileSync(path.join(SCRATCH_DIR, 'catalog_page.html'), content);
  console.log("Catalog page HTML saved.");
  
  // Take a screenshot of the catalog
  const screenshotPath = path.join(SCRATCH_DIR, 'catalog.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("Catalog screenshot saved to:", screenshotPath);
  
  await browser.close();
}

main().catch(console.error);
