/**
 * ¿Qué del resumen de cuenta de Essilor NO está cargado en el sistema?
 *
 * El cron diario guarda el último resumen ("Documentos Pendientes" de
 * procesos@essilor.com.ar) en LabAccountStatement, con cada factura ya cruzada
 * contra los pedidos conocidos (campo `enSistema` y `gemelo`). Este script lee
 * ese snapshot y arma el informe de lo que quedó sin cargar.
 *
 * Además revisa dos cosas que trajo la administradora el 12/8/2026:
 *   - Cinco facturas que llegaron SIN nº de operación, con el número que les
 *     corresponde según la planilla física.
 *   - Los nº de operación "con letra" (TI-7101093): la factura de Optovisión
 *     trae DOS identificadores en la misma línea —"Ped: TI-7101093(580841)"—
 *     y el sistema solo guarda el de paréntesis. Una venta cargada con el de
 *     la letra nunca cruza.
 *
 * SOLO LEE la base (producción). Con --enviar manda el informe por email.
 *
 *   node scripts/checks/lab-resumen-essilor.check.mjs
 *   node scripts/checks/lab-resumen-essilor.check.mjs --enviar
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const url = process.env.PROD_DATABASE_URL;
if (!url) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const ENVIAR = process.argv.includes('--enviar');
const DETALLE = process.argv.includes('--detalle');
const CRM = (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app').replace(/\/$/, '');

/** Facturas sin nº de operación, con el número que les corresponde (planilla física). */
const PENDIENTES_DE_ASIGNAR = [
    { comprobante: '3008-00067549', pedido: '596770' },
    { comprobante: '3008-00052707', pedido: '565417' },
    { comprobante: '3008-00070740', pedido: '3578632' },
    { comprobante: '3008-00063271', pedido: '588062' },
    { comprobante: '3008-00072463', pedido: '598454' },
];

/**
 * Facturas cuyo PDF trae VARIOS pedidos en la línea "Ped:" y que el sistema no
 * cargó (por eso figuran huérfanas aunque las ventas estén cargadas). El PDF
 * los trae con los dos identificadores —"TI-7101568(587979)"— y acá va el de
 * paréntesis, que es el que usan las ventas.
 * 3008-00062896: leída del PDF el 24/8/2026 (es la más cara del resumen).
 */
const PEDIDOS_DE_FACTURA = {
    '3008-00062896': ['587979', '588049', '588966'],
};

const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
// El resumen a veces trae la fecha en un formato que no parsea (la fila de
// 3008-00062896 daba "Invalid Date"): mejor un guión que basura en el email.
const fecha = d => {
    // El resumen guarda la fecha como TEXTO "dd/mm/yyyy" (así viene del PDF).
    // Pasarla por new Date() la daba por inválida ("—" en casi todas las filas)
    // y las pocas que parseaban salían leídas al revés, en formato US:
    // "02/07/2026" (2 de julio) se mostraba como 07/02. Se devuelve tal cual.
    if (typeof d === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(d.trim())) return d.trim();
    const x = d ? new Date(d) : null;
    return x && !isNaN(x.getTime())
        ? x.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';
};
/** "3008 -00070740" / "3008‑00067549" → "3008-00070740" */
const normalizar = s => {
    const m = String(s).match(/(\d{4})\D*0*(\d{3,8})/);
    return m ? `${m[1]}-${m[2].padStart(8, '0')}` : String(s).trim();
};

const esClaveSinNumero = p => !p || /^S\/PEDIDO/.test(String(p)) || !/^\d{5,}$/.test(String(p).trim());

/**
 * Cada factura del resumen con de quién es y el id de su venta. El snapshot ya
 * guarda el cliente pero no el id, y sin id no hay link: se vuelve a cruzar
 * factura → LabCostEntry → Order con el mismo criterio de normalización que usa
 * crossStatementRows (src/services/lab-recon/imap.ts).
 */
async function armarDetalle(rows) {
    const entradas = await prisma.$queryRaw`
        select e."labOrderNumber", e."sourceFile", e.notes, e."orderId",
               e."systemCost", e."billedTotal", e."billedNet", e.difference, e.status,
               o."labOrderNumber" as "ventaPedidos", c.name as cliente
        from "LabCostEntry" e
        left join "Order" o on o.id = e."orderId"
        left join "Client" c on c.id = o."clientId"
        where e.lab = 'OPTOVISION' and e."sourceFile" is not null`;
    const porFactura = new Map();
    for (const e of entradas) {
        const m = (e.sourceFile || '').match(/(\d{4})-?0*(\d{3,8})/);
        if (!m) continue;
        const k = `${m[1]}-${m[2].padStart(8, '0')}`;
        if (!porFactura.has(k)) porFactura.set(k, []);
        porFactura.get(k).push(e);
    }
    // Una factura puede traer VARIOS pedidos ("Ped: TI-7101568(587979) /
    // TI-7101583(588049) / TI-7101638(588966)"). Para las que el sistema cargó,
    // los pedidos son sus entradas; para las que no, salen de PEDIDOS_DE_FACTURA.
    const ventaDe = new Map();
    for (const num of Object.values(PEDIDOS_DE_FACTURA).flat()) {
        const [v] = await prisma.$queryRaw`
            select o.id, o."labOrderNumber", c.name as cliente
            from "Order" o left join "Client" c on c.id = o."clientId"
            where o."isDeleted" = false and o."labOrderNumber" like ${'%' + num + '%'}
            limit 1`;
        ventaDe.set(num, v || null);
    }

    return rows.map((r, i) => {
        const es = porFactura.get(String(r.invoiceNumber)) || [];
        const manuales = PEDIDOS_DE_FACTURA[String(r.invoiceNumber)] || [];
        const pedidosFactura = es.length
            ? es.map(e => e.labOrderNumber).filter(n => /^\d{5,}$/.test(String(n)))
            : manuales;
        const deQuienes = manuales.map(n => ({ pedido: n, venta: ventaDe.get(n) || null }));
        const best = es.find(e => e.orderId) || es[0] || null;
        const g = r.gemelo;
        return {
            n: i + 1,
            factura: String(r.invoiceNumber),
            fecha: fecha(r.fecha),
            importe: r.importe ?? null,
            // Lo que se debe es el SALDO, no el importe original: la 62896 se
            // facturó por $1.056.830 y queda debiendo $249.302. Sumar importes
            // daría una deuda inflada que no cierra con el resumen.
            saldo: r.saldo ?? r.importe ?? null,
            pedido: g?.ventaPedidos || best?.ventaPedidos
                || (esClaveSinNumero(g?.pedido) ? null : g?.pedido),
            cliente: g?.cliente || best?.cliente || null,
            postventa: g?.tipo === 'POSTVENTA' || !!best?.notes?.includes('POSTVENTA (caso'),
            enSistema: !!r.enSistema,
            orderId: best?.orderId || null,
            pedidosFactura,
            deQuienes,
            // Costo del CRM vs. facturado. La comparación la hace el sistema a
            // NIVEL VENTA (una venta puede tener varios pedidos), así que en
            // ventas multi-pedido el sobrecosto es de la venta entera, no de
            // esta factura sola. `difference` positivo = sobrecosto.
            systemCost: best?.systemCost ?? null,
            facturado: best?.billedTotal ?? best?.billedNet ?? null,
            diferencia: best?.difference ?? null,
            estado: best?.status || null,
        };
    });
}

