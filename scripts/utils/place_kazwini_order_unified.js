const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper to parse base code and color variant from model string
function parseModel(modelStr) {
  // e.g. "MLT25029 C2" or "Q5005-C4" or "7036 c2"
  const normalized = modelStr.trim().replace(/-([cC]\d+)$/i, ' $1');
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (/^c\d+(-\d+)?$/i.test(last)) {
      return { base: parts.slice(0, -1).join(' ').trim(), color: last };
    }
  }
  return { base: modelStr, color: 'C1' };
}

async function main() {
  console.log("Querying production database for ALL published Atelier and Kazwini products (including clipons)...");
  
  const publishedProducts = await prisma.product.findMany({
    where: {
      publishToWeb: true,
      brand: {
        in: ['Atelier', 'Kazwini']
      }
    },
    select: {
      brand: true,
      model: true,
      stock: true
    }
  });

  if (publishedProducts.length === 0) {
    console.log("No published products found. Exiting.");
    await prisma.$disconnect();
    return;
  }

  // Group variants by base model code
  const groups = {};
  publishedProducts.forEach(p => {
    // Ignore the generic empty ones if any
    if (!p.model || p.model.trim() === '') return;
    
    // Ignore non-clipon Kazwini if they want ONLY clipons? "Trae todos los codigos de esa carpeta... asi que con que traigas todos los de la web es suficiente". 
    // They mean all published Atelier + Kazwini.
    const { base, color } = parseModel(p.model);
    if (!groups[base]) {
      groups[base] = [];
    }
    groups[base].push({ color, fullModel: p.model, brand: p.brand });
  });

  const baseCodes = Object.keys(groups);
  console.log(`Grouped into ${baseCodes.length} unique base models.`);
  
  await prisma.$disconnect();

  console.log("\nLaunching Chromium in headful mode (headless: false)...");
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
  
  // Also clear cart first if we want a clean slate? User said "cerra todos los pedidos y ordenate".
  // But they might have items they want to keep. We'll just add to what's there.
  
  const shortfalls = [];

  // Loop through base models
  for (let i = 0; i < baseCodes.length; i++) {
    const baseCode = baseCodes[i];
    const variants = groups[baseCode];
    console.log(`\n[${i + 1}/${baseCodes.length}] Processing base model: "${baseCode}"...`);

    try {
      const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(baseCode)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      try {
        await page.waitForSelector('.card', { timeout: 10000 });
      } catch (err) {
        console.log(`  Warning: No cards found for search term "${baseCode}". Skipping.`);
        variants.forEach(v => shortfalls.push({ model: v.fullModel, requested: 5, added: 0, reason: "No encontrado en Kazwini" }));
        continue;
      }

      const matchedCardIndex = await page.evaluate((targetBaseCode) => {
        const cards = Array.from(document.querySelectorAll('.card'));
        return cards.findIndex(card => {
          const h5 = card.querySelector('.product-header h5');
          if (!h5) return false;
          const codeText = h5.textContent.replace('◆', '').trim().toLowerCase();
          return codeText.includes(targetBaseCode.toLowerCase());
        });
      }, baseCode);

      if (matchedCardIndex === -1) {
        console.log(`  Warning: Could not find card matching code "${baseCode}". Skipping.`);
        variants.forEach(v => shortfalls.push({ model: v.fullModel, requested: 5, added: 0, reason: "No encontrado en Kazwini" }));
        continue;
      }

      for (const variant of variants) {
        console.log(`  - Target variant: ${variant.color}`);

        const result = await page.evaluate(async ({ cardIndex, targetColor }) => {
          const card = document.querySelectorAll('.card')[cardIndex];
          if (!card) return { success: false, reason: "Card element not found" };

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

          if (!targetInput && inputs.length === 1) {
            const cfg = JSON.parse(inputs[0].getAttribute('data-js-config') || '{}');
            if (!cfg.color_code && (targetColor.toLowerCase() === 'c1' || targetColor.toLowerCase() === 'default')) {
              targetInput = inputs[0];
            }
          }

          if (!targetInput) {
            return { success: false, reason: `Variant selector for "${targetColor}" not found` };
          }

          targetInput.click();
          await new Promise(resolve => setTimeout(resolve, 1000));

          const qtyInput = card.querySelector('input[name="quantity"]');
          if (!qtyInput) return { success: false, reason: "Quantity input field not found" };

          const initialQty = parseInt(qtyInput.value || qtyInput.getAttribute('data-js-real-value') || '0', 10);
          const targetQty = 5;
          
          if (initialQty >= targetQty) {
            return { success: true, finalQty: initialQty, added: 0, alreadyHad: true };
          }

          const clicksNeeded = targetQty - initialQty;
          const plusBtn = card.querySelector('button[data-js-sum="1"]');
          if (!plusBtn) return { success: false, reason: "Sum button (+) not found" };

          for (let c = 0; c < clicksNeeded; c++) {
            plusBtn.click();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          const finalQty = parseInt(qtyInput.value || qtyInput.getAttribute('data-js-real-value') || '0', 10);
          return { success: true, finalQty, added: finalQty - initialQty, alreadyHad: false };

        }, { cardIndex: matchedCardIndex, targetColor: variant.color });

        if (result.success) {
           console.log(`    Final quantity in cart: ${result.finalQty}`);
           if (result.finalQty < 5) {
               shortfalls.push({ model: variant.fullModel, requested: 5, added: result.finalQty, reason: "Falta stock en Kazwini" });
           }
        } else {
           console.log(`    Failed to add: ${result.reason}`);
           shortfalls.push({ model: variant.fullModel, requested: 5, added: 0, reason: result.reason });
        }
      }

    } catch (err) {
      console.error(`  Error processing base model ${baseCode}:`, err.message);
    }
  }

  console.log("\nAll items processed. Generating report...");
  
  let md = `# Reporte de Faltantes - Pedido Kazwini\n\n`;
  if (shortfalls.length === 0) {
      md += `Se agregaron exitosamente 5 unidades de todos los modelos publicados.\n`;
  } else {
      md += `| Modelo | Cantidad Alcanzada | Motivo |\n`;
      md += `|---|---|---|\n`;
      shortfalls.forEach(s => {
          md += `| ${s.model} | ${s.added} de ${s.requested} | ${s.reason} |\n`;
      });
  }
  
  const outFile = path.join(process.env.ARTIFACTS_DIR || '.', 'reporte_faltantes_kazwini.md');
  fs.writeFileSync(outFile, md);
  console.log("Written report to", outFile);

  await page.goto('https://kazwiniopticalgroup.com/cart', { waitUntil: 'networkidle' });
  console.log("=========================================================================");
  console.log("INSTRUCTIONS:");
  console.log("1. Review the cart directly in the Chromium browser window.");
  console.log("2. Press ENTER in this terminal to close the browser and exit.");
  console.log("=========================================================================");

  await new Promise(resolve => process.stdin.once('data', resolve));
  await browser.close();
}

main().catch(console.error);
