import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const geminiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!geminiKey) {
    console.error("Missing GOOGLE_GENAI_API_KEY");
    return;
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  
  const fridaFilmmaker = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/public/images/editorial/filmmaker-frida.webp');
  
  const candidates = [
    { name: 'Helena C8', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/Q5205-c8.avif' },
    { name: 'Isabel C3', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/Q8013-c3.avif' },
    { name: 'Isabel C6', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/Q8013-c6.avif' },
    { name: 'Isabel C7', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/Q8013-c7.avif' },
    { name: 'Cleopatra C4', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/FD88821-c4.webp' },
    { name: 'Gala C8', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/Q5005-c8.avif' },
    { name: 'Frida C1', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c1.avif' },
    { name: 'Frida C4', path: '/Users/ishtarpissano/proyectos/atelier/public/assets/products/acetato/57201LJH-c4.avif' }
  ];

  const parts: any[] = [
    { text: `Compare the glasses Frida Kahlo is wearing in the first image ("filmmaker-frida.webp") with the subsequent candidate products.
Which candidate product represents the EXACT same model (or looks most similar to it)?
List the candidates in order of similarity, and explain why the top candidate is the best match (consider color, pattern, shape, bridge, and frame details).` },
    { inlineData: { data: fridaFilmmaker.toString('base64'), mimeType: 'image/webp' } }
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.path)) {
      const buffer = fs.readFileSync(c.path);
      const mime = c.path.endsWith('.webp') ? 'image/webp' : 'image/avif';
      parts.push({ text: `Candidate: ${c.name}` });
      parts.push({ inlineData: { data: buffer.toString('base64'), mimeType: mime } });
    } else {
      console.warn(`File not found: ${c.path}`);
    }
  }

  console.log("Analyzing specific candidates with Gemini...");
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ]
  });

  console.log("\n=== SPECIFIC COMPARISON RESULT ===");
  console.log(response.text);
}

main().catch(console.error);
