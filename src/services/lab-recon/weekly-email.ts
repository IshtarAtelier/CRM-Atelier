import { LAB_LABELS, TOPE_PAR_BONIFICADO_2X1, VENTANA_REPORTE_DIAS, fmtARS, fmtFecha } from './types';
import { ACLARACION_LINKS, comprobantesHtml } from './comprobantes-html';

/**
 * EL ÚNICO REPORTE DE LABORATORIO: un correo semanal, los viernes a las 9:30
 * (`/api/cron/lab-weekly-report`). Es una función pura sobre lo que devuelve
 * `weeklyReport()`: la ruta solo autentica y manda, y esto se puede renderizar
 * con datos de prueba y mirar antes de que salga uno real.
 *
 * Por qué uno solo (Ishtar, 25/9/2026): hasta ese día salían tres correos
 * —este, uno de "revisión semanal" que se disparaba junto con este, y un
 * resumen diario— con la misma información repartida y repetida, "mi correo
 * está lleno de spam y me cuesta seguir el ritmo". Ahora todo está acá, en
 * orden de urgencia: primero lo que hay que reclamar, después lo que hay que
 * resolver, y al final el estado y la salud. Aparte queda un solo aviso
 * diario, el de pedidos sin venta (alerts.ts).
 *
 * En un 2x1 el costo de sistema es de la VENTA y cuenta UN par —el bonificado
 * va en $0—, así que se muestra una vez, en la fila del par cobrado; la fila
 * del otro pedido dice "misma venta". Y se dice si el par bonificado vino sin
 * cargo (dentro del tope) o cobrado, que es lo que hay que reclamar.
 */

const STATUS_LABEL: Record<string, string> = {
    OK: 'OK', OVERCOST: 'Sobrecosto', UNDERCOST: 'Menor costo', PENDING: 'Esperando factura', UNMATCHED: 'Sin venta',
};
const fmt = fmtARS;
const TD = 'padding:6px 8px;border:1px solid #e5e7eb';
const TH = 'padding:8px;text-align:left';
const CHICO = 'display:block;font-size:11px;font-weight:normal;color:#6b7280';
const ROJO = '#b91c1c';
const VERDE = '#047857';
const GRIS = '#6b7280';

// Las tres claves con las que se le reclama al laboratorio —nº de operación,
// comprobante y fecha— van SIEMPRE, en todas las filas: si una factura no trae
// el nº de pedido (Optovision factura remitos y reprocesos sin él) se dice así
// con todas las letras, en vez de mostrar el nº de comprobante como si fuera
// el de operación o dejar la celda vacía.
const ES_PEDIDO = /^\d{5,}$/;
const faltante = (t: string) => `<span style="color:${ROJO}">${t}</span>`;
export const nroOperacion = (r: any) => ES_PEDIDO.test(String(r.labOrderNumber || '').trim())
    ? String(r.labOrderNumber).trim()
    : faltante('la factura no trae nº');
export const comprobante = (r: any) => {
    const m = String(r.labOrderNumber || '').match(/\d{4}-\d{4,8}/) || String(r.sourceFile || '').match(/\d{4}-\d{4,8}/);
    if (m) return m[0];
    return r.sourceFile ? String(r.sourceFile).replace(/\.pdf$/i, '') : faltante('sin comprobante');
};
/** Los comprobantes del pedido con su link (portal o correo); si no hay guardados, el de siempre. */
const comprobantes = (r: any) => comprobantesHtml(r, comprobante(r));
const fechaFila = (r: any) => r.invoiceDate
    ? fmtFecha(r.invoiceDate)
    : `${r.createdAt ? fmtFecha(r.createdAt) : 's/fecha'} <span style="color:${GRIS}">(alta)</span>`;
const labDe = (lab: string) => LAB_LABELS[lab] || lab;
const ficha = (appUrl: string, clientId: string | null | undefined, nombre: string) =>
    clientId ? `<a href="${appUrl}/admin/contactos?clientId=${clientId}">${nombre}</a>` : nombre;
