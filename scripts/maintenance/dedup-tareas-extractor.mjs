// ────────────────────────────────────────────────────────────────────────────
// Deduplica las tareas PENDING que apiló el extractor pasivo antes del arreglo
// del 12/8/2026 (pisaba por descripción exacta, la IA redacta distinto cada vez
// → una tarea nueva por tanda de mensajes; una clienta juntó 88).
//
// Por cada cliente deja UNA tarea por familia — la más nueva, que es la que
// tiene la conclusión final de la conversación — y BORRA el resto:
//   · [Extracción Inteligente]  (medido: 1.273 pendientes, sobran 1.011)
//   · [Seguimiento Manual]      (medido:   204 pendientes, sobran   110)
// No toca [RECETA POR FOTO] (ya tenía dedup), ni SENDING/COMPLETED, ni tareas
// humanas.
//
// ⚠️ ESCRIBE en la base que diga TAREAS_DB_URL (o DATABASE_URL si falta).
// Por defecto SIMULA. Solo borra con --aplicar.
//
//   Simulacro:  TAREAS_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//                 scripts/maintenance/dedup-tareas-extractor.mjs
//   En serio:   ...idem con --aplicar
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.TAREAS_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasources: { db: { url } } });

console.log(`\n— Dedup de tareas del extractor (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}) —\n`);

const FAMILIAS = ['[Extracción Inteligente]', '[Seguimiento Manual]'];
let totalBorradas = 0;

for (const prefijo of FAMILIAS) {
  // Todas las pendientes de la familia, más nuevas primero.
  const tareas = await prisma.clientTask.findMany({
    where: { status: 'PENDING', description: { startsWith: prefijo } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, clientId: true, createdAt: true, description: true },
  });

  const vistas = new Set();
  const aBorrar = [];
  for (const t of tareas) {
    if (vistas.has(t.clientId)) aBorrar.push(t);
    else vistas.add(t.clientId); // la primera (más nueva) por cliente se queda
  }

  console.log(`${prefijo}: ${tareas.length} pendientes en ${vistas.size} clientes → se borran ${aBorrar.length}`);

  if (aplicar && aBorrar.length) {
    // De a tandas para no armar un IN gigante.
    for (let i = 0; i < aBorrar.length; i += 200) {
      const ids = aBorrar.slice(i, i + 200).map((t) => t.id);
      const r = await prisma.clientTask.deleteMany({ where: { id: { in: ids }, status: 'PENDING' } });
      totalBorradas += r.count;
    }
  }
}

if (aplicar) {
  console.log(`\n✅ Borradas ${totalBorradas} tareas duplicadas. Queda una por cliente y familia (la más nueva).`);
} else {
  console.log('\n(simulacro: no se borró nada — correr con --aplicar para ejecutar)');
}
await prisma.$disconnect();
console.log('');
