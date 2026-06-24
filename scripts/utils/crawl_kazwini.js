const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCRATCH_DIR = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch';
const OUTPUT_FILE = path.join(SCRATCH_DIR, 'scraped_products.json');

// Helper to determine brand from catalog title
function detectBrand(title) {
  const t = title.toUpperCase();
  if (t.includes('KAZWINI')) return 'Kazwini';
  if (t.includes('LINDBERG')) return 'Lindberg';
  if (t.includes('SILHOUETTE')) return 'Silhouette';
  if (t.includes('KHAOS')) return 'Khaos';
  if (t.includes('DAVID JACOBS')) return 'David Jacobs';
  if (t.includes('HANG LOOSE') || t.includes('HANGO LOOSE')) return 'Hang Loose';
  if (t.includes('CLIP ON') || t.includes('CLIP-ON')) return 'Clip On';
  
  // Default to first two words of title
  const words = title.trim().split(/\s+/);
  return words.slice(0, 2).join(' ');
}

// Helper to determine category
function detectCategory(title) {
  const t = title.toUpperCase();
  if (t.includes('SOL') || t.includes('SUNGLASSES')) {
    return 'Lentes de Sol';
  }
  if (t.includes('CONTACTO') || t.includes('LENS')) {
    return 'Lentes de Contacto';
  }
  return 'Lentes de Receta';
}

async function main() {
  const args = process.argv.slice(2);
  const crawlAll = args.includes('--all');
  const markupMultiplier = parseFloat(args.find(arg => arg.startsWith('--markup='))?.split('=')[1]) || 1.5; // default 50% markup

  console.log(`Starting crawl. Crawl all: ${crawlAll}. Markup multiplier: ${markupMultiplier}`);

  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
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
  
  console.log("Navigating to shop...");
  await page.goto('https://kazwiniopticalgroup.com/shop', { waitUntil: 'networkidle' });
  
  console.log("Extracting catalog links...");
  const catalogLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a.catalog-btn'));
    return links.map(a => ({
      href: a.href,
      title: a.closest('.catalog-card')?.querySelector('.catalog-title')?.textContent?.trim() || 'Desconocido'
    }));
  });

  console.log(`Found ${catalogLinks.length} catalogs.`);
  
  // Decide how many catalogs to crawl
  const catalogsToCrawl = crawlAll ? catalogLinks : catalogLinks.slice(0, 3);
  console.log(`Crawl list contains ${catalogsToCrawl.length} catalogs.`);

  const allProducts = [];

  for (let i = 0; i < catalogsToCrawl.length; i++) {
    const catalog = catalogsToCrawl[i];
    console.log(`[${i + 1}/${catalogsToCrawl.length}] Crawling catalog: "${catalog.title}"...`);
    
    try {
      await page.goto(catalog.href, { waitUntil: 'networkidle', timeout: 30000 });
      
      const parsedProducts = await page.evaluate((baseCatalog) => {
        // This runs in browser context
        const cards = Array.from(document.querySelectorAll('.card'));
        const products = [];
        
        cards.forEach(card => {
          // Get product code (e.g. MB1513)
          const codeEl = card.querySelector('.product-header h5');
          if (!codeEl) return;
          const codeText = codeEl.textContent.replace('◆', '').trim();
          
          // Find variation inputs
          const variantInputs = Array.from(card.querySelectorAll('input.variant-thumbnail-input'));
          
          // If no variations, check if there's a single product cover input
          if (variantInputs.length === 0) {
            const singleInput = card.querySelector('input[data-js-product-cover]');
            if (singleInput) {
              variantInputs.push(singleInput);
            }
          }
          
          variantInputs.forEach(input => {
            const configStr = input.getAttribute('data-js-config');
            if (!configStr) return;
            try {
              const config = JSON.parse(configStr);
              
              const colorName = config.color_name || 'C1';
              const costUSD = parseFloat(config.precio) || 0;
              const stock = parseInt(config.stock) || 0;
              
              // Map images to absolute URLs
              const relativeImages = config.images || [];
              const absoluteImages = relativeImages.map(img => {
                const urlPath = img.pathUrl || img;
                if (urlPath.startsWith('http')) return urlPath;
                return `https://kazwiniopticalgroup.com${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
              });
              
              products.push({
                code: codeText,
                colorCode: colorName,
                cost: costUSD,
                stock: stock,
                images: absoluteImages,
                catalogTitle: baseCatalog.title
              });
            } catch (err) {
              // Ignore invalid JSON
            }
          });
        });
        
        return products;
      }, catalog);
      
      console.log(`  Parsed ${parsedProducts.length} variations from catalog.`);
      
      // Post-process items on node side (detect brand, category, apply markup)
      parsedProducts.forEach(item => {
        const brand = detectBrand(item.catalogTitle || catalog.title);
        const category = detectCategory(item.catalogTitle || catalog.title);
        
        // Product name is Brand + Model Code + Color Code
        const productName = `${brand} ${item.code} ${item.colorCode}`.trim();
        const modelName = `${item.code} ${item.colorCode}`.trim();
        
        // Calculate markup price
        const priceUSD = item.cost * markupMultiplier;
        
        allProducts.push({
          name: productName,
          brand: brand,
          model: modelName,
          type: 'Armazón',
          category: category,
          price: priceUSD,
          cost: item.cost,
          stock: item.stock,
          publishToWeb: true,
          origin: 'STOCK',
          rawImageUrls: item.images,
          imagenesCatalogo: item.images
        });
      });
      
    } catch (err) {
      console.error(`  Error crawling catalog ${catalog.href}:`, err.message);
    }
    
    // Tiny delay between pages to avoid slamming the server
    await page.waitForTimeout(1000);
  }

  // Ensure scratch dir exists
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  // Write results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
  console.log(`\nCrawl complete! Total variations scraped: ${allProducts.length}`);
  console.log(`Saved output file to: ${OUTPUT_FILE}`);

  await browser.close();
}

main().catch(console.error);
