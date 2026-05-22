import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
const prisma = new PrismaClient();

const CANVAS_SIZE = 1024;
const PRODUCT_WIDTH_RATIO = 0.80;
const MAX_HEIGHT_RATIO = 0.55;

async function normalizeImageSize(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const WT = 240;

  const rowSpans: { left: number; right: number; width: number }[] = [];
  let gMinY = info.height, gMaxY = 0;

  for (let y = 0; y < info.height; y++) {
    let rMinX = info.width, rMaxX = 0, has = false;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * channels;
      if (data[i+3] > 20 && (data[i] < WT || data[i+1] < WT || data[i+2] < WT)) {
        if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x; has = true;
      }
    }
    rowSpans.push(has ? { left: rMinX, right: rMaxX, width: rMaxX - rMinX } : { left: 0, right: 0, width: 0 });
    if (has) { if (y < gMinY) gMinY = y; if (y > gMaxY) gMaxY = y; }
  }
  if (gMaxY <= gMinY) return inputBuffer;

  // Widest row = front of frame (lenses)
  let maxRowW = 0;
  for (const s of rowSpans) if (s.width > maxRowW) maxRowW = s.width;

  // Global bounding box
  let gMinX = info.width, gMaxX = 0;
  for (const s of rowSpans) if (s.width > 0) { if (s.left < gMinX) gMinX = s.left; if (s.right > gMaxX) gMaxX = s.right; }

  const margin = Math.round(maxRowW * 0.02);
  const cL = Math.max(0, gMinX-margin), cT = Math.max(0, gMinY-margin);
  const cW = Math.min(info.width-cL, (gMaxX-gMinX)+margin*2);
  const cH = Math.min(info.height-cT, (gMaxY-gMinY)+margin*2);

  const cropped = await sharp(inputBuffer).extract({left:cL,top:cT,width:cW,height:cH}).toBuffer();

  const targetFW = Math.round(CANVAS_SIZE * PRODUCT_WIDTH_RATIO);
  const scale = targetFW / maxRowW;
  let fW = Math.round(cW * scale), fH = Math.round(cH * scale);
  const maxH = Math.round(CANVAS_SIZE * MAX_HEIGHT_RATIO);
  if (fH > maxH) { const hs = maxH/fH; fW = Math.round(fW*hs); fH = maxH; }

  const resized = await sharp(cropped).resize(fW, fH, {fit:'fill'}).toBuffer();
  const rm = await sharp(resized).metadata();
  const rw = rm.width||fW, rh = rm.height||fH;
  const oX = Math.round((CANVAS_SIZE-rw)/2), oY = Math.round((CANVAS_SIZE-rh)/2);

  const result = await sharp({create:{width:CANVAS_SIZE,height:CANVAS_SIZE,channels:3,background:{r:255,g:255,b:255}}})
    .composite([{input:resized,left:oX,top:oY}]).png().toBuffer();
  console.log(`  Normalized: widestRow=${maxRowW}, bbox=${cW}x${cH} → ${rw}x${rh} on ${CANVAS_SIZE}x${CANVAS_SIZE}`);
  return result;
}

const CATALOG_PROMPT = `You are a professional product photographer. Clean up this eyewear photo:
- Remove ENTIRE background, ALL shadows, reflections, glare.
- Output: eyewear ONLY on pure white (#FFFFFF). NO shadows, NO effects.
- Show full frame including temples. Do NOT crop any part.
- Output as high-quality PNG.
After image, output "METADATA:" + brief Spanish description (color, material, shape, size).`;

const MALE_PROMPT = `Generate a SQUARE 1:1 image. Extreme close-up of a young male model: buzzcut, fair skin, angular jaw, silver hoop earring, intense expression. Wearing the EXACT glasses from reference. Face fills entire frame edge-to-edge. White background. Photorealistic. NO TEXT.`;
const FEMALE_PROMPT = `Generate a SQUARE 1:1 image. Extreme close-up of a young female model: golden blonde wavy hair, light blue eyes, fair skin, natural makeup, elegant expression. Wearing the EXACT glasses from reference. Face fills entire frame edge-to-edge. White background. Photorealistic. NO TEXT.`;

const PRODUCTS = [
  { id: 'cmpe7xpwz00004mdiznl56m2w', name: 'Atelier TEST-01' },
  { id: 'cmnkjy0mr005i10yt326ya73b', name: 'Rusty' },
];

async function processProduct(ai: GoogleGenAI, product: typeof PRODUCTS[0]) {
  const dir = path.join(process.cwd(), 'storage/uploads/products', product.id);
  const files = fs.readdirSync(dir).filter(f => f.startsWith('raw_'));
  if (!files.length) { console.log(`[${product.name}] No raw, skip`); return; }
  const buffer = fs.readFileSync(path.join(dir, files[files.length - 1]));
  console.log(`[${product.name}] Raw: ${buffer.length} bytes`);

  console.log(`[${product.name}] Catalog...`);
  const catRes = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [{ text: CATALOG_PROMPT }, { inlineData: { data: buffer.toString('base64'), mimeType: 'image/jpeg' } }] }],
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });
  let rawCat: Buffer | null = null; let meta = '';
  for (const p of catRes.candidates?.[0]?.content?.parts || []) {
    if (p.inlineData?.data) rawCat = Buffer.from(p.inlineData.data, 'base64');
    if (p.text) meta += p.text;
  }
  if (!rawCat) { console.error(`[${product.name}] No image!`); return; }

  console.log(`[${product.name}] Normalizing...`);
  const catalogBuffer = await normalizeImageSize(rawCat);
  const catName = `catalog_0_${Date.now()}.png`;
  fs.writeFileSync(path.join(dir, catName), catalogBuffer);
  const keys = [`local://products/${product.id}/${catName}`];
  console.log(`[${product.name}] ✅ Catalog (${catalogBuffer.length} bytes)`);

  for (const [label, prompt] of [['Male', MALE_PROMPT], ['Female', FEMALE_PROMPT]]) {
    console.log(`[${product.name}] ${label}...`);
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: catalogBuffer.toString('base64'), mimeType: 'image/png' } }] }],
        config: { responseModalities: ['IMAGE'] },
      });
      if (res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        const buf = Buffer.from(res.candidates[0].content.parts[0].inlineData.data, 'base64');
        const name = `avatar_${label.toLowerCase()}_${Date.now()}.png`;
        fs.writeFileSync(path.join(dir, name), buf);
        keys.push(`local://products/${product.id}/${name}`);
        console.log(`[${product.name}] ✅ ${label} (${buf.length} bytes)`);
      }
    } catch (e: any) { console.error(`[${product.name}] ${label} failed:`, e.message); }
  }

  await prisma.product.update({ where: { id: product.id }, data: { imagenesCatalogo: keys, imageProcessingStatus: 'READY',
    ...(meta.includes('METADATA:') ? { seoDescription: meta.split('METADATA:')[1].trim() } : {}) } });
  console.log(`[${product.name}] ✅ Done (${keys.length} images)\n`);
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
  for (const p of PRODUCTS) await processProduct(ai, p);
  console.log('🎯 All done!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
