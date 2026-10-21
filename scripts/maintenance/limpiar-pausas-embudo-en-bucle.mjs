// ────────────────────────────────────────────────────────────────────────────
// Repara lo que dejó el bucle de "más adelante" del motor de seguimientos
// (9 al 19/10/2026, arreglado en fix/embudo-posponer-en-bucle).
//
// El cron pausaba cada hora "30 días desde ahora" sobre el mismo mensaje del
// cliente. Medido el 19/10 en producción: 69 contactos, 5.749 notas "⏸️ Sistema
// pausó los seguimientos…" en la ficha (una por tick) y la misma cantidad de
// filas en AuditLog. La pausa (`WhatsAppChat.followUpPausedUntil`) quedó corrida
// al 15–18/11 aunque el cliente lo dijo semanas antes.
//
// Qué hace, por contacto afectado:
//   1. PAUSA: la devuelve al `hasta` de la PRIMERA pausa (lo que el sistema
//      quiso poner cuando leyó el mensaje). Solo si el chat todavía tiene el
//      `hasta` de la ÚLTIMA pausa automática (si alguien la cambió a mano, no
//      se toca). Si esa fecha ya pasó, el seguimiento vuelve a correr.
//   2. NOTAS: deja la primera nota de pausa de cada ficha y BORRA las
//      repetidas (mismo texto de "pidió más adelante", creadas por 'Sistema').
//   3. AuditLog: NO se toca (trazabilidad: el bucle queda documentado).
//
// ⚠️ ESCRIBE en la base que diga LIMPIEZA_DB_URL (o DATABASE_URL si falta).
// Por defecto SIMULA y solo lista. Escribe únicamente con --aplicar.
//
//   Simulacro:  LIMPIEZA_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//                 scripts/maintenance/limpiar-pausas-embudo-en-bucle.mjs
//   En serio:   ...idem con --aplicar   (pedir OK a Ishtar antes)
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.LIMPIEZA_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const dia = (d) => (d ? d.toISOString().slice(0, 10) : '—');

console.log(`\n— Pausas del embudo en bucle (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}) —\n`);

const filas = await prisma.auditLog.findMany({
  where: {
    entityType: 'CONTACT',
    AND: [
      { details: { path: ['origen'], equals: 'embudo' } },
      { details: { path: ['accion'], equals: 'posponer' } },
    ],
  },
  orderBy: { createdAt: 'asc' },
  select: { entityId: true, createdAt: true, details: true },
});
const porContacto = new Map();
for (const f of filas) {
  if (!porContacto.has(f.entityId)) porContacto.set(f.entityId, []);
  porContacto.get(f.entityId).push(f);
}

let pausasACorregir = 0, pausasVencidas = 0, pausasTocadasAMano = 0, notasABorrar = 0;
for (const [clientId, pausas] of porContacto) {
  if (pausas.length < 2) continue; // una sola pausa: no hubo bucle
  const primera = new Date(pausas[0].details.hasta);
  const ultima = new Date(pausas[pausas.length - 1].details.hasta);

  const chats = await prisma.whatsAppChat.findMany({ where: { clientId }, select: { id: true, followUpPausedUntil: true } });
  const notas = await prisma.interaction.findMany({
    where: { clientId, type: 'NOTE', userName: 'Sistema', content: { contains: 'pausó los seguimientos' }, AND: { content: { contains: 'el cliente pidió más adelante' } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const sobran = notas.slice(1).map(n => n.id);
  notasABorrar += sobran.length;

  for (const c of chats) {
    if (!c.followUpPausedUntil) continue;
    if (c.followUpPausedUntil.getTime() !== ultima.getTime()) { pausasTocadasAMano++; console.log(`  = ${clientId} chat ${c.id}: pausa ${dia(c.followUpPausedUntil)} no es la del bucle, no se toca`); continue; }
    pausasACorregir++;
    const vencida = primera.getTime() <= Date.now();
    if (vencida) pausasVencidas++;
    console.log(`  ↺ ${clientId} chat ${c.id}: ${pausas.length} pausas · ${dia(ultima)} → ${dia(primera)}${vencida ? ' (ya vencida: vuelve el seguimiento)' : ''} · notas repetidas: ${sobran.length}`);
    if (aplicar) await prisma.whatsAppChat.update({ where: { id: c.id }, data: { followUpPausedUntil: primera }, select: { id: true } });
  }
  if (aplicar && sobran.length) await prisma.interaction.deleteMany({ where: { id: { in: sobran } } });
}

console.log(`\nContactos con bucle: ${[...porContacto.values()].filter(p => p.length > 1).length}`);
console.log(`Pausas a devolver a su fecha original: ${pausasACorregir} (de esas, ya vencidas: ${pausasVencidas})`);
console.log(`Pausas cambiadas a mano (no se tocan): ${pausasTocadasAMano}`);
console.log(`Notas repetidas a borrar: ${notasABorrar}`);
console.log(aplicar ? '\nAPLICADO.\n' : '\nSimulacro: no se escribió nada. Para aplicar, --aplicar (con OK).\n');
await prisma.$disconnect();
