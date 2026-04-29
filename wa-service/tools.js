const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { prisma } = require('./db');
const CRM_API_URL = process.env.CRM_API_URL;
const BOT_API_KEY = process.env.BOT_API_KEY || 'atelier-bot-secret-key-2026';

const apiClient = axios.create({
    headers: { 'x-api-key': BOT_API_KEY }
});

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
async function convertIntoLead({ phone, name, contactSource, interest }) {
    try {
        const response = await apiClient.post(`${CRM_API_URL}/clients`, {
            phone, name, contactSource, interest, status: 'CONTACT'
        });
        const newContact = response.data.client || response.data;

        // VINCULACIÓN AUTOMÁTICA DE CHAT MIENTRAS HABLAN:
        if (newContact && newContact.id) {
            await prisma.whatsAppChat.updateMany({
                where: { waId: { contains: phone } },
                data: { clientId: newContact.id }
            });
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

module.exports = {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, logBotMessage, createQuote,
    cancelBot
};
