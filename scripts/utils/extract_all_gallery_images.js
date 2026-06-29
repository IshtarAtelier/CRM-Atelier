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

// Helper to parse base code and color variant from model string
function parseModel(modelStr) {
  const normalized = modelStr.trim().replace(/-([cC]\d+)$/, ' $1');
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) {
    const color = parts[parts.length - 1];
    const base = parts.slice(0, -1).join(' ');
    return { base, color };
  }
  return { base: modelStr, color: 'C1' };
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

  // Group by base code
  const groups = {};
  expectedProducts.forEach(p => {
    const { base, color } = parseModel(p.model);
    if (!groups[base]) {
      groups[base] = [];
    }
    groups[base].push(color);
  });

  const baseCodes = Object.keys(groups);
  console.log(`Found ${baseCodes.length} unique base models to search.`);

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

  const multiImageGallery = [];

  for (let i = 0; i < baseCodes.length; i++) {
    const baseCode = baseCodes[i];
    const targetColors = groups[baseCode];
    console.log(`\n[${i + 1}/${baseCodes.length}] Searching for "${baseCode}"...`);

    try {
      const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(baseCode)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle' });

      // Wait for card
      try {
        await page.waitForSelector('.card', { timeout: 5000 });
      } catch (e) {
        console.log(`  Warning: Card not found for "${baseCode}".`);
        continue;
      }

      // Extract configs for target colors
      const configs = await page.evaluate(({ targetBase, colors }) => {
        const card = Array.from(document.querySelectorAll('.card')).find(c => {
          const h5 = c.querySelector('.product-header h5');
          if (!h5) return false;
          return h5.textContent.replace('◆', '').trim().toLowerCase() === targetBase.toLowerCase();
        });

        if (!card) return null;

        const variantInputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input, input[data-js-product-cover]'));
        const list = [];

        variantInputs.forEach(input => {
          const configStr = input.getAttribute('data-js-config');
          if (!configStr) return;
          try {
            const config = JSON.parse(configStr);
            const colorName = config.color_name || 'C1';
            
            // Check if this color name is in our target colors list (case-insensitive)
            const matchesTarget = colors.some(c => c.toLowerCase() === colorName.toLowerCase());
            if (matchesTarget) {
              list.push({
                color: colorName,
                images: config.images || []
              });
            }
          } catch (e) {}
        });

        return list;
      }, { targetBase: baseCode, colors: targetColors });

      if (!configs || configs.length === 0) {
        console.log(`  Warning: No matching color configs found for "${baseCode}".`);
        continue;
      }

      for (const cfg of configs) {
        const absoluteImages = cfg.images.map(img => {
          const pathUrl = img.pathUrl || img;
          if (pathUrl.startsWith('http')) return pathUrl;
          return `https://kazwiniopticalgroup.com${pathUrl.startsWith('/') ? '' : '/'}${pathUrl}`;
        });

        const imageCount = absoluteImages.length;
        const fullModelName = `${baseCode} ${cfg.color}`;
        const dbModelName = `${baseCode}-${cfg.color}`; // Hyphen format in database

        if (imageCount > 1) {
          console.log(`  -> Variant "${cfg.color}": Found ${imageCount} images!`);
          multiImageGallery.push({
            model: fullModelName,
            imageCount: imageCount,
            images: absoluteImages
          });
        } else {
          console.log(`  -> Variant "${cfg.color}": 1 image.`);
        }

        // Always update both databases with the extracted image list
        // Local DB Updates
        const localProds = await localPrisma.product.findMany({
          where: {
            model: {
              in: [dbModelName, fullModelName]
            },
            brand: {
              equals: 'Atelier',
              mode: 'insensitive'
            }
          }
        });

        for (const lp of localProds) {
          await localPrisma.product.update({
            where: { id: lp.id },
            data: {
              imagenesCatalogo: absoluteImages,
              rawImageUrls: absoluteImages
            }
          });
          
          await localPrisma.webProduct.updateMany({
            where: { productId: lp.id },
            data: {
              images: absoluteImages
            }
          });
        }

        // Production DB Updates
        const prodProds = await prodPrisma.product.findMany({
          where: {
            model: {
              in: [dbModelName, fullModelName]
            },
            brand: {
              equals: 'Atelier',
              mode: 'insensitive'
            }
          }
        });

        for (const pp of prodProds) {
          await prodPrisma.product.update({
            where: { id: pp.id },
            data: {
              imagenesCatalogo: absoluteImages,
              rawImageUrls: absoluteImages
            }
          });
          
          await prodPrisma.webProduct.updateMany({
            where: { productId: pp.id },
            data: {
              images: absoluteImages
            }
          });
        }
      }

    } catch (err) {
      console.error(`  Error processing base model "${baseCode}":`, err.message);
    }

    // Delay between searches
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Print Summary Table
  console.log("\n=================== GALLERY IMAGES SUMMARY ===================");
  console.log(`Total variants with multiple images (gallery): ${multiImageGallery.length}\n`);
  
  multiImageGallery.forEach(item => {
    console.log(`- Model: "${item.model}" | Gallery images count: ${item.imageCount}`);
    item.images.forEach((img, idx) => {
      console.log(`  * Image #${idx + 1}: ${img}`);
    });
    console.log();
  });
  console.log("==============================================================");

  // Write markdown report
  const fs = require('fs');
  const reportPath = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch/gallery_images_report.md';
  let md = `# Kazwini Multiple Images Gallery Audit\n\n`;
  md += `Report completed on: ${new Date().toLocaleString()}\n\n`;
  md += `Total variants found with a multiple-image gallery: **${multiImageGallery.length}**\n\n`;
  
  if (multiImageGallery.length > 0) {
    md += `## Gallery Products List\n\n`;
    md += `| Product Model | Total Photos | Photo URLs |\n`;
    md += `| :--- | :---: | :--- |\n`;
    multiImageGallery.forEach(item => {
      md += `| **${item.model}** | ${item.imageCount} | ${item.images.map((img, idx) => `[Photo #${idx + 1}](${img})`).join(', ')} |\n`;
    });
  } else {
    md += `No products found with multiple images in the current active catalog.\n`;
  }
  
  fs.writeFileSync(reportPath, md);
  console.log(`Saved report artifact to: ${reportPath}`);

  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
});
