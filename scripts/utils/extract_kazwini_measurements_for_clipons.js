const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
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

  // We are looking for these models:
  const modelsToSearch = ['7036', '7103', '9001S', 'G5921', 'MLT25029', 'G5929', 'G5959', 'G5970', 'R12221'];

  for (const model of modelsToSearch) {
    console.log(`\nSearching Kazwini for model: ${model}`);
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(model)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    const data = await page.evaluate((searchModel) => {
      const cards = Array.from(document.querySelectorAll('.card'));
      for (const card of cards) {
        const titleEl = card.querySelector('.product-header h5');
        if (!titleEl) continue;
        const title = titleEl.textContent.replace('◆', '').trim();
        
        // Match the model name loosely (e.g., if we search 9001S and the card says 9001S)
        if (title.toUpperCase().includes(searchModel.toUpperCase()) || searchModel.toUpperCase().includes(title.toUpperCase())) {
          // Extract measurements
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

          // Extract images from the info button data-js-config
          let images = [];
          const infoBtn = card.querySelector('button[data-js-info]');
          if (infoBtn) {
            const configStr = infoBtn.getAttribute('data-js-config');
            if (configStr) {
              try {
                const config = JSON.parse(configStr);
                if (config.images && Array.isArray(config.images)) {
                  images = config.images.map(img => {
                    const urlPath = img.pathUrl || img;
                    return urlPath.startsWith('http') ? urlPath : `https://kazwiniopticalgroup.com${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
                  });
                }
              } catch (e) {}
            }
          }
          
          return { measurements: { lw, bw, tl }, images };
        }
      }
      return null;
    }, model);

    if (data) {
      console.log(`Found data for ${model}:`, data);
      
      // Update our database
      // Since there might be multiple clipons for this model (e.g. MLT25029 c2 and MLT25029 c4), we update all that start with this model
      const dbProducts = await prisma.product.findMany({
        where: { name: { startsWith: `Clip-On ${model}` } }
      });
      
      for (const prod of dbProducts) {
        // Keep our main image first, then append kazwini images
        const currentImages = prod.imagenesCatalogo || [];
        const newImagesSet = new Set(currentImages);
        data.images.forEach(img => newImagesSet.add(img));
        const finalImages = Array.from(newImagesSet);
        
        await prisma.product.update({
          where: { id: prod.id },
          data: {
            lensWidth: data.measurements.lw,
            bridgeWidth: data.measurements.bw,
            templeLength: data.measurements.tl,
            imagenesCatalogo: finalImages,
            rawImageUrls: finalImages
          }
        });
        console.log(`Updated DB Product: ${prod.name}`);
        
        // Update WebProduct too
        const webProd = await prisma.webProduct.findFirst({
            where: { productId: prod.id }
        });
        
        if (webProd) {
            await prisma.webProduct.update({
                where: { id: webProd.id },
                data: { images: finalImages }
            });
            console.log(`Updated WebProduct: ${webProd.slug}`);
        }
      }
    } else {
      console.log(`Could not find card matching ${model} on Kazwini.`);
    }
  }

  await browser.close();
}

main().catch(console.error);
