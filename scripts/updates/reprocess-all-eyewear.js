require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');

// Configuration constants matching the API route
const CANVAS_SIZE = 1024;
const PRODUCT_WIDTH_RATIO = 0.80;
const MAX_HEIGHT_RATIO = 0.55;

const CATALOG_PROMPT = `You are a professional product photographer for a premium eyewear e-commerce catalog.

TASK: Clean up this eyewear photo for catalog use. You MUST follow ALL rules below without exception.

=== BACKGROUND REMOVAL ===
- Remove the ENTIRE background. Remove ALL shadows, reflections, glare, lighting artifacts.
- Output: eyewear ONLY on pure flat white (#FFFFFF). NO shadows. NO glow. NO effects. Just the product on white.

=== BRANDING REMOVAL AND REPLACEMENT ===
- Identify any logo, brand name, text, or emblem printed on the lenses (cristales) of the glasses (for example: "Ray-Ban", "Oakley", etc.).
- REMOVE this original text/logo completely from the glass/lens. Ensure that the lens is left perfectly clear, clean, and transparent where the logo was.
- Add/print the text "ATELIER" ONLY on the lens. The font must always be identical across all products: use a small, clean, modern, medium-weight, geometric sans-serif typeface (similar to Arial or Helvetica), uppercase, colored in a soft semi-transparent white (approximately 70% opacity).
- The text "ATELIER" must always be placed horizontally, centered in the lower portion of the viewer's left lens (the lens on the left side of the image from the viewer's perspective).
- Do NOT alter, distort, or change the shape, structure, thickness, color, or style of the frames or lenses. Keep the glasses exactly as they are in the original image, except for removing the printed brand/logo from the lenses and adding the small, clean "ATELIER" brand text only on the lens.

=== MANDATORY SIZING — THIS IS THE MOST IMPORTANT RULE ===

READ THIS CAREFULLY. THIS RULE CANNOT BE IGNORED OR APPROXIMATED.

The output image MUST be exactly 1024x1024 pixels (square).

The eyewear MUST span EXACTLY 80% of the image width. That means:
- The leftmost pixel of the frame must be at approximately x=102 (10% margin on left)
- The rightmost pixel of the frame must be at approximately x=922 (10% margin on right)
- The frame therefore occupies ~820 pixels of the 1024 pixel width

This applies to EVERY product identically:
- A small round frame? Scale it UP to 80% width.
- A large aviator frame? Scale it DOWN to 80% width.
- EVERY frame, regardless of its real-world size, must appear the SAME width in the output.

WHY: These images are displayed side-by-side in a product grid. If one frame is 50% width and another is 90% width, the catalog looks amateur and inconsistent. ALL frames must be the SAME visual size.

VERIFICATION: Before outputting, mentally check: "Does the frame span from roughly the 10% mark to the 90% mark horizontally?" If not, adjust.

=== CENTERING ===
- Center the product BOTH horizontally AND vertically.
- The vertical center of the frame should be at approximately y=480 (slightly above center to leave room for temples).

=== DO NOT ===
- Do NOT distort, stretch, or change the aspect ratio of the eyewear.
- Do NOT add any shadow, reflection, or lighting effect.
- Do NOT crop any part of the eyewear — temples, hinges, and nose pads must all be fully visible.

=== TEXT OUTPUT ===
After the image, output "METADATA:" followed by a brief Spanish description of the eyewear (color, material, shape, size).
Example: "METADATA: Anteojos rectangulares XL de acetato negro mate, estilo vintage."`;

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const isCloudEnabled = !!(projectId && clientEmail && privateKey && storageBucket);

if (isCloudEnabled && !admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        storageBucket
    });
    console.log("Firebase Admin initialized successfully (Cloud Storage enabled)");
} else {
    console.log("Using Local Storage mode for files");
}

