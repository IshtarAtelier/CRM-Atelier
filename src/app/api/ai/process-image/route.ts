import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadFile, getFileBuffer } from '@/lib/storage';
import { after } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

const CANVAS_SIZE = 1024;
const PRODUCT_WIDTH_RATIO = 0.80; // Front of frame must occupy 80% of canvas width
const MAX_HEIGHT_RATIO = 0.55; // Max height 55% of canvas (glasses are landscape)

/**
 * Post-process image to normalize product size for catalog consistency.
 * 
 * Strategy: Find the WIDEST horizontal span of non-white pixels (= the front of the frame,
 * where the lenses are). Use THAT width for the 80% target, not the full bounding box
 * which includes thin temples that would distort the sizing.
 */
async function normalizeImageSize(inputBuffer: Buffer): Promise<Buffer> {
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

    // For each row, track the leftmost and rightmost non-white pixel
    const rowSpans: { left: number; right: number; width: number }[] = [];
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
      console.warn('[Photo Studio] Could not detect product, returning as-is');
      return inputBuffer;
    }

    // Find the WIDEST row span — this is the front of the frame (lenses area)
    let maxRowWidth = 0;
    for (const span of rowSpans) {
      if (span.width > maxRowWidth) maxRowWidth = span.width;
    }

    // Full bounding box for cropping
    let globalMinX = info.width, globalMaxX = 0;
    for (const span of rowSpans) {
      if (span.width > 0) {
        if (span.left < globalMinX) globalMinX = span.left;
        if (span.right > globalMaxX) globalMaxX = span.right;
      }
    }

    // Crop to full bounding box (with small margin)
    const margin = Math.round(maxRowWidth * 0.02);
    const cropLeft = Math.max(0, globalMinX - margin);
    const cropTop = Math.max(0, globalMinY - margin);
    const cropWidth = Math.min(info.width - cropLeft, (globalMaxX - globalMinX) + margin * 2);
    const cropHeight = Math.min(info.height - cropTop, (globalMaxY - globalMinY) + margin * 2);

    const cropped = await sharp(inputBuffer)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .toBuffer();

    // Scale based on the WIDEST ROW (front of frame), not full bounding box
    const targetFrontWidth = Math.round(CANVAS_SIZE * PRODUCT_WIDTH_RATIO); // 819px
    const scale = targetFrontWidth / maxRowWidth;

    let finalWidth = Math.round(cropWidth * scale);
    let finalHeight = Math.round(cropHeight * scale);

    // Cap height so glasses don't fill the entire canvas vertically
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

    console.log(`[Photo Studio] Normalized: widest row=${maxRowWidth}px, bbox=${cropWidth}x${cropHeight} → ${rw}x${rh} on ${CANVAS_SIZE}x${CANVAS_SIZE}`);
    return result;
  } catch (err) {
    console.error('[Photo Studio] Normalize failed, returning original:', err);
    return inputBuffer;
  }
}

/**
 * Pipeline de procesamiento de imágenes con Gemini.
 * 
 * Flujo:
 * 1. Recibe array de imageKeys (ya subidas al Storage)
 * 2. Retorna HTTP 202 (Accepted) instantáneamente
 * 3. Procesa en background con Gemini (remove bg → fondo blanco → sombras)
 * 4. Actualiza DB cuando termina
 */

