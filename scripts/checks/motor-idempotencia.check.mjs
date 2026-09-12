// ────────────────────────────────────────────────────────────────────────────
// MOTOR DE SEGUIMIENTOS: la clave única contra el doble envío, probada en la base.
//
// `SeguimientoEnvio` tiene @@unique(chatId, plantilla, diaArt). Reclamar dos
// veces el mismo envío el mismo día (el tick corriendo dos veces, dos
// instancias, un reintento) tiene que dar UNA fila. Corre contra la base
// LOCAL; crea y borra sus propios datos.
// Correr:  node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/motor-idempotencia.check.mjs
// ────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { reclamarEnvio, cerrarEnvio } from '../../src/lib/seguimientos/registro.ts';

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) { console.error('Este check corre SOLO contra la base local.'); process.exit(1); }
const prisma = new PrismaClient();
let ok = 0; const fallas = [];
const check = (n, c) => { if (c) { ok++; console.log(`  ✓ ${n}`); } else { fallas.push(n); console.log(`  ✗ ${n}`); } };
const chatId = `check-idem-${Date.now()}`;
try {
    const a = await reclamarEnvio({ chatId, clientId: null, plantilla: 'seguimiento_presupuesto', dia: '2026-09-12' });
    const b = await reclamarEnvio({ chatId, clientId: null, plantilla: 'seguimiento_presupuesto', dia: '2026-09-12' });
    check('el primer reclamo gana', typeof a === 'string');
    check('el segundo reclamo del MISMO chat+plantilla+día choca y devuelve null (no manda)', b === null);
    const c = await reclamarEnvio({ chatId, clientId: null, plantilla: 'seguimiento_presupuesto', dia: '2026-09-13' });
    check('al día siguiente se puede volver a reclamar (otro día)', typeof c === 'string');
    const d = await reclamarEnvio({ chatId, clientId: null, plantilla: 'invitacion_local_v4', dia: '2026-09-12' });
    check('otra plantilla el mismo día es otro envío', typeof d === 'string');
    await cerrarEnvio(a, 'ENVIADO', 'template');
    const fila = await prisma.seguimientoEnvio.findUnique({ where: { id: a }, select: { resultado: true } });
    check('el resultado queda escrito', fila?.resultado === 'ENVIADO');
    // Dos reclamos EN PARALELO (las dos instancias): exactamente uno gana.
    const [p1, p2] = await Promise.all([
        reclamarEnvio({ chatId, clientId: null, plantilla: 'ultimo_seguimiento', dia: '2026-09-12' }),
        reclamarEnvio({ chatId, clientId: null, plantilla: 'ultimo_seguimiento', dia: '2026-09-12' }),
    ]);
    check('dos instancias a la vez: exactamente una gana', [p1, p2].filter(Boolean).length === 1);
} finally {
    await prisma.seguimientoEnvio.deleteMany({ where: { chatId } });
    await prisma.$disconnect();
}
console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) process.exit(1);
