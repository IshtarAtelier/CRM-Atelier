import { prisma } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { BACKFILL_LABS, emailsEnabled, isQuietLab } from './backfill';
import { ALERT_MIN_DIFF, LAB_LABELS, adminInbox, appUrl as appUrlFn, fmtARS, fmtFecha } from './types';

/**
 * AVISOS de la conciliación de costos de laboratorio.
 *
 * Dos canales, definidos con el administrador el 22/7/2026:
 *   - AL INSTANTE (pase de 10 min): pedidos SIN VENTA que los respalde, y
 *     reprocesos de garantía que el lab facturó CON CARGO. Son las dos cosas que
 *     hay que resolver en el momento — plata a reclamar o un número a asignar.
 *   - RESUMEN DIARIO (cron de la mañana): todo lo demás junto en UN email —
 *     facturas que llegaron con su veredicto, sobrecostos y ahorros.
 *
 * El dedupe vive en las columnas alertedAt/alertedStatus de LabCostEntry: nada
 * se avisa dos veces, y se re-avisa solo si el estado cambió.
 */

/**
 * Triage de pedidos SIN VENTA: para cada huérfano intenta explicar de dónde
 * salió, así el aviso llega con la pista hecha en vez de un número suelto.
 *   1) ¿Matchea un caso de POSTVENTA abierto sin nº asignado? (lo más fuerte)
 *   2) ¿El portal lo marca reproceso/garantía/reclamo?
 *   3) ¿Hay un cliente con ese nombre? → venta a la que falta anotarle el nº
 *   4) Nada de lo anterior → DUDOSO, revisar con urgencia
 */
async function clasificarHuerfanos(huerfanos: any[]) {
    const openCases = await prisma.postSaleCase.findMany({
        where: {
            createdAt: { gte: new Date(Date.now() - 60 * 86400000) },
            OR: [{ newOrderNumber: null }, { newOrderNumber: '' }],
        },
        select: {
            id: true, caseType: true, coverage: true,
            order: { select: { clientId: true, client: { select: { name: true } } } },
        },
    }).catch(() => [] as any[]);

    const tokensOf = (s: string) => new Set(
        s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .split(/[^a-z]+/).filter(w => w.length >= 3)
    );

    return Promise.all(huerfanos.map(async (o) => {
        const notes = o.notes || '';
        const nameRaw = notes.match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
        const nameTokens = tokensOf(nameRaw);

        if (nameTokens.size > 0) {
            for (const c of openCases) {
                const ct = tokensOf(c.order?.client?.name || '');
                const inter = [...nameTokens].filter(t => ct.has(t)).length;
                if (inter >= 2 || (inter >= 1 && Math.min(nameTokens.size, ct.size) === 1)) {
                    return {
                        id: o.id, tipo: 'POSTVENTA', clientId: c.order?.clientId,
                        detalle: `Caso de POSTVENTA de «${c.order?.client?.name}» SIN nº asignado (${c.caseType || 's/tipo'}${c.coverage ? `, ${c.coverage}` : ''}) — asignarle este pedido`,
                    };
                }
            }
        }
        if (/reproceso|reclamo|garant[ií]a|cambio\s+(de\s+)?(rx|cristal)/i.test(notes)) {
            return { id: o.id, tipo: 'POSTVENTA', clientId: null, detalle: 'Posible caso de postventa sin nº de operación asignado' };
        }
        const words: string[] = nameRaw.split(/\s+/).filter((w: string) => w.length >= 3 && !/^\d+$/.test(w)).slice(0, 2);
        if (words.length > 0) {
            const client = await prisma.client.findFirst({
                where: { isDeleted: false, AND: words.map((w: string) => ({ name: { contains: w, mode: 'insensitive' as const } })) },
                select: { id: true, name: true, orders: { where: { isDeleted: false, orderType: 'SALE' }, select: { labOrderNumber: true }, take: 3, orderBy: { createdAt: 'desc' as const } } },
            }).catch(() => null);
            if (client) {
                const sinNumero = client.orders.some(v => !v.labOrderNumber?.match(/\d{4,}/));
                return {
                    id: o.id, tipo: 'VENTA_SIN_NUMERO', clientId: client.id,
                    detalle: `Posible venta de «${client.name}»${sinNumero ? ' (tiene venta SIN nº de lab: asignarle este número)' : ''}`,
                };
            }
        }
        // FACTURA SIN Nº DE PEDIDO (emitida contra remito): el papel no dice a qué
        // pedido corresponde ni trae el nombre del cliente, así que se busca la
        // venta candidata por IMPORTE — una que esté esperando factura y cuyo costo
        // de sistema se parezca al facturado. Es una SUGERENCIA para asignar a
        // mano: el sistema no la asigna solo.
        if ((o.notes || '').includes('SIN nº de pedido')) {
            const importe = o.lab === 'OPTOVISION'
                ? (o.billedTotal ?? o.billedNet)
                : (o.billedNet ?? o.billedTotal);
            if (importe) {
                const candidatas = await prisma.labCostEntry.findMany({
                    where: {
                        lab: o.lab, status: 'PENDING', orderId: { not: null },
                        billedNet: null, billedTotal: null,
                        systemCost: { gte: importe * 0.75, lte: importe * 1.35 },
                    },
                    include: { order: { select: { clientId: true, labOrderNumber: true, client: { select: { name: true } } } } },
                    take: 4,
                }).catch(() => [] as any[]);
                if (candidatas.length > 0) {
                    const lista = candidatas
                        .map((c: any) => `${c.labOrderNumber} (${c.order?.client?.name || 's/cliente'}, sistema $${Math.round(c.systemCost || 0).toLocaleString('es-AR')})`)
                        .join(' · ');
                    return {
                        id: o.id, tipo: 'VENTA_SIN_NUMERO',
                        clientId: candidatas.length === 1 ? candidatas[0].order?.clientId : null,
                        detalle: `Factura sin nº de pedido. ${candidatas.length === 1 ? 'Candidata' : `${candidatas.length} candidatas`} por importe: ${lista} — confirmar y asignar`,
                    };
                }
            }
            return { id: o.id, tipo: 'DUDOSO', clientId: null, detalle: 'Factura SIN nº de pedido y sin venta parecida esperando: revisar con el laboratorio' };
        }
        return { id: o.id, tipo: 'DUDOSO', clientId: null, detalle: 'DUDOSO — sin cliente ni postventa que lo explique: revisar con urgencia' };
    }));
}


