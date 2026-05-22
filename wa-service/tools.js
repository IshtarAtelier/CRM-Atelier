const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { prisma } = require('./db');
const CRM_API_URL = process.env.CRM_API_URL;
const BOT_API_KEY = process.env.BOT_API_KEY || 'atelier-bot-secret-key-2026';

const apiClient = axios.create({
    headers: { 'x-api-key': BOT_API_KEY }
});

const { sendMessage } = require('./whatsapp-client');

/**
 * Tool: Search for an existing client by phone or name
 */
async function checkExistingClient({ phone, name }) {
    try {
        const response = await apiClient.get(`${CRM_API_URL}/clients`, {
            params: { phone, name }
        });
        
        const contact = response.data;
        if (contact && contact.found) {
            return { found: true, contact: contact.client };
        }
        return { found: false };
    } catch (error) {
        console.error('Error in checkExistingClient tool:', error.message);
        return { found: false, error: 'Error al consultar el CRM' };
    }
}

/**
 * Tool: Convert a chat into a Lead in the CRM
 */
async function convertIntoLead({ phone, name, contactSource, interest, chatId, insurance }) {
    try {
        // Sanitizar teléfono: números @lid falsos suelen tener 15+ dígitos puros
        let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        if (cleanPhone.length > 15 || cleanPhone.length < 8) {
            console.log(`  ⚠️ Teléfono sospechoso descartado: "${phone}" (${cleanPhone.length} dígitos)`);
            cleanPhone = null;
        } else {
            cleanPhone = phone; // Mantener formato original si es válido
        }

        if (!cleanPhone) {
            return { error: 'No se pudo registrar el lead: el tel\u00e9fono no es v\u00e1lido o no se pudo resolver.' };
        }

        const response = await apiClient.post(`${CRM_API_URL}/clients`, {
            phone: cleanPhone, name, contactSource, interest, status: 'CONTACT', insurance
        });
        const newContact = response.data.client || response.data;

        if (newContact && newContact.id) {
            // Fix: Usar chatId estricto si se provee, o un phone válido. Si phone es vacío y no hay chatId, evitar desastre.
            if (chatId) {
                await prisma.whatsAppChat.update({
                    where: { id: chatId },
                    data: { clientId: newContact.id }
                }).catch(() => {});
            } else if (cleanPhone && cleanPhone.length > 5) {
                await prisma.whatsAppChat.updateMany({
                    where: { waId: { startsWith: cleanPhone } },
                    data: { clientId: newContact.id }
                });
            }
            // Auto-etiquetar como Bot Lead
            await addTagToClient({ clientId: newContact.id, tagName: 'Bot Lead' });
        }

        return { success: true, contact: newContact };
    } catch (error) {
        console.error('Error in convertIntoLead tool:', error.message);
        return { error: 'Error al registrar el lead. Probablemente faltan datos o hay un duplicado.' };
    }
}

/**
 * Tool: Update client info
 */
async function updateClientData({ id, ...data }) {
    try {
        const response = await apiClient.post(`${CRM_API_URL}/clients`, { id, ...data });
        return response.data;
    } catch (error) {
        console.error('Error in updateClientData tool:', error.message);
        return { error: 'Error al actualizar datos' };
    }
}

/**
 * Tool: Get price list for bot quotes
 * Returns products marked as botRecommended from the real inventory.
 * Optionally filtered by category (MULTIFOCAL, MONOFOCAL, CONTACTO, ARMAZON).
 */
async function getPriceList({ category }) {
    try {
        const params = { botRecommended: 'true' };
        if (category) params.category = category;
        const response = await apiClient.get(`${CRM_API_URL}/bot/pricing`, { params });
        return response.data;
    } catch (error) {
        console.error('Error in getPriceList tool:', error.message);
        return { error: 'No se pudo obtener la lista de precios.' };
    }
}

/**
 * Tool: Check order status + balance calculation
 */