/**
 * El listado del resumen para cruzar a mano: una fila por factura, el nombre
 * del cliente, y el link que abre la venta en el CRM. Las de post-venta van
 * marcadas aparte porque no son ventas nuevas — es plata que se facturó dos
 * veces por el mismo par y hay que mirarla distinto.
 * Texto grande y contraste alto: se lee en pantalla al lado del papel.
 */
function htmlDetalle(st, detalle) {
    const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const diferencia = d => {
        if (d.estado === 'PENDING') return '<span style="color:#57534e">falta factura</span>';
        if (d.diferencia == null) return '—';
        const v = Math.round(d.diferencia);
        if (Math.abs(v) < 1000) return '<span style="color:#15803d">al día</span>';
        return v > 0
            ? `<strong style="color:#b91c1c">+${pesos(v)}</strong>`
            : `<span style="color:#15803d">−${pesos(Math.abs(v))}</span>`;
    };
    const total = detalle.reduce((a, d) => a + (d.saldo || 0), 0);
    const fila = d => {
        const fondo = !d.enSistema ? '#fef2f2' : d.postventa ? '#fffbeb' : '#ffffff';
        // Una factura con varios pedidos: se nombran todos, con su venta.
        const varios = d.deQuienes?.length
            ? `<div style="font-size:14px;color:#44403c;margin-top:4px">trae ${d.deQuienes.length} pedidos: ${d.deQuienes.map(x => x.venta
                ? `<a href="${CRM}/admin/ventas?id=${x.venta.id}">${esc(x.pedido)} ${esc(x.venta.cliente || '')}</a>`
                : `${esc(x.pedido)} (sin venta)`).join(' · ')}</div>` : '';
        const quien = !d.enSistema
            ? `<strong style="color:#b91c1c">NO ESTÁ EN EL SISTEMA</strong>${varios}`
            : d.orderId
                ? `<a href="${CRM}/admin/ventas?id=${d.orderId}" style="color:#1d4ed8;font-weight:600">${esc(d.cliente || 'ver la venta')}</a>`
                : d.cliente
                    ? esc(d.cliente)
                    : '<strong style="color:#b45309">falta identificar</strong>';
        return `<tr style="background:${fondo}">
            <td style="padding:10px 8px;color:#57534e">${d.n}</td>
            <td style="padding:10px 8px;font-family:ui-monospace,monospace">${esc(d.factura)}</td>
            <td style="padding:10px 8px;white-space:nowrap">${esc(d.fecha)}</td>
            <td style="padding:10px 8px;text-align:right;white-space:nowrap">${pesos(d.saldo)}${
            d.importe != null && d.saldo != null && Math.round(d.importe) !== Math.round(d.saldo)
                ? `<br><span style="font-size:14px;color:#57534e">de ${pesos(d.importe)}</span>` : ''}</td>
            <td style="padding:10px 8px;font-family:ui-monospace,monospace">${esc(d.pedido || '—')}</td>
            <td style="padding:10px 8px">${quien}</td>
            <td style="padding:10px 8px;text-align:right;white-space:nowrap">${pesos(d.systemCost)}</td>
            <td style="padding:10px 8px;text-align:right;white-space:nowrap">${diferencia(d)}</td>
            <td style="padding:10px 8px">${d.postventa ? '<strong style="color:#92400e">POST-VENTA</strong>' : ''}</td>
        </tr>`;
    };
    const th = 'padding:10px 8px;text-align:left;border-bottom:2px solid #1c1917;font-weight:700';
    return `<meta charset="utf-8"><title>Resumen Essilor</title>
<body style="font-family:system-ui,sans-serif;font-size:17px;color:#1c1917;background:#fff;margin:0;padding:24px">
<h1 style="font-size:26px;margin:0 0 4px">Resumen de cuenta de Optovisión (Essilor)</h1>
<p style="margin:0 0 20px;color:#44403c">Al ${fecha(st.statementDate)} · ${detalle.length} facturas · deuda ${pesos(st.totalDebt)}</p>
<p style="margin:0 0 20px;color:#44403c">
  <span style="background:#fffbeb;padding:2px 8px;border:1px solid #d6d3d1">amarillo</span> = post-venta (reproceso) ·
  <span style="background:#fef2f2;padding:2px 8px;border:1px solid #d6d3d1">rojo</span> = la factura no entró al sistema ·
  el nombre en azul abre la venta.
</p>
<table style="border-collapse:collapse;width:100%;max-width:1100px">
<thead><tr>
  <th style="${th}">#</th><th style="${th}">Factura</th><th style="${th}">Fecha</th>
  <th style="${th};text-align:right">Saldo</th><th style="${th}">Pedido</th>
  <th style="${th}">De quién es</th>
  <th style="${th};text-align:right">Costo CRM</th>
  <th style="${th};text-align:right">Sobre/sub costo</th><th style="${th}"></th>
</tr></thead>
<tbody>${detalle.map(fila).join('')}</tbody>
<tfoot><tr><td colspan="3" style="padding:12px 8px;border-top:2px solid #1c1917;font-weight:700">Total</td>
<td style="padding:12px 8px;border-top:2px solid #1c1917;text-align:right;font-weight:700">${pesos(total)}</td>
<td colspan="5" style="border-top:2px solid #1c1917"></td></tr></tfoot>
</table>
</body>`;
}

