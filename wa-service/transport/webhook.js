/**
 * Webhook de la WhatsApp Cloud API.
 *
 *   GET  /webhook/whatsapp  → verificación de Meta (hub.mode / hub.verify_token / hub.challenge)
 *   POST /webhook/whatsapp  → mensajes entrantes y estados de los salientes
 *
 * Seguridad: es la ÚNICA puerta pública nueva del servicio. Cada POST viene
 * firmado por Meta con HMAC-SHA256 del body crudo usando el App Secret
 * (header X-Hub-Signature-256). Sin firma válida → 401 y se ignora. Por eso
 * este router necesita el body CRUDO: se monta con express.raw, no con el
 * express.json global.
 *
 * Meta espera 200 en menos de ~5 s y reintenta con backoff si no lo recibe.
 * Se responde 200 apenas la firma valida y el procesamiento sigue en
 * background; la idempotencia por wamid (inbound.js) absorbe reentregas.
 *
 * Env: WA_CLOUD_VERIFY_TOKEN (string aleatorio nuestro), META_APP_SECRET.
 */

const express = require('express');
const { createHmac, timingSafeEqual } = require('crypto');
const { persistInbound, persistStatus } = require('./inbound');

function verifySignature(rawBody, header, appSecret) {
    if (!appSecret) return false;
    if (!header || !header.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(header.slice(7));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Convierte el payload de Meta en una lista plana de eventos normalizados.
 * @returns {{ messages: object[], statuses: object[] }}
 */
function normalize(payload) {
    const messages = [];
    const statuses = [];
    if (payload?.object !== 'whatsapp_business_account') return { messages, statuses };
    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;
            const v = change.value || {};
            const names = new Map((v.contacts || []).map(c => [c.wa_id, c.profile?.name]));
            for (const m of v.messages || []) {
                const media = m.image || m.audio || m.video || m.document || m.sticker || null;
                messages.push({
                    from: m.from,
                    profileName: names.get(m.from) || null,
                    wamid: m.id,
                    timestamp: m.timestamp,
                    type: m.type,
                    text: m.text?.body || media?.caption || null,
                    media: media ? { id: media.id, mime_type: media.mime_type, filename: media.filename, sha256: media.sha256 } : null,
                    location: m.location || null,
                    contacts: m.contacts || null,
                    reaction: m.reaction || null,
                    button: m.button || null,
                    interactive: m.interactive || null,
                    referral: m.referral || null,
                    context: m.context || null,
                    phoneNumberId: v.metadata?.phone_number_id || null,
                });
            }
            for (const s of v.statuses || []) {
                statuses.push({ id: s.id, status: s.status, timestamp: s.timestamp, recipient: s.recipient_id, errors: s.errors || null, conversation: s.conversation || null, pricing: s.pricing || null });
            }
        }
    }
    return { messages, statuses };
}

/**
 * @param {{ io: import('socket.io').Server, onInbound?: Function, onStatus?: Function }} deps
 */
function createWebhookRouter(deps = {}) {
    const router = express.Router();
    const VERIFY_TOKEN = process.env.WA_CLOUD_VERIFY_TOKEN || '';
    const APP_SECRET = process.env.META_APP_SECRET || '';

    router.get('/', (req, res) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
            console.log('[Webhook] Verificación de Meta OK');
            return res.status(200).send(challenge);
        }
        console.warn('[Webhook] Verificación rechazada (token no coincide o falta WA_CLOUD_VERIFY_TOKEN)');
        return res.sendStatus(403);
    });

    router.post('/', express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
        if (!verifySignature(raw, req.get('x-hub-signature-256'), APP_SECRET)) {
            console.warn(`[Webhook] Firma inválida desde ${req.ip} — se ignora`);
            return res.sendStatus(401);
        }
        let payload;
        try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.sendStatus(400); }

        // 200 ya: Meta no debe esperar a la base ni a la bajada de medios.
        res.sendStatus(200);

        const { messages, statuses } = normalize(payload);
        (async () => {
            for (const m of messages) {
                try {
                    const r = await persistInbound(m, { io: deps.io });
                    if (deps.onInbound) await deps.onInbound(m, r);
                } catch (e) {
                    console.error('[Webhook] Error procesando entrante:', e.message);
                }
            }
            for (const s of statuses) {
                try {
                    await persistStatus(s, { io: deps.io });
                    if (deps.onStatus) await deps.onStatus(s);
                } catch (e) {
                    console.error('[Webhook] Error procesando estado:', e.message);
                }
            }
        })();
    });

    return router;
}

module.exports = { createWebhookRouter, normalize, verifySignature };
