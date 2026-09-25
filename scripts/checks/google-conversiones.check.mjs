#!/usr/bin/env node
/**
 * Reglas de las conversiones offline hacia Google Ads, probadas sin base ni red:
 * qué es una venta, cuándo se cerró, cuánto vale y qué clic la originó.
 *
 * Son las reglas que usa el cron /api/cron/google-conversiones (ver
 * docs/conversiones-offline-google.md). Cada caso de acá es una forma en que
 * el sistema ya se equivocó alguna vez contando ventas (CLAUDE.md: `paid` sin
 * pagos, presupuestos con total cargado, señas tomadas como el valor).
 *
 * Uso: node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/google-conversiones.check.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const core = await import(pathToFileURL(resolve(raiz, 'src/lib/ads/conversiones-offline-core.ts')).href);

let fallos = 0;
const check = (nombre, ok, detalle = '') => {
    console.log(`  ${ok ? '✓' : '✖'} ${nombre}${ok || !detalle ? '' : ' — ' + String(detalle)}`);
    if (!ok) fallos++;
};
const dia = (s) => new Date(s + 'T15:00:00.000Z');
const ID = 'Cj0KCQjw_abc-DEF123456789';

console.log('Qué cuenta como venta (misma regla que el resto del sistema)');
{
    check('presupuesto con total y sin pagos NO es venta', !core.esVentaReal({ id: '1', total: 300000, labStatus: 'NONE', labSentAt: null, payments: [] }));
    check('labStatus null tampoco', !core.esVentaReal({ id: '1', total: 300000, labStatus: null, labSentAt: null, payments: [] }));
    check('con un pago SÍ', core.esVentaReal({ id: '1', total: 300000, labStatus: 'NONE', labSentAt: null, payments: [{ amount: 50000, date: dia('2026-09-20') }] }));
    check('enviada a fábrica SÍ, aunque no haya pago', core.esVentaReal({ id: '1', total: 300000, labStatus: 'SENT', labSentAt: dia('2026-09-20'), payments: [] }));
}

console.log('Cuándo se cerró');
{
    const enviada = { id: '1', total: 300000, labStatus: 'SENT', labSentAt: dia('2026-09-22'), payments: [{ amount: 50000, date: dia('2026-09-20') }] };
    check('manda el envío a fábrica sobre el pago', core.fechaDeCierre(enviada)?.toISOString() === dia('2026-09-22').toISOString());
    const pagada = { id: '1', total: 300000, labStatus: 'NONE', labSentAt: null, payments: [{ amount: 50000, date: dia('2026-09-21') }, { amount: 20000, date: dia('2026-09-19') }] };
    check('sin fábrica, el PRIMER pago', core.fechaDeCierre(pagada)?.toISOString() === dia('2026-09-19').toISOString());
    check('un presupuesto no tiene cierre', core.fechaDeCierre({ id: '1', total: 1, labStatus: 'NONE', labSentAt: null, payments: [] }) === null);
}

console.log('Cuánto vale');
{
    check('el total de la venta, no la seña', core.valorDeVenta({ id: '1', total: 300000, labStatus: 'SENT', labSentAt: dia('2026-09-22'), payments: [{ amount: 50000, date: dia('2026-09-20') }] }) === 300000);
    check('sin total cargado, lo cobrado', core.valorDeVenta({ id: '1', total: 0, labStatus: 'NONE', labSentAt: null, payments: [{ amount: 50000, date: dia('2026-09-20') }, { amount: 25000.4, date: dia('2026-09-21') }] }) === 75000);
    check('un pago negativo (devolución) no suma', core.valorDeVenta({ id: '1', total: 0, labStatus: 'NONE', labSentAt: null, payments: [{ amount: -1000, date: dia('2026-09-20') }] }) === 0);
}

console.log('Qué clic la originó');
{
    const cierre = dia('2026-09-24');
    const msjs = [
        { content: `Hola [googlerecetados] [gclid:${ID}]`, createdAt: dia('2026-09-10') },
        { content: 'gracias!', createdAt: dia('2026-09-12') },
    ];
    const c = core.clicParaLaVenta(msjs, cierre);
    check('encuentra el gclid del mensaje entrante', c?.kind === 'gclid' && c?.id === ID, JSON.stringify(c));
    const dos = [
        { content: `[gclid:${ID}]`, createdAt: dia('2026-09-01') },
        { content: '[gclid:SEGUNDO_CLIC_9876543210]', createdAt: dia('2026-09-15') },
    ];
    check('con dos clics gana el más reciente (así atribuye Google)', core.clicParaLaVenta(dos, cierre)?.id === 'SEGUNDO_CLIC_9876543210');
    check('un clic POSTERIOR al cierre no cuenta', core.clicParaLaVenta([{ content: `[gclid:${ID}]`, createdAt: dia('2026-09-25') }], cierre) === null);
    check('un clic de hace más de 90 días no cuenta', core.clicParaLaVenta([{ content: `[gclid:${ID}]`, createdAt: dia('2026-06-01') }], cierre) === null);
    check('wbraid también sirve', core.clicParaLaVenta([{ content: '[wbraid:WBRAID1234567890]', createdAt: dia('2026-09-10') }], cierre)?.kind === 'wbraid');
    check('el literal {gclid} de un sitelink roto no es un clic', core.clicParaLaVenta([{ content: 'hola [gclid:{gclid}]', createdAt: dia('2026-09-10') }], cierre) === null);
    check('sin mensajes, sin clic', core.clicParaLaVenta([], cierre) === null);
    check('la ventana de Google es de 90 días', core.VENTANA_CLIC_DIAS === 90);
}

if (fallos) {
    console.log(`\n✖ ${fallos} chequeo(s) fallaron`);
    process.exit(1);
}
console.log('\nTodos los chequeos pasaron');