async function getFileBuffer(key) {
    if (key.startsWith('local://')) {
        const pureKey = key.replace('local://', '');
        const filepath = path.join(process.cwd(), 'storage', 'uploads', pureKey);
        return fs.promises.readFile(filepath);
    }
    if (key.startsWith('/uploads/')) {
        const filepath = path.join(process.cwd(), 'public', key);
        return fs.promises.readFile(filepath);
    }
    if (isCloudEnabled) {
        const bucket = admin.storage().bucket();
        const [buffer] = await bucket.file(key).download();
        return buffer;
    }
    // Local fallback
    const filepath = path.join(process.cwd(), 'storage', 'uploads', key);
    return fs.promises.readFile(filepath);
}

async function uploadFile(buffer, filename, contentType) {
    if (isCloudEnabled) {
        const bucket = admin.storage().bucket();
        const file = bucket.file(filename);
        await file.save(buffer, {
            metadata: { contentType }
        });
        return filename;
    } else {
        const storageDir = path.join(process.cwd(), 'storage', 'uploads');
        const filepath = path.join(storageDir, filename);
        await fs.promises.mkdir(path.dirname(filepath), { recursive: true });
        await fs.promises.writeFile(filepath, buffer);
        return `local://${filename}`;
    }
}

async function normalizeImageSize(inputBuffer) {
  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) return inputBuffer;

    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const WHITE_THRESHOLD = 240;

    const rowSpans = [];
    let globalMinY = info.height, globalMaxY = 0;

    for (let y = 0; y < info.height; y++) {
      let rowMinX = info.width, rowMaxX = 0;
      let hasContent = false;

      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * channels;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        if (a > 20 && (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD)) {
          if (x < rowMinX) rowMinX = x;
          if (x > rowMaxX) rowMaxX = x;
          hasContent = true;
        }
      }

      if (hasContent) {
        rowSpans.push({ left: rowMinX, right: rowMaxX, width: rowMaxX - rowMinX });
        if (y < globalMinY) globalMinY = y;
        if (y > globalMaxY) globalMaxY = y;
      } else {
        rowSpans.push({ left: 0, right: 0, width: 0 });
      }
    }

    if (globalMaxY <= globalMinY) {
      return inputBuffer;
    }

    let maxRowWidth = 0;
    for (const span of rowSpans) {
      if (span.width > maxRowWidth) maxRowWidth = span.width;
    }

    let globalMinX = info.width, globalMaxX = 0;
    for (const span of rowSpans) {
      if (span.width > 0) {
        if (span.left < globalMinX) globalMinX = span.left;
        if (span.right > globalMaxX) globalMaxX = span.right;
      }
    }

    const margin = Math.round(maxRowWidth * 0.02);
    const cropLeft = Math.max(0, globalMinX - margin);
    const cropTop = Math.max(0, globalMinY - margin);
    const cropWidth = Math.min(info.width - cropLeft, (globalMaxX - globalMinX) + margin * 2);
    const cropHeight = Math.min(info.height - cropTop, (globalMaxY - globalMinY) + margin * 2);

    const cropped = await sharp(inputBuffer)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .toBuffer();

    const targetFrontWidth = Math.round(CANVAS_SIZE * PRODUCT_WIDTH_RATIO);
    const scale = targetFrontWidth / maxRowWidth;

    let finalWidth = Math.round(cropWidth * scale);
    let finalHeight = Math.round(cropHeight * scale);

    const maxHeight = Math.round(CANVAS_SIZE * MAX_HEIGHT_RATIO);
    if (finalHeight > maxHeight) {
      const heightScale = maxHeight / finalHeight;
      finalWidth = Math.round(finalWidth * heightScale);
      finalHeight = maxHeight;
    }

    const resized = await sharp(cropped)
      .resize(finalWidth, finalHeight, { fit: 'fill' })
      .toBuffer();

    const resizedMeta = await sharp(resized).metadata();
    const rw = resizedMeta.width || finalWidth;
    const rh = resizedMeta.height || finalHeight;

    const offsetX = Math.round((CANVAS_SIZE - rw) / 2);
    const offsetY = Math.round((CANVAS_SIZE - rh) / 2);

    const result = await sharp({
      create: { width: CANVAS_SIZE, height: CANVAS_SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } }
    })
      .composite([{ input: resized, left: offsetX, top: offsetY }])
      .png()
      .toBuffer();

    return result;
  } catch (err) {
    console.error('Normalize failed:', err);
    return inputBuffer;
  }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const all = args.includes('--all');
    let limit = 1;
    const limitArgIndex = args.indexOf('--limit');
    if (limitArgIndex !== -1 && args[limitArgIndex + 1]) {
        limit = parseInt(args[limitArgIndex + 1], 10);
    }
    const idArgIndex = args.indexOf('--id');
    let targetId = null;
    if (idArgIndex !== -1 && args[idArgIndex + 1]) {
        targetId = args[idArgIndex + 1];
    }

    console.log(`Running in: ${dryRun ? 'DRY-RUN' : 'LIVE'} mode. Limit: ${all ? 'unlimited' : limit}, Target ID: ${targetId || 'none'}`);

    const prisma = new PrismaClient();
    await prisma.$connect();

    // Find all products that have images in their catalog
    const query = {
        where: {
            imagenesCatalogo: { isEmpty: false }
        }
    };
    
    if (targetId) {
        query.where.id = targetId;
    }

    if (!all && !targetId) {
        query.take = limit;
    }

    const products = await prisma.product.findMany(query);

    console.log(`Found ${products.length} products to process.`);

    const geminiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!geminiKey) {
        console.error("GOOGLE_GENAI_API_KEY is not defined in the environment variables.");
        await prisma.$disconnect();
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    for (const p of products) {
        const imageKey = p.imagenesCatalogo[0];
        console.log(`\nProcessing product: [${p.id}] ${p.brand} ${p.model || p.name}`);
        console.log(`- Original image key: ${imageKey}`);

        if (dryRun) {
            console.log(`- [DRY RUN] Would retrieve image, send to Gemini, and save new image.`);
            continue;
        }

        try {
            console.log(`- Downloading original image...`);
            const buffer = await getFileBuffer(imageKey);
            if (!buffer) {
                console.error(`- Error: Could not download image buffer for key: ${imageKey}`);
                continue;
            }

            console.log(`- Invoking Gemini model for branding removal and replacement...`);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: CATALOG_PROMPT },
                            {
                                inlineData: {
                                    data: buffer.toString('base64'),
                                    mimeType: 'image/png', // The catalog images are png
                                }
                            }
                        ]
                    }
                ],
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                },
            });

            let processedBuffer = null;
            let extractedMetadata = "";
            let imageExtracted = false;

            const candidates = response.candidates;
            if (candidates && candidates.length > 0) {
                const parts = candidates[0].content?.parts;
                if (parts) {
                    for (const part of parts) {
                        if (part.text) {
                            extractedMetadata += part.text + " ";
                        }
                        if (part.inlineData?.data) {
                            processedBuffer = Buffer.from(part.inlineData.data, 'base64');
                            imageExtracted = true;
                        }
                    }
                }
            }

            if (!imageExtracted || !processedBuffer) {
                console.error(`- Error: Gemini did not return processed image data.`);
                continue;
            }

            console.log(`- Running image normalization...`);
            processedBuffer = await normalizeImageSize(processedBuffer);

            // Generate output file key
            const cleanKey = imageKey.replace('local://', '');
            const dir = path.dirname(cleanKey);
            const ext = path.extname(cleanKey) || '.png';
            const base = path.basename(cleanKey, ext);
            
            // To prevent overwriting raw uploaded images, save as a new filename
            const newFilename = `${dir}/${base}_atelier_${Date.now()}${ext}`;

            console.log(`- Uploading processed image as: ${newFilename}`);
            const uploadedKey = await uploadFile(processedBuffer, newFilename, 'image/png');
            
            console.log(`- Updating product database...`);
            await prisma.product.update({
                where: { id: p.id },
                data: {
                    imagenesCatalogo: [uploadedKey] // Replace with the newly processed image
                }
            });

            console.log(`- Product ${p.id} successfully updated with new image: ${uploadedKey}`);

        } catch (e) {
            console.error(`- Error processing product ${p.id}:`, e);
        }
    }

    await prisma.$disconnect();
    console.log("\nFinished reprocessing execution.");
}

main().catch(console.error);