/**
 * `--venta <nº de pedido>`: abre UNA venta y muestra de dónde sale su costo de
 * sistema, ítem por ítem. Es para no dar por bueno un sobrecosto sin mirar:
 * la mayoría de los "sobrecostos" históricos fueron costos mal cargados en el
 * CRM, no plata de más del laboratorio. Aplica la regla del negocio: el costo
 * de un cristal es POR PAR, así que un ítem con ojo (`eye`) vale la mitad.
 */
async function verVenta(pedido) {
    const [o] = await prisma.$queryRaw`
        select o.id, o."labOrderNumber", o."appliedPromoName", c.name as cliente
        from "Order" o left join "Client" c on c.id = o."clientId"
        where o."isDeleted" = false and o."labOrderNumber" like ${'%' + pedido + '%'}
        limit 1`;
    if (!o) { console.log(`No hay ninguna venta con el pedido ${pedido}.`); return; }

    // Mismo criterio que systemCostForLab (lab-recon/cost-matching.ts): si el
    // ítem no tiene el costo congelado, se usa el del producto vigente. Leer
    // solo el snapshot daba costo $0 y un "sobrecosto" falso por toda la venta.
    const items = await prisma.$queryRaw`
        select i."productNameSnapshot", i."productCategorySnapshot", i."laboratorySnapshot",
               i."productCostSnapshot", p.cost as "costoProducto", p.name as "productoHoy",
               p.price as "precioLista", i."productUnitTypeSnapshot" as unidad,
               i.price, i.quantity, i.eye
        from "OrderItem" i left join "Product" p on p.id = i."productId"
        where i."orderId" = ${o.id} order by i."productCategorySnapshot"`;
    const entradas = await prisma.$queryRaw`
        select "labOrderNumber", "billedTotal", "billedNet", "systemCost", difference, status, "sourceFile"
        from "LabCostEntry" where "orderId" = ${o.id}`;

    console.log(`\nVENTA ${o.labOrderNumber} — ${o.cliente || 's/cliente'}${o.appliedPromoName ? ` · promo: ${o.appliedPromoName}` : ''}`);
    console.log(`  ${CRM}/admin/ventas?id=${o.id}\n`);
    const CALIBRADO = 15000 * 1.21; // mismo fallback que cost-matching.ts
    const es2x1 = (o.appliedPromoName || '').toLowerCase().includes('2x1')
        || items.some(i => /cristal/i.test(i.productCategorySnapshot || '') && i.price === 0);
    console.log(`  ÍTEMS (costo por par: el ítem con ojo cuenta la mitad)${es2x1 ? ' · VENTA 2x1' : ''}`);
    let suma = 0;
    for (const it of items) {
        const mitad = it.eye ? 0.5 : 1;
        const costoLista = it.productCostSnapshot ?? it.costoProducto ?? null;
        // Regla del 2x1 (la misma de systemCostForLab): el par regalado se
        // cuenta solo como calibrado, no a costo de lista. Es EL supuesto que
        // decide si una venta 2x1 da sobrecosto o no.
        const esRegalado = es2x1 && /cristal/i.test(it.productCategorySnapshot || '') && it.price === 0;
        const costo = esRegalado ? CALIBRADO : costoLista;
        const deDonde = esRegalado ? 'par regalado → calibrado'
            : it.productCostSnapshot != null ? 'congelado'
                : it.costoProducto != null ? 'del producto hoy' : 'SIN COSTO CARGADO';
        const aporta = (costo ?? 0) * mitad * (it.quantity || 1);
        suma += aporta;
        console.log(`    ${String(it.productNameSnapshot || '—').slice(0, 40).padEnd(42)}` +
            `costo ${pesos(costo).padStart(11)}${it.eye ? ' /2' : '   '} ${deDonde.padEnd(18)}` +
            ` precio ${pesos(it.price).padStart(11)}  → ${pesos(aporta)}`);
    }
    console.log(`\n  unidad con la que está cargado el costo: ${[...new Set(items.map(i => i.unidad || 'sin unidad'))].join(', ')}`);
    console.log(`  costo de sistema (suma de arriba): ${pesos(suma)}`);
    console.log(`  FACTURAS DEL LABORATORIO:`);
    let facturado = 0;
    for (const e of entradas) {
        const imp = e.billedTotal ?? e.billedNet ?? 0;
        facturado += imp;
        console.log(`    pedido ${String(e.labOrderNumber).padEnd(12)} ${pesos(imp).padStart(12)}  ${e.status}  ${e.sourceFile || ''}`);
    }
    console.log(`\n  total facturado: ${pesos(facturado)}`);
    const dif = facturado - suma;
    console.log(`  diferencia: ${dif > 0 ? `+${pesos(dif)} (el lab cobró de MÁS)` : `${pesos(dif)} (el lab cobró de MENOS que el costo cargado)`}`);
}

