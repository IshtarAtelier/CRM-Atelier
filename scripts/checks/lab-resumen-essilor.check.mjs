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

/** Facturas sin nº de operación, con el número que les corresponde (planilla física). */
const PENDIENTES_DE_ASIGNAR = [
    { comprobante: '3008-00067549', pedido: '596770' },
    { comprobante: '3008-00052707', pedido: '565417' },
    { comprobante: '3008-00070740', pedido: '3578632' },
    { comprobante: '3008-00063271', pedido: '588062' },
    { comprobante: '3008-00072463', pedido: '598454' },
];

const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
// El resumen a veces trae la fecha en un formato que no parsea (la fila de
// 3008-00062896 daba "Invalid Date"): mejor un guión que basura en el email.
const fecha = d => {
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

async function main() {
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
    const esClaveSinNumero = p => !p || /^S\/PEDIDO/.test(String(p)) || !/^\d{5,}$/.test(String(p).trim());
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
    const sinVenta = sinVentaCrudo;

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
    await enviar({ st, rows, sinCargar, huerfanas, sinNumero, conVenta, conPostventa, asignables, conLetra, totalSinCargar });
}

async function enviar({ st, rows, sinCargar, huerfanas, sinNumero, conVenta, conPostventa, asignables, conLetra, totalSinCargar }) {
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

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#1f2937">
            <h2>Resumen de cuenta de Optovisión — qué falta cargar</h2>
            <p>Resumen al <strong>${fecha(st.statementDate)}</strong>: ${st.invoiceCount} facturas, deuda ${pesos(st.totalDebt)}.
            De esas, ${conVenta.length} tienen venta enganchada y ${conPostventa.length} son reprocesos de postventa.</p>
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
