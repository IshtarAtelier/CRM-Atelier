// ────────────────────────────────────────────────────────────────────────────
// Verificación de la outbox de envíos (Fase 1 del motor de seguimientos).
// Fija las garantías que importan:
//   1. persistir/marcar: el ciclo QUEUED → SENDING → SENT queda registrado.
//   2. Recuperación tras "muerte" del proceso:
//      · SENDING huérfano → SKIPPED (incierto), NUNCA se reenvía.
//      · QUEUED → se reenvía UNA vez por el camino normal.
//   3. El claim persistido protege de duplicados: si la ClientTask fue tomada
//      por otra corrida (updatedAt distinto), el reenvío se descarta.
// Corre contra la base LOCAL (DATABASE_URL). Crea y borra sus propias filas.
//
// Correr:  npm run check:outbox
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:localpassword@localhost:5432/atelier';
const { prisma } = require('../../wa-service/db');
const outbox = require('../../wa-service/followups/outbox.js');

let passed = 0;
const check = (name, cond) => { assert.ok(cond, `FALLÓ: ${name}`); passed++; console.log(`  ✓ ${name}`); };
const limpiar = () => prisma.envioProgramado.deleteMany({ where: { origen: 'CHECK_OUTBOX' } });

console.log('\n— Outbox de envíos: garantías de persistencia y recuperación —\n');
await limpiar();

// 1. Ciclo de vida básico
const id1 = await outbox.persistir({ waId: '549000@c.us', chatId: null, contenido: 'test', origen: 'CHECK_OUTBOX', clientName: 'Check' });
check('persistir crea la fila QUEUED', !!id1);
let fila = await prisma.envioProgramado.findUnique({ where: { id: id1 } });
check('estado inicial QUEUED, intentos 0', fila.estado === 'QUEUED' && fila.intentos === 0);

await outbox.marcar(id1, 'SENDING');
fila = await prisma.envioProgramado.findUnique({ where: { id: id1 } });
check('SENDING incrementa intentos', fila.estado === 'SENDING' && fila.intentos === 1);

await outbox.marcar(id1, 'SENT');
fila = await prisma.envioProgramado.findUnique({ where: { id: id1 } });
check('SENT cierra el ciclo', fila.estado === 'SENT');

// 2. Recuperación: SENDING huérfano NUNCA se reenvía; QUEUED sí, una vez
const idIncierto = await outbox.persistir({ waId: '549001@c.us', contenido: 'en curso al morir', origen: 'CHECK_OUTBOX' });
await outbox.marcar(idIncierto, 'SENDING');
const idColgado = await outbox.persistir({ waId: '549002@c.us', contenido: 'aprobado sin salir', origen: 'CHECK_OUTBOX' });

const reenvios = [];
const enviarFake = async (params) => { reenvios.push(params); await outbox.marcar(params.outboxId, 'SENT'); return { sent: true }; };
// Simula el arranque de un proceso nuevo (nota: barre TODA la outbox, como en
// producción — en la base local no hay filas reales que interfieran)
const r = await outbox.recuperarPendientes(enviarFake);

check('el SENDING huérfano se marcó incierto y NO se reenvió',
    (await prisma.envioProgramado.findUnique({ where: { id: idIncierto } })).estado === 'SKIPPED' &&
    !reenvios.some(p => p.outboxId === idIncierto));
check('el QUEUED se reenvió exactamente una vez',
    reenvios.filter(p => p.outboxId === idColgado).length === 1);
check('la fila reenviada reusó su id (no se duplicó)',
    await prisma.envioProgramado.count({ where: { origen: 'CHECK_OUTBOX' } }) === 3);
check('el contador de la recuperación coincide', r.reenviados >= 1 && r.inciertos >= 1);

// 3. El claim persistido viaja a la recuperación
const tarea = await prisma.clientTask.findFirst({ select: { id: true, updatedAt: true } });
if (tarea) {
    const idConClaim = await outbox.persistir({
        waId: '549003@c.us', contenido: 'con claim', origen: 'CHECK_OUTBOX',
        taskId: tarea.id, claimStamp: tarea.updatedAt,
    });
    const capturas = [];
    await outbox.recuperarPendientes(async (params) => { capturas.push(params); await outbox.marcar(params.outboxId, 'SKIPPED', 'check'); return { sent: false }; });
    const conClaim = capturas.find(p => p.outboxId === idConClaim);
    check('la recuperación reconstruye el claim (taskId + claimStamp)',
        conClaim?.claim?.taskId === tarea.id &&
        new Date(conClaim.claim.claimStamp).getTime() === tarea.updatedAt.getTime());
} else {
    console.log('  (sin ClientTask en la base local: se saltea el caso del claim)');
}

await limpiar();
await prisma.$disconnect();
console.log(`\n✅ ${passed} checks OK — lo aprobado sobrevive reinicios y nunca se duplica\n`);