async function getOrderStatus({ orderId, clientId }) {
    try {
        const response = await apiClient.get(`${CRM_API_URL}/orders`, {
            params: { orderId }
        });
        const order = response.data;
        
        if (!order || !order.found) {
            return { found: false, error: "Pedido no encontrado" };
        }

        const paid = (order.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
        const total = order.total || 0;
        const balance = total - paid;

        return { 
            found: true, 
            status: order.labStatus || order.status,
            total,
            paid,
            balance,
            updatedAt: order.updatedAt
        };
    } catch (error) {
        console.error('Error in getOrderStatus tool:', error.message);
        return { error: 'No se pudo consultar el estado del pedido.' };
    }
}

/**
 * Tool: Create a follow-up task
 */
async function createTask({ clientId, description, dueDate }) {
    try {
        const response = await apiClient.post(`${CRM_API_URL}/tasks`, {
            clientId, description, dueDate
        });
        return response.data;
    } catch (error) {
        console.error('Error in createTask tool:', error.message);
        return { error: 'Error al crear tarea' };
    }
}

/**
 * Tool: Register an interaction
 */
async function addInteraction({ clientId, type, content }) {
    try {
        const response = await apiClient.post(`${CRM_API_URL}/interactions`, {
            clientId, type, content
        });
        return response.data;
    } catch (error) {
        console.error('Error in addInteraction tool:', error.message);
        return { error: 'Error al registrar interacción' };
    }
}

/**
 * Tool: Save prescription data (OCR)
 */
async function savePrescription({ clientId, ...prescriptionData }) {
    try {
        const response = await apiClient.post(`${CRM_API_URL}/prescriptions`, {
            clientId, ...prescriptionData
        });
        return response.data;
    } catch (error) {
        console.error('Error in savePrescription tool:', error.message);
        return { error: 'Error al guardar la receta' };
    }
}

/**
 * Tool: Log bot message in CRM
 */
async function logBotMessage({ waId, content }) {
    try {
        await apiClient.post(`${CRM_API_URL}/messages`, {
            waId, content, direction: 'OUTBOUND'
        });
        return { success: true };
    } catch (error) {
        console.error('Error in logBotMessage tool:', error.message);
        return { success: false };
    }
}

/**
 * Tool: Create a formal quote
 */
async function createQuote({ clientId, items, total, discountCash }) {
    try {
        const response = await apiClient.post(`${CRM_API_URL}/orders`, {
            clientId, items, total, discountCash
        });
        return response.data;
    } catch (error) {
        console.error('Error in createQuote tool:', error.message);
        return { error: 'Error al registrar el presupuesto en el CRM' };
    }
}

/**
 * Tool: Cancel the bot and tag the conversation
 */
async function cancelBot({ clientId, waId }) {
    try {
        // If no waId provided, try to find it from clientId
        if (!waId && clientId && clientId !== 'none') {
            const chatFromClient = await prisma.whatsAppChat.findFirst({ where: { clientId } });
            if (chatFromClient) waId = chatFromClient.waId;
        }

        let tag = await prisma.tag.findFirst({
            where: { name: { equals: 'Cancelar Bot', mode: 'insensitive' } }
        });
        
        if (!tag) {
            tag = await prisma.tag.create({
                data: { name: 'Cancelar Bot', color: '#ff4d4f' }
            });
        }

        if (clientId && clientId !== 'none') {
            await prisma.client.update({
                where: { id: clientId },
                data: {
                    tags: {
                        connect: { id: tag.id }
                    }
                }
            });
        }

        if (waId) {
            const chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
            if (chat) {
                const updatedLabels = new Set(chat.chatLabels || []);
                updatedLabels.add('Cancelar Bot');

                await prisma.whatsAppChat.update({
                    where: { waId },
                    data: { 
                        botEnabled: false, 
                        status: 'OPEN', 
                        unreadCount: { increment: 1 },
                        chatLabels: Array.from(updatedLabels)
                    }
                });
                return { success: true, message: 'BOT_CANCELED' };
            }
        }

        return { error: 'Se requiere waId para cancelar el bot en este chat o el chat no existe.' };
    } catch (error) {
        console.error('Error in cancelBot tool:', error.message);
        return { error: 'No se pudo cancelar el bot.' };
    }
}

/**
 * Tool: Add a tag dynamically to a client
 */
async function addTagToClient({ clientId, tagName }) {
    if (!clientId || clientId === 'none') return { error: "No client ID provided. No se puede etiquetar a un prospecto no guardado." };
    try {
        let tag = await prisma.tag.findFirst({
            where: { name: { equals: tagName, mode: 'insensitive' } }
        });
        
        if (!tag) {
            tag = await prisma.tag.create({
                data: { name: tagName, color: '#1677ff' } // azul por defecto
            });
        }

        const client = await prisma.client.update({
            where: { id: clientId },
            data: {
                tags: {
                    connect: { id: tag.id }
                }
            }
        });

        // 1. Bot Action Automation
        if (tag.botAction === 'TURN_OFF' || tag.botAction === 'TURN_ON') {
            await prisma.whatsAppChat.updateMany({
                where: { clientId: clientId },
                data: { botEnabled: tag.botAction === 'TURN_ON' }
            });
            console.log(`[Etiqueta Automation] Bot ${tag.botAction === 'TURN_ON' ? 'activado' : 'pausado'} para cliente ${client.name}`);
        }

        // 2. Notification Automation
        if (tag.notifyPhone) {
            try {
                const message = `🔔 *NOTIFICACIÓN DEL CRM*\nSe ha aplicado la etiqueta *${tag.name}* al cliente *${client.name || 'Sin nombre'}* (ID: ${client.id}).`;
                const notifyWaId = tag.notifyPhone.includes('@') ? tag.notifyPhone : `${tag.notifyPhone.replace(/[^0-9]/g, '')}@c.us`;
                await sendMessage(notifyWaId, message);
                console.log(`[Etiqueta Automation] Notificación enviada a ${notifyWaId}`);
            } catch (err) {
                console.error("[Etiqueta Automation] Error enviando notificación:", err.message);
            }
        }

        return { success: true, message: `Etiqueta '${tagName}' agregada correctamente al cliente.` };
    } catch (error) {
        console.error('Error in addTagToClient tool:', error.message);
        return { error: `No se pudo agregar la etiqueta '${tagName}'.` };
    }
}

/**
 * Tool: Disable Bot explicitly for a Chat
 */
async function disableBotForChat({ chatId }) {
    if (!chatId || chatId === 'none') return { error: "No chatId provided." };
    try {
        await prisma.whatsAppChat.update({
            where: { id: chatId },
            data: { botEnabled: false }
        });
        return { success: true, message: `Bot apagado para el chat.` };
    } catch (error) {
        console.error('Error in disableBotForChat tool:', error.message);
        return { error: `No se pudo apagar el bot para el chat.` };
    }
}


/**
 * Tool: Report a complaint via email
 */
async function reportComplaint({ clientId, details }) {
    if (!clientId) return { error: "No client ID provided." };
    if (!details) return { error: "No details provided." };
    try {
        const complaintsUrl = CRM_API_URL.replace('/api/bot', '/api');
        const response = await apiClient.post(`${complaintsUrl}/complaints`, {
            clientId,
            details
        });

        // Add the NOTE to the client's profile automatically
        await addInteraction({
            clientId,
            type: 'NOTE',
            content: `[RECLAMO POST-VENTA] ${details}`
        });

        // Enviar notificación por WhatsApp a la administración
        const adminPhone = process.env.ADMIN_PHONE || '5493512222222'; // A configurar
        if (adminPhone) {
            try {
                // Obtenemos los datos del cliente para el msj
                const client = await prisma.client.findUnique({ where: { id: clientId } });
                const clientName = client ? client.name : clientId;
                
                const waMsg = `🚨 *NUEVO RECLAMO POST-VENTA* 🚨\n\n*Cliente:* ${clientName}\n\n*Detalles:*\n${details}\n\nRevisa el correo para más información.`;
                await sendMessage(adminPhone + '@c.us', waMsg);
                console.log(`WhatsApp notification sent to admin (${adminPhone})`);
            } catch (waError) {
                console.error('Error sending WA notification:', waError);
            }
        }

        return { success: true, message: `Reclamo reportado exitosamente.` };
    } catch (error) {
        console.error('Error in reportComplaint tool:', error.message);
        return { error: `No se pudo enviar el reporte del reclamo.` };
    }
}

module.exports = {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, logBotMessage, createQuote,
    cancelBot, addTagToClient, disableBotForChat, reportComplaint
};