const CATALOG_PROMPT = `You are a professional product photographer for a premium eyewear e-commerce catalog.

TASK: Clean up this eyewear photo for catalog use. You MUST follow ALL rules below without exception.

=== BACKGROUND REMOVAL ===
- Remove the ENTIRE background. Remove ALL shadows, reflections, glare, lighting artifacts.
- Output: eyewear ONLY on pure flat white (#FFFFFF). NO shadows. NO glow. NO effects. Just the product on white.

=== BRANDING REMOVAL AND REPLACEMENT ===
- Identify any logo, brand name, text, or emblem printed on the lenses (cristales) of the glasses (for example: "Ray-Ban", "Oakley", etc.).
- REMOVE this original text/logo completely from the glass/lens. Ensure that the lens is left perfectly clear, clean, and transparent where the logo was.
- Add/print the text "ATELIERS" ONLY on the lens. The font must always be identical across all products: use a small, clean, modern, medium-weight, geometric sans-serif typeface (similar to Arial or Helvetica), uppercase, colored in a soft semi-transparent white (approximately 70% opacity).
- The text "ATELIERS" must always be placed horizontally, centered in the lower portion of the viewer's left lens (the lens on the left side of the image from the viewer's perspective).
- Do NOT alter, distort, or change the shape, structure, thickness, color, or style of the frames or lenses. Keep the glasses exactly as they are in the original image, except for removing the printed brand/logo from the lenses and adding the small, clean "ATELIERS" brand text only on the lens.

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

const MALE_AVATAR_PROMPT = `Generate a SQUARE 1:1 aspect ratio image. Extreme close-up macro portrait of a young male model with a very short buzzcut hairstyle (almost shaved), light/fair skin, strong angular jawline, a small silver hoop earring on one ear, and a serious intense expression. He is wearing the EXACT glasses shown in the reference image. The portrait must fill the ENTIRE square frame edge-to-edge — show from the top of the forehead to below the chin, with the face perfectly centered. NO empty space or margins. Shot in a bright editorial studio with a pure white background. Crisp, even lighting with no harsh shadows on the face. Highly detailed skin texture, intense gaze looking directly at the camera. The glasses must perfectly match the reference image's frame shape, pattern, color, and proportions. Photorealistic quality. NO TEXT in output.`;

