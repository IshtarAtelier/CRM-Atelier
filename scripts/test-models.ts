import { GoogleGenAI } from '@google/genai';
async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
  const response = await ai.models.list();
  for await (const model of response) {
    if (model.name.includes('imagen')) {
      console.log(model.name);
    }
  }
}
test();
