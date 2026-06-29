const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to inspect Kazwini product galleries...");
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

  const testCodes = ['Q5005', 'TL5217'];
  console.log(`\nSearching for models to inspect galleries: ${testCodes.join(', ')}`);

  for (const code of testCodes) {
    console.log(`\n--- Inspecting gallery for: "${code}" ---`);
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(code)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    // Wait for card
    try {
      await page.waitForSelector('.card', { timeout: 5000 });
    } catch (e) {
      console.log(`- Card not found for "${code}"`);
      continue;
    }

    // Get detail link
    const detailHref = await page.evaluate(() => {
      const a = document.querySelector('.card a[href*="/product/"], .card a.product-image-link');
      return a ? a.href : null;
    });

    if (!detailHref) {
      console.log(`- Detail link not found in card for "${code}"`);
      continue;
    }

    console.log(`- Navigating to detail page: ${detailHref}`);
    await page.goto(detailHref, { waitUntil: 'networkidle' });

    // Extract all images on the page
    const imagesInfo = await page.evaluate(() => {
      const imgElements = Array.from(document.querySelectorAll('img'));
      const imgs = imgElements.map(img => {
        return {
          src: img.src,
          alt: img.alt,
          className: img.className,
          id: img.id,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          parentClass: img.parentElement ? img.parentElement.className : ''
        };
      });

      // Let's also look specifically for elements with class carousel or thumbnail or slider
      const galleryContainers = Array.from(document.querySelectorAll('.carousel, .slider, .thumbnails, .gallery, [class*="thumbnail"], [class*="gallery"]')).map(el => {
        return {
          className: el.className,
          tagName: el.tagName,
          imagesInside: Array.from(el.querySelectorAll('img')).map(img => img.src)
        };
      });

      return {
        allImages: imgs,
        galleryContainers: galleryContainers
      };
    });

    console.log(`- Found ${imagesInfo.allImages.length} images total on page.`);
    
    // Filter images that look like product images
    // Usually product images on detail pages are in specific containers or have specific sizes
    const productImgs = imagesInfo.allImages.filter(img => 
      img.src.includes('/products/') || 
      img.src.includes('/product/') ||
      img.parentClass.includes('thumbnail') ||
      img.className.includes('thumbnail') ||
      img.parentClass.includes('carousel') ||
      img.className.includes('carousel') ||
      img.src.includes('.avif') ||
      img.src.includes('.webp') ||
      img.src.includes('.jpg') ||
      img.src.includes('.png')
    );

    console.log(`- Potential product images found:`);
    productImgs.forEach((img, idx) => {
      console.log(`  [${idx + 1}] Src: ${img.src} | Alt: "${img.alt}" | Class: "${img.className}" | ParentClass: "${img.parentClass}"`);
    });

    if (imagesInfo.galleryContainers.length > 0) {
      console.log(`- Gallery containers found:`);
      imagesInfo.galleryContainers.forEach((container, idx) => {
        if (container.imagesInside.length > 0) {
          console.log(`  Container #${idx + 1} (${container.tagName}.${container.className}):`);
          container.imagesInside.forEach(src => console.log(`    * ${src}`));
        }
      });
    }
  }

  await browser.close();
}

main().catch(console.error);
