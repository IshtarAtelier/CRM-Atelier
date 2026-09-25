/**
 * VENTAS 2x1: ¿EL LABORATORIO MANDÓ EL PAR BONIFICADO SIN CARGO?
 *
 * Lista las ventas 2x1 (misma regla que el cruce: `esVenta2x1`) con los pedidos
 * de laboratorio que tienen facturados y dice, venta por venta, si el par
 * bonificado vino sin cargo (dentro de TOPE_PAR_BONIFICADO_2X1), si vino
 * COBRADO (a reclamar), o si todavía falta una factura para saberlo. Es la
 * foto histórica de la regla que el cruce aplica al guardar cada factura
 * (cost-matching.ts) — sirve para ver qué había ANTES de que la regla exista
 * y para verificar un caso puntual con datos reales.
 *
 * SOLO LEE. Base LOCAL por defecto (DATABASE_URL); con `--prod` usa
 * PROD_DATABASE_URL — pedir OK antes de correrlo contra producción.
 *
 * Correr:  node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/dos-por-uno-par-bonificado.mjs [--prod] [--desde=2026-04-08] [--cliente=peralta]
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { esVenta2x1, parBonificadoCobrado, systemCostForLab } from '../../src/services/lab-recon/cost-matching.ts';
import { TOPE_PAR_BONIFICADO_2X1, billedForLab } from '../../src/services/lab-recon/types.ts';

config();
const args = process.argv.slice(2);
const flag = (n) => args.find(a => a.startsWith(`--${n}=`))?.split('=')[1];
const prod = args.includes('--prod');
const url = prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${prod ? 'PROD_DATABASE_URL' : 'DATABASE_URL'}`); process.exit(1); }
const desde = new Date(flag('desde') || '2026-04-08');
const cliente = (flag('cliente') || '').toLowerCase();
const prisma = new PrismaClient({ datasources: { db: { url } } });
const ars = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR');
const fecha = d => d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

async function main() {
    console.log(`Base: ${prod ? 'PRODUCCIÓN' : 'local'} · ventas desde ${fecha(desde)} · tope del par bonificado ${ars(TOPE_PAR_BONIFICADO_2X1)}\n`);
    const ventas = await prisma.order.findMany({
        where: { isDeleted: false, orderType: 'SALE', createdAt: { gte: desde } },
        select: {
            id: true, createdAt: true, labOrderNumber: true, appliedPromoName: true,
            client: { select: { name: true } },
            items: {
                select: {
                    eye: true, price: true, quantity: true, productCategorySnapshot: true, productCostSnapshot: true,
                    laboratorySnapshot: true, product: { select: { cost: true, laboratory: true, category: true } },
                },
            },
            labCostEntries: { select: { lab: true, labOrderNumber: true, billedNet: true, billedTotal: true, status: true, notes: true, invoiceDate: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
    const dosPorUno = ventas.filter(v => esVenta2x1(v) && (!cliente || (v.client?.name || '').toLowerCase().includes(cliente)));
    const cuenta = { ok: 0, cobrado: 0, incompleta: 0, sinPedidos: 0 };
    for (const v of dosPorUno) {
        const numeros = String(v.labOrderNumber || '').match(/\d{4,}/g) || [];
        const pedidos = v.labCostEntries.filter(e => numeros.includes(e.labOrderNumber) && !(e.notes || '').includes('POSTVENTA (caso'));
        const lab = pedidos[0]?.lab || (v.items.some(i => /optovision/i.test(i.laboratorySnapshot || i.product?.laboratory || '')) ? 'OPTOVISION' : 'GRUPO_OPTICO');
        const sistema = systemCostForLab(v, lab);
        const facturados = pedidos.map(e => ({ n: e.labOrderNumber, importe: billedForLab(e.lab, e), fecha: e.invoiceDate })).filter(p => p.importe !== null);
        let veredicto;
        if (numeros.length < 2) { veredicto = `un solo nº de pedido (${v.labOrderNumber || 'sin nº'}): sin veredicto`; cuenta.sinPedidos++; }
        else if (facturados.length < numeros.length) { veredicto = `falta factura (${facturados.length}/${numeros.length})`; cuenta.incompleta++; }
        else {
            const par = parBonificadoCobrado(facturados.map(p => p.importe));
            if (par.cobrado) { veredicto = `⚠️ PAR BONIFICADO COBRADO: el más barato ${ars(par.masBarato)} — a reclamar`; cuenta.cobrado++; }
            else { veredicto = `✓ par bonificado a ${ars(par.masBarato)}`; cuenta.ok++; }
        }
        const suma = facturados.reduce((t, p) => t + p.importe, 0);
        console.log(`${fecha(v.createdAt)}  ${(v.client?.name || '—').padEnd(28)} ${lab.padEnd(13)} sistema ${ars(sistema).padStart(10)}  facturado ${facturados.map(p => `${p.n}=${ars(p.importe)}`).join(' + ') || '—'}${facturados.length ? ` (suma ${ars(suma)}, dif ${ars(suma - sistema)})` : ''}`);
        console.log(`            ${veredicto}`);
    }
    console.log(`\n${dosPorUno.length} ventas 2x1: ${cuenta.ok} con el par bonificado sin cargo, ${cuenta.cobrado} con el par COBRADO, ${cuenta.incompleta} esperando factura, ${cuenta.sinPedidos} con un solo nº de pedido.`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
