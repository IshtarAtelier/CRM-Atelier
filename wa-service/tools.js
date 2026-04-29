const axios = require('axios');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CRM_API_URL = process.env.CRM_API_URL;
const { prisma } = require('./db');
const CRM_API_URL = process.env.CRM_API_URL;
/**
 * Tool: Search for an existing client by phone or name
 */
async function checkExistingClient({ phone, name }) {
    try {
        const response = await axios.get(`${CRM_API_URL}/clients`, {
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
        const response = await axios.post(`${CRM_API_URL}/clients`, {
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
        const response = await axios.post(`${CRM_API_URL}/clients`, { id, ...data });
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
        const response = await axios.get(`${CRM_API_URL}/bot/pricing`, { params });
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
        const response = await axios.get(`${CRM_API_URL}/orders`, {
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
        const response = await axios.post(`${CRM_API_URL}/tasks`, {
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
        const response = await axios.post(`${CRM_API_URL}/interactions`, {
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
        const response = await axios.post(`${CRM_API_URL}/prescriptions`, {
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
        await axios.post(`${CRM_API_URL}/messages`, {
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
        const response = await axios.post(`${CRM_API_URL}/orders`, {
            clientId, items, total, discountCash
        });
        return response.data;
    } catch (error) {
        console.error('Error in createQuote tool:', error.message);
        return { error: 'Error al registrar el presupuesto en el CRM' };
    }
}

module.exports = {
    checkExistingClient, convertIntoLead, updateClientData,
    getPriceList, getOrderStatus, createTask,
    addInteraction, savePrescription, logBotMessage, createQuote
};
