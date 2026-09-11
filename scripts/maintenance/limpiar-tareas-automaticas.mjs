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
// Qué hace: pasa a CANCELLED todas las tareas PENDING de la CAMPANITA
// (`type: 'TASK'`) que NO programó una persona. No borra — cancelar deja la fila, el historial de la ficha y la
// posibilidad de revertir; borrar no.
//
// Qué NO toca:
//   · Nada que no sea `type: 'TASK'`: ni REVIEW_REQUEST (reseñas), ni TURNO
//     (agenda), ni EMBUDO. Las del embudo que todavía estén como TASK las pasa
//     a EMBUDO solo el sync diario (`sincronizar-tareas.ts`) — si este script
//     las cancelara, el panel del embudo quedaría vacío hasta la mañana.
//   · Las que tienen `createdBy` de una persona.
//   · Nada COMPLETED ni CANCELLED.
//
// Las de `createdBy: null` SÍ entran: son el fondo viejo de la base (medido en
// prod el 22/8/2026: de 334 tareas creadas en una semana, CERO las había hecho
// una persona). Si alguna era manual, se cancela — y esa es justamente la
// pizarra limpia que se pidió.
//
// LOS AVISOS "⚠️" NO SE CANCELAN EN SILENCIO. Son cosas que alguien tenía que
// hacer a mano ("Falló el mensaje de laboratorio a Axel Bruni"): el 11/9 había
// 22 pendientes en prod, de antes de que los avisos pasaran a Mensajes del
// equipo, y la campanita ya no los muestra. Con --aplicar se mandan TODOS en un
// solo mensaje del sistema al equipo y recién después se cancelan; si el aviso
// no llega a nadie, esos no se tocan.
//
// ⚠️ ESCRIBE en la base que diga TAREAS_DB_URL (o DATABASE_URL si falta).
// Por defecto SIMULA. Solo escribe con --aplicar.
//
//   Simulacro local:  node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//                       scripts/maintenance/limpiar-tareas-automaticas.mjs
//   Simulacro prod:   TAREAS_DB_URL="$PROD_DATABASE_URL" node --env-file=.env --experimental-strip-types \
//                       --import ./scripts/checks/_alias.mjs scripts/maintenance/limpiar-tareas-automaticas.mjs
//   En serio:         ...idem con --aplicar
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.TAREAS_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasources: { db: { url } } });

// La MISMA lista que usa la campanita, no una copia: si alguien suma un motor
// allá, este script lo limpia sin tocarlo. (`origen.ts` no importa nada con
// alias, así que corre con --experimental-strip-types solo.)
import { CREADORES_AUTOMATICOS as TODOS_LOS_MOTORES, PREFIJOS_AUTOMATICOS } from '../../src/lib/tareas/origen.ts';

// Las del EMBUDO no se cancelan: el sync diario las pasa a type EMBUDO en el
// lugar (mismo id, misma fecha). Se sacan de la LISTA y no con un NOT en el
// where: `NOT createdBy = x` descarta también las filas con createdBy NULL
// (en SQL da NULL, no TRUE) — y esas son justamente las que hay que limpiar.
const CREADORES_AUTOMATICOS = TODOS_LOS_MOTORES.filter((c) => c !== 'Sistema (Embudo)');

const filtro = {
    status: 'PENDING',
    type: 'TASK',
    OR: [
        { createdBy: null },
        { createdBy: { in: CREADORES_AUTOMATICOS } },
        ...PREFIJOS_AUTOMATICOS.map((p) => ({ description: { startsWith: p } })),
    ],
};

console.log(`\n— Limpieza de tareas automáticas (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}) —\n`);

// Foto de lo que hay, para que el simulacro sirva de algo.
const pendientes = await prisma.clientTask.findMany({
    where: { status: 'PENDING', type: 'TASK' },
    select: { id: true, type: true, createdBy: true, description: true, createdAt: true, client: { select: { name: true } } },
});

const esAutomatica = (t) =>
    t.createdBy === null ||
    CREADORES_AUTOMATICOS.includes(t.createdBy) ||
    PREFIJOS_AUTOMATICOS.some((p) => t.description?.startsWith(p));

const delEmbudo = pendientes.filter((t) => t.createdBy === 'Sistema (Embudo)');
const automaticas = pendientes.filter(esAutomatica);
const humanas = pendientes.filter((t) => !esAutomatica(t) && t.createdBy !== 'Sistema (Embudo)');

const porAutor = new Map();
for (const t of automaticas) {
    const clave = `${t.type} · ${t.createdBy ?? '(sin autor)'}`;
    porAutor.set(clave, (porAutor.get(clave) || 0) + 1);
}
for (const [clave, n] of [...porAutor.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${clave}`);
}

const avisos = automaticas.filter((t) => /^⚠/.test(t.description || ''));
console.log(`\n  Se cancelan: ${automaticas.length}`);
console.log(`  …de esas, avisos ⚠️ que ANTES se mandan juntos a Mensajes del equipo: ${avisos.length}`);
for (const t of avisos.slice(0, 25)) {
    console.log(`    · ${t.createdAt.toISOString().slice(0, 10)} ${t.client?.name ?? ''}: ${t.description.slice(0, 90)}`);
}
if (avisos.length > 25) console.log(`    … y ${avisos.length - 25} más`);
console.log(`  Quedan del embudo (el sync diario las pasa a su panel, no se cancelan): ${delEmbudo.length}`);
console.log(`  Sobreviven en la campanita (las programó una persona): ${humanas.length}`);
for (const t of humanas.slice(0, 20)) {
    console.log(`    · ${t.createdBy}: ${t.description.slice(0, 70)}`);
}
if (humanas.length > 20) console.log(`    … y ${humanas.length - 20} más`);

if (!aplicar) {
    console.log('\nSimulacro: no se tocó nada. Agregá --aplicar para cancelarlas.\n');
} else if (!automaticas.length) {
    console.log('\nNo hay nada que cancelar.\n');
} else {
    let noTocar = [];
    if (avisos.length) {
        // La mensajería vive en src/ (hilos, participantes, dedup): se usa esa,
        // contra la MISMA base que este script.
        process.env.DATABASE_URL = url;
        const { avisarAlEquipo } = await import('../../src/lib/avisos/aviso-al-equipo.ts');
        const lineas = avisos.map((t) => `• ${t.createdAt.toISOString().slice(0, 10)} — ${t.description.replace(/\s+/g, ' ').slice(0, 180)}`);
        const llegaron = await avisarAlEquipo({
            asunto: `⚠️ ${avisos.length} avisos pendientes que estaban en la campanita`,
            cuerpo: `Quedaron de antes de que estos avisos pasaran a Mensajes del equipo. La campanita ya no los muestra, así que van acá, todos juntos, para revisarlos a mano:\n\n${lineas.join('\n')}`,
        });
        if (!llegaron) {
            noTocar = avisos.map((t) => t.id);
            console.log(`\n✋ El aviso no le llegó a nadie: los ${avisos.length} avisos ⚠️ NO se cancelan.`);
        } else {
            console.log(`\n📨 Avisos ⚠️ mandados a Mensajes del equipo (le llegó a ${llegaron} persona/s).`);
        }
    }
    const r = await prisma.clientTask.updateMany({
        where: { ...filtro, ...(noTocar.length ? { id: { notIn: noTocar } } : {}) },
        data: { status: 'CANCELLED', completedBy: 'Sistema (limpieza 10/9/2026)', completedAt: new Date() },
    });
    console.log(`\n✅ Canceladas ${r.count} tareas automáticas.\n`);
}

await prisma.$disconnect();
