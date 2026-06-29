const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

// DB Clients
const localPrisma = new PrismaClient();
const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

const PROJECT_DIR = '/Users/ishtarpissano/proyectos/atelier';
const GALLERY_DIR = path.join(PROJECT_DIR, 'public/assets/products/gallery');

// Ensure gallery dir exists
if (!fs.existsSync(GALLERY_DIR)) {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

// Helper to parse base code and color variant
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

// Helper to download a file from URL to local path
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // delete file on error
      reject(err);
    });
  });
}

// Gather all files in local directories
function scanLocalFiles() {
  const files = [];
  const directories = [
    { dir: path.join(PROJECT_DIR, 'public/assets/products/acetato'), category: 'acetato' },
    { dir: path.join(PROJECT_DIR, 'public/assets/products/metal'), category: 'metal' }
  ];

  directories.forEach(d => {
    if (!fs.existsSync(d.dir)) return;
    const list = fs.readdirSync(d.dir);
    list.forEach(file => {
      const ext = path.extname(file);
      if (['.avif', '.webp', '.jpg', '.png', '.jpeg'].includes(ext.toLowerCase())) {
        const baseName = file.trim().replace(/\.[^/.]+$/, ""); // remove extension
        files.push({
          filename: file,
          normalized: baseName.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-'),
          path: `/assets/products/${d.category}/${file.trim()}`,
          category: d.category
        });
      }
    });
  });

  return files;
}

// Find local file match for model
function findLocalFile(model, localFiles) {
  const normModel = model.trim().toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-');
  
  // 1. Exact match
  let match = localFiles.find(f => f.normalized === normModel);
  if (match) return match.path;
  
  // 2. StartsWith / EndsWith
  match = localFiles.find(f => f.normalized.startsWith(normModel) || normModel.startsWith(f.normalized));
  if (match) return match.path;
  
  // 3. Includes
  match = localFiles.find(f => f.normalized.includes(normModel) || normModel.includes(f.normalized));
  if (match) return match.path;
  
  return null;
}

async function main() {
  console.log("Scanning local directory for original product files...");
  const localFiles = scanLocalFiles();
  console.log(`Scanned ${localFiles.length} original image files.`);

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

  console.log(`Found ${expectedProducts.length} published products.`);

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
  console.log(`Grouped into ${baseCodes.length} base models.`);

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

  let processedCount = 0;

  for (let i = 0; i < baseCodes.length; i++) {
    const baseCode = baseCodes[i];
    const targetColors = groups[baseCode];
    console.log(`\n[${i + 1}/${baseCodes.length}] Processing base model: "${baseCode}"...`);

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
        const fullModelName = `${baseCode} ${cfg.color}`;
        const dbModelName = `${baseCode}-${cfg.color}`;

        // 1. Find the original primary local image
        let primaryLocalPath = findLocalFile(dbModelName, localFiles) || findLocalFile(fullModelName, localFiles);
        if (!primaryLocalPath) {
          console.log(`  [!] Warning: Could not find original local file for "${dbModelName}". Falling back to first Kazwini image.`);
          const firstImg = cfg.images[0];
          if (firstImg) {
            const pathUrl = firstImg.pathUrl || firstImg;
            primaryLocalPath = pathUrl.startsWith('http') ? pathUrl : `https://kazwiniopticalgroup.com${pathUrl.startsWith('/') ? '' : '/'}${pathUrl}`;
          } else {
            primaryLocalPath = '/images/placeholder.png';
          }
        }

        const finalImagesList = [primaryLocalPath];

        // 2. Download and localize subsequent gallery images (index >= 1)
        for (let idx = 1; idx < cfg.images.length; idx++) {
          const rawImg = cfg.images[idx];
          const pathUrl = rawImg.pathUrl || rawImg;
          const absoluteUrl = pathUrl.startsWith('http') ? pathUrl : `https://kazwiniopticalgroup.com${pathUrl.startsWith('/') ? '' : '/'}${pathUrl}`;
          
          // Parse extension
          const ext = path.extname(pathUrl) || '.avif';
          const filename = `${baseCode.replace(/\s+/g, '_')}-${cfg.color}-${idx + 1}${ext}`;
          const localDestPath = path.join(GALLERY_DIR, filename);
          const relativeAssetPath = `/assets/products/gallery/${filename}`;

          try {
            console.log(`    -> Downloading gallery image #${idx + 1} for ${fullModelName}...`);
            await downloadFile(absoluteUrl, localDestPath);
            finalImagesList.push(relativeAssetPath);
          } catch (err) {
            console.error(`    [!] Error downloading ${absoluteUrl}:`, err.message);
          }
        }

        console.log(`  -> Variant "${cfg.color}": Primary local path = "${primaryLocalPath}". Gallery items = ${finalImagesList.length}.`);

        // 3. Update databases
        // Local DB Updates
        const localProds = await localPrisma.product.findMany({
          where: {
            model: { in: [dbModelName, fullModelName] },
            brand: { equals: 'Atelier', mode: 'insensitive' }
          }
        });

        for (const lp of localProds) {
          await localPrisma.product.update({
            where: { id: lp.id },
            data: {
              imagenesCatalogo: finalImagesList,
              rawImageUrls: finalImagesList
            }
          });
          
          await localPrisma.webProduct.updateMany({
            where: { productId: lp.id },
            data: {
              imageUrl: primaryLocalPath,
              images: finalImagesList
            }
          });
        }

        // Production DB Updates
        const prodProds = await prodPrisma.product.findMany({
          where: {
            model: { in: [dbModelName, fullModelName] },
            brand: { equals: 'Atelier', mode: 'insensitive' }
          }
        });

        for (const pp of prodProds) {
          await prodPrisma.product.update({
            where: { id: pp.id },
            data: {
              imagenesCatalogo: finalImagesList,
              rawImageUrls: finalImagesList
            }
          });
          
          await prodPrisma.webProduct.updateMany({
            where: { productId: pp.id },
            data: {
              imageUrl: primaryLocalPath,
              images: finalImagesList
            }
          });
        }

        processedCount++;
      }

    } catch (err) {
      console.error(`  Error processing base model "${baseCode}":`, err.message);
    }

    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log(`\nFinished recovery! Successfully restored and localized ${processedCount} variations.`);

  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
});
