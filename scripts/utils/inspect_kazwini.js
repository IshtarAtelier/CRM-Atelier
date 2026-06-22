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
  
  console.log("Filling login credentials...");
  await page.fill('#landing-login-email', 'pissano@kazwini.com');
  await page.fill('#landing-login-password', 'pissano2025');
  
  console.log("Submitting login form...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
    page.click('#landing-login-form button[type="submit"]')
  ]);
  
  console.log("Logged in! Current URL is:", page.url());
  
  // Ensure scratch dir exists
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // Save page content for inspection
  const content = await page.content();
  fs.writeFileSync(path.join(SCRATCH_DIR, 'logged_in_page.html'), content);
  
  // Take a screenshot to verify
  const screenshotPath = path.join(SCRATCH_DIR, 'logged_in.png');
  await page.screenshot({ path: screenshotPath });
  console.log("Screenshot saved to:", screenshotPath);
  
  await browser.close();
}

main().catch(console.error);
