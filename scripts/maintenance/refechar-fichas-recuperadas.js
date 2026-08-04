/**
 * Reasigna la fecha (createdAt) de las fichas creadas por el bot HOY al día del
 * PRIMER mensaje real de su conversación de WhatsApp.
 *
 * Por qué: el 4/8/2026 el recuperador de extracciones saldó ~95 fichas de golpe
 * tras dos arreglos, y todas quedaron fechadas "hoy" aunque las conversaciones
 * eran de días anteriores — el contador diario y el total del mes quedaban mal.
 * Pedido explícito del dueño: cada ficha asignada a su día.
 *
 * Uso:
 *   node scripts/maintenance/refechar-fichas-recuperadas.js            → PRUEBA (no escribe)
 *   node scripts/maintenance/refechar-fichas-recuperadas.js --execute  → aplica
 *
 * Base: usa PROD_DATABASE_URL (este arreglo es de producción). Antes de escribir
 * guarda un respaldo JSON con los valores previos en backups/, para poder
 * revertir.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const EXECUTE = process.argv.includes('--execute');
const url = process.env.PROD_DATABASE_URL;
if (!url) { console.error('Falta PROD_DATABASE_URL'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Medianoche de HOY en Argentina (UTC-3), igual que el dashboard.
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;
const artNow = new Date(Date.now() - ART_OFFSET_MS);
const inicioHoyART = new Date(Date.UTC(artNow.getUTCFullYear(), artNow.getUTCMonth(), artNow.getUTCDate()) + ART_OFFSET_MS);

const MAX_DIAS = 90;

(async () => {
    const fichasDeHoy = await prisma.client.findMany({
        where: {
            isDeleted: false,
            createdBy: 'Agente Bot',
            createdAt: { gte: inicioHoyART },
        },
        select: {
            id: true, name: true, createdAt: true,
            whatsappChats: { select: { id: true } },
        },
    });

    console.log(`Fichas del bot creadas hoy: ${fichasDeHoy.length}`);

    const cambios = [];
    for (const f of fichasDeHoy) {
        const chatIds = f.whatsappChats.map(c => c.id);
        if (!chatIds.length) continue;
        const primero = await prisma.whatsAppMessage.findFirst({
            where: { chatId: { in: chatIds }, direction: 'INBOUND' },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        });
        if (!primero) continue;

        const fecha = primero.createdAt;
        const edadMs = Date.now() - fecha.getTime();
        // Solo si la conversación empezó ANTES de hoy, hacia atrás y acotado.
        if (fecha >= inicioHoyART) continue;
        if (edadMs <= 0 || edadMs > MAX_DIAS * 864e5) continue;

        cambios.push({ id: f.id, name: f.name, antes: f.createdAt.toISOString(), despues: fecha.toISOString() });
    }

    console.log(`Fichas cuya conversación es de un día anterior: ${cambios.length}`);
    for (const c of cambios) {
        console.log(`  ${c.name.padEnd(28).slice(0, 28)} ${c.antes.slice(0, 10)} → ${c.despues.slice(0, 10)}`);
    }

    if (!EXECUTE) {
        console.log('\nMODO PRUEBA: no se escribió nada. Correr con --execute para aplicar.');
    } else if (cambios.length) {
        const backupPath = path.join(__dirname, '..', '..', 'backups', `refechar-fichas-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(cambios, null, 2));
        console.log(`\nRespaldo de valores previos: ${backupPath}`);

        for (const c of cambios) {
            await prisma.client.update({
                where: { id: c.id },
                data: { createdAt: new Date(c.despues) },
                select: { id: true },
            });
        }
        console.log(`Aplicado: ${cambios.length} fichas refechadas a su día real.`);
    }

    await prisma.$disconnect();
})().catch(async (e) => { console.error('ERROR:', e.message); await prisma.$disconnect(); process.exit(1); });
