/**
 * Migra WhatsAppChat.waId al formato de la API oficial (E.164 sin "+", sin
 * "@c.us"). Se corre UNA vez, en la Fase 4, con el número ya en la Cloud API.
 *
 *   node scripts/maintenance/whatsapp-api-oficial/migrar-waid-e164.mjs            # dry-run, base LOCAL
 *   node scripts/maintenance/whatsapp-api-oficial/migrar-waid-e164.mjs --apply    # escribe en la base LOCAL
 *   node scripts/maintenance/whatsapp-api-oficial/migrar-waid-e164.mjs --prod --apply   # PRODUCCIÓN: solo con OK explícito
 *
 * Reglas:
 *  - "<num>@c.us"  → "<num>"           (si ya existe un chat "<num>", se FUSIONAN:
 *                                        los mensajes pasan al que tenga más actividad
 *                                        y el otro se archiva vacío — nunca se borra).
 *  - "<lid>@lid"   → realPhone o teléfono de la ficha vinculada, normalizado 549…;
 *                     si no hay teléfono confiable, queda como está y ARCHIVADO
 *                     (se lista al final para revisar a mano).
 *  - Grupos "@g.us" → se archivan (la API oficial no tiene grupos).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PROD = args.includes('--prod');
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(PROD ? 'Falta PROD_DATABASE_URL' : 'Falta DATABASE_URL'); process.exit(1); }
if (PROD && !APPLY) console.log('⚠️  --prod sin --apply: dry-run contra PRODUCCIÓN (solo lectura).');
const prisma = new PrismaClient({ datasources: { db: { url } } });

function normalizar(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('549')) d = d.slice(3); else if (d.startsWith('54')) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    const m = d.match(/^([1-3]\d{1,3})15(\d{6,8})$/); if (m) d = m[1] + m[2];
    if (d.length < 10 || d.length > 11) return null;
    return `549${d}`;
}

async function main() {
    const chats = await prisma.whatsAppChat.findMany({
        select: { id: true, waId: true, realPhone: true, clientId: true, lastMessageAt: true, archived: true, client: { select: { phone: true } }, _count: { select: { messages: true } } },
    });
    const plan = { cus: [], lid: [], lidSin: [], grupos: [], ok: 0 };
    const porE164 = new Map();
    for (const c of chats) if (/^\d{10,15}$/.test(c.waId)) porE164.set(c.waId, c);

    for (const c of chats) {
        if (/^\d{10,15}$/.test(c.waId)) { plan.ok++; continue; }
        if (c.waId.endsWith('@g.us')) { plan.grupos.push(c); continue; }
        if (c.waId.endsWith('@c.us')) {
            // También se normaliza: hay "542974207763@c.us" (sin el 9) y "0@c.us".
            const crudo = c.waId.replace('@c.us', '');
            const e164 = normalizar(crudo) || (/^\d{10,15}$/.test(crudo) && !crudo.startsWith('54') ? crudo : null); // extranjeros: tal cual
            if (e164) plan.cus.push({ c, e164 }); else plan.lidSin.push(c);
            continue;
        }
        if (c.waId.endsWith('@lid')) {
            const e164 = normalizar(c.realPhone) || normalizar(c.client?.phone);
            if (e164) plan.lid.push({ c, e164 }); else plan.lidSin.push(c);
        }
    }

    console.log(`Chats: ${chats.length} · ya E.164: ${plan.ok} · @c.us: ${plan.cus.length} · @lid resolubles: ${plan.lid.length} · @lid sin teléfono: ${plan.lidSin.length} · grupos: ${plan.grupos.length}`);
    if (!APPLY) {
        console.log('\n(dry-run) Ejemplos @c.us →', plan.cus.slice(0, 5).map(x => `${x.c.waId} → ${x.e164}`).join(', '));
        console.log('(dry-run) Ejemplos @lid →', plan.lid.slice(0, 5).map(x => `${x.c.waId} → ${x.e164}`).join(', '));
        console.log('(dry-run) @lid SIN teléfono (se archivarían):', plan.lidSin.length);
        await prisma.$disconnect(); return;
    }

    let fusiones = 0, renombres = 0, archivados = 0;
    async function moverA(c, e164) {
        const existente = porE164.get(e164);
        if (existente && existente.id !== c.id) {
            // Fusión: el destino conserva su waId; los mensajes del origen pasan a él.
            const [dst, src] = (existente.lastMessageAt || 0) >= (c.lastMessageAt || 0) ? [existente, c] : [c, existente];
            await prisma.$transaction(async tx => {
                await tx.whatsAppMessage.updateMany({ where: { chatId: src.id }, data: { chatId: dst.id } });
                await tx.whatsAppChat.update({ where: { id: src.id }, data: { waId: `${src.waId}#fusionado-${Date.now()}`, archived: true } });
                await tx.whatsAppChat.update({ where: { id: dst.id }, data: { waId: e164, realPhone: e164, clientId: dst.clientId || src.clientId, lastMessageAt: dst.lastMessageAt || src.lastMessageAt } });
            });
            porE164.set(e164, dst);
            fusiones++;
        } else {
            await prisma.whatsAppChat.update({ where: { id: c.id }, data: { waId: e164, realPhone: e164 } });
            porE164.set(e164, c);
            renombres++;
        }
    }
    for (const { c, e164 } of plan.cus) await moverA(c, e164);
    for (const { c, e164 } of plan.lid) await moverA(c, e164);
    for (const c of [...plan.lidSin, ...plan.grupos]) {
        if (!c.archived) { await prisma.whatsAppChat.update({ where: { id: c.id }, data: { archived: true } }); archivados++; }
    }
    console.log(`Listo. Renombrados: ${renombres} · Fusionados: ${fusiones} · Archivados (sin teléfono / grupos): ${archivados}`);
    if (plan.lidSin.length) console.log('Revisar a mano (@lid sin teléfono):', plan.lidSin.map(c => c.id).join(', '));
    await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