const FEMALE_AVATAR_PROMPT = `Generate a SQUARE 1:1 aspect ratio image. Extreme close-up macro portrait of a young female model with long golden blonde wavy hair, striking light blue eyes, fair skin with a natural warm tone, soft natural makeup, and a composed elegant expression. She is wearing the EXACT glasses shown in the reference image. The portrait must fill the ENTIRE square frame edge-to-edge — show from the top of the forehead to below the chin, with the face perfectly centered. NO empty space or margins. Shot in a bright editorial studio with a pure white or very light neutral background. Crisp, soft lighting, highly detailed skin texture, direct gaze at the camera. The glasses must perfectly match the reference image's frame shape, pattern, color, and proportions. Photorealistic quality. NO TEXT in output.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, imageKeys } = body;

    if (!productId || !imageKeys || !Array.isArray(imageKeys) || imageKeys.length === 0) {
      return NextResponse.json(
        { error: 'Missing productId or imageKeys array' },
        { status: 400 }
      );
    }

    // 1. Mark product as PROCESSING
    await prisma.product.update({
      where: { id: productId },
      data: {
        imageProcessingStatus: 'PROCESSING',
        rawImageUrls: imageKeys,
      }
    });

    // 2. Background task
    after(async () => {
      try {
        console.log(`[Photo Studio] Processing ${imageKeys.length} image(s) for product ${productId}`);

        const geminiKey = process.env.GOOGLE_GENAI_API_KEY;
        const processedKeys: string[] = [];
        let finalMetadata = "";

        const results = await Promise.allSettled(
          imageKeys.map(async (key: string, index: number) => {
            const buffer = await getFileBuffer(key);
            if (!buffer) throw new Error(`Could not read file: ${key}`);

            let processedBuffer: Buffer = buffer;
            let extractedMetadata = "";
            let imageExtracted = false;
            let ai: GoogleGenAI | null = null;

            if (geminiKey) {
              // Gemini AI Processing
              ai = new GoogleGenAI({ apiKey: geminiKey });

              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image', // Model with image output support
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: CATALOG_PROMPT },
                      {
                        inlineData: {
                          data: buffer.toString('base64'),
                          mimeType: 'image/jpeg',
                        }
                      }
                    ]
                  }
                ],
                config: {
                  responseModalities: ['TEXT', 'IMAGE'],
                },
              });

              // Extract image and text from response

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
                      console.log(`[Photo Studio] Gemini processed image ${index} OK`);
                    }
                  }
                }
              }

              if (!imageExtracted) {
                console.warn(`[Photo Studio] Gemini returned no image for index ${index}, keeping original`);
                processedBuffer = buffer;
              } else {
                // Post-process: normalize to exactly 80% width on 1024x1024 canvas
                processedBuffer = await normalizeImageSize(processedBuffer);
              }
              
              if (extractedMetadata.includes("METADATA:")) {
                extractedMetadata = extractedMetadata.split("METADATA:")[1].trim();
              }
            } else {
              // No API key: simulation mode (dev only)
              console.warn(`[Photo Studio] No GOOGLE_GENAI_API_KEY. Simulating for image ${index}`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              processedBuffer = buffer;
              extractedMetadata = "Gafas de prueba simuladas.";
            }

            const processedFileName = `products/${productId}/catalog_${index}_${Date.now()}.png`;
            const uploadedKey = await uploadFile(processedBuffer!, processedFileName, 'image/png');
            
            const keysToReturn = [uploadedKey];

            // Only generate avatars for the first image to save time and costs
            if (index === 0 && process.env.GOOGLE_GENAI_API_KEY && ai) {
                console.log(`[Photo Studio] Generating male avatar...`);
                try {
                  const maleResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: [{ role: 'user', parts: [{ text: MALE_AVATAR_PROMPT }, { inlineData: { data: processedBuffer!.toString('base64'), mimeType: 'image/png' } }] }],
                    config: { responseModalities: ['IMAGE'] },
                  });
                  if (maleResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
                    const maleBuffer = Buffer.from(maleResponse.candidates[0].content.parts[0].inlineData.data, 'base64');
                    const maleKey = await uploadFile(maleBuffer, `products/${productId}/avatar_male_${Date.now()}.png`, 'image/png');
                    keysToReturn.push(maleKey);
                    console.log(`[Photo Studio] Male avatar generated and uploaded.`);
                  } else {
                    console.warn(`[Photo Studio] Male avatar response had no image data. Response text: ${maleResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'N/A'}`);
                  }
                } catch (e: any) {
                  console.error(`[Photo Studio] Male avatar generation failed:`, e.message);
                }

                console.log(`[Photo Studio] Generating female avatar...`);
                try {
                  const femaleResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: [{ role: 'user', parts: [{ text: FEMALE_AVATAR_PROMPT }, { inlineData: { data: processedBuffer!.toString('base64'), mimeType: 'image/png' } }] }],
                    config: { responseModalities: ['IMAGE'] },
                  });
                  if (femaleResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
                    const femaleBuffer = Buffer.from(femaleResponse.candidates[0].content.parts[0].inlineData.data, 'base64');
                    const femaleKey = await uploadFile(femaleBuffer, `products/${productId}/avatar_female_${Date.now()}.png`, 'image/png');
                    keysToReturn.push(femaleKey);
                    console.log(`[Photo Studio] Female avatar generated and uploaded.`);
                  } else {
                    console.warn(`[Photo Studio] Female avatar response had no image data. Response text: ${femaleResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'N/A'}`);
                  }
                } catch (e: any) {
                  console.error(`[Photo Studio] Female avatar generation failed:`, e.message);
                }
            }

            return { keys: keysToReturn, metadata: extractedMetadata };
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            processedKeys.push(...result.value.keys);
            if (result.value.metadata && !finalMetadata) {
              finalMetadata = result.value.metadata; // Tomar la metadata de la primera imagen exitosa
            }
          } else {
            console.error(`[Photo Studio] Image failed:`, result.reason);
          }
        }

        if (processedKeys.length === 0) {
          throw new Error('All images failed processing');
        }

        await prisma.product.update({
          where: { id: productId },
          data: {
            imagenesCatalogo: processedKeys,
            imageProcessingStatus: 'READY',
            ...(finalMetadata ? { botLabel: finalMetadata.substring(0, 500) } : {})
          }
        });
        console.log(`[Photo Studio] Done: ${processedKeys.length}/${imageKeys.length} images for ${productId}. Metadata saved.`);

      } catch (error: any) {
        console.error(`[Photo Studio] Failed for ${productId}:`, error);
        
        const { handleAIError } = await import('@/lib/ai-error-handler');
        try {
            await handleAIError(error, 'AI Photo Studio (Avatares/Fondo Blanco)');
        } catch (handledError) {
            // Already handled, just update status
        }

        await prisma.product.update({
          where: { id: productId },
          data: { imageProcessingStatus: 'ERROR' }
        }).catch(e => console.error("Failed to update error status", e));
      }
    });

    // 3. Return 202 instantly
    return NextResponse.json(
      { status: 'PROCESSING', count: imageKeys.length },
      { status: 202 }
    );

  } catch (error: any) {
    console.error('Process-image trigger error:', error);
    return NextResponse.json(
      { error: error.message || 'Error triggering job' },
      { status: 500 }
    );
  }
}