/**
 * `--costos`: el cruce de costo tomando el VALOR DE LOS CRISTALES, los dos
 * pares. El sistema hoy supone que en un 2x1 el par regalado le cuesta al lab
 * solo el calibrado; el laboratorio no sabe nada de la promo y fabrica los dos
 * pares igual. Esta vista compara las dos cuentas, una al lado de la otra.
 */
async function verCostos() {
    const ventas = await prisma.$queryRaw`
        select distinct o.id, o."labOrderNumber", o."appliedPromoName", c.name as cliente
        from "LabCostEntry" e
        join "Order" o on o.id = e."orderId"
        left join "Client" c on c.id = o."clientId"
        where e.lab = 'OPTOVISION' and e."sourceFile" is not null and o."isDeleted" = false`;

    const CALIBRADO = 15000 * 1.21;
    const filas = [];
    for (const o of ventas) {
        const items = await prisma.$queryRaw`
            select i."productCategorySnapshot", i."productCostSnapshot", p.cost as "costoProducto",
                   i.price, i.quantity, i.eye
            from "OrderItem" i left join "Product" p on p.id = i."productId"
            where i."orderId" = ${o.id}`;
        const entradas = await prisma.$queryRaw`
            select "billedTotal", "billedNet", notes from "LabCostEntry" where "orderId" = ${o.id}`;
        // Los reprocesos de postventa no son parte del costo de la venta.
        const propias = entradas.filter(e => !e.notes?.includes('POSTVENTA (caso'));
        if (!propias.length) continue;
        const facturado = propias.reduce((a, e) => a + (e.billedTotal ?? e.billedNet ?? 0), 0);

        const cristales = items.filter(i => /cristal/i.test(i.productCategorySnapshot || ''));
        if (!cristales.length) continue;
        const es2x1 = (o.appliedPromoName || '').toLowerCase().includes('2x1')
            || cristales.some(i => i.price === 0);
        const costoDe = i => i.productCostSnapshot ?? i.costoProducto ?? 0;
        const porPar = i => (i.eye ? 0.5 : 1) * (i.quantity || 1);
        // Valor de los cristales: TODOS los pares a costo de lista.
        const cristalesFull = cristales.reduce((a, i) => a + costoDe(i) * porPar(i), 0);
        // Lo que calcula el sistema hoy: el par regalado solo calibrado.
        const sistema = cristales.reduce((a, i) =>
            a + (es2x1 && i.price === 0 ? CALIBRADO : costoDe(i)) * porPar(i), 0);
        filas.push({ ...o, es2x1, cristalesFull, sistema, facturado });
    }

    filas.sort((a, b) => (b.facturado - b.cristalesFull) - (a.facturado - a.cristalesFull));
    console.log(`\nCOSTO CONTRA LO FACTURADO — ${filas.length} ventas con factura de Optovisión\n`);
    console.log(`  ${'Venta'.padEnd(28)}${'Cliente'.padEnd(26)}${'Cristales'.padStart(12)}${'Facturado'.padStart(13)}${'Diferencia'.padStart(13)}   ${'(regla vieja)'.padStart(13)}`);
    for (const f of filas) {
        const d = f.facturado - f.cristalesFull;
        const dv = f.facturado - f.sistema;
        console.log(`  ${String(f.labOrderNumber).slice(0, 26).padEnd(28)}${String(f.cliente || '—').slice(0, 24).padEnd(26)}` +
            `${pesos(f.cristalesFull).padStart(12)}${pesos(f.facturado).padStart(13)}` +
            `${(d > 0 ? '+' : '−') + pesos(Math.abs(d))}`.padStart(13) +
            `   ${((dv > 0 ? '+' : '−') + pesos(Math.abs(dv))).padStart(13)}${f.es2x1 ? '  2x1' : ''}`);
    }
    const totalDif = filas.reduce((a, f) => a + (f.facturado - f.cristalesFull), 0);
    console.log(`\n  Total tomando el valor de los cristales: ${totalDif > 0 ? '+' : '−'}${pesos(Math.abs(totalDif))}` +
        ` ${totalDif > 0 ? '(el lab cobró de más)' : '(el lab cobró de menos que el costo cargado)'}`);
}

