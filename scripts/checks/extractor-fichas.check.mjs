#!/usr/bin/env node
/**
 * Guardián del extractor pasivo de fichas.
 *
 * Por qué existe: entre el 18/6 y el 29/7/2026 el extractor no creó NINGUNA ficha
 * desde WhatsApp. La causa fue un `return` que entró de arrastre en un commit de
 * SEO (c8d2b3ba), sin relación con WhatsApp. Nadie se enteró durante ~6 semanas
 * porque el bot está diseñado para no mostrar errores.
 *
 * Este chequeo mira el resultado, no el código: si hubo conversaciones nuevas y
 * ninguna terminó en ficha, algo se rompió otra vez.
 *
 * Uso:
 *   node scripts/checks/extractor-fichas.check.mjs            # base local
 *   node scripts/checks/extractor-fichas.check.mjs --prod     # SOLO LECTURA contra producción
 */

import { PrismaClient } from '@prisma/client';

const CONTRA_PROD = process.argv.includes('--prod');
const DIAS = Number(process.env.CHECK_DIAS || 7);
const CREADORES_AUTOMATICOS = ['Agente Bot', 'Sistema (Pasivo)', 'Bot Trigger'];

const url = CONTRA_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
    console.error(`Falta ${CONTRA_PROD ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el entorno.`);
    process.exit(2);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);

try {
    // Chats con actividad entrante real en la ventana: son las oportunidades de ficha
    const chatsConActividad = await prisma.whatsAppChat.count({
        where: { lastMessageAt: { gte: desde }, clientId: null },
    });

    const fichasAutomaticas = await prisma.client.count({
        where: { createdAt: { gte: desde }, createdBy: { in: CREADORES_AUTOMATICOS } },
    });

    const fichasTotales = await prisma.client.count({ where: { createdAt: { gte: desde } } });

    console.log(`Ventana: últimos ${DIAS} días (${CONTRA_PROD ? 'PRODUCCIÓN' : 'local'})`);
    console.log(`  Chats sin ficha con actividad : ${chatsConActividad}`);
    console.log(`  Fichas creadas por el sistema : ${fichasAutomaticas}`);
    console.log(`  Fichas creadas en total       : ${fichasTotales}`);

    // El umbral es deliberadamente flojo: no medimos eficiencia, medimos "¿sigue vivo?".
    // Con menos de 5 chats sin ficha no hay señal suficiente para afirmar nada.
    if (chatsConActividad >= 5 && fichasAutomaticas === 0) {
        console.error(
            `\n❌ ALERTA: ${chatsConActividad} chats sin ficha tuvieron actividad y el extractor no creó ninguna.\n` +
            `   Revisar wa-service/passive-extractor.js (¿volvió el return temprano?),\n` +
            `   la variable GOOGLE_GENAI_API_KEY en Railway, y los logs del servicio.`,
        );
        process.exit(1);
    }

    console.log('\n✅ El extractor de fichas da señales de vida.');
    process.exit(0);
} catch (e) {
    console.error('Error corriendo el chequeo:', e.message);
    process.exit(2);
} finally {
    await prisma.$disconnect();
}
