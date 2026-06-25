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
  
  const fridaFilmmaker = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/images/editorial/filmmaker-frida.webp');
  
  const c1 = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c1.avif');
  const c3 = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c3.avif');
  const c4 = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c4.avif');
  const c6 = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c6.avif');
  const c7 = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c7.avif');

  const prompt = `You are an expert fashion auditor for an eyewear store. 
We have a filmmaker image ("La Frida") showing Frida Kahlo wearing an oversized dark Carey/tortoise shell frame.
We also have 5 color variants of the "Frida" model (57201LJH) from the store catalog:
- Frida C1
- Frida C3
- Frida C4
- Frida C6
- Frida C7

Below, I am providing the filmmaker image first, followed by the images of C1, C3, C4, C6, and C7.
Please determine which of these 5 product images represents the exact Carey/tortoise shell variant Frida is wearing, or matches it closest in color and style. Explain your reasoning.`;

  console.log("Analyzing and comparing images with Gemini...");
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: fridaFilmmaker.toString('base64'), mimeType: 'image/webp' } },
          { inlineData: { data: c1.toString('base64'), mimeType: 'image/avif' } },
          { inlineData: { data: c3.toString('base64'), mimeType: 'image/avif' } },
          { inlineData: { data: c4.toString('base64'), mimeType: 'image/avif' } },
          { inlineData: { data: c6.toString('base64'), mimeType: 'image/avif' } },
          { inlineData: { data: c7.toString('base64'), mimeType: 'image/avif' } }
        ]
      }
    ]
  });

  console.log("\n=== COMPARISON RESULT ===");
  console.log(response.text);
}

main().catch(console.error);
