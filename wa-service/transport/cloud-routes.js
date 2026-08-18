/**
 * Rutas /api/* que SOLO existen (o se comportan distinto) con la API oficial.
 * Se montan ANTES del router legacy (routes/api.js): la primera ruta que
 * matchea gana, así que estas pisan a las del bot cuando WA_TRANSPORT=cloud.
 *
 *  GET  /api/status            estado del número (sin QR, sin agente)
 *  GET  /api/agent             { enabled:false, configured:false } — no hay bot
 *  POST /api/agent             410 — no hay bot que configurar
 *  POST /api/followups/trigger 410 — no hay seguimientos automáticos
 *  POST /api/sync              204 — no hay sesión que sincronizar (el webhook es la verdad)
 *  POST /api/resolve-phones    204 — ya no existen @lid
 *  POST /api/test/chat         410
 *  GET  /api/templates         plantillas cacheadas (con ?refresh=1 sincroniza con Meta)
 *  POST /api/templates/sync    sincroniza con Meta y devuelve la lista
 *  POST /api/templates         crea una plantilla en Meta (queda PENDING)
 *  GET  /api/chats/:id/window  { open, remainingMs, lastInboundAt }
 */

const express = require('express');
const { prisma } = require('../db');
const cloud = require('./cloud-api');

const GONE = (what) => (req, res) => res.status(410).json({ error: `${what} no existe con la API oficial de WhatsApp.`, transport: 'cloud' });

async function syncTemplates() {
    const remote = await cloud.listTemplates();
    const seen = new Set();
    for (const t of remote) {
        seen.add(`${t.name}|${t.language}`);
        await prisma.whatsAppTemplate.upsert({
            where: { name_language: { name: t.name, language: t.language } },
            update: { category: t.category, status: t.status, components: t.components || [], metaId: t.id, syncedAt: new Date() },
            create: { name: t.name, language: t.language, category: t.category, status: t.status, components: t.components || [], metaId: t.id },
        });
    }
    // Las que ya no están en Meta se marcan DISABLED (no se borran: puede haber mensajes que las referencian).
    const local = await prisma.whatsAppTemplate.findMany({ select: { id: true, name: true, language: true, status: true } });
    for (const l of local) {
        if (!seen.has(`${l.name}|${l.language}`) && l.status !== 'DISABLED') {
            await prisma.whatsAppTemplate.update({ where: { id: l.id }, data: { status: 'DISABLED', syncedAt: new Date() } });
        }
    }
    return prisma.whatsAppTemplate.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
}

function createCloudRoutes({ transport }) {
    const router = express.Router();

    router.get('/status', (req, res) => {
        const s = transport.getStatus();
        res.json({ ...s, connected: s.isReady, phone: s.connectedPhone, qr: null, agentEnabled: false, followupsEnabled: false, prompt: '' });
    });

    router.get('/agent', (req, res) => res.json({ enabled: false, configured: false, prompt: '', dailyContext: '', followupsEnabled: false, transport: 'cloud' }));
    router.post('/agent', GONE('El asistente IA'));
    router.post('/followups/trigger', GONE('El disparo de seguimientos automáticos'));
    router.post('/test/chat', GONE('El simulador del bot'));
    router.post('/sync', (req, res) => res.status(204).end());
    router.post('/resolve-phones', (req, res) => res.status(204).end());

    router.get('/templates', async (req, res) => {
        try {
            if (req.query.refresh === '1') return res.json(await syncTemplates());
            res.json(await prisma.whatsAppTemplate.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] }));
        } catch (e) { res.status(500).json({ error: e.message, code: e.code }); }
    });
    router.post('/templates/sync', async (req, res) => {
        try { res.json(await syncTemplates()); } catch (e) { res.status(500).json({ error: e.message, code: e.code }); }
    });
    router.post('/templates', async (req, res) => {
        try {
            const { name, language, category, components } = req.body || {};
            if (!name || !category || !Array.isArray(components)) return res.status(400).json({ error: 'name, category y components son obligatorios' });
            const r = await cloud.createTemplate({ name, language, category, components });
            await syncTemplates().catch(() => {});
            res.json({ success: true, meta: r });
        } catch (e) { res.status(500).json({ error: e.message, code: e.code }); }
    });

    router.get('/chats/:id/window', async (req, res) => {
        try {
            const chat = await prisma.whatsAppChat.findUnique({ where: { id: req.params.id }, select: { lastInboundAt: true } });
            if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
            res.json({ open: cloud.isServiceWindowOpen(chat), remainingMs: cloud.serviceWindowRemainingMs(chat), lastInboundAt: chat.lastInboundAt });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

module.exports = { createCloudRoutes, syncTemplates };
