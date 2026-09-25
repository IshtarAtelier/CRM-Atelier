// ────────────────────────────────────────────────────────────────────────────
// GRUPO ÓPTICO: UN PEDIDO CUESTA SOLO LAS LÍNEAS QUE LLEVAN SU NÚMERO.
//
// Regla de Ishtar del 25/9/2026, con el caso de Rius Belen (pedido 80544194):
// "debe ingresar y ver únicamente los que están con su nombrecito". Un
// comprobante de Grupo Óptico agrupa pedidos de muchos clientes; el pedido
// está en DOS: el remito X-0004-00023793 (el cristal, 2 × 0,50 × $20.764) y la
// factura X-0004-00353854 (el calibrado, $2.971). Con el 20% de descuento de
// cuenta: $16.611,20 + $2.376,80 = $18.988.
//
// El 24/9 figuró con $162.872: las líneas sin nº de pedido de un PDF leído a
// medias se REPARTÍAN entre los pedidos de la factura. Ya no se reparten.
//
// Fija también cómo se guardan y juntan los comprobantes con su link.
// Corre sin base y sin red.
// Correr:  npm run check:go-lineas
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { montosPorPedido } from '../../src/services/lab-providers/grupo-optico-invoices.ts';
import { juntarComprobantes, linkGmail, comprobanteDeArchivo } from '../../src/services/lab-recon/types.ts';
import { comprobantesHtml } from '../../src/services/lab-recon/comprobantes-html.ts';
import { evaluarConteo } from '../../src/services/lab-providers/grupo-optico.provider.ts';

const comprobante = (invoiceNumber, lineas, unattributed = 0) => ({
    invoiceNumber, total: null, faImporte: null, descuento: 0.8,
    attributed: new Map(Object.entries(lineas)), unattributed,
});

// Los dos comprobantes reales (importes ya con el 20% de descuento), y uno
// con $430.000 de líneas SIN nº de pedido, como el PDF a medias del 24/9.
const remito = comprobante('0004-00023793', { '80544194': 16611.2, '80544207': 10840, '80544309': 2669.6 });
const factura = comprobante('0004-00353854', { '80543304': 2.4, '80544156': 11471.2, '80544194': 2376.8, '80544207': 2376.8, '80544309': 2376.8 });
const basura = comprobante('0004-00023793', {}, 430000);

