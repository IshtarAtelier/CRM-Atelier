#!/usr/bin/env node
/**
 * Corre el service de conversiones offline en modo SECO contra la base LOCAL
 * (DATABASE_URL de .env): prueba que las consultas a Prisma están bien armadas
 * y que el resumen tiene la forma que espera el cron. No sube nada: sin los
 * dos candados de entorno el service se frena solo y lo informa en `bloqueo`.
 *
 * Uso: node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/google-conversiones-base.check.mjs
 */
const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
    console.error('Este check solo corre contra la base LOCAL (DATABASE_URL en localhost).');
    process.exit(1);
}
const { GoogleOfflineConversionsService } = await import('../../src/services/google-offline-conversions.service.ts');

const resumen = await GoogleOfflineConversionsService.subirVentasCerradas({ dias: 30, validateOnly: true });
console.log(JSON.stringify(resumen, null, 2));

let fallos = 0;
const check = (nombre, ok) => { console.log(`  ${ok ? '✓' : '✖'} ${nombre}`); if (!ok) fallos++; };
check('revisó órdenes sin reventar', Number.isInteger(resumen.ordenesRevisadas));
check('ventas ≤ órdenes revisadas', resumen.ventas <= resumen.ordenesRevisadas);
check('conClic + sinClic + yaSubidas ≤ ventas', resumen.conClic + resumen.sinClic + resumen.yaSubidas <= resumen.ventas);
check('en seco no sube nada', resumen.subidas === 0);
check('sin candados abiertos, lo dice (o no había nada con clic)', Boolean(resumen.bloqueo) || resumen.conClic === 0);

const { prisma } = await import('../../src/lib/db.ts');
await prisma.$disconnect();
if (fallos) { console.log(`\n✖ ${fallos} chequeo(s) fallaron`); process.exit(1); }
console.log('\nTodos los chequeos pasaron');