/** Marca una entrada como ya alertada con su estado actual (dedupe de avisos). */
export async function markAlerted(id: string, status: string) {
    await prisma.labCostEntry.update({
        where: { id },
        data: { alertedAt: new Date(), alertedStatus: status },
    }).catch(err => console.error('[LabCost] Error marcando alerta enviada:', err));
}


/**
 * Barrido de alertas. DOS MODOS (pedido del administrador el 22/7):
 *
 *  - `urgente` (pase rápido, cada 10 min): SOLO los pedidos SIN VENTA. Son
 *    los que hay que resolver en el momento (asignarle el nº a una venta,
 *    vincularlo a una postventa o reclamarle al lab), así que van apenas
 *    aparecen y con el triage ya hecho.
 *  - `diario` (cron de la mañana): TODO LO DEMÁS junto en UN SOLO email —
 *    facturas que llegaron, diferencias de costo a favor y en contra. Nada
 *    de un mail por factura: un resumen del día y listo.
 *
 * En ambos, el par alertedAt/alertedStatus garantiza que nada se avise dos
 * veces ni se escape (se re-alerta solo si el estado cambió).
 */
export async function alertNewFindings(opts: { modo?: 'urgente' | 'diario' } = {}) {
    const modo = opts.modo ?? 'diario';
    const estados = modo === 'urgente'
        ? ['UNMATCHED']
        : ['OVERCOST', 'UNDERCOST', 'OK', 'PENDING'];
    const candidatos = await prisma.labCostEntry.findMany({
        where: { status: { in: estados } },
        include: { order: { select: { id: true, clientId: true, client: { select: { name: true } } } } },
        orderBy: [{ lab: 'asc' }, { createdAt: 'desc' }],
    });
    // Los labs con backfill pendiente no alertan (sus entradas se están
    // estampando en silencio); el resto sigue el dedupe normal.
    const quietPorLab: Record<string, boolean> = {};
    for (const l of BACKFILL_LABS) quietPorLab[l] = await isQuietLab(l);
    const nuevos = candidatos.filter(e => !quietPorLab[e.lab] && (!e.alertedAt || e.alertedStatus !== e.status));
    if (nuevos.length === 0) return { alerted: 0 };

    // En el modo `urgente` todo lo que entra son huérfanos: van sí o sí.
    // En el `diario` solo entran las entradas que ya tienen COSTO REAL — un
    // pedido registrado del portal que todavía no facturó no es novedad y
    // llenaría el resumen de ruido (queda esperando en la pantalla, y cuando
    // llegue su factura aparece en el resumen de ese día).
    const bill = (e: any) => e.lab === 'OPTOVISION' ? (e.billedTotal ?? e.billedNet ?? 0) : (e.billedNet ?? e.billedTotal ?? 0);
    const relevantes = modo === 'urgente'
        ? nuevos
        : nuevos.filter(e => bill(e) > 0 || e.difference !== null);
    // El resumen diario no silencia nada por monto: es un solo email por día,
    // así que las diferencias chicas también entran (ordenadas al final).
    const chicos: any[] = [];

    // Una venta con varios pedidos (2x1) estampa el estado a NIVEL VENTA en
    // todas sus entradas hermanas: informar UNA fila por venta (la de mayor
    // importe; a igualdad, menor nº) y marcar el resto como alertado junto
    // con ella — el mismo sobrecosto no se lista dos veces.
    // OJO: las entradas de POSTVENTA (reproceso) comparten el orderId de la
    // venta pero son un hallazgo APARTE — agruparlas con la venta escondería
    // una de las dos. Van sueltas, como los huérfanos.
    const esPostventa = (e: any) => (e.notes || '').includes('POSTVENTA (caso');
    const porVenta = new Map<string, any[]>();
    const findings: any[] = [];
    const suprimidosDe = new Map<string, any[]>();
    for (const e of relevantes) {
        if (!e.orderId || esPostventa(e)) { findings.push(e); continue; }
        const key = `${e.lab}:${e.orderId}`;
        if (!porVenta.has(key)) porVenta.set(key, []);
        porVenta.get(key)!.push(e);
    }
    for (const grupo of porVenta.values()) {
        grupo.sort((a, b) => bill(b) - bill(a) || a.labOrderNumber.localeCompare(b.labOrderNumber));
        findings.push(grupo[0]);
        suprimidosDe.set(grupo[0].id, grupo.slice(1));
    }

    // En local/desarrollo no se mandan emails (ruido al administrador con datos
    // de la base local); tampoco se marca alertado, así prod avisa igual.
    if (!emailsEnabled()) {
        console.log(`[LabCost] alertNewFindings: ${findings.length} hallazgo(s), ${chicos.length} silenciado(s) por monto chico (email omitido fuera de producción)`);
        return { alerted: 0, skipped: findings.length, silenciados: chicos.length };
    }
    // Las diferencias chicas se estampan acá (en prod): sin esto quedarían
    // como "pendientes de alertar" y se re-evaluarían en cada corrida.
    for (const c of chicos) await markAlerted(c.id, c.status);
    if (findings.length === 0) return { alerted: 0, silenciados: chicos.length };

    const appUrl = appUrlFn();
    const fmt = fmtARS;
    const LABS = LAB_LABELS;
    const META: Record<string, { label: string; color: string }> = {
        UNMATCHED: { label: 'SIN VENTA NI POSTVENTA', color: '#b91c1c' },
        OVERCOST: { label: 'SOBRECOSTO', color: '#c2410c' },
        UNDERCOST: { label: 'Menor costo (a favor)', color: '#047857' },
        OK: { label: 'Coincide', color: '#047857' },
        PENDING: { label: 'Esperando el otro par (2x1)', color: '#1d4ed8' },
    };
    const cuenta = (s: string) => findings.filter(f => f.status === s).length;
    const partes = [
        cuenta('UNMATCHED') ? `${cuenta('UNMATCHED')} sin venta` : null,
        cuenta('OVERCOST') ? `${cuenta('OVERCOST')} sobrecosto${cuenta('OVERCOST') > 1 ? 's' : ''}` : null,
        cuenta('UNDERCOST') ? `${cuenta('UNDERCOST')} a favor` : null,
        cuenta('OK') ? `${cuenta('OK')} coinciden` : null,
        cuenta('PENDING') ? `${cuenta('PENDING')} esperando el par` : null,
    ].filter(Boolean).join(', ');

    // Lo que necesita acción primero: sobrecostos (por monto), después el resto.
    const PRIORIDAD: Record<string, number> = { UNMATCHED: 0, OVERCOST: 1, UNDERCOST: 2, PENDING: 3, OK: 4 };
    findings.sort((a, b) =>
        (PRIORIDAD[a.status] ?? 9) - (PRIORIDAD[b.status] ?? 9)
        || Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0));

    // TOPE AUTO-DRENANTE: un evento masivo (p. ej. el PDF de comprobantes que
    // vuelve después de fallar y mueve cientos de pedidos de golpe) llenaría
    // el resumen con cientos de filas — Gmail lo recorta a los 102 KB y los
    // hallazgos importantes se pierden. Se informan los MÁS IMPORTANTES y solo
    // esos se marcan como vistos: los demás salen en el resumen siguiente, sin
    // perderse ninguno. Con el volumen normal (unos pocos por día) nunca actúa.
    const MAX_FILAS = 60;
    const pendientes = Math.max(0, findings.length - MAX_FILAS);
    const total = findings.length;
    if (pendientes > 0) findings.length = MAX_FILAS;

    // En el aviso de huérfanos, la última columna es el TRIAGE (de dónde puede
    // haber salido ese pedido); en el resumen diario, el detalle de la entrada.
    const triage = modo === 'urgente'
        ? new Map((await clasificarHuerfanos(findings).catch(() => [])).map((c: any) => [c.id, c]))
        : new Map();
    const BADGE: Record<string, string> = {
        POSTVENTA: 'background:#dbeafe;color:#1d4ed8',
        VENTA_SIN_NUMERO: 'background:#fef3c7;color:#92400e',
        DUDOSO: 'background:#fee2e2;color:#b91c1c;font-weight:bold',
    };

    const rows = findings.map((f, i) => {
        const m = META[f.status] || { label: f.status, color: '#374151' };
        const cliente = f.order
            ? `<a href="${appUrl}/admin/contactos?clientId=${f.order.clientId}">${f.order.client?.name || 'ver ficha'}</a>`
            : '<span style="color:#b91c1c">—</span>';
        const real = f.lab === 'OPTOVISION' ? (f.billedTotal ?? f.billedNet) : (f.billedNet ?? f.billedTotal);
        const t: any = triage.get(f.id);
        const ultima = t
            ? `<span style="padding:2px 8px;border-radius:10px;${BADGE[t.tipo] || ''}">${t.detalle}</span>${t.clientId ? ` <a href="${appUrl}/admin/contactos?clientId=${t.clientId}">ver ficha</a>` : ''}`
            : (f.notes || '—');
        return `<tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
            <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${f.labOrderNumber}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb">${LABS[f.lab] || f.lab}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb">${cliente}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${fmt(f.systemCost)}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${fmt(real)}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;color:${(f.difference ?? 0) > 0 ? '#b91c1c' : '#047857'}">${f.difference != null ? fmt(f.difference) : '—'}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb"><span style="color:${m.color};font-weight:bold">${m.label}</span></td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${ultima}</td>
        </tr>`;
    }).join('');

    const esUrgente = modo === 'urgente';
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
    const asunto = esUrgente
        ? `🚨 ${findings.length} pedido(s) de laboratorio SIN VENTA en el sistema`
        : `📋 Laboratorios ${hoy}: ${findings.length} movimiento(s) — ${partes}`;
    const titulo = esUrgente
        ? '🚨 Pedidos de laboratorio sin venta que los respalde'
        : `📋 Resumen del día — laboratorios`;
    const bajada = esUrgente
        ? `Aparecieron <strong>${findings.length}</strong> pedido(s) facturados por el laboratorio que no tienen ninguna venta ni postventa que los respalde. Conviene resolverlos ahora: asignarle el número a la venta que corresponda, vincularlo a un caso de postventa, o reclamárselo al laboratorio.`
        : `Todo lo que se movió hoy en los dos laboratorios, junto: ${partes}. Los pedidos sin venta se avisan aparte, en el momento.`;

    const res: any = await sendEmail({
        to: adminInbox(),
        subject: asunto,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#1f2937">
                <h2 style="color:${esUrgente ? '#b91c1c' : '#1f2937'}">${titulo}</h2>
                <p>${bajada}</p>
                ${pendientes > 0 ? `<p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px 12px;font-size:13px">Se movieron <strong>${total}</strong> en total: acá van los <strong>${MAX_FILAS} más importantes</strong> y los otros <strong>${pendientes}</strong> salen en el próximo resumen (no se pierde ninguno). Están todos en <a href="${appUrl}/admin/laboratorio/costos">la pantalla de conciliación</a>.</p>` : ''}
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#111827;color:#fff">
                        <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Lab</th>
                        <th style="padding:8px;text-align:left">Cliente</th><th style="padding:8px;text-align:right">Costo sistema</th>
                        <th style="padding:8px;text-align:right">Costo real</th><th style="padding:8px;text-align:right">Dif.</th>
                        <th style="padding:8px;text-align:left">Estado</th><th style="padding:8px;text-align:left">Detalle</th>
                    </tr>${rows}
                </table>
                <p style="margin-top:14px"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
            </div>
        `,
    });
    // sendEmail NUNCA lanza: devuelve { success:false } si el envío falló.
    // Marcar como alertado un hallazgo cuyo email no salió lo silenciaría
    // para siempre — solo se marca lo que efectivamente se avisó.
    if (!res?.success) {
        console.error('[LabCost] alertNewFindings: el email NO salió; se reintenta en la próxima corrida.');
        return { alerted: 0, failed: findings.length };
    }
    // Se marca SOLO lo que salió en este email (con los hermanos de esas
    // ventas): lo que quedó fuera del tope sigue pendiente para el próximo.
    // Un updateMany por estado en vez de N updates: con lotes grandes, N
    // updates secuenciales contra la base (Singapur) agregaban minutos al cron.
    const aMarcar = [...findings];
    for (const f of findings) aMarcar.push(...(suprimidosDe.get(f.id) || []));
    const porEstado = new Map<string, string[]>();
    for (const e of aMarcar) {
        if (!porEstado.has(e.status)) porEstado.set(e.status, []);
        porEstado.get(e.status)!.push(e.id);
    }
    const ahora = new Date();
    for (const [st, ids] of porEstado) {
        await prisma.labCostEntry.updateMany({
            where: { id: { in: ids } },
            data: { alertedAt: ahora, alertedStatus: st },
        }).catch(err => console.error('[LabCost] Error marcando hallazgos alertados:', err));
    }
    return { alerted: findings.length, ...(pendientes > 0 ? { pendientes } : {}) };
}


export async function sendChargedReworkAlert(entry: any, order: any, pvCase: any, billed: number): Promise<boolean> {
    const appUrl = appUrlFn();
    const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
    // EL CASO COMPLETO en el email (pedido del administrador): para poder
    // reclamarle al laboratorio sin tener que entrar al sistema a buscar qué
    // pasó — tipo de caso, falla, cobertura, historial de notas y la venta
    // original con sus pedidos.
    const caso = await prisma.postSaleCase.findUnique({
        where: { id: pvCase.id },
        include: {
            notesList: { orderBy: { createdAt: 'asc' }, take: 20 },
            statusHistory: { orderBy: { createdAt: 'asc' }, take: 20 },
        },
    }).catch(() => null);

    const fecha = (d: Date | string | null | undefined) => d
        ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
        : '—';
    const fila = (k: string, v: string) => `<tr><td style="padding:5px 8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:bold;white-space:nowrap">${k}</td><td style="padding:5px 8px;border:1px solid #e5e7eb">${v}</td></tr>`;

    // Fotos que el vendedor adjuntó al caso (el lente roto, el comprobante):
    // son la prueba para reclamarle al lab, así que van con link directo.
    const urlFoto = (u: string) => /^https?:\/\//i.test(u) ? u : `${appUrl}${u.startsWith('/') ? '' : '/'}${u}`;
    const notasHtml = (caso?.notesList || []).length
        ? `<p style="margin:14px 0 4px;font-weight:bold">Historial del caso:</p>
           <ul style="line-height:1.6;font-size:13px;margin-top:0">${(caso!.notesList as any[]).map(n =>
                `<li><span style="color:#6b7280">${fecha(n.createdAt)}${n.createdBy ? ` · ${n.createdBy}` : ''}:</span> ${n.content || ''}` +
                `${n.imageUrl ? ` <a href="${urlFoto(n.imageUrl)}">📎 ver foto adjunta</a>` : ''}</li>`).join('')}</ul>`
        : '';
    const notaLibreHtml = caso?.notes
        ? `<p style="margin:14px 0 4px;font-weight:bold">Observaciones:</p><p style="font-size:13px;white-space:pre-wrap;margin-top:0">${caso.notes}</p>`
        : '';

    const estadosHtml = (caso?.statusHistory || []).length
        ? `<p style="margin:14px 0 4px;font-weight:bold">Estados por los que pasó:</p>
           <p style="font-size:13px;margin-top:0">${(caso!.statusHistory as any[]).map(h => `${fecha(h.createdAt)}: ${h.fromStatus} → <strong>${h.toStatus}</strong>${h.changedBy ? ` (${h.changedBy})` : ''}`).join('<br>')}</p>`
        : '';

    const res: any = await sendEmail({
        to: adminInbox(),
        subject: `🚨 Reproceso de POSTVENTA facturado CON CARGO: pedido ${entry.labOrderNumber} (${fmt(billed)}) — ${order.client?.name || 'cliente'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #b91c1c;">🚨 Reproceso de postventa facturado con cargo</h2>
                <p>El laboratorio cobró <strong style="color:#b91c1c;font-size:17px">${fmt(billed)}</strong> por un reproceso que salió de un caso de <strong>postventa</strong>.
                Las garantías deberían venir sin cargo — <strong>verificar con el laboratorio si corresponde nota de crédito</strong>.</p>

                <p style="margin:16px 0 4px;font-weight:bold">El caso:</p>
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    ${fila('Cliente', `<a href="${appUrl}/admin/contactos?clientId=${order.clientId}">${order.client?.name || 'ver ficha'}</a>`)}
                    ${fila('Tipo de caso', caso?.caseType || pvCase.caseType || 'sin tipo')}
                    ${fila('Falla reportada', caso?.fault || pvCase.fault || '—')}
                    ${fila('Cobertura', caso?.coverage || pvCase.coverage || '—')}
                    ${fila('Responsable', caso?.responsible || '—')}
                    ${fila('Estado del caso', caso?.status || '—')}
                    ${fila('Abierto el', fecha(caso?.createdAt))}
                    ${fila('Costo cargado en el caso', caso?.cost ? fmt(caso.cost) : '$0 (se cargó como garantía)')}
                </table>

                <p style="margin:16px 0 4px;font-weight:bold">Lo que facturó el laboratorio:</p>
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    ${fila('Laboratorio', entry.lab === 'GRUPO_OPTICO' ? 'Grupo Óptico' : 'Optovisión')}
                    ${fila('Nº de operación del reproceso', `<span style="font-family:monospace">${entry.labOrderNumber}</span>`)}
                    ${fila('Importe facturado', `<strong style="color:#b91c1c">${fmt(billed)}</strong>`)}
                    ${fila('Comprobante', entry.sourceFile || '—')}
                    ${fila('Fecha de factura', fecha(entry.invoiceDate))}
                    ${fila('Venta original', `<span style="font-family:monospace">${order.labOrderNumber || '—'}</span>`)}
                </table>

                ${notaLibreHtml}
                ${notasHtml}
                ${estadosHtml}

                <p style="margin-top:18px">
                    <a href="${appUrl}/admin/contactos?clientId=${order.clientId}">Ver la ficha del cliente y el caso</a> ·
                    <a href="${appUrl}/admin/laboratorio/costos?lab=${entry.lab}">Ver la conciliación</a>
                </p>
            </div>
        `,
    });
    if (!res?.success) {
        console.error(`[LabCost] Alerta de reproceso cobrado NO salió (pedido ${entry.labOrderNumber}); se reintenta en la próxima corrida.`);
        return false;
    }
    console.log(`[LabCost] Alerta de reproceso cobrado enviada: pedido ${entry.labOrderNumber} (${billed})`);
    return true;
}

