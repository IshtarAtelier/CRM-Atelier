import { LAB_LABELS, TOPE_PAR_BONIFICADO_2X1, VENTANA_REPORTE_DIAS, fmtARS, fmtFecha } from './types';

/**
 * EL EMAIL DEL REPORTE SEMANAL DE LABORATORIO (el de los viernes/domingos,
 * `/api/cron/lab-weekly-report`). Es una función pura sobre lo que devuelve
 * `weeklyReport()`: la ruta solo autentica y manda. Así se puede renderizar
 * con datos de prueba y mirar el HTML antes de que salga uno real.
 *
 * LO QUE ESTE EMAIL TIENE QUE DEJAR CLARO (Ishtar, 25/9/2026, sobre la venta
 * de Gabriela Peralta): en un 2x1 el costo de sistema es de la VENTA y cuenta
 * UN solo par —el bonificado va en $0—, así que se muestra UNA vez, en la fila
 * del par cobrado; la fila del otro pedido dice "misma venta" y trae solo lo
 * que le facturaron. Y se dice explícitamente si el par bonificado vino sin
 * cargo (dentro del tope) o cobrado, que es lo que hay que reclamar.
 */

const STATUS_LABEL: Record<string, string> = {
    OK: 'OK', OVERCOST: 'Sobrecosto', UNDERCOST: 'Menor costo', PENDING: 'Esperando factura', UNMATCHED: 'Sin venta',
};
const fmt = fmtARS;
const TD = 'padding:6px 8px;border:1px solid #e5e7eb';
const CHICO = 'display:block;font-size:11px;font-weight:normal;color:#6b7280';

// Las tres claves con las que se le reclama al laboratorio —nº de operación,
// comprobante y fecha— van SIEMPRE, en todas las filas: si una factura no trae
// el nº de pedido (Optovision factura remitos y reprocesos sin él) se dice así
// con todas las letras, en vez de mostrar el nº de comprobante como si fuera
// el de operación o dejar la celda vacía.
const ES_PEDIDO = /^\d{5,}$/;
const faltante = (t: string) => `<span style="color:#b91c1c">${t}</span>`;
export const nroOperacion = (r: any) => ES_PEDIDO.test(String(r.labOrderNumber || '').trim())
    ? String(r.labOrderNumber).trim()
    : faltante('la factura no trae nº');
export const comprobante = (r: any) => {
    const m = String(r.labOrderNumber || '').match(/\d{4}-\d{4,8}/) || String(r.sourceFile || '').match(/\d{4}-\d{4,8}/);
    if (m) return m[0];
    return r.sourceFile ? String(r.sourceFile).replace(/\.pdf$/i, '') : faltante('sin comprobante');
};
const fechaFila = (r: any) => r.invoiceDate
    ? fmtFecha(r.invoiceDate)
    : `${r.createdAt ? fmtFecha(r.createdAt) : 's/fecha'} <span style="color:#6b7280">(alta)</span>`;

/** Resuelto a mano: se dice, con quién y cómo, en vez de volver a acusar. */
function resuelto(r: any): string {
    if (!r.resuelta) return '';
    return `<span style="${CHICO};color:#047857">✓ resuelto${r.resolvedBy ? ` por ${r.resolvedBy}` : ''}${r.resolvedNote ? `: ${r.resolvedNote}` : ''}</span>`;
}

