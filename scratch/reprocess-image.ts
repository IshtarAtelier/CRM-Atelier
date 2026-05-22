import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CATALOG_PROMPT = `You are a professional product photographer for a premium eyewear e-commerce catalog.

TASK: Edit this eyewear photo in TWO strict phases, then provide metadata.

PHASE 1 — CLEAN ISOLATION (do this FIRST, before anything else):
- Remove the ENTIRE background: surface, table, fabric, wall, everything.
- Remove ALL existing shadows from the original photo — contact shadows, drop shadows, ambient occlusion, every shadow trace. There must be ZERO remnants of the original lighting environment.
- Remove all reflections, surface glare, and lighting artifacts.
- The result of this phase must be the eyewear ONLY, floating on pure white (#FFFFFF), with absolutely NO shadows at all.

PHASE 2 — STUDIO RELIGHT (apply ONLY after Phase 1 is complete):
- DO NOT keep any shadow from Phase 1. The ONLY shadow in the final image must be the one you create in this phase.
- Add exactly ONE floating elliptical drop shadow:
  * Position: centered directly below the product, 15-20px gap between the bottom of the frame and the top of the shadow.
  * Color: pure black at 12% opacity.
  * Blur: 25-30px soft gaussian blur.
  * Width: 60% of the product width, horizontally centered.
  * Light direction: perfectly top-down (12 o'clock), no lateral offset.
- This shadow must look IDENTICAL on every product for catalog uniformity.

SCALE & POSITIONING RULES (critical for catalog uniformity):
- STANDARDIZED SIZE: The eyewear MUST span exactly 75% of the total frame WIDTH.
- Do NOT distort or stretch the product. Maintain the original aspect ratio.
- CENTER the product both horizontally and vertically in the frame.
- Output as square 1:1 aspect ratio, high-quality PNG.

STRICT RULES FOR TEXT:
You MUST also output a text block starting with "METADATA:" followed by a concise description in Spanish.
Example: "METADATA: Anteojos rectangulares XL, marco grueso color carey oscuro, de acetato, estilo vintage."`;

async function main() {
  const productId = 'cmpe7xpwz00004mdiznl56m2w';
  const rawPath = path.join(process.cwd(), 'storage/uploads/products', productId, 'raw_1779297349484_WhatsApp_Image_2026-05-20_at_13.36.05.jpeg');
  
  if (!fs.existsSync(rawPath)) {
    console.error('Raw image not found at:', rawPath);
    return;
  }

  const buffer = fs.readFileSync(rawPath);
  console.log(`[Reprocess] Read raw image: ${buffer.length} bytes`);

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

  // Phase 1: Catalog image
  console.log('[Reprocess] Generating catalog image...');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [{ text: CATALOG_PROMPT }, { inlineData: { data: buffer.toString('base64'), mimeType: 'image/jpeg' } }] }],
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  let catalogBuffer: Buffer | null = null;
  let metadata = '';

  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        catalogBuffer = Buffer.from(part.inlineData.data, 'base64');
      }
      if (part.text) metadata += part.text;
    }
  }

  if (!catalogBuffer) {
    console.error('[Reprocess] Gemini returned no image!');
    console.log('Response text:', metadata);
    return;
  }

  const catalogPath = path.join(process.cwd(), 'storage/uploads/products', productId, `catalog_0_${Date.now()}.png`);
  fs.writeFileSync(catalogPath, catalogBuffer);
  const catalogKey = `local://products/${productId}/${path.basename(catalogPath)}`;
  console.log(`[Reprocess] Catalog saved: ${catalogPath} (${catalogBuffer.length} bytes)`);

  const imageKeys = [catalogKey];

  // Phase 2: Male avatar
  console.log('[Reprocess] Generating male avatar...');
  const MALE_PROMPT = `Generate a SQUARE 1:1 aspect ratio image. Extreme close-up macro portrait of a young male model with a very short buzzcut hairstyle (almost shaved), light/fair skin, strong angular jawline, a small silver hoop earring on one ear, and a serious intense expression. He is wearing the EXACT glasses shown in the reference image. The portrait must fill the ENTIRE square frame edge-to-edge — show from the top of the forehead to below the chin, with the face perfectly centered. NO empty space or margins. Shot in a bright editorial studio with a pure white background. Crisp, even lighting with no harsh shadows on the face. Highly detailed skin texture, intense gaze looking directly at the camera. The glasses must perfectly match the reference image's frame shape, pattern, color, and proportions. Photorealistic quality. NO TEXT in output.`;
  
  try {
    const maleRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: MALE_PROMPT }, { inlineData: { data: catalogBuffer.toString('base64'), mimeType: 'image/png' } }] }],
      config: { responseModalities: ['IMAGE'] },
    });
    if (maleRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      const maleBuf = Buffer.from(maleRes.candidates[0].content.parts[0].inlineData.data, 'base64');
      const malePath = path.join(process.cwd(), 'storage/uploads/products', productId, `avatar_male_${Date.now()}.png`);
      fs.writeFileSync(malePath, maleBuf);
      imageKeys.push(`local://products/${productId}/${path.basename(malePath)}`);
      console.log(`[Reprocess] Male avatar saved (${maleBuf.length} bytes)`);
    }
  } catch (e: any) { console.error('[Reprocess] Male avatar failed:', e.message); }

  // Phase 3: Female avatar
  console.log('[Reprocess] Generating female avatar...');
  const FEMALE_PROMPT = `Generate a SQUARE 1:1 aspect ratio image. Extreme close-up macro portrait of a young female model with long golden blonde wavy hair, striking light blue eyes, fair skin with a natural warm tone, soft natural makeup, and a composed elegant expression. She is wearing the EXACT glasses shown in the reference image. The portrait must fill the ENTIRE square frame edge-to-edge — show from the top of the forehead to below the chin, with the face perfectly centered. NO empty space or margins. Shot in a bright editorial studio with a pure white or very light neutral background. Crisp, soft lighting, highly detailed skin texture, direct gaze at the camera. The glasses must perfectly match the reference image's frame shape, pattern, color, and proportions. Photorealistic quality. NO TEXT in output.`;
  
  try {
    const femaleRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: FEMALE_PROMPT }, { inlineData: { data: catalogBuffer.toString('base64'), mimeType: 'image/png' } }] }],
      config: { responseModalities: ['IMAGE'] },
    });
    if (femaleRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
      const femaleBuf = Buffer.from(femaleRes.candidates[0].content.parts[0].inlineData.data, 'base64');
      const femalePath = path.join(process.cwd(), 'storage/uploads/products', productId, `avatar_female_${Date.now()}.png`);
      fs.writeFileSync(femalePath, femaleBuf);
      imageKeys.push(`local://products/${productId}/${path.basename(femalePath)}`);
      console.log(`[Reprocess] Female avatar saved (${femaleBuf.length} bytes)`);
    }
  } catch (e: any) { console.error('[Reprocess] Female avatar failed:', e.message); }

  // Update DB
  await prisma.product.update({
    where: { id: productId },
    data: {
      imagenesCatalogo: imageKeys,
      imageProcessingStatus: 'READY',
      ...(metadata.includes('METADATA:') ? { seoDescription: metadata.split('METADATA:')[1].trim() } : {}),
    }
  });

  console.log(`[Reprocess] ✅ Done! Updated product with ${imageKeys.length} images.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
