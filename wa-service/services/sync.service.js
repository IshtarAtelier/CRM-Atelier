/**
 * Sync Services
 */

const { getFileExtension } = require('../utils');

async function downloadAndUploadMediaForSyncMessage(deps, msg, dbMessageId, chatId) {
    const { prisma, broadcastChatUpdate } = deps;
    try {
        console.log(`  📥 Descargando media en segundo plano para mensaje ${msg.id._serialized}...`);
        const media = await msg.downloadMedia();
        if (!media) {
            console.log(`  ⚠️ No se pudo descargar media para mensaje ${msg.id._serialized}`);
            return;
        }

        let messageType = 'IMAGE';
        if (media.mimetype.startsWith('audio/')) messageType = 'AUDIO';
        else if (media.mimetype.startsWith('video/')) messageType = 'VIDEO';
        else if (media.mimetype.startsWith('application/')) messageType = 'DOCUMENT';
        else messageType = 'IMAGE';

        const buffer = Buffer.from(media.data, 'base64');
        const ext = getFileExtension(media.mimetype);

        // Cache local para audio/imagen
        if (messageType === 'IMAGE' || messageType === 'AUDIO') {
            const mediaMime = media.mimetype;
            const mediaBase64 = buffer.toString('base64');
            if (!global.mediaCache) global.mediaCache = {};
            if (!Array.isArray(global.mediaCache[chatId])) {
                global.mediaCache[chatId] = [];
            }
            const cacheItem = { waMessageId: msg.id._serialized, base64: mediaBase64, mimeType: mediaMime, timestamp: Date.now() };
            global.mediaCache[chatId].push(cacheItem);
            
            setTimeout(() => {
                if (global.mediaCache[chatId]) {
                    global.mediaCache[chatId] = global.mediaCache[chatId].filter(item => item !== cacheItem);
                    if (global.mediaCache[chatId].length === 0) {
                        delete global.mediaCache[chatId];
                    }
                }
            }, 5 * 60 * 1000);
        }

        // Subir al CRM
        const axios = require('axios');
        const FormDataNode = require('form-data');
        const form = new FormDataNode();
        form.append('file', buffer, { filename: `wa_${Date.now()}.${ext}`, contentType: media.mimetype });
        
        let mediaUrl = null;
        try {
            let uploadUrl = process.env.CRM_API_URL;
            if (uploadUrl.endsWith('/api/bot')) uploadUrl = uploadUrl.replace('/api/bot', '/api/upload');
            else if (uploadUrl.endsWith('/api')) uploadUrl = uploadUrl + '/upload';
            else uploadUrl = uploadUrl + '/upload';

            const uploadRes = await axios.post(uploadUrl, form, {
                headers: {
                    ...form.getHeaders(),
                    'x-api-key': process.env.BOT_API_KEY
                }
            });
            
            if (uploadRes.data && uploadRes.data.url) {
                mediaUrl = uploadRes.data.url;
            }
        } catch (uploadError) {
            console.error('Error uploading file to CRM during sync:', uploadError.message);
        }

        if (mediaUrl) {
            // Actualizar mensaje en la DB con el mediaUrl y el tipo resuelto
            await prisma.whatsAppMessage.update({
                where: { id: dbMessageId },
                data: {
                    mediaUrl,
                    type: messageType
                }
            });
            console.log(`  ✅ Media subido y guardado para mensaje ${msg.id._serialized}: ${mediaUrl}`);
            broadcastChatUpdate(chatId);
        }
    } catch (e) {
        console.error(`  ❌ Error en downloadAndUploadMediaForSyncMessage para ${msg.id._serialized}:`, e.message);
    }
}

