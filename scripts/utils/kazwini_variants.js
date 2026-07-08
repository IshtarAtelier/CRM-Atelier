/**
 * Extrae de Kazwini, por cada modelo, TODAS las variantes de color reales:
 * { color_code, cover, images[], size }. Fuente autoritativa de fotos + medidas.
 * Salida: scratch/kazwini_variants.json
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MODELS = ['GS7008S', 'GS7010S', 'GS7014S', 'GS7017S', 'G7008', 'G7010', 'G7012', 'G7013'];
const OUT = path.join(__dirname, '../../scratch/kazwini_variants.json');

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

  const result = {};
  for (const model of MODELS) {
    await page.goto(`https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(model)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const data = await page.evaluate((m) => {
      const cards = Array.from(document.querySelectorAll('.card'));
      const card = cards.find((c) => {
        const t = c.querySelector('.product-header h5');
        return t && t.textContent.replace('◆', '').trim().toUpperCase() === m.toUpperCase();
      }) || cards.find((c) => {
        const t = c.querySelector('.product-header h5');
        return t && t.textContent.toUpperCase().includes(m.toUpperCase());
      });
      if (!card) return null;
      const size = (card.innerText.match(/(\d{2}-\d{2}-\d{3})/) || [])[1] || null;
      const variants = [];
      card.querySelectorAll('input[data-js-config]').forEach((inp) => {
        try {
          const cfg = JSON.parse(inp.getAttribute('data-js-config'));
          if (!cfg.color_code) return;
          const imgs = (cfg.images || []).map((i) => i.pathUrl || i).filter(Boolean);
          variants.push({ color: cfg.color_code, cover: cfg.cover, images: imgs, stock: cfg.stock ?? null, reservado: cfg.stock_reservado ?? null, precio: cfg.precio ?? null });
        } catch {}
      });
      // dedup por color
      const seen = new Set(); const uniq = [];
      for (const v of variants) { if (seen.has(v.color)) continue; seen.add(v.color); uniq.push(v); }
      return { size, variants: uniq };
    }, model);
    result[model] = data;
    console.log(`${model.padEnd(9)} size=${data?.size || '?'}  colores=${data ? data.variants.map((v) => `${v.color}(${v.images.length}f,resv${v.reservado})`).join(' ') : 'NO ENCONTRADO'}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`\nGuardado: ${OUT}`);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
