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
  
  console.log("Filling and submitting form via JS Event dispatch...");
  const loginResult = await page.evaluate(async () => {
    const emailInput = document.getElementById('landing-login-email');
    const passInput = document.getElementById('landing-login-password');
    if (!emailInput || !passInput) {
      return { success: false, error: 'Inputs not found' };
    }
    emailInput.value = 'pissano@kazwini.com';
    passInput.value = 'pissano2025';
    
    const form = document.getElementById('landing-login-form');
    if (!form) {
      return { success: false, error: 'Form not found' };
    }
    
    // Dispatch submit event to trigger the AJAX handler
    const event = new Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);
    return { success: true };
  });
  
  console.log("Form submission event dispatched:", loginResult);

  console.log("Waiting 5 seconds for redirection or AJAX completion...");
  await page.waitForTimeout(5000);
  
  console.log("Current URL is:", page.url());
  
  // Ensure scratch dir exists
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // Take a screenshot of the page after login attempt
  const dashboardScreenshotPath = path.join(SCRATCH_DIR, 'dashboard.png');
  await page.screenshot({ path: dashboardScreenshotPath });
  console.log("Dashboard screenshot saved to:", dashboardScreenshotPath);
  
  // If we didn't redirect automatically, let's navigate to /shop
  if (!page.url().includes('/shop')) {
    console.log("Navigating explicitly to shop...");
    await page.goto('https://kazwiniopticalgroup.com/shop', { waitUntil: 'networkidle' });
    console.log("Current URL in shop is:", page.url());
  }
  
  // Save page content for inspection
  const content = await page.content();
  fs.writeFileSync(path.join(SCRATCH_DIR, 'shop_page.html'), content);
  console.log("Shop page HTML saved.");
  
  // Take a screenshot of the shop
  const shopScreenshotPath = path.join(SCRATCH_DIR, 'shop.png');
  await page.screenshot({ path: shopScreenshotPath, fullPage: true });
  console.log("Shop screenshot saved to:", shopScreenshotPath);
  
  await browser.close();
}

main().catch(console.error);
