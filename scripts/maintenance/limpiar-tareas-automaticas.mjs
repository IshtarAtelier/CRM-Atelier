// ────────────────────────────────────────────────────────────────────────────
// VACIAR LA CAMPANITA DE TAREAS — una sola vez.
//
// Pedido de Ishtar (10/9/2026): "necesito que las tareas se salgan todas y
// únicamente estén las que el vendedor programe".
//
// De acá en adelante el código ya no mezcla: las del embudo nacen con
// `type: 'EMBUDO'` (tienen su propio ícono en el dock), los avisos de fallo
// ⚠️ van como mensaje del sistema a la mensajería interna, y la campanita
// filtra por `SOLO_DEL_VENDEDOR` (`src/lib/tareas/origen.ts`). Lo que queda es
// el arrastre: lo que YA está PENDING en la base.
//
// Qué hace: pasa a CANCELLED todas las tareas PENDING que NO programó una
// persona. No borra — cancelar deja la fila, el historial de la ficha y la
// posibilidad de revertir; borrar no.
//
// Qué NO toca:
//   · REVIEW_REQUEST (pedidos de reseña) y TURNO (agenda) — tienen su propio
//     circuito y su propia pantalla.
//   · Las que tienen `createdBy` de una persona.
//   · Nada COMPLETED ni CANCELLED.
//
// Las de `createdBy: null` SÍ entran: son el fondo viejo de la base (medido en
// prod el 22/8/2026: de 334 tareas creadas en una semana, CERO las había hecho
// una persona). Si alguna era manual, se cancela — y esa es justamente la
// pizarra limpia que se pidió.
//
// ⚠️ ESCRIBE en la base que diga TAREAS_DB_URL (o DATABASE_URL si falta).
// Por defecto SIMULA. Solo escribe con --aplicar.
//
//   Simulacro local:  node --env-file=.env scripts/maintenance/limpiar-tareas-automaticas.mjs
//   Simulacro prod:   TAREAS_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//                       scripts/maintenance/limpiar-tareas-automaticas.mjs
//   En serio:         ...idem con --aplicar
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.TAREAS_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Espejo de src/lib/tareas/origen.ts. Se duplica a propósito: un .mjs suelto
// no puede importar TypeScript con alias '@/'. Si cambia allá, cambia acá.
const CREADORES_AUTOMATICOS = [
    'Sistema', 'Sistema (Embudo)', 'Sistema (Pasivo)', 'Sistema (Retención)',
    'Sistema (Retencion)', 'Sistema (cierre venta)', 'Bot', 'Agente Bot', 'Bot Trigger',
];
const PREFIJOS_AUTOMATICOS = [
    '[Extracción Inteligente]', '[Seguimiento Manual]', '[RECETA POR FOTO]', '⚠️', '⚠',
];

const filtro = {
    status: 'PENDING',
    // TURNO y REVIEW_REQUEST quedan afuera: no son la campanita.
    type: { notIn: ['TURNO', 'REVIEW_REQUEST'] },
    OR: [
        { createdBy: null },
        { createdBy: { in: CREADORES_AUTOMATICOS } },
        ...PREFIJOS_AUTOMATICOS.map((p) => ({ description: { startsWith: p } })),
    ],
};

console.log(`\n— Limpieza de tareas automáticas (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}) —\n`);

// Foto de lo que hay, para que el simulacro sirva de algo.
const pendientes = await prisma.clientTask.findMany({
    where: { status: 'PENDING', type: { notIn: ['TURNO', 'REVIEW_REQUEST'] } },
    select: { id: true, type: true, createdBy: true, description: true },
});

const esAutomatica = (t) =>
    t.createdBy === null ||
    CREADORES_AUTOMATICOS.includes(t.createdBy) ||
    PREFIJOS_AUTOMATICOS.some((p) => t.description?.startsWith(p));

const automaticas = pendientes.filter(esAutomatica);
const humanas = pendientes.filter((t) => !esAutomatica(t));

const porAutor = new Map();
for (const t of automaticas) {
    const clave = `${t.type} · ${t.createdBy ?? '(sin autor)'}`;
    porAutor.set(clave, (porAutor.get(clave) || 0) + 1);
}
for (const [clave, n] of [...porAutor.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${clave}`);
}

console.log(`\n  Se cancelan: ${automaticas.length}`);
console.log(`  Sobreviven (las programó una persona): ${humanas.length}`);
for (const t of humanas.slice(0, 20)) {
    console.log(`    · ${t.createdBy}: ${t.description.slice(0, 70)}`);
}
if (humanas.length > 20) console.log(`    … y ${humanas.length - 20} más`);

if (!aplicar) {
    console.log('\nSimulacro: no se tocó nada. Agregá --aplicar para cancelarlas.\n');
} else if (!automaticas.length) {
    console.log('\nNo hay nada que cancelar.\n');
} else {
    const r = await prisma.clientTask.updateMany({
        where: filtro,
        data: { status: 'CANCELLED', completedBy: 'Sistema (limpieza 10/9/2026)', completedAt: new Date() },
    });
    console.log(`\n✅ Canceladas ${r.count} tareas automáticas.\n`);
}

await prisma.$disconnect();
