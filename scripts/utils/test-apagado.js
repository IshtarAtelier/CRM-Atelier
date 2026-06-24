const { HumanMessage } = require("@langchain/core/messages");
const { graph } = require("../../wa-service/graph.js");

async function testPrompt(messageText, description) {
    console.log(`\n======================================================`);
    console.log(`🧪 PRUEBA: ${description}`);
    console.log(`💬 MENSAJE SIMULADO: "${messageText}"\n`);
    
    try {
        const state = await graph.invoke({
            messages: [new HumanMessage(messageText)],
            userPhone: "5493510000000",
            userName: "Proveedor de Prueba",
            agentType: "SALES",
            clientData: null,
            chatSummary: "",
            customPrompt: "",
            dailyContext: "Hoy es martes",
            chatId: "test_chat_id_123",
            waId: "5493510000000@c.us"
        });

        const lastMessage = state.messages[state.messages.length - 1];
        
        // Verificamos si usó alguna herramienta
        const toolCalls = lastMessage.tool_calls || [];
        
        if (toolCalls.length > 0) {
            console.log(`✅ RESULTADO: El bot decidió usar ${toolCalls.length} herramienta(s).`);
            toolCalls.forEach(t => {
                console.log(`   - Herramienta invocada: [${t.name}]`);
                console.log(`   - Argumentos:`, t.args);
            });
        } else {
            console.log(`❌ RESULTADO: El bot NO se apagó. Decidió responder.`);
            console.log(`   - Respuesta del bot: "${lastMessage.content}"`);
        }
    } catch (e) {
        console.error("Error en la prueba:", e.message);
    }
}

async function runTests() {
    await testPrompt(
        "Hola como andas? Somos de la óptica de al lado, queríamos pasar a mostrar la nueva colección de marcos sin compromiso la semana que viene.",
        "Proveedor ofreciendo mostrar colección (Texto Claro)"
    );

    await testPrompt(
        "Hola che, soy el primo de Juan. Pasaba a dejarte las llaves de la casa que me prestaste, te veo en un rato no?",
        "Conversación puramente personal (Familia/Amigos)"
    );

    await testPrompt(
        "Hola como andas ? Semana q viene vamos andar por cordobs y me gustaría pasar a visitarte sin compromiso",
        "El texto exacto de Dani (Proveedor camuflado de visita)"
    );
}

runTests();
