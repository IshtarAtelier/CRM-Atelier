const { graph } = require('../wa-service/graph.js');
const { HumanMessage } = require("@langchain/core/messages");

async function main() {
    console.log("Testing graph...");
    const state = { 
        messages: [new HumanMessage("Hola, quiero cotizar unos anteojos")],
        userPhone: '5493541215971',
        userName: 'Test User',
        customPrompt: 'Sos un asistente amigable...'
    };
    const config = { configurable: { thread_id: '5493541215971' } };
    
    try {
        const result = await graph.invoke(state, config);
        console.log("SUCCESS:");
        console.dir(result);
    } catch (e) {
        console.error("FAILED:");
        console.error(e);
    }
}
main();