const zebra = (i: number) => `background:${i % 2 === 0 ? '#fff' : '#f9fafb'}`;

/** Un cuadro con título, bajada, cabeceras y filas; si no hay filas, la frase de "todo bien". */
function cuadro(titulo: string, bajada: string, cabeceras: string[], filas: string[], vacio: string): string {
    return `
        <h3 style="margin:26px 0 2px;font-size:15px;color:#111">${titulo}</h3>
        <p style="margin:0 0 8px;font-size:12px;color:${GRIS}">${bajada}</p>
        ${filas.length ? `<table style="border-collapse:collapse;width:100%;font-size:13px">
            <tr style="background:#111827;color:#fff">${cabeceras.map(c => `<th style="${TH}${/^\$|Importe|Facturado|Sistema|Dif\.|Cobrado|Costo|A reclamar|Días/.test(c) ? ';text-align:right' : ''}">${c}</th>`).join('')}</tr>
            ${filas.join('')}
        </table>` : `<p style="font-size:13px;color:${VERDE};margin:0">✅ ${vacio}</p>`}`;
}

/** Resuelto a mano: se dice, con quién y cómo, en vez de volver a acusar. */
function resuelto(r: any): string {
    if (!r.resuelta) return '';
    return `<span style="${CHICO};color:${VERDE}">✓ resuelto${r.resolvedBy ? ` por ${r.resolvedBy}` : ''}${r.resolvedNote ? `: ${r.resolvedNote}` : ''}</span>`;
}

/** Qué dice la columna Estado de la primera fila de una venta 2x1. */
function estado2x1(r: any): string {
    if (!r.es2x1) return '';
    if (r.parBonificadoCobrado) {
        return `<span style="${CHICO};color:${ROJO};font-weight:bold">⚠️ 2x1: el par bonificado vino cobrado (${fmt(r.parMasBarato)}, tope ${fmt(TOPE_PAR_BONIFICADO_2X1)}) — a reclamar</span>`;
    }
    if (r.parBonificadoVerificado) {
        return `<span style="${CHICO};color:${VERDE}">✓ 2x1: par bonificado ${r.parMasBarato ? `a ${fmt(r.parMasBarato)}` : 'sin cargo'}</span>`;
    }
    return `<span style="${CHICO}">2x1: falta la factura del otro par</span>`;
}

/** Qué se dice debajo del nº de operación sobre los otros pedidos de la venta. */
function otrosPedidos(r: any): string {
    if (!r.primeraDeLaVenta || !r.otrosPedidos?.length) return '';
    const partes = r.otrosPedidos.map((o: any) => o.billed === null
        ? `${o.labOrderNumber} sin factura todavía`
        : `${o.labOrderNumber} facturado ${fmt(o.billed)}${o.invoiceDate ? ` el ${fmtFecha(o.invoiceDate)}` : ''}`);
    return `<span style="${CHICO};font-family:Arial,sans-serif">${r.es2x1 ? '2x1 · ' : 'misma venta · '}${partes.join(' · ')}</span>`;
}

