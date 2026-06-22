require('dotenv').config();
const { graph } = require('./graph');
const { prisma } = require('./db');
const { HumanMessage } = require('@langchain/core/messages');

async function testSilence() {
  console.log("🚀 Testing Bot Absolute Silence Rule on IA accusation...");
  
  const promptSetting = await prisma.systemSetting.findUnique({ where: { key: 'bot_prompt' } });
  const activePrompt = promptSetting ? promptSetting.value : "";
  
  const state = {
    messages: [new HumanMessage("Che, ¿sos un robot o una inteligencia artificial?")],
    userPhone: "5493512345678",
    userName: "Juan",
    waId: "5493512345678@c.us",
    chatId: "test_chat_id",
    customPrompt: activePrompt,
    dailyContext: "",
    clientData: null,
    chatSummary: null
  };

  const config = { configurable: { thread_id: "test_silence_thread" } };
  
  try {
    const result = await graph.invoke(state, config);
    
    console.log("------------------ ALL MESSAGES ------------------");
    result.messages.forEach((msg, idx) => {
      console.log(`[${idx}] ${msg.constructor.name}:`, JSON.stringify(msg.content));
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        console.log(`    Tool Calls:`, JSON.stringify(msg.tool_calls));
      }
    });
    console.log("--------------------------------------------------");

    const lastMsg = result.messages[result.messages.length - 1];
    
    let lastMsgIsSilent = false;
    if (!lastMsg.content) {
      lastMsgIsSilent = true;
    } else if (typeof lastMsg.content === 'string') {
      lastMsgIsSilent = lastMsg.content.trim() === "";
    } else if (Array.isArray(lastMsg.content)) {
      lastMsgIsSilent = lastMsg.content.length === 0 || lastMsg.content.every(c => typeof c === 'string' ? c.trim() === "" : (c.text ? c.text.trim() === "" : false));
    }

    const calledShutdownTool = result.messages.some(msg => 
      msg.tool_calls && msg.tool_calls.some(call => 
        call.name === 'cancel_bot' || call.name === 'disable_bot_for_personal_chat'
      )
    );

    if (lastMsgIsSilent && calledShutdownTool) {
      console.log("🎉 SUCCESS: The bot executed shutdown tools and remained absolutely silent in its final response!");
    } else {
      console.log(`❌ FAILURE: lastMsgIsSilent=${lastMsgIsSilent}, calledShutdownTool=${calledShutdownTool}`);
    }
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }
}

testSilence().catch(console.error).finally(() => prisma.$disconnect());
