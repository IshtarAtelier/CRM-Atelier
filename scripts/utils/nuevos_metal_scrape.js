/**
 * Fase A.2 — loguea en Kazwini y busca las medidas (lensWidth-bridgeWidth-templeLength)
 * de cada modelo. Actualiza el manifest en su lugar. Best-effort: si un modelo no
 * aparece, quedan en null. NO toca la base.
 *
 * Correr:  node scripts/utils/nuevos_metal_scrape.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MANIFEST = path.join(__dirname, '../../scratch/nuevos_metal_manifest.json');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const models = [...new Set(manifest.map((m) => m.model))];
  const found = {};

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext().then((c) => c.newPage());

  console.log('Logueando en Kazwini…');
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

  for (const model of models) {
    try {
      await page.goto(`https://kazwiniopticalgroup.com/shop/search?s=${encodeURIComponent(model)}`, { waitUntil: 'networkidle' });
      const m = await page.evaluate((searchModel) => {
        const cards = Array.from(document.querySelectorAll('.card'));
        for (const card of cards) {
          const t = card.querySelector('.product-header h5');
          if (!t) continue;
          const title = t.textContent.replace('◆', '').trim().toUpperCase();
          if (title.includes(searchModel.toUpperCase()) || searchModel.toUpperCase().includes(title)) {
            const match = card.innerText.match(/(\d{2})[-\s](\d{2})[-\s](\d{3})/);
            if (match) return { lensWidth: +match[1], bridgeWidth: +match[2], templeLength: +match[3] };
            return { lensWidth: null, bridgeWidth: null, templeLength: null };
          }
        }
        // fallback: patrón en toda la página
        const g = document.body.innerText.match(/(\d{2})[-\s](\d{2})[-\s](\d{3})/);
        return g ? { lensWidth: +g[1], bridgeWidth: +g[2], templeLength: +g[3] } : null;
      }, model);
      found[model] = m;
      console.log(`${model.padEnd(9)} → ${m ? JSON.stringify(m) : 'no encontrado'}`);
    } catch (e) {
      console.log(`${model.padEnd(9)} → error: ${e.message}`);
      found[model] = null;
    }
  }

  await browser.close();

  for (const entry of manifest) {
    const m = found[entry.model];
    if (m) entry.measurements = m;
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('\nManifest actualizado con medidas.');
}

main().catch((e) => { console.error(e); process.exit(1); });
