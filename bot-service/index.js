const express = require('express');
const cors = require('cors');
const { graph } = require('./graph');
const { MemorySaver } = require("@langchain/langgraph");
const { logBotMessage } = require('./tools');
const { HumanMessage } = require("@langchain/core/messages");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for images

const memory = new MemorySaver();

// In-memory or Redis-based check for "is bot sending this?"
const botIsSending = new Set();

app.post('/chat', async (req, res) => {
    const { waId, content, phone, image } = req.body;

    if (!waId || (!content && !image)) {
        return res.status(400).json({ error: 'waId and (content or image) are required' });
    }

    try {
        console.log(`🤖 Processing message from ${waId}...`);

        let messageRequest;
        if (image) {
            // Multimodal message with image for Gemini
            messageRequest = new HumanMessage({
                content: [
                    { type: "text", text: content || "Analiza esta imagen." },
                    {
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${image}` },
                    },
                ],
            });
        } else {
            messageRequest = new HumanMessage(content);
        }

        const config = { configurable: { thread_id: waId } };
        const state = { 
            messages: [messageRequest],
            userPhone: waId.replace('@c.us', ''),
            userName: phone || waId
        };
        
        const result = await graph.invoke(state, config);
        
        const lastMessage = result.messages[result.messages.length - 1];
        const responseText = lastMessage.content;

        // Log the bot's response in the CRM
        await logBotMessage({ waId, content: responseText });

        res.json({ 
            response: responseText,
            agentType: result.agentType || "UNKNOWN"
        });

    } catch (error) {
        console.error('Error in bot service:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Use BOT_PORT (not PORT — Railway injects PORT for the main web service)
const PORT = process.env.BOT_PORT || 3001;
app.listen(PORT, () => {
    console.log(`Bot Service running on port ${PORT}`);
});
