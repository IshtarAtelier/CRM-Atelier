/**
 * minar-conversaciones.mjs — Minería SOLO LECTURA de chats de WhatsApp para
 * armar el dataset de evaluación del bot (`conversaciones-reales.json`).
 *
 * Contra qué base pega: la que diga DATABASE_URL. Para producción (lo normal):
 *
 *   cd /Users/ishtarpissano/proyectos/atelier
 *   DATABASE_URL="$(grep '^PROD_DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" \
 *     node scripts/maintenance/bot-eval/minar-conversaciones.mjs --relevar
 *   DATABASE_URL="..." node ... --extraer > /ruta/al/dump-crudo.json
 *
 * Modos:
 *   --relevar   imprime volumen (chats, mensajes, rangos de fecha, firmas)
 *   --extraer   emite por stdout un JSON con los hilos completos de los chats
 *               que tienen diálogo real (entrantes Y salientes del Bot)
 *
 * Garantías:
 *   - SOLO consultas de lectura (count / groupBy / aggregate / findMany).
 *   - `select` explícito en todo (el schema local está adelantado a prod).
 *   - Teléfonos anonimizados a últimos 4 dígitos ANTES de emitir.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const modo = process.argv[2] || '--relevar';

/** waId tipo "5493511234567@c.us" → "…4567" */
function anonPhone(waId) {
  const digits = String(waId || '').replace(/\D/g, '');
  return digits.length >= 4 ? `…${digits.slice(-4)}` : '…????';
}

/** Solo el nombre de pila (uso interno, pero sin apellidos en el dataset). */
function firstName(profileName) {
  if (!profileName) return null;
  const t = String(profileName).trim().split(/\s+/)[0];
  return t || null;
}

async function relevar() {
  const [totalChats, totalMsgs, rango] = await Promise.all([
    prisma.whatsAppChat.count(),
    prisma.whatsAppMessage.count(),
    prisma.whatsAppMessage.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } }),
  ]);

  const porDireccion = await prisma.whatsAppMessage.groupBy({
    by: ['direction'],
    _count: { _all: true },
  });

  const firmas = await prisma.whatsAppMessage.groupBy({
    by: ['senderName'],
    where: { direction: 'OUTBOUND' },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 25,
  });

  // Chats con 5+ entrantes
  const entrantesPorChat = await prisma.whatsAppMessage.groupBy({
    by: ['chatId'],
    where: { direction: 'INBOUND' },
    _count: { _all: true },
  });
  const con5mas = entrantesPorChat.filter((c) => c._count._all >= 5).length;
  const con3mas = entrantesPorChat.filter((c) => c._count._all >= 3).length;

  console.log(JSON.stringify({
    totalChats,
    totalMensajes: totalMsgs,
    primerMensaje: rango._min.createdAt,
    ultimoMensaje: rango._max.createdAt,
    porDireccion: Object.fromEntries(porDireccion.map((d) => [d.direction, d._count._all])),
    chatsConEntrantes: entrantesPorChat.length,
    chatsCon3oMasEntrantes: con3mas,
    chatsCon5oMasEntrantes: con5mas,
    firmasSalientes: firmas.map((f) => ({ senderName: f.senderName, n: f._count._all })),
  }, null, 2));
}

async function extraer() {
  // Chats con al menos 3 entrantes: ahí puede haber diálogo real.
  const entrantesPorChat = await prisma.whatsAppMessage.groupBy({
    by: ['chatId'],
    where: { direction: 'INBOUND' },
    _count: { _all: true },
  });
  const candidatos = entrantesPorChat
    .filter((c) => c._count._all >= 3)
    .map((c) => c.chatId);

  process.stderr.write(`Candidatos (3+ entrantes): ${candidatos.length}\n`);

  const resultado = [];
  const LOTE = 50;
  for (let i = 0; i < candidatos.length; i += LOTE) {
    const ids = candidatos.slice(i, i + LOTE);
    const chats = await prisma.whatsAppChat.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        waId: true,
        profileName: true,
        chatSummary: true,
        adTag: true,
        botEnabled: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            direction: true,
            type: true,
            content: true,
            senderName: true,
            templateName: true,
            createdAt: true,
          },
        },
      },
    });

    for (const chat of chats) {
      const msgs = chat.messages;
      const inbound = msgs.filter((m) => m.direction === 'INBOUND');
      const outBot = msgs.filter((m) => m.direction === 'OUTBOUND' && m.senderName === 'Bot');
      const outAll = msgs.filter((m) => m.direction === 'OUTBOUND');
      // Diálogo real: el cliente habló Y alguien (idealmente el bot) respondió.
      if (inbound.length < 3 || outAll.length < 2) continue;
      resultado.push({
        chatId: chat.id,
        telefono: anonPhone(chat.waId),
        nombre: firstName(chat.profileName),
        adTag: chat.adTag || null,
        chatSummary: chat.chatSummary || null,
        stats: { entrantes: inbound.length, salientesBot: outBot.length, salientesTotal: outAll.length },
        mensajes: msgs.map((m) => ({
          dir: m.direction,
          tipo: m.type,
          quien: m.direction === 'INBOUND' ? 'cliente' : (m.senderName || 'desconocido'),
          plantilla: m.templateName || undefined,
          texto: (m.content || '').slice(0, 2000),
          fecha: m.createdAt,
        })),
      });
    }
    process.stderr.write(`  lote ${i / LOTE + 1}: acumulados ${resultado.length}\n`);
  }

  process.stdout.write(JSON.stringify(resultado));
  process.stderr.write(`Total conversaciones con diálogo real: ${resultado.length}\n`);
}

try {
  if (modo === '--relevar') await relevar();
  else if (modo === '--extraer') await extraer();
  else { console.error('Uso: --relevar | --extraer'); process.exit(1); }
} finally {
  await prisma.$disconnect();
}
