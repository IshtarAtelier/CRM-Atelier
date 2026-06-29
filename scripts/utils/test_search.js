const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCRATCH_DIR = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch';

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set up request listener
  page.on('request', request => {
    if (request.url().includes('cart')) {
      console.log(`>> CART REQUEST: ${request.method()} ${request.url()}`);
      const postData = request.postData();
      if (postData) {
        console.log(`   Payload: ${postData}`);
      }
    }
  });

  page.on('response', async response => {
    if (response.url().includes('cart')) {
      console.log(`<< CART RESPONSE: ${response.status()} ${response.url()}`);
      try {
        const text = await response.text();
        console.log(`   Response text: ${text.slice(0, 500)}`);
      } catch (e) {}
    }
  });

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
  
  console.log("Searching for MB1513...");
  await page.goto('https://kazwiniopticalgroup.com/shop/search?s=MB1513', { waitUntil: 'networkidle' });
  console.log("Current URL:", page.url());

  // Wait for the card to be visible
  await page.waitForSelector('.card');

  // Let's select variant C2.
  // The radio input for variant C2 has color_code C2.
  console.log("Selecting variant C2...");
  await page.evaluate(() => {
    // Find the input corresponding to variant C2 under MB1513
    const card = document.querySelector('.card'); // first card
    const inputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input'));
    const c2Input = inputs.find(input => {
      try {
        const cfg = JSON.parse(input.getAttribute('data-js-config') || '{}');
        return cfg.color_code === 'C2';
      } catch (e) {
        return false;
      }
    });

    if (c2Input) {
      c2Input.click();
      console.log("Clicked C2 input. ID:", c2Input.id);
    } else {
      console.log("C2 input not found!");
    }
  });

  // Let's wait a bit for any state update
  await page.waitForTimeout(2000);

  // Now, let's find the "+" button inside the quantity controls of that card and click it.
  console.log("Clicking the '+' button...");
  await page.evaluate(() => {
    const card = document.querySelector('.card');
    const plusButton = card.querySelector('button[data-js-sum="1"]');
    if (plusButton) {
      plusButton.click();
      console.log("Clicked '+' button");
    } else {
      console.log("'+' button not found");
    }
  });

  // Wait to see the request/response logs
  await page.waitForTimeout(5000);

  console.log("Closing browser...");
  await browser.close();
}

main().catch(console.error);
