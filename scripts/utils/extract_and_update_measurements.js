const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

// Local DB Client
const localPrisma = new PrismaClient();

// Prod DB Client
const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

// Helper to parse base code from model
function parseModel(modelStr) {
  const normalized = modelStr.trim().replace(/-([cC]\d+)$/, ' $1');
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) {
    return parts.slice(0, -1).join(' ').trim();
  }
  return modelStr.trim();
}

async function main() {
  console.log("Querying database for active Atelier products...");
  const expectedProducts = await localPrisma.product.findMany({
    where: {
      publishToWeb: true,
      brand: {
        equals: 'Atelier',
        mode: 'insensitive'
      }
    },
    select: {
      model: true
    }
  });

  if (expectedProducts.length === 0) {
    console.log("No published Atelier products found. Exiting.");
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
    return;
  }

  // Get unique base models
  const baseCodesSet = new Set();
  expectedProducts.forEach(p => {
    baseCodesSet.add(parseModel(p.model));
  });

  const baseCodes = Array.from(baseCodesSet);
  console.log(`Found ${baseCodes.length} unique base models to process.`);

  console.log("\nLaunching Chromium in headless mode...");
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
  console.log("Logged in!");

  const results = [];

  for (let i = 0; i < baseCodes.length; i++) {
    const baseCode = baseCodes[i];
    console.log(`\n[${i + 1}/${baseCodes.length}] Searching for "${baseCode}"...`);

    try {
      const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(baseCode)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      // Check if any card is loaded
      const cardExists = await page.locator('.card').count();
      if (cardExists === 0) {
        console.log(`  Warning: No cards found for "${baseCode}".`);
        results.push({ baseCode, success: false, reason: "Card not found" });
        continue;
      }

      // Extract measurements from matching card
      const measurements = await page.evaluate((targetBase) => {
        const cards = Array.from(document.querySelectorAll('.card'));
        const matchedCard = cards.find(card => {
          const h5 = card.querySelector('.product-header h5');
          if (!h5) return false;
          const codeText = h5.textContent.replace('◆', '').trim();
          return codeText.toLowerCase() === targetBase.toLowerCase();
        });

        if (!matchedCard) return null;

        const text = matchedCard.textContent;
        // Regex for pattern like 52-19-145 or 54□18-140 or 52 18 140
        const regex = /(\d{2})[-_□\u25A1\s]+(\d{2})[-_\s]+(\d{3})/;
        const match = text.match(regex);

        if (match) {
          return {
            lensWidth: parseInt(match[1], 10),
            bridgeWidth: parseInt(match[2], 10),
            templeLength: parseInt(match[3], 10),
            rawText: match[0]
          };
        }
        return null;
      }, baseCode);

      if (!measurements) {
        console.log(`  Warning: Measurements pattern not found in card for "${baseCode}".`);
        results.push({ baseCode, success: false, reason: "Measurements pattern not found" });
        continue;
      }

      console.log(`  Found measurements: ${measurements.rawText} -> Lens: ${measurements.lensWidth}mm, Bridge: ${measurements.bridgeWidth}mm, Temple: ${measurements.templeLength}mm`);

      // Update both Local and Production databases
      const localUpdated = await localPrisma.product.updateMany({
        where: {
          model: {
            startsWith: baseCode
          },
          brand: {
            equals: 'Atelier',
            mode: 'insensitive'
          }
        },
        data: {
          lensWidth: measurements.lensWidth,
          bridgeWidth: measurements.bridgeWidth,
          templeLength: measurements.templeLength
        }
      });

      const prodUpdated = await prodPrisma.product.updateMany({
        where: {
          model: {
            startsWith: baseCode
          },
          brand: {
            equals: 'Atelier',
            mode: 'insensitive'
          }
        },
        data: {
          lensWidth: measurements.lensWidth,
          bridgeWidth: measurements.bridgeWidth,
          templeLength: measurements.templeLength
        }
      });

      console.log(`  Successfully updated database: Local count = ${localUpdated.count}, Production count = ${prodUpdated.count}`);
      results.push({
        baseCode,
        success: true,
        lensWidth: measurements.lensWidth,
        bridgeWidth: measurements.bridgeWidth,
        templeLength: measurements.templeLength
      });

    } catch (err) {
      console.error(`  Error processing "${baseCode}":`, err.message);
      results.push({ baseCode, success: false, reason: err.message });
    }

    // Short delay to avoid spamming searches too fast
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Print Summary Table
  console.log("\n=================== EXTRACTION SUMMARY ===================");
  let successCount = 0;
  results.forEach(r => {
    if (r.success) {
      console.log(`- ${r.baseCode}: ${r.lensWidth}-${r.bridgeWidth}-${r.templeLength}`);
      successCount++;
    } else {
      console.log(`- ${r.baseCode}: FAILED (${r.reason})`);
    }
  });
  console.log(`\nSuccessfully processed: ${successCount}/${baseCodes.length}`);
  console.log("==========================================================");

  // Write measurements file as artifact
  const fs = require('fs');
  const txtPath = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch/measurements.txt';
  let txtContent = "BaseCode,LensWidth,BridgeWidth,TempleLength\n";
  results.forEach(r => {
    if (r.success) {
      txtContent += `${r.baseCode},${r.lensWidth},${r.bridgeWidth},${r.templeLength}\n`;
    }
  });
  fs.writeFileSync(txtPath, txtContent);
  console.log(`Saved text data to: ${txtPath}`);

  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
});
