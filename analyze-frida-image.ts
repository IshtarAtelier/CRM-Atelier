import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const geminiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!geminiKey) {
    console.error("Missing GOOGLE_GENAI_API_KEY in .env");
    return;
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  
  const imageBuffer = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/images/editorial/filmmaker-frida.webp');
  
  const prompt = `Describe the glasses that Frida is wearing in this filmmaker image. Pay attention to the frame shape, color pattern (e.g. tortoise/carey, black, clear, pink, etc.), frame thickness, bridge style, and size. Then describe its characteristics in detail.`;

  console.log("Analyzing filmmaker-frida.webp with Gemini...");
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: 'image/webp',
            }
          }
        ]
      }
    ]
  });

  console.log("\n=== GEMINI ANALYSIS ===");
  console.log(response.text);
}

main().catch(console.error);
