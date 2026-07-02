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
    // Parse model and color: "7036 - c2.avif", "9001S - c3 .avif", "G5921 c2.avif", "R12221 .avif"
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
        color = 'c1'; // fallback
    }

    console.log(`\nProcessing: Model=${model}, Color=${color} (from ${file})`);

    let measurements = { lensWidth: null, bridgeWidth: null, templeLength: null, frameHeight: null };
    let kazwiniImages = [];

    // Search Kazwini
    const searchUrl = `https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(model)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle' });
    
    // Find the link to the product
    const productLink = await page.$('a.product-link, .card a');
    if (productLink) {
        const href = await productLink.getAttribute('href');
        if (href) {
            console.log(`Found product on Kazwini: ${href}`);
            await page.goto(href.startsWith('http') ? href : `https://kazwiniopticalgroup.com${href}`, { waitUntil: 'networkidle' });
            
            // Extract images and measurements
            kazwiniImages = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('.product-gallery img, .thumbnail-image img, .carousel img, .product-images img'));
                return imgs.map(i => i.src).filter(src => src && src.startsWith('http'));
            });
            kazwiniImages = [...new Set(kazwiniImages)]; // unique

            measurements = await page.evaluate(() => {
                let text = document.body.innerText;
                let lw = null, bw = null, tl = null, fh = null;
                // Look for patterns like "52-18-140"
                const match = text.match(/(\d{2})[- ](\d{2})[- ](\d{3})/);
                if (match) {
                    lw = parseInt(match[1]);
                    bw = parseInt(match[2]);
                    tl = parseInt(match[3]);
                }
                return { lensWidth: lw, bridgeWidth: bw, templeLength: tl, frameHeight: fh };
            });
            console.log("Measurements from Kazwini:", measurements);
            console.log("Extra images from Kazwini:", kazwiniImages.length);
        }
    } else {
        console.log(`Model ${model} not found on Kazwini.`);
    }

    // Process the desktop image
    const finalSlug = `clipon-${model.toLowerCase()}-${color.toLowerCase()}`;
    const mainImageName = `${finalSlug}.webp`;
    const mainImagePath = path.join(PUBLIC_DIR, mainImageName);
    
    await sharp(filePath)
        .webp({ quality: 85 })
        .toFile(mainImagePath);
        
    const finalImages = [`/images/products/${mainImageName}`];
    
    // Create or find Product
    const productName = `Clip-On ${model} ${color.toUpperCase()}`;
    
    let product = await prisma.product.findFirst({
        where: { name: productName }
    });
    
    if (!product) {
        product = await prisma.product.create({
            data: {
                name: productName,
                model: `${model} ${color.toUpperCase()}`,
                brand: "Kazwini",
                category: "Lentes de Sol", // Clip-ons go to sun? Or specific category? Let's use Lentes de Sol
                type: "Armazón",
                stock: 1,
                price: 70000, // Default price? I'll set 0 and they can update
                cost: 0,
                publishToWeb: true,
                origin: "STOCK",
                imagenesCatalogo: finalImages,
                rawImageUrls: finalImages,
                ...measurements
            }
        });
        console.log("Created Product:", product.id);
    } else {
        product = await prisma.product.update({
            where: { id: product.id },
            data: {
                imagenesCatalogo: finalImages,
                publishToWeb: true,
                ...measurements
            }
        });
        console.log("Updated Product:", product.id);
    }
    
    // Create or find WebProduct
    let webProduct = await prisma.webProduct.findUnique({
        where: { slug: finalSlug }
    });
    
    if (!webProduct) {
        webProduct = await prisma.webProduct.create({
            data: {
                productId: product.id,
                name: productName,
                slug: finalSlug,
                category: "Lentes de Sol",
                isActive: true,
                imageUrl: finalImages[0],
                images: finalImages
            }
        });
        console.log("Created WebProduct:", webProduct.slug);
    } else {
        webProduct = await prisma.webProduct.update({
            where: { slug: finalSlug },
            data: {
                isActive: true,
                imageUrl: finalImages[0],
                images: finalImages
            }
        });
        console.log("Updated WebProduct:", webProduct.slug);
    }
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