function filaFactura(r: any, i: number, appUrl: string): string {
    const primera = r.primeraDeLaVenta;
    const cliente = ficha(appUrl, r.clientId, r.cliente);
    // Con el par bonificado cobrado la diferencia de la suma no dice nada
    // (puede hasta dar "a favor"): se muestra en gris, el veredicto está en Estado.
    const colorDif = r.parBonificadoCobrado ? GRIS
        : (r.difference || 0) > 100 ? ROJO : (r.difference || 0) < -100 ? '#059669' : GRIS;
    const dif = r.difference == null ? '—' : ((r.difference > 0 ? '+' : '') + fmt(r.difference));
    // Segunda fila de la misma venta: solo su pedido y su factura. El costo y
    // la diferencia son de la venta y ya están en la fila de arriba.
    if (!primera) {
        const queEs = r.es2x1
            ? (r.parBonificadoCobrado
                ? `<span style="color:${ROJO};font-weight:bold">par bonificado COBRADO</span>`
                : `<span style="color:${GRIS}">par bonificado</span>`)
            : `<span style="color:${GRIS}">otro pedido de la venta</span>`;
        return `
                <tr style="${zebra(i)}">
                    <td style="${TD};font-family:monospace"><span style="color:#9ca3af">↳</span> ${nroOperacion(r)}</td>
                    <td style="${TD};font-family:monospace">${comprobantes(r)}</td>
                    <td style="${TD};white-space:nowrap">${fechaFila(r)}</td>
                    <td style="${TD};color:${GRIS}">↳ misma venta</td>
                    <td style="${TD};text-align:right;font-weight:bold">${fmt(r.billed)}</td>
                    <td style="${TD};text-align:right;color:#9ca3af">—</td>
                    <td style="${TD};text-align:right;color:#9ca3af">—</td>
                    <td style="${TD};font-size:12px">${queEs}</td>
                </tr>`;
    }
    const deLaVenta = r.pedidosDeLaVenta > 1
        ? `<span style="${CHICO}">de la venta${r.es2x1 ? ' (2x1: un par cobrado, el otro en $0)' : ` (${r.pedidosDeLaVenta} pedidos)`}</span>`
        : '';
    return `
                <tr style="${zebra(i)}">
                    <td style="${TD};font-family:monospace">${nroOperacion(r)}${otrosPedidos(r)}</td>
                    <td style="${TD};font-family:monospace">${comprobantes(r)}</td>
                    <td style="${TD};white-space:nowrap">${fechaFila(r)}</td>
                    <td style="${TD}">${cliente}${r.esPostventa ? ` · <span style="color:#1d4ed8">postventa</span>` : ''}</td>
                    <td style="${TD};text-align:right;font-weight:bold">${fmt(r.billed)}</td>
                    <td style="${TD};text-align:right">${fmt(r.systemCost)}${deLaVenta}</td>
                    <td style="${TD};text-align:right;color:${colorDif}">${dif}</td>
                    <td style="${TD};font-size:12px">${STATUS_LABEL[r.status] || r.status}${estado2x1(r)}${resuelto(r)}</td>
                </tr>`;
}

/** 3 · Facturas de la semana, por laboratorio. */
function bloqueFacturas(lab: string, d: any, appUrl: string): string {
    const filas = d.detalleSemana.map((r: any, i: number) => filaFactura(r, i, appUrl)).join('');
    return `
                <h4 style="margin:18px 0 4px;color:#111">${labDe(lab)} · ${d.facturasSemana} factura(s) por ${fmt(d.facturadoSemana)}</h4>
                ${d.detalleSemana.length ? `
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#111827;color:#fff">
                        <th style="${TH}">Nº operación</th><th style="${TH}">Comprobante</th>
                        <th style="${TH}">Fecha</th><th style="${TH}">Cliente</th>
                        <th style="${TH};text-align:right">Facturado</th><th style="${TH};text-align:right">Sistema</th>
                        <th style="${TH};text-align:right">Dif.</th><th style="${TH}">Estado</th>
                    </tr>${filas}
                </table>` : `<p style="font-size:13px;color:#9ca3af;margin:0">Sin facturas nuevas en la semana.</p>`}`;
}

/** 1a · Un sobrecosto abierto, en una línea: o el 2x1 con el par cobrado, o la diferencia. */
function lineaSobrecosto(s: any): string {
    const refs = comprobantes(s).replace(/<div style="white-space:nowrap">/g, '<span style="white-space:nowrap">').replace(/<\/div>/g, '</span> ');
    const cabecera = `${labDe(s.lab)} · operación ${s.es2x1 && s.pedidos?.length > 1 ? s.pedidos.join(' + ') : nroOperacion(s)} · ${refs} · ${fechaFila(s)} (${s.cliente})`;
    if (s.parBonificadoCobrado) {
        return `<li>${cabecera}: <strong style="color:${ROJO}">2x1 con el par bonificado cobrado — a reclamar ${fmt(s.parMasBarato)}</strong>` +
            `${(s.difference || 0) > 100 ? ` (y la venta entera ${fmt(s.difference)} por encima del sistema)` : ''}</li>`;
    }
    return `<li>${cabecera}: <strong style="color:${ROJO}">+${fmt(s.difference)}</strong></li>`;
}