async function main() {
    if (process.argv.includes('--costos')) { await verCostos(); return; }
    const iVenta = process.argv.indexOf('--venta');
    if (iVenta !== -1 && process.argv[iVenta + 1]) {
        await verVenta(process.argv[iVenta + 1]);
        return;
    }
    const [st] = await prisma.$queryRaw`
        select "statementDate", "totalDebt", "invoiceCount", rows, "sourceFile", "createdAt"
        from "LabAccountStatement"
        where lab = 'OPTOVISION'
        order by "statementDate" desc, "createdAt" desc
        limit 1`;

    if (!st) {
        console.log('No hay ningún resumen de cuenta guardado todavía.');
        return;
    }

    const rows = Array.isArray(st.rows) ? st.rows : [];
    const sinCargar = rows.filter(r => !r.enSistema);
    const conVenta = rows.filter(r => r.gemelo?.tipo === 'VENTA');
    const conPostventa = rows.filter(r => r.gemelo?.tipo === 'POSTVENTA');

    // LO QUE ESTE INFORME NO PUEDE EQUIVOCAR: decir "no está en el sistema"
    // de algo que sí está. Una factura que llegó sin nº de pedido queda sin
    // venta enganchada, pero la venta puede estar cargada perfectamente — lo
    // que falta es el dato en el papel. Antes las dos cosas caían en la misma
    // bolsa ("sin venta que las respalde") y eso hacía sonar grave lo que no
    // lo era, y perderse lo que sí. Acá se separan, y de las que no traen nº
    // se busca activamente la venta antes de darlas por huérfanas.
    const sinVentaCrudo = rows.filter(r => r.enSistema && r.gemelo?.tipo === 'SIN_VENTA');
    const sinNumero = [];   // la factura no trae el nº: la venta puede existir
    const huerfanas = [];   // pedido con nº propio y sin ninguna venta: lo grave
    for (const r of sinVentaCrudo) {
        if (esClaveSinNumero(r.gemelo?.pedido)) {
            // ¿Sabemos a qué pedido corresponde? (planilla física) ¿y hay venta?
            const dato = PENDIENTES_DE_ASIGNAR.find(p => normalizar(p.comprobante) === String(r.invoiceNumber));
            let venta = null;
            if (dato) {
                const v = await prisma.$queryRaw`
                    select o."labOrderNumber", c.name as cliente, o."clientId"
                    from "Order" o left join "Client" c on c.id = o."clientId"
                    where o."isDeleted" = false and o."labOrderNumber" like ${'%' + dato.pedido + '%'}`;
                venta = v[0] || null;
            }
            sinNumero.push({ ...r, pedidoConocido: dato?.pedido || null, venta });
        } else {
            huerfanas.push(r);
        }
    }

    console.log(`Resumen de cuenta de Optovisión (Essilor)`);
    console.log(`  al ${fecha(st.statementDate)} · ${st.invoiceCount} facturas · deuda ${pesos(st.totalDebt)}`);
    console.log(`  archivo: ${st.sourceFile || '—'} · leído el ${fecha(st.createdAt)}\n`);
    console.log(`  con venta enganchada .............. ${conVenta.length}`);
    console.log(`  con postventa (reproceso) ......... ${conPostventa.length}`);
    console.log(`  la factura no trae el nº de pedido  ${sinNumero.length}  (la venta puede estar cargada)`);
    console.log(`  pedido SIN venta en el sistema .... ${huerfanas.length}  ← lo grave`);
    console.log(`  factura que no entró al sistema ... ${sinCargar.length}  ← lo grave`);

    const importeDe = r => r.importe ?? r.saldo ?? null;
    const totalSinCargar = sinCargar.reduce((a, r) => a + (importeDe(r) || 0), 0);

    // Las facturas del resumen una por una, en el mismo orden que vienen en el
    // papel, con de quién es cada una y el link a la venta. Es la vista para
    // cruzar contra el resumen impreso: va siempre en el email, y a la consola
    // con --detalle (y a un archivo clickeable con --html <archivo>).
    const detalle = await armarDetalle(rows);
    if (DETALLE) {
        console.log(`\nLAS ${detalle.length} FACTURAS DEL RESUMEN, UNA POR UNA:\n`);
        for (const d of detalle) {
            const quien = !d.enSistema ? '⚠ NO ESTÁ EN EL SISTEMA'
                : d.cliente ? `${d.cliente}${d.postventa ? '  ★ POST-VENTA' : ''}`
                    : '⚠ sin venta enganchada';
            const parcial = d.importe != null && d.saldo != null && Math.round(d.importe) !== Math.round(d.saldo)
                ? ` (de ${pesos(d.importe)})` : '';
            console.log(
                `${String(d.n).padStart(2)}. ${d.factura.padEnd(15)}${d.fecha.padEnd(12)}` +
                `${pesos(d.saldo).padStart(13)}${parcial.padEnd(16)} ${String(d.pedido || '—').padEnd(18)} ${quien}`
            );
            for (const x of d.deQuienes || []) {
                console.log(`        pedido ${x.pedido} → ${x.venta ? `${x.venta.cliente} (${x.venta.labOrderNumber})` : 'sin venta cargada'}`);
            }
        }
        const iHtml = process.argv.indexOf('--html');
        if (iHtml !== -1 && process.argv[iHtml + 1]) {
            const { writeFileSync } = await import('node:fs');
            writeFileSync(process.argv[iHtml + 1], htmlDetalle(st, detalle));
            console.log(`\n  listado clickeable escrito en ${process.argv[iHtml + 1]}`);
        }
    }
    if (sinCargar.length) {
        console.log(`\nFACTURAS DEL RESUMEN QUE NO ESTÁN EN EL SISTEMA (${pesos(totalSinCargar)}):`);
        for (const r of sinCargar) {
            console.log(`  ${String(r.invoiceNumber).padEnd(16)} ${fecha(r.fecha).padEnd(12)} ${pesos(importeDe(r))}`);
        }
    }
    if (huerfanas.length) {
        console.log(`\nPEDIDOS FACTURADOS SIN NINGUNA VENTA EN EL SISTEMA:`);
        for (const r of huerfanas) {
            console.log(`  ${String(r.invoiceNumber).padEnd(16)} pedido ${r.gemelo?.pedido || '—'} · ${pesos(importeDe(r))}`);
        }
    }
    if (sinNumero.length) {
        console.log(`\nFACTURAS QUE NO TRAEN EL Nº DE PEDIDO (la venta puede estar cargada):`);
        for (const r of sinNumero) {
            const donde = r.venta
                ? `es de ${r.venta.cliente} (${r.venta.labOrderNumber})`
                : r.pedidoConocido
                    ? `sería el pedido ${r.pedidoConocido}, que no figura en ninguna venta`
                    : 'falta identificar a qué pedido corresponde';
            console.log(`  ${String(r.invoiceNumber).padEnd(16)} ${pesos(importeDe(r)).padStart(12)} · ${donde}`);
        }
    }

    // ── Las cinco facturas sin nº de operación ────────────────────────────
    console.log(`\n\nFACTURAS SIN Nº DE OPERACIÓN (las que pasaste):`);
    const asignables = [];
    for (const p of PENDIENTES_DE_ASIGNAR) {
        const comp = normalizar(p.comprobante);
        const nro = comp.split('-')[1].replace(/^0+/, '');
        const entradas = await prisma.$queryRaw`
            select "labOrderNumber", "sourceFile", "billedNet", "billedTotal", status, "orderId", "invoiceDate"
            from "LabCostEntry"
            where "labOrderNumber" like ${'%' + nro + '%'} or "sourceFile" like ${'%' + nro + '%'}`;
        const ventas = await prisma.$queryRaw`
            select o.id, o."labOrderNumber", o."clientId", c.name as cliente, o."labStatus"
            from "Order" o left join "Client" c on c.id = o."clientId"
            where o."isDeleted" = false and o."labOrderNumber" like ${'%' + p.pedido + '%'}`;
        const yaCargado = await prisma.$queryRaw`
            select "labOrderNumber", status, "orderId" from "LabCostEntry"
            where "labOrderNumber" = ${p.pedido}`;

        const e = entradas[0] || null;
        const v = ventas[0] || null;
        asignables.push({ ...p, comprobante: comp, entrada: e, venta: v, yaCargado: yaCargado[0] || null });
        console.log(`\n  ${comp}  →  pedido ${p.pedido}`);
        console.log(`    factura en el sistema: ${e ? `${e.labOrderNumber} · ${pesos(e.billedTotal ?? e.billedNet)} · ${e.status}` : 'NO está'}`);
        console.log(`    venta con ese pedido:  ${v ? `${v.cliente || 's/cliente'} (${v.labOrderNumber})` : 'ninguna venta tiene ese número'}`);
        if (yaCargado[0]) console.log(`    ojo: ya existe una entrada con el pedido ${p.pedido} (${yaCargado[0].status})`);
    }

    // ── Pedidos que caen DENTRO de un rango ───────────────────────────────
    // Las ventas cargan los pedidos como rango: "588966 - 588968". El cruce
    // lee los números sueltos (/\d{4,}/g), así que ve el 588966 y el 588968
    // pero NO el 588967: la factura del pedido del medio queda huérfana para
    // siempre aunque su venta esté cargada.
    const conRango = await prisma.$queryRaw`
        select o.id, o."labOrderNumber", c.name as cliente
        from "Order" o left join "Client" c on c.id = o."clientId"
        where o."isDeleted" = false
          and o."labOrderNumber" ~ '[0-9]{5,}[^0-9]+[0-9]{5,}'`;
    const rangos = conRango.map(o => {
        const nums = (o.labOrderNumber.match(/\d{5,}/g) || []).map(Number);
        return { ...o, desde: Math.min(...nums), hasta: Math.max(...nums), sueltos: new Set(nums) };
    }).filter(r => r.hasta - r.desde > 1 && r.hasta - r.desde < 20);

    const enRango = n => rangos.find(r => n > r.desde && n < r.hasta && !r.sueltos.has(n));

    console.log(`\n\nPEDIDOS QUE CAEN EN EL MEDIO DE UN RANGO`);
    console.log(`  ventas con rango de más de dos números: ${rangos.length}`);
    for (const p of PENDIENTES_DE_ASIGNAR) {
        const r = enRango(Number(p.pedido));
        if (r) console.log(`  pedido ${p.pedido} está DENTRO de "${r.labOrderNumber}" — ${r.cliente}`);
    }
    const huerfanos = await prisma.$queryRaw`
        select "labOrderNumber" from "LabCostEntry"
        where status = 'UNMATCHED' and "labOrderNumber" ~ '^[0-9]{5,8}$'`;
    const rescatables = huerfanos
        .map(h => ({ num: Number(h.labOrderNumber), venta: enRango(Number(h.labOrderNumber)) }))
        .filter(x => x.venta);
    console.log(`  facturas huérfanas cuyo pedido cae dentro del rango de una venta: ${rescatables.length}`);
    for (const x of rescatables) console.log(`    ${x.num} → "${x.venta.labOrderNumber}" (${x.venta.cliente})`);

    // ── El identificador "con letra" (TI-7101093) ─────────────────────────
    // En el sistema el número está pelado, sin la T: lo que se cargó es
    // 7101093. Se reconoce por el LARGO, que es la firma de cada identificador:
    //   6 dígitos  → pedido de Optovisión (580841) ← el que usa el sistema
    //   7 dígitos  → el otro identificador, el de la T (TI-7101093)
    //   8 dígitos  → pedido de Grupo Óptico (80513687)
    const conLetra = await prisma.$queryRaw`
        select o.id, o."labOrderNumber", o."createdAt", o."labStatus", c.name as cliente,
               (select count(*) from "LabCostEntry" e where e."orderId" = o.id)::int as entradas
        from "Order" o left join "Client" c on c.id = o."clientId"
        where o."isDeleted" = false
          and o."labOrderNumber" ~ '(^|[^0-9])[0-9]{7}([^0-9]|$)'
        order by o."createdAt" desc
        limit 100`;

    const sinCruzarLetra = conLetra.filter(o => o.entradas === 0);
    console.log(`\n\nVENTAS CARGADAS CON EL OTRO IDENTIFICADOR (7 dígitos, el de la "T"): ${conLetra.length}`);
    console.log(`  de esas, SIN cruzar con ninguna factura: ${sinCruzarLetra.length}`);
    for (const o of conLetra.slice(0, 30)) {
        console.log(`  ${String(o.labOrderNumber).padEnd(22)} ${fecha(o.createdAt).padEnd(12)} ${(o.cliente || '').slice(0, 28).padEnd(30)} ${o.entradas ? 'cruza' : 'SIN CRUZAR'}`);
    }

    // Control: ¿cuántas ventas usan el formato correcto? Sirve para saber si
    // esto es la excepción o la regla.
    const [formatos] = await prisma.$queryRaw`
        select count(*) filter (where "labOrderNumber" ~ '(^|[^0-9])[0-9]{6}([^0-9]|$)')::int as de_6,
               count(*) filter (where "labOrderNumber" ~ '(^|[^0-9])[0-9]{7}([^0-9]|$)')::int as de_7,
               count(*) filter (where "labOrderNumber" ~ '(^|[^0-9])[0-9]{8}([^0-9]|$)')::int as de_8
        from "Order" where "isDeleted" = false and "labOrderNumber" ~ '[0-9]{4}'`;
    console.log(`\n  Formato de los nº cargados en las ventas: ${formatos.de_6} de 6 dígitos (pedido Optovisión) · ${formatos.de_7} de 7 (el de la T) · ${formatos.de_8} de 8 (Grupo Óptico)`);

    if (!ENVIAR) {
        console.log(`\n\n(Informe no enviado. Para mandarlo por email: --enviar)`);
        return;
    }
    await enviar({ st, rows, sinCargar, huerfanas, sinNumero, conVenta, conPostventa, asignables, conLetra, totalSinCargar, detalle });
}

