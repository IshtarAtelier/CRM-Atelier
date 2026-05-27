import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  try {
    const creds = JSON.parse(process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS || '{}');
    fs.writeFileSync('/tmp/vertex-creds.json', JSON.stringify(creds));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/vertex-creds.json';

    const ai = new GoogleGenAI({
      vertexai: {
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION,
      }
    });
    
    console.log("Generating image...");
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: 'test prompt',
        config: { numberOfImages: 1 }
    });
    console.log(response.generatedImages?.[0]?.image?.imageBytes ? "Success" : "Failed");
  } catch (e) { console.error(e); }
}
test();
