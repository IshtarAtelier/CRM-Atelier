import { GoogleGenAI } from '@google/genai';
async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: 'test prompt',
        config: { numberOfImages: 1 }
    });
    console.log(response);
  } catch (e) { console.error(e); }
}
test();