async function enviar({ st, rows, sinCargar, huerfanas, sinNumero, conVenta, conPostventa, asignables, conLetra, totalSinCargar, detalle }) {
    const key = process.env.RESEND_API_KEY;
    const to = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
    const from = process.env.EMAIL_FROM || 'Atelier Óptica <onboarding@resend.dev>';
    if (!key && !process.env.EMAIL_USER) {
        console.error('Sin RESEND_API_KEY ni EMAIL_USER: no se envía.');
        return;
    }

    const th = 'padding:8px;text-align:left;background:#111827;color:#fff';
    const td = 'padding:6px 8px;border:1px solid #e5e7eb';
    const importeDe = r => r.importe ?? r.saldo ?? null;

    const tablaSinCargar = sinCargar.length ? `
        <h3 style="color:#b91c1c">Facturas del resumen que NO están en el sistema (${sinCargar.length} · ${pesos(totalSinCargar)})</h3>
        <p>Están en la cuenta de Essilor pero nunca entraron por email, así que no se cruzaron con ninguna venta.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr><th style="${th}">Comprobante</th><th style="${th}">Fecha</th><th style="${th}">Importe</th><th style="${th}">Saldo</th></tr>
            ${sinCargar.map(r => `<tr><td style="${td};font-family:monospace">${r.invoiceNumber}</td><td style="${td}">${fecha(r.fecha)}</td><td style="${td};text-align:right">${pesos(r.importe)}</td><td style="${td};text-align:right">${pesos(r.saldo)}</td></tr>`).join('')}
        </table>` : '<p style="color:#047857"><strong>Todas las facturas del resumen están cargadas en el sistema.</strong></p>';

    const tablaHuerfanas = huerfanas.length ? `
        <h3 style="color:#b91c1c">Pedidos facturados que NO están en el sistema (${huerfanas.length})</h3>
        <p>El laboratorio cobró estos pedidos y no hay ninguna venta ni postventa que los respalde. Esto es lo grave: o falta cargar la venta, o hay que reclamárselo al laboratorio.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr><th style="${th}">Comprobante</th><th style="${th}">Pedido</th><th style="${th}">Importe</th></tr>
            ${huerfanas.map(r => `<tr><td style="${td};font-family:monospace">${r.invoiceNumber}</td><td style="${td};font-family:monospace">${r.gemelo?.pedido || '—'}</td><td style="${td};text-align:right">${pesos(importeDe(r))}</td></tr>`).join('')}
        </table>` : '';

    const tablaSinNumero = sinNumero.length ? `
        <h3 style="color:#c2410c">Facturas que no traen el nº de pedido (${sinNumero.length})</h3>
        <p><strong>Esto no es "sin venta".</strong> Optovisión emite algunas facturas contra remito, sin decir a qué pedido corresponden.
        La venta puede estar cargada perfectamente — lo que falta es el dato en el papel para engancharlas.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr><th style="${th}">Comprobante</th><th style="${th}">Importe</th><th style="${th}">A qué venta corresponde</th></tr>
            ${sinNumero.map(r => `<tr>
                <td style="${td};font-family:monospace">${r.invoiceNumber}</td>
                <td style="${td};text-align:right">${pesos(importeDe(r))}</td>
                <td style="${td}">${r.venta
                    ? `<strong>${r.venta.cliente}</strong> — pedido ${r.venta.labOrderNumber} <span style="color:#047857">(identificada: falta asignarla)</span>`
                    : r.pedidoConocido
                        ? `sería el pedido ${r.pedidoConocido}, que <span style="color:#b91c1c">no figura en ninguna venta</span>`
                        : 'falta identificar a qué pedido corresponde'}</td>
            </tr>`).join('')}
        </table>` : '';

    const tablaAsignar = `
        <h3>Facturas sin nº de operación (las de la planilla)</h3>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr><th style="${th}">Comprobante</th><th style="${th}">Pedido según planilla</th><th style="${th}">Factura en el sistema</th><th style="${th}">Venta con ese pedido</th></tr>
            ${asignables.map(a => `<tr>
                <td style="${td};font-family:monospace">${a.comprobante}</td>
                <td style="${td};font-family:monospace">${a.pedido}</td>
                <td style="${td}">${a.entrada ? `${pesos(a.entrada.billedTotal ?? a.entrada.billedNet)} (${a.entrada.status})` : '<span style="color:#b91c1c">no está</span>'}</td>
                <td style="${td}">${a.venta ? `${a.venta.cliente || 's/cliente'} — ${a.venta.labOrderNumber}` : '<span style="color:#b91c1c">ninguna venta tiene ese número</span>'}</td>
            </tr>`).join('')}
        </table>`;

    const sinCruzarLetra = conLetra.filter(o => o.entradas === 0);
    const tablaLetra = conLetra.length ? `
        <h3>Nº de operación de la planilla: es el otro identificador (${conLetra.length} ventas, ${sinCruzarLetra.length} sin cruzar)</h3>
        <p>La factura de Optovisión trae <strong>dos</strong> identificadores en la misma línea:
        <code>Ped: TI-7101093(580841)</code>. El sistema se guía por el de paréntesis (6 dígitos);
        la planilla física trae el de la T (7 dígitos, cargado sin la letra). Una venta cargada con
        ese número no cruza nunca con su factura.</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr><th style="${th}">Nº cargado en la venta</th><th style="${th}">Cliente</th><th style="${th}">Fecha</th><th style="${th}">¿Cruza?</th></tr>
            ${conLetra.slice(0, 30).map(o => `<tr><td style="${td};font-family:monospace">${o.labOrderNumber}</td><td style="${td}">${o.cliente || '—'}</td><td style="${td}">${fecha(o.createdAt)}</td><td style="${td}">${o.entradas ? 'sí' : '<span style="color:#b91c1c">no</span>'}</td></tr>`).join('')}
        </table>` : '';

    // El listado completo, factura por factura, con link a cada venta y el
    // cruce de costo. Va PRIMERO: es lo que se lee al lado del resumen impreso.
    const listado = htmlDetalle(st, detalle)
        .replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>$/, '');

    // Sobrecostos y ahorros, una línea por VENTA (no por factura: la comparación
    // del sistema es a nivel venta, así que dos facturas de la misma venta
    // repiten la misma diferencia y sumarlas contaría doble).
    const porVenta = new Map();
    for (const d of detalle) {
        if (d.diferencia == null || !d.orderId || d.postventa) continue;
        porVenta.set(d.orderId, d);
    }
    const dif = [...porVenta.values()].sort((a, b) => (b.diferencia || 0) - (a.diferencia || 0));
    const tablaCostos = dif.length ? `
        <h3>Costo del CRM contra lo que facturó el laboratorio</h3>
        <p style="color:#4b5563">Una línea por venta. <strong>Ojo:</strong> casi todas son ventas 2x1, y ahí
        el sistema supone que el par regalado solo cuesta el calibrado (${pesos(15000 * 1.21)}). Si el
        laboratorio cobró los dos pares completos, ese supuesto infla la diferencia. Antes de reclamar,
        mirar la venta.</p>
        <table style="border-collapse:collapse;width:100%">
        <tr><th style="${th}">Venta</th><th style="${th}">Cliente</th>
            <th style="${th}">Costo CRM</th><th style="${th}">Facturado</th><th style="${th}">Diferencia</th></tr>
        ${dif.map(d => `<tr>
            <td style="${td};font-family:monospace">${d.pedido || '—'}</td>
            <td style="${td}"><a href="${CRM}/admin/ventas?id=${d.orderId}">${d.cliente || 'ver'}</a></td>
            <td style="${td};text-align:right">${pesos(d.systemCost)}</td>
            <td style="${td};text-align:right">${pesos(d.facturado)}</td>
            <td style="${td};text-align:right;color:${(d.diferencia || 0) > 0 ? '#b91c1c' : '#15803d'};font-weight:bold">
                ${(d.diferencia || 0) > 0 ? '+' : '−'}${pesos(Math.abs(d.diferencia || 0))}</td>
        </tr>`).join('')}
        </table>` : '';

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#1f2937">
            <h2>Resumen de cuenta de Optovisión — qué falta cargar</h2>
            <p>Resumen al <strong>${fecha(st.statementDate)}</strong>: ${st.invoiceCount} facturas, deuda ${pesos(st.totalDebt)}.
            De esas, ${conVenta.length} tienen venta enganchada y ${conPostventa.length} son reprocesos de postventa.</p>
            ${listado}
            ${tablaCostos}
            ${tablaSinCargar}
            ${tablaHuerfanas}
            ${tablaSinNumero}
            ${tablaAsignar}
            ${tablaLetra}
        </div>`;

    const subject = `Cuenta de Optovisión al ${fecha(st.statementDate)}: ${sinCargar.length} factura(s) sin cargar`;

    // Mismo criterio que src/lib/email.ts: Resend si hay key (Railway bloquea
    // SMTP saliente), y si no el SMTP de Gmail, que es lo que hay en local.
    if (key) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, subject, html }),
        });
        console.log(res.ok ? `\nInforme enviado a ${to}.` : `\nNO se pudo enviar: ${res.status} ${await res.text()}`);
        return;
    }

    const { default: nodemailer } = await import('nodemailer');
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    const info = await transporter.sendMail({
        from: `"Atelier Óptica" <${process.env.EMAIL_USER}>`, to, subject, html,
    });
    console.log(`\nInforme enviado a ${to} (SMTP). ID: ${info.messageId}`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