async function processMediaDownloadQueue(deps) {
    const { mediaDownloadQueue, isDownloadingMediaRef } = deps;
    if (isDownloadingMediaRef.current) return;
    isDownloadingMediaRef.current = true;
    while (mediaDownloadQueue.length > 0) {
        const item = mediaDownloadQueue.shift();
        try {
            await downloadAndUploadMediaForSyncMessage(deps, item.msg, item.dbMessageId, item.chatId);
        } catch (e) {
            console.error(`  ❌ Error en processMediaDownloadQueue para ${item.msg?.id?._serialized}:`, e.message);
        }
        // Pequeña pausa entre descargas para evitar saturar Chromium/Puppeteer (Railway RAM limit)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    isDownloadingMediaRef.current = false;
}

const syncRecentChatsAndMessages = async (deps, wc) => {
    const { getStatus, prisma, mediaDownloadQueue, isDownloadingMediaRef, broadcastChatUpdate } = deps;
    const status = getStatus();
    if (!status.isReady) {
        console.log('⚠️ WhatsApp no está listo para sincronizar (desconectado).');
        return;
    }
    if (!wc) {
        console.log('⚠️ No hay cliente de WhatsApp disponible para sincronizar.');
        return;
    }
    if (global.isSyncingWhatsApp) {
        console.log('⏳ Sincronización ya en curso. Ignorando petición.');
        return;
    }
    global.isSyncingWhatsApp = true;
    console.log('🔄 Sincronizando chats y mensajes recientes desde WhatsApp...');

    try {
        const chats = await wc.getChats();
        const individualChats = chats.filter(c => !c.isGroup && !c.id.server.includes('broadcast')).slice(0, 45);
        console.log(`🔍 Procesando ${individualChats.length} chats individuales recientes...`);

        for (const chatObj of individualChats) {
            const waId = chatObj.id._serialized;
            const profileName = chatObj.name || '';
            let realPhone = chatObj.id.user || '';

            // Si es LID, intentar obtener el teléfono real
            if (waId.includes('@lid')) {
                realPhone = '';
                try {
                    if (typeof wc.getContactLidAndPhone === 'function') {
                        const mapping = await wc.getContactLidAndPhone([waId]);
                        if (mapping && mapping.length > 0 && mapping[0].pn) {
                            realPhone = mapping[0].pn.replace('@c.us', '').replace('@s.whatsapp.net', '');
                        }
                    }
                } catch (e) {}
                if (!realPhone) {
                    try {
                        const formatted = await wc.getFormattedNumber(waId);
                        if (formatted) realPhone = formatted.replace(/[^0-9]/g, '');
                    } catch (e) {}
                }
            }

            try {
                let dbChat = await prisma.whatsAppChat.findUnique({ where: { waId } });
                if (!dbChat) {
                    let shouldEnableBot = true;
                    try {
                        const prevMsgs = await chatObj.fetchMessages({ limit: 15 });
                        if (prevMsgs.some(m => m.fromMe)) {
                            shouldEnableBot = false;
                        }
                    } catch (e) {}

                    // Search for a matching client by phone suffix (last 8 digits)
                    let linkedClientId = null;
                    if (realPhone && realPhone.length >= 8) {
                        const searchPhoneStr = realPhone.slice(-8).replace(/\D/g, '');
                        if (searchPhoneStr.length >= 8) {
                            try {
                                const rawDuplicates = await prisma.$queryRawUnsafe(`
                                    SELECT id 
                                    FROM "Client" 
                                    WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE '%${searchPhoneStr}%'
                                    LIMIT 1
                                `);
                                if (rawDuplicates && rawDuplicates.length > 0) {
                                    linkedClientId = rawDuplicates[0].id;
                                }
                            } catch (e) {}
                        }
                    }

                    try {
                        dbChat = await prisma.whatsAppChat.create({
                            data: {
                                waId,
                                realPhone: realPhone || null,
                                profileName: profileName || null,
                                status: 'OPEN',
                                botEnabled: shouldEnableBot,
                                lastMessageAt: new Date(),
                                unreadCount: chatObj.unreadCount > 0 ? chatObj.unreadCount : 0,
                                clientId: linkedClientId
                            }
                        });
                    } catch (createErr) {
                        if (createErr.code === 'P2002') {
                            const p2002Data = { lastMessageAt: new Date() };
                            if (profileName) p2002Data.profileName = profileName;
                            if (realPhone) p2002Data.realPhone = realPhone;
                            dbChat = await prisma.whatsAppChat.update({
                                where: { waId },
                                data: p2002Data
                            });
                        } else throw createErr;
                    }
                } else {
                    const updateData = {};
                    if (profileName && !dbChat.clientId) updateData.profileName = profileName;
                    if (realPhone && !dbChat.realPhone) updateData.realPhone = realPhone;
                    if (chatObj.unreadCount !== dbChat.unreadCount) updateData.unreadCount = chatObj.unreadCount;
                    
                    if (Object.keys(updateData).length > 0) {
                        dbChat = await prisma.whatsAppChat.update({
                            where: { id: dbChat.id },
                            data: updateData
                        });
                    }
                }

                // Sincronizar mensajes recientes
                const messages = await chatObj.fetchMessages({ limit: 15 });
                for (const msg of messages) {
                    if (msg.type === 'e2e_notification') continue; // Ignorar notificaciones de cifrado
                    
                    const existingMsg = await prisma.whatsAppMessage.findUnique({
                        where: { waMessageId: msg.id._serialized }
                    });

                    let dbMsg = existingMsg;

                    if (!existingMsg) {
                        let msgType = 'TEXT';
                        if (['image', 'sticker'].includes(msg.type)) msgType = 'IMAGE';
                        else if (msg.type === 'video') msgType = 'VIDEO';
                        else if (['audio', 'ptt'].includes(msg.type)) msgType = 'AUDIO';
                        else if (msg.type === 'document') msgType = 'DOCUMENT';
                        else if (msg.hasMedia) msgType = 'IMAGE';
                        
                        dbMsg = await prisma.whatsAppMessage.create({
                            data: {
                                chatId: dbChat.id,
                                direction: msg.fromMe ? 'OUTBOUND' : 'INBOUND',
                                type: msgType,
                                content: msg.body || ((msg.hasMedia || ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msg.type)) ? '[Media/Documento]' : ''),
                                waMessageId: msg.id._serialized,
                                senderName: msg.fromMe ? 'Humano (Sincronizado)' : null,
                                createdAt: new Date(msg.timestamp * 1000)
                            }
                        });
                    }

                    // Si tiene media y le falta el mediaUrl, lo agregamos a la cola para descargarlo secuencialmente en segundo plano
                    if ((msg.hasMedia || ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msg.type)) && !dbMsg.mediaUrl) {
                        mediaDownloadQueue.push({ msg, dbMessageId: dbMsg.id, chatId: dbChat.id });
                        processMediaDownloadQueue(deps);
                    }
                }

                // Ajustar timestamp al último mensaje real guardado
                const lastMsg = await prisma.whatsAppMessage.findFirst({
                    where: { chatId: dbChat.id },
                    orderBy: { createdAt: 'desc' }
                });
                if (lastMsg) {
                    await prisma.whatsAppChat.update({
                        where: { id: dbChat.id },
                        data: { lastMessageAt: lastMsg.createdAt }
                    });
                }

                broadcastChatUpdate(dbChat.id);
            } catch (msgErr) {
                console.error(`  ⚠️ Error cargando mensajes para ${waId}:`, msgErr.message);
            }
        }
        console.log('✅ Sincronización de chats y mensajes completada.');
    } catch (err) {
        console.error('❌ Error en syncRecentChatsAndMessages:', err);
    } finally {
        global.isSyncingWhatsApp = false;
    }
};

module.exports = {
    syncRecentChatsAndMessages,
    processMediaDownloadQueue,
    downloadAndUploadMediaForSyncMessage
};
