import { prisma } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { estaResuelta, etiquetaSinVenta } from '../../lib/lab-factura';
import { labPortalClientName } from '../../lib/lab-portal-client-name';
import { BACKFILL_LABS, emailsEnabled, isQuietLab } from './backfill';
import { LAB_LABELS, UNMATCHED_GRACE_MS, VENTANA_REPORTE_DIAS, adminInbox, appUrl as appUrlFn, fmtARS, fmtFecha } from './types';

/**
 * AVISO DIARIO de la conciliación de costos de laboratorio: los pedidos SIN
 * VENTA, una vez por día, con su pista. Es el ÚNICO mail diario (Ishtar,
 * 25/9/2026); todo lo demás —facturas con su veredicto, sobrecostos,
 * reprocesos cobrados, 2x1— va en el reporte semanal (weekly-email.ts).
 *
 * Hasta el 25/9/2026 había dos canales (definidos el 22/7/2026): un aviso al
 * instante cada 10 minutos y un resumen diario con el resto. El primero pasó a
 * una vez por día y el segundo se retiró a favor del semanal.
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
export async function clasificarHuerfanos(huerfanos: any[]) {
    // Ventas recientes YA ENVIADAS al laboratorio cuyo nº de operación todavía
    // no está cargado. Caso real del 20/8/2026 (Cecilia Damon): el envío por
    // SmartLab deja `labOrderNumber = "SML-<borrador>"` y el nº real (8053…)
    // recién lo carga un humano al confirmar el borrador en el portal. En esa
    // ventana el barrido ve los pedidos, no matchean con ninguna venta, y el
    // aviso urgente salía acusando "SIN VENTA — DUDOSO" con la venta cargada
    // delante de las narices. Estos candidatos se comparan por nombre EN CÓDIGO
    // (con la misma tolerancia a erratas de abajo), no con un `contains` en SQL.
    const ventasEnviadas = await prisma.order.findMany({
        where: {
            isDeleted: false,
            orderType: 'SALE',
            labSentAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: {
            id: true, labOrderNumber: true, clientId: true,
            client: { select: { name: true } },
        },
    }).catch(() => [] as any[]);
    /** ¿El "nº" de la venta es un borrador de SmartLab o directamente no está? */
    const sinNumeroReal = (s: string | null | undefined) =>
        !s || /^(SML|Borrador)-/i.test(s) || !s.match(/\d{5,}/);

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

    // EL NOMBRE DEL PORTAL VIENE TIPEADO A MANO. Caso real del 28/7/2026: el
    // cliente «Oddino Franco» entró al portal como "Odino Franco" en un pedido y
    // como "Odina ranco" en el otro. Comparar palabra por palabra exacta no
    // encontraba nada y los dos pedidos quedaban como DUDOSO, cuando la venta
    // estaba cargada. Se compara tolerando erratas: una letra de más, una de
    // menos o una cambiada.
    const distancia = (a: string, b: string): number => {
        if (a === b) return 0;
        const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            let anterior = prev[0];
            prev[0] = i;
            for (let j = 1; j <= b.length; j++) {
                const temp = prev[j];
                prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
                anterior = temp;
            }
        }
        return prev[b.length];
    };
    // Dos erratas en palabras de 5+ letras: hace falta esa holgura para que
    // "Odina ranco" llegue a «Oddino Franco». Como el aviso solo SUGIERE ("posible
    // venta de…") y no asigna nada, un parecido de más lo resuelve el ojo humano;
    // uno de menos deja el pedido perdido.
    const parecidas = (a: string, b: string) => Math.abs(a.length - b.length) <= 2
        && distancia(a, b) <= (Math.min(a.length, b.length) >= 5 ? 2 : 1);
    /** Cuántos tokens del nombre del portal aparecen —aun con erratas— en el otro. */
    const coincidencias = (unos: Set<string>, otros: Set<string>) =>
        [...unos].filter(t => [...otros].some(o => parecidas(t, o))).length;
    const normalizado = (s: string) => s.toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, ' ').trim();

    return Promise.all(huerfanos.map(async (o) => {
        const notes = o.notes || '';
        const nameRaw = notes.match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
        const nameTokens = tokensOf(nameRaw);

        if (nameTokens.size > 0) {
            for (const c of openCases) {
                const ct = tokensOf(c.order?.client?.name || '');
                const inter = coincidencias(nameTokens, ct);
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
        // ¿Coincide por nombre con una venta ya enviada al lab que sigue sin su
        // nº real (borrador SML-… de SmartLab, o directamente vacío)? Entonces
        // NO es un pedido sin venta: es la venta esperando que le carguen el nº.
        // El re-cruce (cada 10 min) la engancha solo apenas alguien lo cargue.
        if (nameTokens.size > 0) {
            for (const v of ventasEnviadas) {
                if (!sinNumeroReal(v.labOrderNumber)) continue;
                const vt = tokensOf(v.client?.name || '');
                const inter = coincidencias(nameTokens, vt);
                if (inter >= 2 || (inter >= 1 && Math.min(nameTokens.size, vt.size) === 1)) {
                    const esBorrador = /^(SML|Borrador)-/i.test(v.labOrderNumber || '');
                    return {
                        id: o.id, tipo: 'VENTA_SMARTLAB', clientId: v.clientId,
                        detalle: `La venta de «${v.client?.name}» ya está enviada al laboratorio pero ${esBorrador
                            ? `sigue con el borrador de SmartLab (${v.labOrderNumber})`
                            : 'no tiene el nº de operación cargado'}: cargarle este nº a la venta — el cruce engancha solo al guardarlo`,
                    };
                }
            }
        }
        const words: string[] = nameRaw.split(/\s+/).filter((w: string) => w.length >= 3 && !/^\d+$/.test(w)).slice(0, 2);
        if (words.length > 0) {
            const select = {
                id: true, name: true,
                orders: { where: { isDeleted: false, orderType: 'SALE' }, select: { labOrderNumber: true }, take: 3, orderBy: { createdAt: 'desc' as const } },
            };
            // Primero el nombre tal cual vino. Si no aparece —erratas del portal—,
            // se traen los que empiezan igual y se elige por parecido.
            let client = await prisma.client.findFirst({
                where: { isDeleted: false, AND: words.map((w: string) => ({ name: { contains: w, mode: 'insensitive' as const } })) },
                select,
            }).catch(() => null);

            if (!client) {
                const candidatos = await prisma.client.findMany({
                    where: {
                        isDeleted: false,
                        OR: words.filter(w => w.length >= 4)
                            .map((w: string) => ({ name: { contains: w.slice(0, 4), mode: 'insensitive' as const } })),
                    },
                    select, take: 40,
                }).catch(() => [] as any[]);
                // A igualdad de tokens parecidos gana el nombre entero más cercano:
                // «Odina ranco» empata tokens con «Oddino Franco» y con «De La
                // Colina Franco», y solo el nombre completo los desempata.
                const puntuados = candidatos
                    .map((c: any) => ({
                        c,
                        puntos: coincidencias(nameTokens, tokensOf(c.name || '')),
                        error: distancia(normalizado(nameRaw), normalizado(c.name || '')),
                    }))
                    .filter((x: any) => x.puntos >= 2 || (x.puntos >= 1 && nameTokens.size === 1))
                    .sort((a: any, b: any) => b.puntos - a.puntos || a.error - b.error);
                client = puntuados[0]?.c ?? null;
            }

            if (client) {
                // Un borrador "SML-123456" tiene dígitos pero NO es un nº de
                // operación del lab: cuenta como venta sin número.
                const sinNumero = client.orders.some(v => sinNumeroReal(v.labOrderNumber));
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
 * AVISO DIARIO DE PEDIDOS SIN VENTA — el único aviso diario de laboratorio
 * (Ishtar, 25/9/2026: "ese sería el único que lo pasaría una vez al día").
 *
 * Un pedido que el laboratorio facturó y no tiene venta ni postventa que lo
 * respalde es plata sin dueño: o falta cargarle el nº de operación a la venta,
 * o es un reproceso sin nº asignado, o hay que reclamárselo al lab. Sale una
 * vez por día desde el cron diario, con el triage hecho (clasificarHuerfanos).
 *
 * El par alertedAt/alertedStatus garantiza que ningún pedido se avise dos
 * veces (se re-avisa solo si cambió de estado). Lo resuelto a mano no se
 * avisa. Y solo lo de la ventana (VENTANA_REPORTE_DIAS): lo más viejo se
 * estampa como visto sin avisar. El reporte semanal vuelve a listar TODOS los
 * que sigan abiertos, así nada se pierde por haberse avisado una sola vez.
 */
export async function alertNewFindings() {
    const candidatos = await prisma.labCostEntry.findMany({
        where: { status: 'UNMATCHED' },
        include: { order: { select: { id: true, clientId: true, client: { select: { name: true } } } } },
        orderBy: [{ lab: 'asc' }, { createdAt: 'desc' }],
    });
    // Los labs con backfill pendiente no alertan (sus entradas se están
    // estampando en silencio); el resto sigue el dedupe normal.
    const quietPorLab: Record<string, boolean> = {};
    for (const l of BACKFILL_LABS) quietPorLab[l] = await isQuietLab(l);
    // Un SIN VENTA recién aparecido no es huérfano todavía: el vendedor tiene
    // el margen de UNMATCHED_GRACE_MS para cargarle el nº de operación a la
    // venta antes de que se lo dé por perdido.
    const listoParaAvisar = (e: any) => Date.now() - new Date(e.createdAt).getTime() >= UNMATCHED_GRACE_MS;
    const ventanaDesde = Date.now() - VENTANA_REPORTE_DIAS * 86400000;
    const enVentana = (e: any) => new Date(e.invoiceDate ?? e.createdAt).getTime() >= ventanaDesde;
    const nuevos = candidatos.filter(e => !quietPorLab[e.lab] && !estaResuelta(e)
        && (!e.alertedAt || e.alertedStatus !== e.status) && listoParaAvisar(e));
    const viejos = nuevos.filter(e => !enVentana(e));
    let findings: any[] = nuevos.filter(enVentana);
    if (findings.length === 0 && viejos.length === 0) return { alerted: 0 };

    // Triage ANTES de decidir qué sale: un pedido que coincide por nombre con
    // una venta ya enviada al lab que espera su nº real (borrador SML- de
    // SmartLab) no es una alarma — es papeleo en curso. Se le da 24 h para que
    // carguen el nº (el re-cruce lo engancha solo); si pasado ese plazo sigue
    // suelto, sale con la explicación, no como DUDOSO. No se marca alertado,
    // así vuelve a evaluarse al día siguiente.
    const EN_CAMINO_MS = 24 * 60 * 60 * 1000;
    let triage = new Map<string, any>();
    if (findings.length > 0) {
        triage = new Map((await clasificarHuerfanos(findings).catch(() => [])).map((c: any) => [c.id, c]));
        const enCamino = findings.filter(f => triage.get(f.id)?.tipo === 'VENTA_SMARTLAB'
            && Date.now() - new Date(f.createdAt).getTime() < EN_CAMINO_MS);
        if (enCamino.length > 0) {
            console.log(`[LabCost] alertNewFindings: ${enCamino.length} pedido(s) sin alertar — su venta ya está enviada al lab y espera el nº real: ${enCamino.map(f => f.labOrderNumber).join(', ')}`);
            findings = findings.filter(f => !enCamino.includes(f));
        }
    }

    // En local/desarrollo no se mandan emails (ruido al administrador con datos
    // de la base local); tampoco se marca alertado, así prod avisa igual.
    if (!emailsEnabled()) {
        console.log(`[LabCost] alertNewFindings: ${findings.length} pedido(s) sin venta, ${viejos.length} fuera de ventana (email omitido fuera de producción)`);
        return { alerted: 0, skipped: findings.length, viejos: viejos.length };
    }
    // Lo de más de 30 días se estampa como visto sin avisar: si no, quedaría
    // "pendiente de avisar" y se re-evaluaría en cada corrida.
    for (const v of viejos) await markAlerted(v.id, v.status);
    if (findings.length === 0) return { alerted: 0, viejos: viejos.length };

    // TOPE AUTO-DRENANTE: un evento masivo (p. ej. el barrido del portal que
    // vuelve después de fallar y registra cientos de pedidos de golpe) llenaría
    // el aviso con cientos de filas — Gmail lo recorta a los 102 KB. Se informan
    // los MÁS NUEVOS y solo esos se marcan como vistos: los demás salen al día
    // siguiente, sin perderse ninguno.
    const MAX_FILAS = 60;
    findings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = findings.length;
    const pendientes = Math.max(0, total - MAX_FILAS);
    if (pendientes > 0) findings.length = MAX_FILAS;

    // RELECTURA ANTES DE MANDAR. Todo lo de arriba se arma con una foto que se
    // sacó al empezar la corrida; entre esa foto y el envío, el propio cruce
    // puede haber enganchado la factura con su venta. Pasó el 25/8/2026: la
    // factura de Gonzalez Victoria entró 08:31, enganchó 08:35, y el aviso
    // salió igual gritando "SIN VENTA" de algo que estuvo huérfano cuatro
    // minutos. Un aviso que llega resuelto entrena a ignorarlos, que es peor
    // que no mandarlo. Se relee el estado y se caen los resueltos.
    const ids = findings.map((f: any) => f.id).filter(Boolean);
    const vigentes = await prisma.labCostEntry.findMany({
        where: { id: { in: ids }, status: 'UNMATCHED', orderId: null },
        select: { id: true },
    }).catch(() => null);
    // FAIL-CLOSED: si la relectura no se pudo hacer, el aviso NO sale esta
    // corrida (mañana lo manda si sigue vigente). Con un catch permisivo, un
    // error transitorio de base dejaba pasar la foto vieja y el mail acusaba
    // "SIN VENTA" a ventas cargadas — pasó el 27/8/2026 con dos pedidos
    // matcheados hacía días.
    if (!vigentes) {
        console.error('[LabCost] No se pudo releer el estado antes del aviso: se omite el email de esta corrida.');
        return { alerted: 0, omitidoPorRelecturaFallida: true };
    }
    const sigueSinVenta = new Set(vigentes.map(e => e.id));
    const resueltos = findings.filter((f: any) => !sigueSinVenta.has(f.id));
    if (resueltos.length) {
        console.log(`[LabCost] ${resueltos.length} pedido(s) se engancharon mientras se armaba el aviso: no se avisan (${resueltos.map((f: any) => f.labOrderNumber).join(', ')})`);
        findings = findings.filter((f: any) => sigueSinVenta.has(f.id));
    }

    // ÚLTIMA BARRERA, contra TODA la clase de error: antes de acusar "SIN
    // VENTA", buscar cada número directamente en las VENTAS. Si una venta no
    // borrada ya tiene ese nº de operación, el pedido NO es huérfano — sea cual
    // sea el estado (viejo o corrupto) de la entrada de costo. El matcheo real
    // lo hace la próxima pasada; acá solo se evita el falso grito. (Origen:
    // 27/8/2026, mail acusando a 3581791 y 3578632 con ambas ventas cargadas.)
    if (findings.length > 0) {
        const numeros = findings.map((f: any) => String(f.labOrderNumber || '').trim()).filter(n => n.length >= 4);
        const ventasConNumero = numeros.length > 0
            ? await prisma.order.findMany({
                where: { isDeleted: false, OR: numeros.map(n => ({ labOrderNumber: { contains: n } })) },
                select: { labOrderNumber: true },
            }).catch(() => null)
            : [];
        if (ventasConNumero === null) {
            console.error('[LabCost] No se pudo verificar los números contra Ventas: se omite el email de esta corrida.');
            return { alerted: 0, omitidoPorRelecturaFallida: true };
        }
        const numsEnVentas = new Set((ventasConNumero as any[]).flatMap(o => String(o.labOrderNumber || '').match(/\d{4,}/g) || []));
        const conVenta = findings.filter((f: any) => numsEnVentas.has(String(f.labOrderNumber || '').trim()));
        if (conVenta.length) {
            console.warn(`[LabCost] ${conVenta.length} pedido(s) tienen su venta cargada aunque la entrada figure huérfana — NO se avisan y quedan para el rematch: ${conVenta.map((f: any) => f.labOrderNumber).join(', ')}`);
            findings = findings.filter((f: any) => !numsEnVentas.has(String(f.labOrderNumber || '').trim()));
        }
    }
    if (findings.length === 0) return { alerted: 0, resueltosAntesDeAvisar: resueltos.length };

    const appUrl = appUrlFn();
    const fmt = fmtARS;
    const LABS = LAB_LABELS;
    const BADGE: Record<string, string> = {
        POSTVENTA: 'background:#dbeafe;color:#1d4ed8',
        VENTA_SMARTLAB: 'background:#dbeafe;color:#1d4ed8',
        VENTA_SIN_NUMERO: 'background:#fef3c7;color:#92400e',
        DUDOSO: 'background:#fee2e2;color:#b91c1c;font-weight:bold',
    };
    // TODA fila lleva SIEMPRE las tres claves con las que se reclama al lab:
    // nº de operación, comprobante y fecha. Cuando la factura NO trae nº de
    // pedido (Optovision factura remitos y reprocesos sin él), se dice así.
    const ES_PEDIDO = /^\d{5,}$/;
    const faltante = (texto: string) => `<span style="color:#b91c1c">${texto}</span>`;
    const comprobanteDe = (f: any): string | null => {
        const m = String(f.labOrderNumber || '').match(/\d{4}-\d{4,8}/)
            || String(f.sourceFile || '').match(/\d{4}-\d{4,8}/);
        if (m) return m[0];
        return f.sourceFile ? String(f.sourceFile).replace(/\.pdf$/i, '') : null;
    };
    const rows = findings.map((f, i) => {
        // "Sin venta" es la acusación grave; una factura que llegó SIN nº de
        // pedido no es eso — la venta suele estar cargada y falta el dato.
        const etiqueta = etiquetaSinVenta(f.labOrderNumber).label.toUpperCase();
        const delPortal = labPortalClientName(f.notes);
        const nroOperacion = ES_PEDIDO.test(String(f.labOrderNumber || '').trim())
            ? String(f.labOrderNumber).trim()
            : faltante('la factura no trae nº');
        const comprobante = comprobanteDe(f) || faltante('sin comprobante');
        // La fecha de ingreso que manda el portal vale más que el alta en el
        // sistema: es cuándo entró el trabajo al laboratorio. El portal escribe
        // dos formatos: "ingreso 2026-07-28 16:06" y "ingreso 13-07-26 09:52".
        const iso = (f.notes || '').match(/ingreso (\d{4})-(\d{2})-(\d{2})/);
        const ar = (f.notes || '').match(/ingreso (\d{2})-(\d{2})-(\d{2})\b/);
        const ingresoPortal = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : ar ? `${ar[1]}/${ar[2]}/20${ar[3]}` : null;
        const fecha = f.invoiceDate
            ? fmtFecha(f.invoiceDate)
            : ingresoPortal
                ? `${ingresoPortal} <span style="color:#6b7280">(ingreso)</span>`
                : `${fmtFecha(f.createdAt)} <span style="color:#6b7280">(alta)</span>`;
        const real = f.lab === 'OPTOVISION' ? (f.billedTotal ?? f.billedNet) : (f.billedNet ?? f.billedTotal);
        const t: any = triage.get(f.id);
        const pista = t
            ? `<span style="padding:2px 8px;border-radius:10px;${BADGE[t.tipo] || ''}">${t.detalle}</span>${t.clientId ? ` <a href="${appUrl}/admin/contactos?clientId=${t.clientId}">ver ficha</a>` : ''}`
            : (f.notes || '—');
        return `<tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
            <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${nroOperacion}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${comprobante}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;white-space:nowrap">${fecha}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb">${LABS[f.lab] || f.lab}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb">${delPortal
                ? `<span style="color:#b45309">${delPortal}</span><br><span style="font-size:11px;color:#6b7280">nombre del portal</span>`
                : '<span style="color:#b91c1c">sin nombre</span>'}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${fmt(real)}</td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb"><span style="color:#b91c1c;font-weight:bold">${etiqueta}</span></td>
            <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${pista}</td>
        </tr>`;
    }).join('');

    const res: any = await sendEmail({
        to: adminInbox(),
        subject: `🚨 ${findings.length} pedido(s) de laboratorio SIN VENTA en el sistema`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#1f2937">
                <h2 style="color:#b91c1c">🚨 Pedidos de laboratorio sin venta que los respalde</h2>
                <p>Aparecieron <strong>${findings.length}</strong> pedido(s) facturados por el laboratorio que no tienen ninguna venta ni postventa que los respalde. Conviene resolverlos hoy: asignarle el número a la venta que corresponda, vincularlo a un caso de postventa, o reclamárselo al laboratorio. Si ya está tratado, marcalo <strong>resuelto</strong> en la pantalla y no vuelve a salir.</p>
                ${pendientes > 0 ? `<p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px 12px;font-size:13px">Aparecieron <strong>${total}</strong> en total: acá van los <strong>${MAX_FILAS} más nuevos</strong> y los otros <strong>${pendientes}</strong> salen mañana (no se pierde ninguno). Están todos en <a href="${appUrl}/admin/laboratorio/costos?estado=UNMATCHED">la pantalla de conciliación</a>.</p>` : ''}
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#111827;color:#fff">
                        <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Comprobante</th>
                        <th style="padding:8px;text-align:left">Fecha</th><th style="padding:8px;text-align:left">Lab</th>
                        <th style="padding:8px;text-align:left">Cargado en el portal</th><th style="padding:8px;text-align:right">Importe</th>
                        <th style="padding:8px;text-align:left">Estado</th><th style="padding:8px;text-align:left">Pista</th>
                    </tr>${rows}
                </table>
                <p style="margin-top:14px"><a href="${appUrl}/admin/laboratorio/costos?estado=UNMATCHED">Ver los pedidos sin venta en el CRM</a></p>
            </div>
        `,
    });
    // sendEmail NUNCA lanza: devuelve { success:false } si el envío falló.
    // Marcar como alertado un hallazgo cuyo email no salió lo silenciaría
    // para siempre — solo se marca lo que efectivamente se avisó.
    if (!res?.success) {
        console.error('[LabCost] alertNewFindings: el email NO salió; se reintenta mañana.');
        return { alerted: 0, failed: findings.length };
    }
    await prisma.labCostEntry.updateMany({
        where: { id: { in: findings.map((f: any) => f.id) } },
        data: { alertedAt: new Date(), alertedStatus: 'UNMATCHED' },
    }).catch(err => console.error('[LabCost] Error marcando hallazgos alertados:', err));
    return {
        alerted: findings.length,
        ...(pendientes > 0 ? { pendientes } : {}),
        ...(viejos.length ? { viejos: viejos.length } : {}),
    };
}
