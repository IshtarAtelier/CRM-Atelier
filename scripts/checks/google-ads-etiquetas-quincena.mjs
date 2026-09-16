/**
 * ¿Qué trajo Google en la última quincena, medido en el CRM? SOLO LECTURA.
 *
 * Es el dato que hace falta ANTES de tocar las acciones de conversión de Google
 * Ads (scripts/maintenance/google-ads/conversiones-principales.mjs): chats que
 * entraron con etiqueta `google:*` (la landing la pone en el mensaje desde el
 * 15/9/26), cuántos llegaron a presupuesto, cuántos cerraron y cuánta plata
 * entró. Sin esto, el cambio de conversiones no se puede evaluar.
 *
 * Uso: node scripts/checks/google-ads-etiquetas-quincena.mjs [--prod] [--dias 14]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const usarProd = process.argv.includes('--prod');
const i = process.argv.indexOf('--dias'); const DIAS = i !== -1 ? Number(process.argv[i + 1]) : 14;
const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
const prisma = new PrismaClient({ datasourceUrl: url });
const plata = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
const desde = new Date(Date.now() - DIAS * 864e5);
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} · últimos ${DIAS} días\n`);

const chats = await prisma.whatsAppChat.findMany({ where: { createdAt: { gte: desde }, adTag: { startsWith: 'google:' } }, select: { adTag: true, clientId: true } });
const porTag = new Map();
for (const c of chats) { const g = porTag.get(c.adTag) || { chats: 0, clientes: new Set() }; g.chats++; if (c.clientId) g.clientes.add(c.clientId); porTag.set(c.adTag, g); }
const ids = [...new Set(chats.map((c) => c.clientId).filter(Boolean))];
const ordenes = ids.length ? await prisma.order.findMany({ where: { clientId: { in: ids }, isDeleted: false }, select: { clientId: true, orderType: true, total: true, payments: { select: { amount: true } } } }) : [];
const porCliente = new Map();
for (const o of ordenes) { const p = porCliente.get(o.clientId) || { presup: 0, cobrado: 0 }; p.presup++; p.cobrado += o.payments.reduce((s, x) => s + Number(x.amount || 0), 0); porCliente.set(o.clientId, p); }

console.log(`Chats con etiqueta google:* → ${chats.length}`);
console.log('ETIQUETA'.padEnd(32) + 'CHATS'.padStart(6) + 'FICHAS'.padStart(7) + 'PRESUP.'.padStart(8) + 'COBRADO'.padStart(13));
for (const [tag, g] of [...porTag.entries()].sort((a, b) => b[1].chats - a[1].chats)) {
    let presup = 0, cobrado = 0;
    for (const cid of g.clientes) { const p = porCliente.get(cid); if (p) { if (p.presup) presup++; cobrado += p.cobrado; } }
    console.log(tag.padEnd(32) + String(g.chats).padStart(6) + String(g.clientes.size).padStart(7) + String(presup).padStart(8) + plata(cobrado).padStart(13));
}
const total = await prisma.whatsAppChat.count({ where: { createdAt: { gte: desde } } });
const sinTag = await prisma.whatsAppChat.count({ where: { createdAt: { gte: desde }, adTag: null } });
console.log(`\nDe ${total} chats nuevos en el período, ${sinTag} (${Math.round(sinTag / Math.max(total, 1) * 100)}%) siguen sin ninguna etiqueta.`);
await prisma.$disconnect();
