#!/usr/bin/env node
/**
 * Genera copias .webp de todos los .avif de public/ para el feed de Google
 * Shopping: Merchant Center NO acepta AVIF como image_link (sí WebP).
 *
 * Idempotente: solo convierte donde falta el .webp o el .avif es más nuevo.
 * Las copias se commitean al repo (assets estáticos, igual que los .avif).
 * Avisa si una imagen queda por debajo de 500×500 (mínimo de Merchant Center
 * desde abril 2026).
 *
 * Uso: node scripts/ads/convert_feed_images.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', '..', 'public');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main() {
  let converted = 0;
  let skipped = 0;
  const small = [];

  for (const file of walk(ROOT)) {
    if (!file.toLowerCase().endsWith('.avif')) continue;
    const target = file.replace(/\.avif$/i, '.webp');

    const needsWork =
      !fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(file).mtimeMs;
    if (!needsWork) {
      skipped++;
      continue;
    }

    const img = sharp(file);
    const meta = await img.metadata();
    if ((meta.width || 0) < 500 || (meta.height || 0) < 500) {
      small.push(`${path.relative(ROOT, file)} (${meta.width}×${meta.height})`);
    }
    await img.webp({ quality: 82 }).toFile(target);
    converted++;
  }

  console.log(`Convertidas: ${converted} · ya al día: ${skipped}`);
  if (small.length) {
    console.log(
      `\n⚠ ${small.length} imagen(es) por debajo de 500×500 (mínimo de Merchant Center desde abr-2026):`,
    );
    for (const s of small) console.log(`  - ${s}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
