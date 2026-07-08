// Exploración: loguea en Kazwini, busca G7008 y vuelca la estructura de datos
// (colores, imágenes, medidas) para entender cómo mapear color->foto.
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then((c) => c.newPage());
  await page.goto('https://kazwiniopticalgroup.com', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const e = document.getElementById('landing-login-email');
    const p = document.getElementById('landing-login-password');
    if (e) e.value = 'pissano@kazwini.com';
    if (p) p.value = 'pissano2025';
    const f = document.getElementById('landing-login-form');
    if (f) f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });
  await page.waitForTimeout(5000);

  const model = process.argv[2] || 'G7008';
  await page.goto(`https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(model)}`, { waitUntil: 'networkidle' });

  // link al detalle del producto
  const href = await page.evaluate((searchModel) => {
    const cards = Array.from(document.querySelectorAll('.card'));
    for (const card of cards) {
      const t = card.querySelector('.product-header h5');
      if (t && t.textContent.toUpperCase().includes(searchModel.toUpperCase())) {
        const a = card.querySelector('a[href]');
        if (a) return a.getAttribute('href');
      }
    }
    return null;
  }, model);
  console.log('DETALLE href:', href);
  if (href) {
    await page.goto(href.startsWith('http') ? href : `https://kazwiniopticalgroup.com${href}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const detail = await page.evaluate(() => {
      const imgs = [...new Set(Array.from(document.querySelectorAll('img'))
        .map((i) => i.src || i.getAttribute('data-src'))
        .filter((s) => s && /storage\/product/.test(s)))];
      // swatches de color: buscar elementos con texto C1/C2/C3/C4 o data-color
      const swatches = Array.from(document.querySelectorAll('[data-color], [data-color-code], .color-option, .variation, button, label, span'))
        .map((el) => ({ t: (el.textContent || '').trim().slice(0, 8), color: el.getAttribute('data-color') || el.getAttribute('data-color-code') || el.getAttribute('data-js-config') }))
        .filter((s) => /^C\d$/i.test(s.t) || s.color);
      const sizeMatch = document.body.innerText.match(/(\d{2}-\d{2}-\d{3})/);
      return { size: sizeMatch ? sizeMatch[1] : null, imgs, swatches: swatches.slice(0, 40) };
    });
    console.log('SIZE:', detail.size);
    console.log('IMÁGENES (', detail.imgs.length, '):');
    detail.imgs.forEach((s) => console.log('  ', s));
    console.log('SWATCHES:', JSON.stringify(detail.swatches).slice(0, 1500));
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
