const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// Helper to parse base code and color variant from model string
function parseModel(modelStr) {
  const parts = modelStr.trim().split(/\s+/);
  if (parts.length > 1) {
    const color = parts[parts.length - 1];
    const base = parts.slice(0, -1).join(' ');
    return { base, color };
  }
  return { base: modelStr, color: 'C1' };
}

async function main() {
  console.log("Querying database for published Kazwini products...");
  const publishedProducts = await prisma.product.findMany({
    where: {
      publishToWeb: true,
      NOT: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    },
    select: {
      brand: true,
      model: true,
      stock: true,
      cost: true
    }
  });

  if (publishedProducts.length === 0) {
    console.log("No published products found to order. Exiting.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${publishedProducts.length} published products. Grouping by base model code...`);
  
  // Group variants by base model code
  const groups = {};
  publishedProducts.forEach(p => {
    const { base, color } = parseModel(p.model);
    if (!groups[base]) {
      groups[base] = [];
    }
    groups[base].push({ color, fullModel: p.model, brand: p.brand });
  });

  const baseCodes = Object.keys(groups);
  console.log(`Grouped into ${baseCodes.length} unique base models.`);
  baseCodes.forEach(base => {
    console.log(`- ${base}: [${groups[base].map(g => g.color).join(', ')}]`);
  });

  // Disconnect database since we don't need it anymore
  await prisma.$disconnect();

  console.log("\nLaunching Chromium in headful mode (headless: false)...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set default timeout
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
  console.log("Logged in! Current URL:", page.url());

  // Loop through base models
  for (let i = 0; i < baseCodes.length; i++) {
    const baseCode = baseCodes[i];
    const variants = groups[baseCode];
    console.log(`\n[${i + 1}/${baseCodes.length}] Processing base model: "${baseCode}"...`);

    try {
      // Search for the base model code
      const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(baseCode)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      // Wait for at least one card to appear
      try {
        await page.waitForSelector('.card', { timeout: 10000 });
      } catch (err) {
        console.log(`  Warning: No cards found for search term "${baseCode}". Skipping.`);
        continue;
      }

      // Find the card index matching the base code exactly
      const matchedCardIndex = await page.evaluate((targetBaseCode) => {
        const cards = Array.from(document.querySelectorAll('.card'));
        return cards.findIndex(card => {
          const h5 = card.querySelector('.product-header h5');
          if (!h5) return false;
          const codeText = h5.textContent.replace('◆', '').trim();
          return codeText.toLowerCase() === targetBaseCode.toLowerCase();
        });
      }, baseCode);

      if (matchedCardIndex === -1) {
        console.log(`  Warning: Could not find card matching code "${baseCode}" exactly. Skipping.`);
        continue;
      }

      console.log(`  Found matching card at index ${matchedCardIndex}.`);

      // Add each variant of this model to the cart
      for (const variant of variants) {
        console.log(`  - Target variant: ${variant.color}`);

        const result = await page.evaluate(async ({ cardIndex, targetColor }) => {
          const card = document.querySelectorAll('.card')[cardIndex];
          if (!card) return { success: false, reason: "Card element not found" };

          // Find the radio input for this variant
          const inputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input, input[data-js-product-cover]'));
          let targetInput = null;

          for (const input of inputs) {
            try {
              const cfg = JSON.parse(input.getAttribute('data-js-config') || '{}');
              const colorCode = cfg.color_code || '';
              const colorName = cfg.color_name || '';
              if (
                colorCode.toLowerCase() === targetColor.toLowerCase() ||
                colorName.toLowerCase() === targetColor.toLowerCase()
              ) {
                targetInput = input;
                break;
              }
            } catch (e) {}
          }

          // If no variant input found, check if it's a single product card and color is default/C1
          if (!targetInput && inputs.length === 1) {
            const cfg = JSON.parse(inputs[0].getAttribute('data-js-config') || '{}');
            if (!cfg.color_code && (targetColor.toLowerCase() === 'c1' || targetColor.toLowerCase() === 'default')) {
              targetInput = inputs[0];
            }
          }

          if (!targetInput) {
            return { success: false, reason: `Variant selector for "${targetColor}" not found` };
          }

          // Click the variant input
          targetInput.click();
          
          // Wait 1 second inside page context to allow variation update
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Get current quantity input value
          const qtyInput = card.querySelector('input[name="quantity"]');
          if (!qtyInput) {
            return { success: false, reason: "Quantity input field not found" };
          }

          const currentQty = parseInt(qtyInput.value || qtyInput.getAttribute('data-js-real-value') || '0', 10);
          if (currentQty >= 1) {
            return { success: true, reason: `Already in cart (Qty: ${currentQty}). Skipped.` };
          }

          // Click sum button to add 1
          const plusBtn = card.querySelector('button[data-js-sum="1"]');
          if (!plusBtn) {
            return { success: false, reason: "Sum button (+) not found" };
          }

          plusBtn.click();
          return { success: true, added: true };

        }, { cardIndex: matchedCardIndex, targetColor: variant.color });

        if (result.success) {
          if (result.added) {
            console.log(`    Successfully added to cart.`);
            // Extra delay to let AJAX requests resolve before navigating or clicking next
            await page.waitForTimeout(2000);
          } else {
            console.log(`    ${result.reason}`);
          }
        } else {
          console.log(`    Failed to add: ${result.reason}`);
        }
      }

    } catch (err) {
      console.error(`  Error processing base model ${baseCode}:`, err.message);
    }

    // Tiny delay between search groups
    await page.waitForTimeout(1000);
  }

  console.log("\nAll items processed. Navigating to the shopping cart page...");
  await page.goto('https://kazwiniopticalgroup.com/cart', { waitUntil: 'networkidle' });
  console.log("\nCart prepared successfully!");
  console.log("=========================================================================");
  console.log("INSTRUCTIONS:");
  console.log("1. Inspect the cart in the open browser window.");
  console.log("2. Adjust quantities if necessary.");
  console.log("3. Once satisfied, manually click the order checkout/confirmation button.");
  console.log("=========================================================================");
  console.log("Press ENTER in this terminal to close the browser and exit the script...");

  // Keep process alive until user presses Enter in terminal
  await new Promise(resolve => process.stdin.once('data', resolve));

  console.log("Closing browser and exiting...");
  await browser.close();
}

main().catch(console.error);
