/**
 * Fuente autoritativa: Kazwini. Descarga las fotos limpias por color (portada
 * primero = frontal), convierte a webp en public/images/products/ y arma el
 * manifest con medidas de Kazwini. NO toca la base.
 *   node scripts/utils/nuevos_metal_kz.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const KZ = JSON.parse(fs.readFileSync(path.join(__dirname, '../../scratch/kazwini_variants.json'), 'utf8'));
const PUBLIC_DIR = path.join(__dirname, '../../public/images/products');
const MANIFEST = path.join(__dirname, '../../scratch/nuevos_metal_manifest.json');
const TMP = path.join(__dirname, '../../scratch/kzdl');

// nombre estelar + categoría + costo USD por código de modelo (confirmado usuario)
const MODELS = {
  'GS7008S': { name: 'Sirio',   webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'GS7010S': { name: 'Vega',    webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'GS7014S': { name: 'Altair',  webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'GS7017S': { name: 'Antares', webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'G7008':   { name: 'Rigel',   webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
  'G7010':   { name: 'Lira',    webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
  'G7012':   { name: 'Orión',   webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
  'G7013':   { name: 'Halley',  webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
};

// colores a publicar por modelo = los que ordenó/fotografió el usuario, con el
// código real de Kazwini (verificado por comparación visual)
const PUBLISH = {
  'GS7008S': ['C1', 'C2'],
  'GS7010S': ['C1', 'C2'],
  'GS7014S': ['C2'],
  'GS7017S': ['C1'],
  'G7008':   ['C1', 'C3'],
  'G7010':   ['C1'],
  'G7012':   ['C1'],
  'G7013':   ['C1'],
};

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(f); f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const manifest = [];

  for (const model of Object.keys(PUBLISH)) {
    const cfg = MODELS[model];
    const data = KZ[model];
    const [lw, bw, tl] = (data.size || '0-0-0').split('-').map(Number);

    for (const color of PUBLISH[model]) {
      const variant = data.variants.find((v) => v.color === color);
      if (!variant) { console.log(`⚠️  ${model} ${color} no está en Kazwini`); continue; }
      const slug = `${slugify(cfg.name)}-${color.toLowerCase()}`;
      const images = [];
      let idx = 0;
      for (const p of variant.images) {          // images[0] = cover = frontal
        idx++;
        const avif = path.join(TMP, `${slug}-${idx}.avif`);
        await download(`https://kazwiniopticalgroup.com${p}`, avif);
        const outName = idx === 1 ? `${slug}.webp` : `${slug}-${idx}.webp`;
        await sharp(avif).resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(PUBLIC_DIR, outName));
        images.push(`/images/products/${outName}`);
      }
      manifest.push({
        model, color, slug,
        name: `${cfg.name} ${color}`,
        productModel: `${model} ${color}`,
        webCat: cfg.webCat, prodCat: cfg.prodCat, type: cfg.type,
        costUSD: cfg.costUSD,
        images,
        measurements: { lensWidth: lw, bridgeWidth: bw, templeLength: tl },
      });
      console.log(`✓ ${slug.padEnd(11)} ${images.length} foto(s)  [${model} ${color}]  ${lw}-${bw}-${tl}`);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${MANIFEST}  (${manifest.length} variantes)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
