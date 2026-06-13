/**
 * Bot Orchestration Service
 */

const { HumanMessage } = require("@langchain/core/messages");
const { getNextWeekdayDate } = require('./helper.service');
const { getFileExtension } = require('../utils');

class BotService {
    constructor(deps) {
        this.prisma = deps.prisma;
        this.io = deps.io;
        this.botReplyingTo = deps.botReplyingTo;
        this.passiveDebounceTimers = deps.passiveDebounceTimers || new Map();
        
        // Estado interno de orquestación
        this.botDebounceTimers = new Map();
        this.chatErrorCounts = new Map();
        
        // Dependencias inyectadas
        this.graph = deps.graph;
        this.agentState = deps.agentState;
        this.broadcastChatUpdate = deps.broadcastChatUpdate;
        this.generateAndSaveHandoffSummary = deps.generateAndSaveHandoffSummary;
        this.sendMessage = deps.sendMessage;
        this.sendTypingState = deps.sendTypingState;
        this.TAGS_SIN_BOT = deps.TAGS_SIN_BOT;
        this.processPassiveExtraction = deps.processPassiveExtraction;
    }

    async disableBotForChatById(chatId, reason) {
        try {
            const chat = await this.prisma.whatsAppChat.findUnique({ where: { id: chatId } });
            if (chat && chat.botEnabled) {
                await this.prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: { botEnabled: false }
                });
                console.log(`  ⏹️ Bot desactivado para chat ${chatId}. Razón: ${reason}`);
                this.broadcastChatUpdate(chatId);
                
                // Generar resumen de handoff
                if (this.generateAndSaveHandoffSummary) {
                    await this.generateAndSaveHandoffSummary(chatId).catch(e => console.error("Error generando resumen de handoff:", e.message));
                }
            }

            // Cancelar timer de debounce si existe
            if (this.botDebounceTimers.has(chatId)) {
                clearTimeout(this.botDebounceTimers.get(chatId));
                this.botDebounceTimers.delete(chatId);
                console.log(`  🕒 Timer de debounce cancelado para chat ${chatId}`);
            }
        } catch (e) {
            console.error('Error disabling bot for chat ID:', e.message);
        }
    }

    async disableBotForWaId(waId, reason) {
        try {
            const chat = await this.prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat && chat.botEnabled) {
                await this.disableBotForChatById(chat.id, reason);
            }
        } catch (e) {
            console.error('Error disabling bot for waId:', e.message);
        }
    }

    async detectAndCreateVisitTask(clientId, text) {
        if (!text || typeof text !== 'string') return;
        const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const triggerWords = /\b(pas[ao]|pasar[eé]?|ir[eé]?|voy|visitar|visito|vuelta)\b/i;
        const daysRegex = /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/i;

        const hasTrigger = triggerWords.test(normalizedText);
        const dayMatch = normalizedText.match(daysRegex);

        if (hasTrigger && dayMatch) {
            const dayName = dayMatch[1];
            const targetDate = getNextWeekdayDate(dayName);

            if (targetDate) {
                const startOfDay = new Date(targetDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(targetDate);
                endOfDay.setHours(23, 59, 59, 999);

                const existingTask = await this.prisma.clientTask.findFirst({
                    where: {
                        clientId: clientId,
                        description: "Quedó que pasaba por el local.",
                        status: "PENDING",
                        dueDate: { gte: startOfDay, lte: endOfDay }
                    }
                });

                if (!existingTask) {
                    console.log(`  📝 [Auto-Task] Creando tarea para el cliente ${clientId} el día ${dayName} (${targetDate.toISOString()})`);
                    await this.prisma.clientTask.create({
                        data: {
                            clientId: clientId,
                            description: "Quedó que pasaba por el local.",
                            status: "PENDING",
                            type: "TASK",
                            dueDate: targetDate
                        }
                    });
                } else {
                    console.log(`  📝 [Auto-Task] Tarea ya existente para el día ${dayName}. Omitiendo duplicado.`);
                }
            }
        }
    }
}

module.exports = { BotService };
