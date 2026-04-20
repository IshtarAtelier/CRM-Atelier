const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CRM_API_URL = process.env.CRM_API_URL;

/**
 * Tool: Search for an existing client by phone or name
 */
async function checkExistingClient({ phone, name }) {
    try {
        const response = await axios.get(`${CRM_API_URL}/clients`, {
            params: { phone, name }
        });
        return response.data; // { found: boolean, client?: Object }
    } catch (error) {
        console.error('Error in checkExistingClient tool:', error.message);
        return { found: false, error: 'Error al consultar el CRM' };
    }
}

/**
 * Tool: Convert a chat into a Lead in the CRM (Qualifying)
 */
async function convertIntoLead({ phone, name, contactSource, interest }) {
    try {
        const response = await axios.post(`${CRM_API_URL}/clients`, {
            phone,
            name,
            contactSource,
            interest,
            status: 'CONTACT'
        });
        return response.data; // { action: 'CREATED' | 'UPDATED', client: Object }
    } catch (error) {
        console.error('Error in convertIntoLead tool:', error.message);
        return { error: 'Error al registrar el lead' };
    }
}

/**
 * Tool: Update client info (e.g. detected interest or source)
 */
async function updateClientData({ id, ...data }) {
    try {
        const response = await axios.post(`${CRM_API_URL}/clients`, {
            id,
            ...data
        });
        return response.data;
    } catch (error) {
        console.error('Error in updateClientData tool:', error.message);
        return { error: 'Error al actualizar datos' };
    }
}

/**
 * Tool: Search products in the catalog
 */
async function searchProducts({ query, category, type }) {
    try {
        const response = await axios.get(`${CRM_API_URL}/products`, {
            params: { q: query, category, type }
        });
        return response.data;
    } catch (error) {
        console.error('Error in searchProducts tool:', error.message);
        return { error: 'No se pudo consultar el catálogo.' };
    }
}

/**
 * Tool: Check order status
 */
async function getOrderStatus({ orderId, orderNumber }) {
    try {
        const response = await axios.get(`${CRM_API_URL}/orders`, {
            params: { orderId, orderNumber }
        });
        return response.data;
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
            clientId,
            description,
            dueDate
        });
        return response.data;
    } catch (error) {
        console.error('Error in createTask tool:', error.message);
        return { error: 'Error al crear tarea' };
    }
}

/**
 * Tool: Register an interaction (e.g. report internal error)
 */
async function addInteraction({ clientId, type, content }) {
    try {
        const response = await axios.post(`${CRM_API_URL}/interactions`, {
            clientId,
            type,
            content
        });
        return response.data;
    } catch (error) {
        console.error('Error in addInteraction tool:', error.message);
        return { error: 'Error al registrar interacción' };
    }
}

/**
 * Tool: Save prescription data (OCR result)
 */
async function savePrescription({ clientId, ...prescriptionData }) {
    try {
        const response = await axios.post(`${CRM_API_URL}/prescriptions`, {
            clientId,
            ...prescriptionData
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
            waId,
            content,
            direction: 'OUTBOUND'
        });
        return { success: true };
    } catch (error) {
        console.error('Error in logBotMessage tool:', error.message);
        return { success: false };
    }
}

/**
 * Tool: Create a formal quote (Order)
 */
async function createQuote({ clientId, items, total, discountCash }) {
    try {
        const response = await axios.post(`${CRM_API_URL}/orders`, {
            clientId,
            items,
            total,
            discountCash
        });
        return response.data;
    } catch (error) {
        console.error('Error in createQuote tool:', error.message);
        return { error: 'Error al registrar el presupuesto en el CRM' };
    }
}

module.exports = {
    checkExistingClient,
    convertIntoLead,
    updateClientData,
    searchProducts,
    getOrderStatus,
    createTask,
    addInteraction,
    savePrescription,
    logBotMessage,
    createQuote
};
