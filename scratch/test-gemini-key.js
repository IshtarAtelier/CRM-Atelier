require('dotenv').config();
const fetch = require('node-fetch');

async function testGemini() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_GENAI_API_KEY no encontrada en el .env');
        return;
    }
    
    // Probamos el modelo exacto que usa el agente
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    console.log('Probando clave nueva con gemini-3-flash-preview...');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Responde únicamente con la palabra: ACTIVO" }] }]
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API Key is working!');
            console.log('Respuesta del bot:', data.candidates[0].content.parts[0].text);
        } else {
            console.error('❌ API Key test failed.');
            console.error('Status:', response.status);
            const errorText = await response.text();
            console.error('Error Details:', errorText);
        }
    } catch (err) {
        console.error('Request failed:', err);
    }
}

testGemini();

testGemini();
