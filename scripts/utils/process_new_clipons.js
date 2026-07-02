const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INPUT_DIR = '/Users/ishtarpissano/Desktop/Pedido Clipon';
const PUBLIC_DIR = path.join(__dirname, '../../public/images/products');

async function main() {
  console.log('Reading files from', INPUT_DIR);
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.avif'));
  
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

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

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    let baseName = file.replace('.avif', '').trim();
    let model = '';
    let color = '';
    
    if (baseName.includes('-')) {
        const parts = baseName.split('-');
        model = parts[0].trim();
        color = parts[1].trim();
    } else {
        const parts = baseName.split(' ');
        model = parts[0].trim();
        color = parts.slice(1).join(' ').trim();
    }
    
    if (!color) {
        color = 'c1'; 
    }

    const productName = `Clip-On ${model} ${color.toUpperCase()}`;
    const finalSlug = `clipon-${model.toLowerCase()}-${color.toLowerCase()}`;
    
    // Check if exists
    let product = await prisma.product.findFirst({
        where: { name: productName }
    });
    
    if (product) {
        console.log(`Skipping ${productName}, already exists.`);
        continue;
    }
    
    console.log(`\nProcessing NEW file: Model=${model}, Color=${color}`);

    // Process image
    const mainImageName = `${finalSlug}.webp`;
    const mainImagePath = path.join(PUBLIC_DIR, mainImageName);
    await sharp(filePath).webp({ quality: 85 }).toFile(mainImagePath);
    let images = [`/images/products/${mainImageName}`];
    
    // Search Kazwini
    let measurements = { lw: null, bw: null, tl: null };
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(model)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    const data = await page.evaluate((searchModel) => {
      const cards = Array.from(document.querySelectorAll('.card'));
      for (const card of cards) {
        const titleEl = card.querySelector('.product-header h5');
        if (!titleEl) continue;
        const title = titleEl.textContent.replace('◆', '').trim();
        
        if (title.toUpperCase().includes(searchModel.toUpperCase()) || searchModel.toUpperCase().includes(title.toUpperCase())) {
          let lw = null, bw = null, tl = null;
          const spans = card.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent.trim();
            const match = text.match(/(\d{2})[- ](\d{2})[- ](\d{3})/);
            if (match) {
              lw = parseInt(match[1]);
              bw = parseInt(match[2]);
              tl = parseInt(match[3]);
              break;
            }
          }

          let extraImages = [];
          const infoBtn = card.querySelector('button[data-js-info]');
          if (infoBtn) {
            const configStr = infoBtn.getAttribute('data-js-config');
            if (configStr) {
              try {
                const config = JSON.parse(configStr);
                if (config.images && Array.isArray(config.images)) {
                  extraImages = config.images.map(img => {
                    const urlPath = img.pathUrl || img;
                    return urlPath.startsWith('http') ? urlPath : `https://kazwiniopticalgroup.com${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
                  });
                }
              } catch (e) {}
            }
          }
          return { measurements: { lw, bw, tl }, extraImages };
        }
      }
      return null;
    }, model);

    if (data) {
        console.log(`Found data for ${model} on Kazwini.`);
        measurements = data.measurements;
        const newImagesSet = new Set(images);
        data.extraImages.forEach(img => newImagesSet.add(img));
        images = Array.from(newImagesSet);
    } else {
        console.log(`Model ${model} not found on Kazwini search.`);
    }

    product = await prisma.product.create({
        data: {
            name: productName,
            model: `${model} ${color.toUpperCase()}`,
            brand: "Kazwini",
            category: "Lentes de Sol",
            type: "Armazón",
            stock: 1,
            price: 70000,
            cost: 0,
            publishToWeb: true,
            origin: "STOCK",
            imagenesCatalogo: images,
            rawImageUrls: images,
            lensWidth: measurements.lw,
            bridgeWidth: measurements.bw,
            templeLength: measurements.tl
        }
    });
    console.log("Created Product:", product.id);
    
    await prisma.webProduct.create({
        data: {
            productId: product.id,
            name: productName,
            slug: finalSlug,
            category: "Lentes de Sol",
            isActive: true,
            imageUrl: images[0],
            images: images
        }
    });
    console.log("Created WebProduct:", finalSlug);
  }

  await browser.close();
  console.log("Done processing new clipons!");
}

main().catch(console.error);