/** Qué dice la columna Estado de la primera fila de una venta 2x1. */
function estado2x1(r: any): string {
    if (!r.es2x1) return '';
    if (r.parBonificadoCobrado) {
        return `<span style="${CHICO};color:#b91c1c;font-weight:bold">⚠️ 2x1: el par bonificado vino cobrado (${fmt(r.parMasBarato)}, tope ${fmt(TOPE_PAR_BONIFICADO_2X1)}) — a reclamar</span>`;
    }
    if (r.parBonificadoVerificado) {
        return `<span style="${CHICO};color:#047857">✓ 2x1: par bonificado ${r.parMasBarato ? `a ${fmt(r.parMasBarato)}` : 'sin cargo'}</span>`;
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

function filaDetalle(r: any, i: number, appUrl: string): string {
    const primera = r.primeraDeLaVenta;
    const cliente = r.clientId
        ? `<a href="${appUrl}/admin/contactos?clientId=${r.clientId}">${r.cliente}</a>`
        : r.cliente;
    // Con el par bonificado cobrado la diferencia de la suma no dice nada
    // (puede hasta dar "a favor"): se muestra en gris, el veredicto está en Estado.
    const colorDif = r.parBonificadoCobrado ? '#6b7280'
        : (r.difference || 0) > 100 ? '#b91c1c' : (r.difference || 0) < -100 ? '#059669' : '#6b7280';
    const dif = r.difference == null ? '—' : ((r.difference > 0 ? '+' : '') + fmt(r.difference));
    // Segunda fila de la misma venta: solo su pedido y su factura. El costo y
    // la diferencia son de la venta y ya están en la fila de arriba.
    if (!primera) {
        const queEs = r.es2x1
            ? (r.parBonificadoCobrado
                ? `<span style="color:#b91c1c;font-weight:bold">par bonificado COBRADO</span>`
                : `<span style="color:#6b7280">par bonificado</span>`)
            : `<span style="color:#6b7280">otro pedido de la venta</span>`;
        return `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="${TD};font-family:monospace"><span style="color:#9ca3af">↳</span> ${nroOperacion(r)}</td>
                    <td style="${TD};font-family:monospace">${comprobante(r)}</td>
                    <td style="${TD};white-space:nowrap">${fechaFila(r)}</td>
                    <td style="${TD};color:#6b7280">↳ misma venta</td>
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
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="${TD};font-family:monospace">${nroOperacion(r)}${otrosPedidos(r)}</td>
                    <td style="${TD};font-family:monospace">${comprobante(r)}</td>
                    <td style="${TD};white-space:nowrap">${fechaFila(r)}</td>
                    <td style="${TD}">${cliente}${r.esPostventa ? ' · <span style="color:#1d4ed8">postventa</span>' : ''}</td>
                    <td style="${TD};text-align:right;font-weight:bold">${fmt(r.billed)}</td>
                    <td style="${TD};text-align:right">${fmt(r.systemCost)}${deLaVenta}</td>
                    <td style="${TD};text-align:right;color:${colorDif}">${dif}</td>
                    <td style="${TD};font-size:12px">${STATUS_LABEL[r.status] || r.status}${estado2x1(r)}${resuelto(r)}</td>
                </tr>`;
}

function bloqueLab(lab: string, d: any, appUrl: string): string {
    const filas = d.detalleSemana.map((r: any, i: number) => filaDetalle(r, i, appUrl)).join('');
    return `
                <h3 style="margin-top:24px;color:#111">${LAB_LABELS[lab] || lab}</h3>
                <p style="font-size:13px;color:#4b5563">
                    Facturas esta semana: <strong>${d.facturasSemana}</strong> por <strong>${fmt(d.facturadoSemana)}</strong> ·
                    Últimos ${d.ventanaDias ?? VENTANA_REPORTE_DIAS} días: ${d.ok} OK, <span style="color:#b91c1c">${d.sobrecostos} sobrecosto(s)</span>,
                    ${d.menorCosto} menor costo, ${d.esperandoFactura} esperando factura,
                    <span style="color:#b45309">${d.sinVenta} sin venta</span>${d.resueltos ? `, ${d.resueltos} resuelto(s) a mano` : ''} · Facturado acumulado ${fmt(d.facturadoAcumulado)}
                </p>
                ${d.detalleSemana.length ? `
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#111827;color:#fff">
                        <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Comprobante</th>
                        <th style="padding:8px;text-align:left">Fecha</th><th style="padding:8px;text-align:left">Cliente</th>
                        <th style="padding:8px;text-align:right">Facturado</th><th style="padding:8px;text-align:right">Sistema</th>
                        <th style="padding:8px;text-align:right">Dif.</th><th style="padding:8px;text-align:left">Estado</th>
                    </tr>${filas}
                </table>` : '<p style="font-size:13px;color:#9ca3af">Sin facturas nuevas en la semana.</p>'}`;
}

/** Un sobrecosto vigente, en una línea: o el 2x1 con el par cobrado, o la diferencia. */
function lineaSobrecosto(s: any): string {
    const cabecera = `${LAB_LABELS[s.lab] || s.lab} · operación ${s.es2x1 && s.pedidos?.length > 1 ? s.pedidos.join(' + ') : nroOperacion(s)} · comprobante ${comprobante(s)} · ${fechaFila(s)} (${s.cliente})`;
    if (s.parBonificadoCobrado) {
        return `<li>${cabecera}: <strong style="color:#b91c1c">2x1 con el par bonificado cobrado — a reclamar ${fmt(s.parMasBarato)}</strong>` +
            `${(s.difference || 0) > 100 ? ` (y la venta entera ${fmt(s.difference)} por encima del sistema)` : ''}</li>`;
    }
    return `<li>${cabecera}: <strong style="color:#b91c1c">+${fmt(s.difference)}</strong></li>`;
}

export function armarEmailSemanal(rep: any, appUrl: string): { subject: string; html: string } {
    const rango = `${fmtFecha(rep.from)} – ${fmtFecha(rep.to)}`;
    const sobre = (rep.sobrecostosVigentes || []).slice(0, 10);
    const cc = (rep.cuentaCorriente || []);
    const html = `
            <div style="font-family:Arial,sans-serif;max-width:920px;margin:0 auto;color:#1f2937">
                <h2 style="color:#b45309">Reporte semanal de laboratorio (${rango})</h2>
                ${cc.length ? `
                <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px;margin-bottom:8px">
                    <strong>Cuenta corriente (deuda al día):</strong>
                    <ul style="margin:6px 0 0;font-size:13px;line-height:1.6">
                        ${cc.map((c: any) => `<li>${LAB_LABELS[c.lab] || c.lab}: <strong>${fmt(c.totalDebt)}</strong> (${c.invoiceCount} facturas, al ${fmtFecha(c.statementDate)})</li>`).join('')}
                    </ul>
                </div>` : ''}
                ${sobre.length ? `
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:8px">
                    <strong style="color:#b91c1c">${sobre.length} sobrecosto(s) de los últimos ${rep.ventanaDias ?? VENTANA_REPORTE_DIAS} días a revisar:</strong>
                    <ul style="margin:6px 0 0;font-size:13px;line-height:1.6">
                        ${sobre.map((s: any) => lineaSobrecosto(s)).join('')}
                    </ul>
                    <p style="font-size:12px;color:#6b7280;margin:8px 0 0">Cuando lo trates (reclamado, acreditado, es correcto), marcalo <strong>resuelto</strong> en <a href="${appUrl}/admin/laboratorio/costos?estado=OVERCOST">la pantalla de conciliación</a> y deja de salir acá.</p>
                </div>` : `<p style="color:#059669">✅ Sin sobrecostos abiertos en los últimos ${rep.ventanaDias ?? VENTANA_REPORTE_DIAS} días.</p>`}
                ${rep.sobrecostosFueraDeVentana ? `<p style="font-size:12px;color:#6b7280;margin:0 0 8px">Además hay <strong>${rep.sobrecostosFueraDeVentana}</strong> sobrecosto(s) de más de ${rep.ventanaDias ?? VENTANA_REPORTE_DIAS} días sin resolver: no se repiten acá. Se ven eligiendo el mes en la pantalla, y ahí se marcan resueltos.</p>` : ''}
                <p style="font-size:12px;color:#6b7280;margin:8px 0 0">En un 2x1 la venta tiene dos pedidos: el <strong>Sistema</strong> es de la venta entera y cuenta un solo par (el bonificado va en $0), por eso aparece una vez; la fila «misma venta» es el otro pedido con lo que le facturaron. El par bonificado tiene que venir sin cargo o hasta ${fmt(TOPE_PAR_BONIFICADO_2X1)}; si viene por encima, es sobrecosto y se reclama.</p>
                ${bloqueLab('OPTOVISION', rep.perLab.OPTOVISION, appUrl)}
                ${bloqueLab('GRUPO_OPTICO', rep.perLab.GRUPO_OPTICO, appUrl)}
                <p style="margin-top:16px;font-size:13px"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
                <p style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:16px">Atelier Óptica — Reporte semanal de costos de laboratorio</p>
            </div>`;
    return { subject: `📊 Reporte semanal de laboratorio (${rango})`, html };
}
