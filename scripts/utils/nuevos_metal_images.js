/**
 * Fase A — procesa las fotos de los 8 modelos nuevos (metal, unisex) desde
 * `Desktop/Pagina web atelier/Nuevos`, las convierte a webp optimizado en
 * public/images/products/ y escribe un manifest JSON. NO toca la base.
 *
 * Correr:  node scripts/utils/nuevos_metal_images.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const INPUT_DIR = '/Users/ishtarpissano/Desktop/Pagina web atelier/Nuevos';
const PUBLIC_DIR = path.join(__dirname, '../../public/images/products');
const MANIFEST = path.join(__dirname, '../../scratch/nuevos_metal_manifest.json');

// Nombre de fantasía + clasificación por código de modelo (confirmado por el usuario)
const MODELS = {
  'GS7008S': { name: 'Eros',   webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'GS7010S': { name: 'Apolo',  webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'GS7014S': { name: 'Ares',   webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'GS7017S': { name: 'Febo',   webCat: 'Sol',    prodCat: 'Lentes de Sol',     type: 'Armazón',           costUSD: 10.78 },
  'G7008':   { name: 'Atlas',  webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
  'G7010':   { name: 'Jano',   webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
  'G7012':   { name: 'Orión',  webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
  'G7013':   { name: 'Néstor', webCat: 'Receta', prodCat: 'Armazón de Receta', type: 'Armazón de Receta', costUSD: 10.06 },
};

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// prioridad de la toma para ordenar (menor = imagen principal)
function anglePriority(desc) {
  const d = desc.toLowerCase();
  if (d.includes('frente')) return 0;
  if (d === '' ) return 1;
  if (d.includes('sol') && !d.includes('lateral')) return 2;
  if (d.includes('lateral')) return 3;
  if (d.includes('45')) return 4;
  if (d.includes('atras') || d.includes('atrás')) return 5;
  return 3;
}

function parse(file) {
  const base = file.replace(/\.avif$/i, '').replace(/\s+/g, ' ').trim();
  const tokens = base.split(' ');
  const model = tokens[0];
  const colorTok = tokens.find((t) => /^c\d+$/i.test(t.replace(/[()]/g, '')));
  const color = (colorTok ? colorTok.replace(/[()]/g, '') : 'c1').toLowerCase();
  const desc = tokens.slice(1).filter((t) => !/^c\d+$/i.test(t.replace(/[()]/g, ''))).join(' ').replace(/[()]/g, '').trim();
  return { model, color, desc };
}

async function toWebp(src, destAbs) {
  try {
    await sharp(src).resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(destAbs);
    return true;
  } catch (e) {
    // fallback: sips avif->png, luego sharp png->webp (algunos .avif rompen a sharp)
    const tmpPng = destAbs.replace(/\.webp$/, '.tmp.png');
    execFileSync('sips', ['-s', 'format', 'png', src, '--out', tmpPng], { stdio: 'ignore' });
    await sharp(tmpPng).resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(destAbs);
    fs.unlinkSync(tmpPng);
    return true;
  }
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });

  const files = fs.readdirSync(INPUT_DIR).filter((f) => /\.avif$/i.test(f));
  const groups = {}; // key: model|color

  for (const file of files) {
    const { model, color, desc } = parse(file);
    if (!MODELS[model]) { console.log(`⚠️  sin config, salteo: ${file} (modelo ${model})`); continue; }
    const key = `${model}|${color}`;
    (groups[key] ||= []).push({ file, desc });
  }

  const manifest = [];
  for (const key of Object.keys(groups).sort()) {
    const [model, color] = key.split('|');
    const cfg = MODELS[model];
    const slug = `${slugify(cfg.name)}-${color}`;
    const shots = groups[key].sort((a, b) => anglePriority(a.desc) - anglePriority(b.desc));

    const images = [];
    let idx = 0;
    for (const shot of shots) {
      idx++;
      const outName = idx === 1 ? `${slug}.webp` : `${slug}-${idx}.webp`;
      const destAbs = path.join(PUBLIC_DIR, outName);
      await toWebp(path.join(INPUT_DIR, shot.file), destAbs);
      images.push(`/images/products/${outName}`);
    }

    manifest.push({
      model, color, slug,
      name: `${cfg.name} ${color.toUpperCase()}`,
      productModel: `${model} ${color.toUpperCase()}`,
      webCat: cfg.webCat, prodCat: cfg.prodCat, type: cfg.type,
      costUSD: cfg.costUSD,
      images,
      measurements: { lensWidth: null, bridgeWidth: null, templeLength: null },
    });
    console.log(`✓ ${slug.padEnd(12)} ${images.length} foto(s)  [${model} ${color}]`);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${MANIFEST}  (${manifest.length} variantes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
