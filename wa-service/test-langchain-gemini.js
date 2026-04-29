const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testLangchainGemini() {
    console.log('Testing Gemini API with @langchain/google-genai...');
    try {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
             console.error('❌ Error: API Key not found in .env');
             return;
        }
        console.log(`Using API Key starting with: ${apiKey.substring(0, 5)}...`);

        const model = new ChatGoogleGenerativeAI({
            model: "gemini-3-flash-preview", // Using Gemini 3 Flash Preview
            maxOutputTokens: 100,
            apiKey: apiKey,
        });

        const response = await model.invoke("Hola, responde solo con la palabra 'Funciona'");
        
        console.log('✅ API Key is working!');
        console.log('Response:', response.content);
    } catch (err) {
        console.error('❌ Request failed:', err.message);
    }
}

testLangchainGemini();
