const fetch = require('node-fetch');

async function testGemini() {
    const apiKey = 'AIzaSyA-LRFReaI74cw_5l7W5ZsBcR93u-DW3Sk'; // From .env
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    console.log('Testing Gemini API key...');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Hola, responde solo con la palabra 'Funciona'"
                    }]
                }]
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ API Key is working!');
            console.log('Response:', data.candidates[0].content.parts[0].text);
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
