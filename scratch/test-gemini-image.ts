import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
config();

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: "Draw a circle" }] }],
      config: { responseModalities: ['IMAGE'] }
    });
    console.log(JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
main();