export function armarEmailSemanal(rep: any, appUrl: string): { subject: string; html: string } {
    const rango = `${fmtFecha(rep.from)} – ${fmtFecha(rep.to)}`;
    const ventana = rep.ventanaDias ?? VENTANA_REPORTE_DIAS;
    const labs = ['OPTOVISION', 'GRUPO_OPTICO'];
    const perLab = rep.perLab || {};
    const suma = (k: string) => labs.reduce((t, l) => t + (perLab[l]?.[k] || 0), 0);
    const facturas = suma('facturasSemana');
    const facturado = suma('facturadoSemana');
    const paraReclamar = rep.paraReclamar || { cantidad: 0, monto: 0 };
    const sinVenta: any[] = rep.sinVenta || [];
    const sobre: any[] = (rep.sobrecostosVigentes || []).slice(0, 15);
    const reprocesos: any[] = rep.reprocesosConCargo || [];
    const dobles: any[] = rep.dobles || [];
    const postventa: any[] = rep.postventaSemana || [];
    const espera: any[] = rep.esperandoHaceMucho || [];
    const sinNombre: any[] = rep.sinNombrePortal || [];
    const resueltos: any[] = rep.resueltosSemana || [];
    const cc: any[] = rep.cuentaCorriente || [];
    const salud = rep.salud || { fuentes: [], corridasSemana: 0, ultimaCorrida: null };
    const pantalla = `${appUrl}/admin/laboratorio/costos`;

    // ── Resumen de arriba: una línea por lab y una de lo que hay que hacer ──
    const resumenLab = (l: string) => {
        const d = perLab[l] || {};
        return `<li><strong>${labDe(l)}</strong>: ${d.facturasSemana || 0} factura(s) por <strong>${fmt(d.facturadoSemana || 0)}</strong> esta semana · últimos ${ventana} días: ${d.ok || 0} OK, <span style="color:${ROJO}">${d.sobrecostos || 0} sobrecosto(s)</span>, ${d.menorCosto || 0} menor costo, ${d.esperandoFactura || 0} esperando factura, <span style="color:#b45309">${d.sinVenta || 0} sin venta</span>${d.resueltos ? `, ${d.resueltos} resuelto(s) a mano` : ''}</li>`;
    };

    // ── 1 · PARA RECLAMAR ──
    const filasReprocesos = reprocesos.map((p, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD};font-family:monospace">${nroOperacion(p)}</td>
            <td style="${TD};font-family:monospace">${comprobantes(p)}</td>
            <td style="${TD};white-space:nowrap">${fechaFila(p)}</td>
            <td style="${TD}">${labDe(p.lab)}</td>
            <td style="${TD}">${ficha(appUrl, p.clientId, p.cliente)}</td>
            <td style="${TD};font-size:12px">${p.caso ? `${p.caso.tipo || 'sin tipo'}${p.caso.cobertura ? ` · ${p.caso.cobertura}` : ''}${p.caso.falla ? `<span style="${CHICO}">${p.caso.falla}</span>` : ''}` : 'caso sin datos'}</td>
            <td style="${TD};text-align:right">${p.costoCaso != null ? fmt(p.costoCaso) : '<span style="color:#b45309">sin costo cargado</span>'}</td>
            <td style="${TD};text-align:right;font-weight:bold;color:${ROJO}">${fmt(p.cobrado)}</td>
        </tr>`);
    const filasDobles = dobles.map((d, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD}">${labDe(d.lab)}</td>
            <td style="${TD}">${ficha(appUrl, d.clientId, d.cliente || '—')}${d.origen === 'PORTAL' ? `<span style="${CHICO}">nombre del portal, sin venta</span>` : ''}</td>
            <td style="${TD};font-family:monospace">${d.pedidos.map((p: any) => p.labOrderNumber).join(' · ')}</td>
            <td style="${TD};text-align:right">${d.pedidos.map((p: any) => fmt(p.importe)).join('<br>')}</td>
            <td style="${TD};text-align:right;font-weight:bold;color:${ROJO}">${fmt(d.aReclamar)}${d.mismoImporte ? `<span style="${CHICO}">mismo importe</span>` : ''}</td>
        </tr>`);
    const nadaParaReclamar = sobre.length === 0 && reprocesos.length === 0 && dobles.length === 0;
    const bloqueReclamar = `
        <div style="background:${nadaParaReclamar ? '#ecfdf5' : '#fef2f2'};border:1px solid ${nadaParaReclamar ? '#a7f3d0' : '#fecaca'};border-radius:8px;padding:12px 14px;margin:14px 0">
            <h3 style="margin:0 0 4px;font-size:15px;color:${nadaParaReclamar ? VERDE : ROJO}">1 · Para reclamar al laboratorio${paraReclamar.cantidad ? ` — ${paraReclamar.cantidad} caso(s), ${fmt(paraReclamar.monto)}` : ''}</h3>
            ${nadaParaReclamar
                ? `<p style="margin:0;font-size:13px;color:${VERDE}">✅ Nada para reclamar en los últimos ${ventana} días.</p>`
                : `<p style="margin:0 0 6px;font-size:12px;color:${GRIS}">Cuando lo trates (reclamado, acreditado, es correcto), marcalo <strong>resuelto</strong> en <a href="${pantalla}?estado=OVERCOST">la pantalla</a> y deja de salir acá.</p>`}
            ${sobre.length ? `
            <p style="margin:8px 0 2px;font-size:13px"><strong>Sobrecostos abiertos</strong> (últimos ${ventana} días, uno por venta):</p>
            <ul style="margin:0;font-size:13px;line-height:1.6">${sobre.map(s => lineaSobrecosto(s)).join('')}</ul>` : ''}
            ${rep.sobrecostosFueraDeVentana ? `<p style="font-size:12px;color:${GRIS};margin:6px 0 0">Además hay <strong>${rep.sobrecostosFueraDeVentana}</strong> sobrecosto(s) de más de ${ventana} días sin resolver: no se repiten acá. Se ven eligiendo el mes en la pantalla, y ahí se marcan resueltos.</p>` : ''}
            ${reprocesos.length ? cuadro(
                `Reprocesos de garantía facturados con cargo — ${reprocesos.length}`,
                `El caso figura en $0 (garantía) y el laboratorio lo cobró: corresponde nota de crédito. El reproceso se ve en el caso de postventa del cliente.`,
                ['Nº operación', 'Comprobante', 'Fecha', 'Lab', 'Cliente', 'Caso', 'Costo del caso', 'Cobrado'],
                filasReprocesos, '') : ''}
            ${dobles.length ? cuadro(
                `Posible 2x1 cobrado dos veces — ${dobles.length}`,
                `Dos pedidos del mismo cliente, salidos juntos, los dos con cargo. Puede ser legítimo (dos anteojos distintos comprados juntos), por eso van los dos importes.`,
                ['Lab', 'Cliente', 'Pedidos', 'Cobrado', 'A reclamar'],
                filasDobles, '') : ''}
        </div>`;

    // ── 2 · SIN VENTA ──
    const BADGE: Record<string, string> = {
        POSTVENTA: 'background:#dbeafe;color:#1d4ed8',
        VENTA_SMARTLAB: 'background:#dbeafe;color:#1d4ed8',
        VENTA_SIN_NUMERO: 'background:#fef3c7;color:#92400e',
        DUDOSO: 'background:#fee2e2;color:#b91c1c;font-weight:bold',
    };
    const filasSinVenta = sinVenta.map((h, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD};font-family:monospace">${nroOperacion(h)}${h.nuevoEnLaSemana ? `<span style="${CHICO};color:#b45309;font-family:Arial,sans-serif">nuevo esta semana</span>` : ''}</td>
            <td style="${TD};font-family:monospace">${comprobantes(h)}</td>
            <td style="${TD};white-space:nowrap">${fechaFila(h)}</td>
            <td style="${TD}">${labDe(h.lab)}</td>
            <td style="${TD}">${h.nombrePortal ? `<span style="color:#b45309">${h.nombrePortal}</span>` : `<span style="color:${ROJO}">sin nombre</span>`}</td>
            <td style="${TD};text-align:right;font-weight:bold">${fmt(h.billed)}</td>
            <td style="${TD};font-size:12px">${h.pista
                ? `<span style="padding:2px 8px;border-radius:10px;${BADGE[h.pista.tipo] || ''}">${h.pista.detalle}</span>${h.pista.clientId ? ` <a href="${appUrl}/admin/contactos?clientId=${h.pista.clientId}">ver ficha</a>` : ''}`
                : (h.facturaSinNumero ? 'La factura no trae nº de pedido: asignarla a mano' : '—')}</td>
        </tr>`);
    const bloqueSinVenta = cuadro(
        `2 · Pedidos sin venta en el sistema — ${sinVenta.length}`,
        `Operaciones que el laboratorio facturó y no figuran ni como venta ni como caso de postventa (últimos ${ventana} días, sin los resueltos a mano). El aviso diario los manda una vez; acá se repiten todos los que sigan abiertos. Se resuelven cargándole el nº a la venta, vinculándolos a una postventa, o marcándolos resueltos.`,
        ['Nº operación', 'Comprobante', 'Fecha', 'Lab', 'Cargado en el portal', 'Importe', 'Pista'],
        filasSinVenta, 'Todo lo facturado tiene su trabajo en el sistema.');

    // ── 4 · POSTVENTA DE LA SEMANA ──
    const filasPostventa = postventa.map((p, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD};font-family:monospace">${nroOperacion(p)}</td>
            <td style="${TD};white-space:nowrap">${fechaFila(p)}</td>
            <td style="${TD}">${labDe(p.lab)}</td>
            <td style="${TD}">${ficha(appUrl, p.clientId, p.cliente)}</td>
            <td style="${TD};font-size:12px">${p.caso ? `${p.caso.tipo || 'sin tipo'}${p.caso.cobertura ? ` · ${p.caso.cobertura}` : ''}` : 'caso sin datos'}</td>
            <td style="${TD};text-align:right">${p.costoCaso != null ? fmt(p.costoCaso) : '<span style="color:#b45309">sin costo cargado</span>'}</td>
            <td style="${TD};text-align:right;font-weight:bold">${fmt(p.cobrado)}</td>
            <td style="${TD};font-size:12px">${p.garantiaCobrada
                ? (p.resuelta ? `<span style="color:${VERDE}">garantía cobrada · resuelto</span>` : `<span style="color:${ROJO};font-weight:bold">garantía y el lab lo cobró</span>`)
                : p.cobrado > 0 ? 'con costo cargado en el caso' : `<span style="color:${VERDE}">sin cargo, como corresponde</span>`}</td>
        </tr>`);
    const bloquePostventa = cuadro(
        `4 · Postventa de la semana — ${postventa.length} reproceso(s)`,
        `Reprocesos que el laboratorio facturó esta semana, con el costo cargado en el caso al lado de lo facturado.`,
        ['Nº operación', 'Fecha', 'Lab', 'Cliente', 'Caso', 'Costo del caso', 'Facturado', ''],
        filasPostventa, 'Ninguna factura de la semana corresponde a un reproceso.');

    // ── 5 · ESPERANDO FACTURA HACE MUCHO ──
    const filasEspera = espera.map((e, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD}">${labDe(e.lab)}</td>
            <td style="${TD}">${ficha(appUrl, e.clientId, e.cliente)}</td>
            <td style="${TD};font-family:monospace">${e.pedidos.join(' + ')}${e.pedidos.length > 1 ? `<span style="${CHICO};font-family:Arial,sans-serif">${e.facturados} de ${e.pedidos.length} facturado(s)</span>` : ''}</td>
            <td style="${TD};text-align:right;font-weight:bold;color:#b45309">${e.dias}</td>
        </tr>`);
    const bloqueEspera = cuadro(
        `5 · Esperando factura hace más de ${rep.esperaMaxDias ?? 15} días — ${espera.length}`,
        `Ventas enviadas al laboratorio cuyo pedido sigue sin factura. O el número está mal cargado, o la factura no llegó: conviene preguntarle al laboratorio.`,
        ['Lab', 'Cliente', 'Pedidos', 'Días'],
        filasEspera, `Ninguna venta lleva más de ${rep.esperaMaxDias ?? 15} días sin factura.`);

    // ── 6 · GRUPO ÓPTICO SIN NOMBRE ──
    const filasSinNombre = sinNombre.map((e, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD};font-family:monospace">${nroOperacion(e)}</td>
            <td style="${TD};white-space:nowrap">${fechaFila(e)}</td>
            <td style="${TD}">${e.cliente ? ficha(appUrl, e.clientId, e.cliente) : `<span style="color:${ROJO}">sin venta en el sistema</span>`}</td>
            <td style="${TD};text-align:right;font-weight:bold">${fmt(e.billed)}</td>
        </tr>`);
    const bloqueSinNombre = cuadro(
        `6 · Grupo Óptico: pedidos que el portal mandó sin nombre — ${sinNombre.length}`,
        `El nombre del portal es con lo que se le busca la venta a un huérfano. Sin nombre no hay por dónde empezar: hay que pedírselo al laboratorio.`,
        ['Nº operación', 'Fecha', 'Venta en el sistema', 'Importe'],
        filasSinNombre, 'Todos los pedidos de la semana vinieron con nombre.');

    // ── 7 · RESUELTOS ESTA SEMANA ──
    const filasResueltos = resueltos.map((r, i) => `
        <tr style="${zebra(i)}">
            <td style="${TD};font-family:monospace">${nroOperacion(r)}</td>
            <td style="${TD}">${labDe(r.lab)}</td>
            <td style="${TD}">${ficha(appUrl, r.clientId, r.cliente)}</td>
            <td style="${TD};font-size:12px">${STATUS_LABEL[r.status] || r.status}${r.difference != null ? ` (${r.difference > 0 ? '+' : ''}${fmt(r.difference)})` : ''}</td>
            <td style="${TD};font-size:12px">${fmtFecha(r.resolvedAt)}${r.resolvedBy ? ` · ${r.resolvedBy}` : ''}${r.resolvedNote ? `<span style="${CHICO}">${r.resolvedNote}</span>` : ''}</td>
        </tr>`);
    const bloqueResueltos = cuadro(
        `7 · Resueltos a mano esta semana — ${resueltos.length}`,
        `Lo que se marcó como tratado desde la pantalla. No vuelve a salir en ningún aviso; se puede reabrir.`,
        ['Nº operación', 'Lab', 'Cliente', 'Era', 'Resuelto'],
        filasResueltos, 'Nada se marcó resuelto esta semana.');

    // ── 8 · CUENTA CORRIENTE Y SALUD ──
    const fuentes = (salud.fuentes || []).map((f: any) => f.caida
        ? `<li><strong style="color:${ROJO}">${labDe(f.lab)}: ${f.lastOkAt ? `sin corrida exitosa hace ${f.dias} días (última ${fmtFecha(f.lastOkAt)})` : 'nunca corrió bien'}</strong> — la auditoría está incompleta hasta resolverlo (credencial vencida es la causa típica)</li>`
        : `<li>${labDe(f.lab)}: al día (última corrida exitosa ${fmtFecha(f.lastOkAt)})</li>`).join('');
    const bloqueSalud = `
        <h3 style="margin:26px 0 4px;font-size:15px;color:#111">8 · Cuenta corriente y salud del control</h3>
        <ul style="margin:4px 0;font-size:13px;line-height:1.6">
            ${cc.length ? cc.map((c: any) => `<li>Deuda con <strong>${labDe(c.lab)}</strong> según su último resumen: <strong>${fmt(c.totalDebt)}</strong> (${c.invoiceCount} facturas, al ${fmtFecha(c.statementDate)})</li>`).join('') : `<li style="color:${GRIS}">Sin resumen de cuenta cargado de ningún laboratorio.</li>`}
            ${labs.map(l => `<li>Facturado acumulado ${labDe(l)}: ${fmt(perLab[l]?.facturadoAcumulado || 0)}</li>`).join('')}
        </ul>
        <ul style="margin:4px 0;font-size:13px;line-height:1.6">
            ${fuentes}
            <li>La conciliación corrió <strong>${salud.corridasSemana}</strong> veces esta semana${salud.ultimaCorrida ? ` (última ${fmtFecha(salud.ultimaCorrida.runAt)}${salud.ultimaCorrida.staleSources?.length ? `, con fuentes caídas: ${salud.ultimaCorrida.staleSources.join(', ')}` : ''})` : ''}.</li>
        </ul>`;

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#1f2937">
            <h2 style="color:#b45309;margin-bottom:2px">Laboratorios — semana ${rango}</h2>
            <p style="margin:0 0 6px;font-size:13px;color:#4b5563">El único reporte de laboratorio: todo lo de la semana y lo abierto de los últimos ${ventana} días, en orden de urgencia. Los pedidos sin venta además se avisan una vez por día.</p>
            <ul style="margin:6px 0 0;font-size:13px;line-height:1.6">
                <li><strong>Esta semana:</strong> ${facturas} factura(s) por <strong>${fmt(facturado)}</strong> · <strong style="color:${paraReclamar.cantidad ? ROJO : VERDE}">${paraReclamar.cantidad} para reclamar${paraReclamar.monto ? ` (${fmt(paraReclamar.monto)})` : ''}</strong> · <span style="color:#b45309">${sinVenta.length} sin venta</span> · ${espera.length} esperando factura hace mucho · ${resueltos.length} resuelto(s) a mano</li>
                ${labs.map(resumenLab).join('')}
            </ul>
            ${bloqueReclamar}
            ${bloqueSinVenta}
            <h3 style="margin:26px 0 2px;font-size:15px;color:#111">3 · Facturas de la semana</h3>
            <p style="margin:0;font-size:12px;color:${GRIS}">Agrupadas por venta. En un 2x1 el <strong>Sistema</strong> es de la venta entera y cuenta un solo par (el bonificado va en $0), por eso aparece una vez; la fila «misma venta» es el otro pedido con lo que le facturaron. El par bonificado tiene que venir sin cargo o hasta ${fmt(TOPE_PAR_BONIFICADO_2X1)}; si viene por encima, es sobrecosto y se reclama.</p>
            ${labs.map(l => bloqueFacturas(l, perLab[l] || { facturasSemana: 0, facturadoSemana: 0, detalleSemana: [] }, appUrl)).join('')}
            ${bloquePostventa}
            ${bloqueEspera}
            ${bloqueSinNombre}
            ${bloqueResueltos}
            ${bloqueSalud}
            <p style="margin-top:16px;font-size:12px;color:${GRIS}">${ACLARACION_LINKS}</p>
            <p style="margin-top:8px;font-size:13px"><a href="${pantalla}">Ver la conciliación completa en el CRM</a></p>
            <p style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:16px">Atelier Óptica — reporte semanal de laboratorios. Sale los viernes a las 9:30.</p>
        </div>`;

    const subject = `📊 Laboratorios ${rango}: ${paraReclamar.cantidad} para reclamar${paraReclamar.monto ? ` (${fmt(paraReclamar.monto)})` : ''} · ${sinVenta.length} sin venta · ${facturas} factura(s) (${fmt(facturado)})`;
    return { subject, html };
}