const casos = [
    ['Rius Belen: sus líneas de los dos comprobantes suman $18.988', () => {
        const { amounts } = montosPorPedido([remito, factura]);
        assert.equal(Math.round(amounts.get('80544194') * 100) / 100, 18988);
    }],
    ['el detalle dice cuánto le cobra cada comprobante', () => {
        const { porComprobante } = montosPorPedido([remito, factura]);
        assert.deepEqual(Object.fromEntries(porComprobante.get('80544194')), { '0004-00023793': 16611.2, '0004-00353854': 2376.8 });
    }],
    ['las líneas SIN nº de pedido no se le asignan a nadie (el bug del 24/9)', () => {
        const { amounts, stats } = montosPorPedido([remito, factura, basura]);
        assert.equal(Math.round(amounts.get('80544194') * 100) / 100, 18988);
        assert.equal(Math.round(amounts.get('80544207') * 100) / 100, 13216.8);
        assert.equal(stats.unattributedSum, 430000);
    }],
    ['un pedido sin líneas en ningún comprobante no tiene importe', () => {
        const { amounts } = montosPorPedido([remito, factura, basura]);
        assert.equal(amounts.has('80599999'), false);
    }],
    ['sin comprobantes, nada', () => {
        const { amounts, stats } = montosPorPedido([]);
        assert.equal(amounts.size, 0);
        assert.equal(stats.invoices, 0);
    }],

    ['juntar comprobantes: una corrida sin importe no borra el que había', () => {
        const viejos = [{ comprobante: 'X-0004-00023793', importe: 16611.2, url: 'https://portal/a', tipo: 'remito' }];
        const nuevos = [{ comprobante: 'X-0004-00023793', importe: null, url: null, tipo: 'remito' }];
        assert.deepEqual(juntarComprobantes(viejos, nuevos), viejos);
    }],
    ['juntar comprobantes: el importe nuevo manda y los demás se conservan', () => {
        const viejos = [{ comprobante: 'A', importe: 1, url: 'u1' }, { comprobante: 'B', importe: 2, url: 'u2' }];
        const r = juntarComprobantes(viejos, [{ comprobante: 'A', importe: 5, url: null }]);
        assert.deepEqual(r, [{ comprobante: 'A', importe: 5, url: 'u1' }, { comprobante: 'B', importe: 2, url: 'u2' }]);
    }],
    ['juntar comprobantes: "0004-…" (del PDF) y "X-0004-…" (de la API) son el mismo', () => {
        const r = juntarComprobantes([{ comprobante: '0004-00023793', importe: 16611.2, url: null }],
            [{ comprobante: 'X-0004-00023793', importe: null, url: 'https://portal/a', tipo: 'remito' }]);
        assert.deepEqual(r, [{ comprobante: 'X-0004-00023793', importe: 16611.2, url: 'https://portal/a', tipo: 'remito' }]);
    }],
    ['juntar comprobantes: nada de ningún lado es null', () => {
        assert.equal(juntarComprobantes(null, undefined), null);
    }],

    // ── El PDF de comprobantes: cuándo se usa y cuándo se puede borrar ──
    ['PDF entero (640 contra 640): se usan los importes y se puede borrar', () => {
        assert.deepEqual(evaluarConteo(640, 640, 0), { usarImportes: true, completo: true, nuevaBase: 640, nuevoDudoso: 0 });
    }],
    ['PDF con el 95% (600 contra 640): se usan los importes pero NO se borra nada', () => {
        const d = evaluarConteo(600, 640, 0);
        assert.equal(d.usarImportes, true);
        assert.equal(d.completo, false);
    }],
    ['PDF a medias (374 contra 640): no se tocan importes y queda anotado como dudoso', () => {
        assert.deepEqual(evaluarConteo(374, 640, 0), { usarImportes: false, completo: false, nuevaBase: null, nuevoDudoso: 374 });
    }],
    ['dos PDFs a medias DISTINTOS seguidos (374 y 195): se siguen rechazando', () => {
        assert.equal(evaluarConteo(195, 640, 374).usarImportes, false);
    }],
    ['dos pasadas SEGUIDAS que coinciden en un conteo bajo (500 y 501): el portal cambió, nueva base, sin borrar', () => {
        assert.deepEqual(evaluarConteo(501, 640, 500), { usarImportes: true, completo: false, nuevaBase: 501, nuevoDudoso: 0 });
    }],
    ['primera pasada tras el deploy (sin base): se usan los importes pero NO se borra nada', () => {
        assert.deepEqual(evaluarConteo(640, 0, 0), { usarImportes: true, completo: false, nuevaBase: 640, nuevoDudoso: 0 });
    }],
    ['PDF vacío: no hay importes', () => {
        assert.equal(evaluarConteo(0, 0, 0).usarImportes, false);
    }],

    ['link a Gmail por Message-ID, en la cuenta que lo recibió', () => {
        assert.equal(linkGmail('pisano.ishtar@gmail.com', '<ABC123@optovisionsa.com.ar>'),
            'https://mail.google.com/mail/?authuser=pisano.ishtar%40gmail.com#search/rfc822msgid%3AABC123%40optovisionsa.com.ar');
        assert.equal(linkGmail('x@y.com', null), null);
    }],
    ['nº de comprobante de Optovisión desde el nombre del adjunto', () => {
        assert.equal(comprobanteDeArchivo('FA_3025-00051752.pdf'), '3025-00051752');
        assert.equal(comprobanteDeArchivo('factura.pdf'), null);
    }],
    ['el HTML lleva cada comprobante con su link y su importe', () => {
        const html = comprobantesHtml({ invoiceRefs: [
            { comprobante: 'X-0004-00023793', importe: 16611.2, url: 'https://grupooptico.dyndns.info/x?id=1&pedido=80544194', tipo: 'remito' },
            { comprobante: 'X-0004-00353854', importe: 2376.8, url: null, tipo: 'factura' },
        ] }, 'respaldo');
        assert.match(html, /<a href="https:\/\/grupooptico\.dyndns\.info\/x\?id=1&amp;pedido=80544194">X-0004-00023793<\/a>/);
        assert.match(html, /\$16\.611/);
        assert.match(html, /X-0004-00353854/);
        assert.equal(comprobantesHtml({ invoiceRefs: null }, 'respaldo'), 'respaldo');
    }],
];

let fallas = 0;
for (const [nombre, fn] of casos) {
    try { fn(); console.log(`  ✓ ${nombre}`); }
    catch (e) { fallas++; console.log(`  ✗ ${nombre}\n      ${String(e.message).split('\n')[0]}`); }
}
console.log(fallas ? `\n${fallas} caso(s) fallaron` : `\n${casos.length} casos OK`);
process.exit(fallas ? 1 : 0);
