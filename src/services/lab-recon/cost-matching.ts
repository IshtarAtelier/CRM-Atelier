import { prisma } from '../../lib/db';
import { RESOLUCIONES_CONOCIDAS } from '../lab-providers/resoluciones';
import { isQuietLab } from './backfill';
import { sendChargedReworkAlert } from './alerts';
import { completePostSaleCost } from './order-status';
import { LabCostInput, LabName, LAB_ITEM_PATTERNS, TOLERANCE } from './types';

/**
 * EL NÚCLEO DEL CRUCE: registra el costo que facturó un laboratorio por un nº de
 * pedido y lo compara contra el costo cargado en el CRM.
 *
 * Reglas del negocio que viven acá:
 *  - Los cristales se cargan POR PAR, pero la venta guarda DOS ítems (un ojo cada
 *    uno) con el snapshot del par completo → cada ítem con ojo cuenta la MITAD.
 *  - Una venta puede tener varios pedidos de lab (2x1): la comparación es a
 *    NIVEL VENTA y espera a que TODAS sus operaciones estén facturadas.
 *  - Un pedido facturado sin venta ni postventa que lo respalde es un HUÉRFANO.
 *  - Los reprocesos de postventa quedan FUERA del cruce de costo (comparar una
 *    garantía de ~$0 contra el costo del par daría un falso ahorro).
 */

/**
 * Costo de sistema de una orden para un laboratorio dado: suma solo los ítems
 * de ese lab (snapshot primero, costo vivo como fallback). Si ningún ítem
 * matchea el lab, cae a los ítems de categoría Cristal; si tampoco, a todos.
 *
 * REGLA POR PAR: el costo de los cristales se carga POR PAR (ambos ojos) en
 * el producto, pero la venta los guarda como DOS ítems (eye OD/OI), cada uno
 * con el snapshot del par completo. Por eso cada ítem con ojo cuenta la MITAD
 * — así el total de la venta es un solo par, igual que factura el lab
 * (2 líneas de 0.50 × unitario por par). Un solo ojo vendido = medio par.
 */
export function systemCostForLab(order: any, lab: string): number {
    const items: any[] = order.items || [];
    if (items.length === 0) return 0;

    const pattern = LAB_ITEM_PATTERNS[lab];
    const labOf = (item: any) => item.laboratorySnapshot || item.product?.laboratory || '';
    const categoryOf = (item: any) => item.productCategorySnapshot || item.product?.category || '';

    let relevant = pattern ? items.filter(i => pattern.test(labOf(i))) : [];
    if (relevant.length === 0) relevant = items.filter(i => /cristal/i.test(categoryOf(i)));
    if (relevant.length === 0) relevant = items;

    // En una venta 2x1 el par gratis (cristal con price 0) le cuesta al lab SOLO el
    // calibrado, no el costo de lista del cristal. Contarlo entero infla el systemCost
    // y enmascara un sobrecosto real. Mismo criterio que report.service.
    const is2x1 = (order.appliedPromoName || '').toLowerCase().includes('2x1')
        || items.some((i: any) => /cristal/i.test(categoryOf(i)) && i.price === 0);
    const CALIBRADO_COST = 15000 * 1.21; // fallback calibrado + IVA (igual que report.service)

    return relevant.reduce((total, item) => {
        const perEyeHalf = item.eye ? 0.5 : 1;
        const isCrystal = /cristal/i.test(categoryOf(item));
        if (is2x1 && isCrystal && item.price === 0) {
            return total + CALIBRADO_COST * perEyeHalf * (item.quantity || 1);
        }
        const cost = item.productCostSnapshot ?? item.product?.cost ?? 0;
        return total + cost * perEyeHalf * (item.quantity || 1);
    }, 0);
}


/**
 * Registra (o actualiza) el costo facturado por el lab para un nº de pedido,
 * lo cruza contra la orden del CRM y dispara alerta si hay sobrecosto nuevo.
 * Devuelve la entrada resultante.
 */
export async function upsertEntry(input: LabCostInput) {
    const cleanNumber = input.claveLiteral
        ? input.labOrderNumber.trim()
        : (input.labOrderNumber.match(/\d{4,}/) || [input.labOrderNumber.trim()])[0];
    if (!cleanNumber) return null;

    // Backfill pendiente para este lab → modo silencioso (ver arriba).
    const quiet = await isQuietLab(String(input.lab));

    // Buscar la venta cuyo labOrderNumber contiene ese número (o un caso de
    // postventa que generó un pedido nuevo con ese número).
    const candidatos = await prisma.order.findMany({
        where: {
            isDeleted: false,
            OR: [
                { labOrderNumber: { contains: cleanNumber } },
                { postSaleCases: { some: { newOrderNumber: { contains: cleanNumber } } } },
            ],
        },
        include: {
            client: { select: { name: true } },
            items: { include: { product: { select: { name: true, cost: true, laboratory: true, category: true } } } },
            postSaleCases: {
                select: { id: true, newOrderNumber: true, caseType: true, coverage: true, fault: true, cost: true },
                orderBy: { createdAt: 'desc' as const },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    // El `contains` puede matchear por SUBSTRING (p. ej. "12345" dentro de
    // "612345", o un nº de otro lab): quedarse con el candidato cuyo número
    // sea EXACTAMENTE uno de los pedidos de la venta — y recién si no hay,
    // con el que matchee exacto por caso de postventa. Mirar TODOS los
    // candidatos: con uno solo, una venta más nueva que matchea por substring
    // eclipsaba a la venta correcta. Sin match exacto → huérfano (mejor un
    // huérfano visible que colgar la factura de la venta equivocada).
    const numbersOf = (s: string | null | undefined): string[] => s?.match(/\d{4,}/g) || [];
    const order =
        candidatos.find(o => numbersOf(o.labOrderNumber).includes(cleanNumber))
        ?? candidatos.find(o => o.postSaleCases?.some((c: any) => numbersOf(c.newOrderNumber).includes(cleanNumber)))
        ?? null;

    // ¿El número matcheó por POSTVENTA (reproceso) y no por la venta original?
    const pvCase = order?.postSaleCases?.find((c: any) => numbersOf(c.newOrderNumber).includes(cleanNumber)) || null;

    const existing = await prisma.labCostEntry.findUnique({
        where: { lab_labOrderNumber: { lab: input.lab, labOrderNumber: cleanNumber } },
    });

    // Una fuente sin importes (p. ej. el barrido del portal) NUNCA debe pisar
    // la facturación ya registrada por otra fuente (planilla, PDF de email).
    const hasNewBilling = input.billedNet != null || input.billedTotal != null;
    const keepExistingBilling = !hasNewBilling && !!existing
        && (existing.billedNet !== null || existing.billedTotal !== null);

    // Y al revés: el pase RÁPIDO (ventana corta) no pisa importes registrados
    // por una pasada completa — su reparto de líneas se calcula con menos
    // comprobantes y "corregiría" para atrás (ping-pong de estados y re-alertas).
    const preferExisting = keepExistingBilling ||
        (!!input.preferExistingBilling && !!existing && (existing.billedNet !== null || existing.billedTotal !== null));

    const billedNet = preferExisting ? existing!.billedNet : (input.billedNet ?? null);
    const billedTotal = preferExisting ? existing!.billedTotal : (input.billedTotal ?? null);
    const source = preferExisting ? existing!.source : input.source;
    const sourceFile = preferExisting
        ? existing!.sourceFile
        : (input.sourceFile ?? existing?.sourceFile ?? null);
    // La fecha de factura nunca se borra: la nueva si viene, si no la que había.
    const invoiceDate = preferExisting
        ? (existing!.invoiceDate ?? input.invoiceDate ?? null)
        : (input.invoiceDate ?? existing?.invoiceDate ?? null);

    // Comparable por laboratorio: Optovision discrimina IVA y Atelier es
    // monotributo (no lo recupera) → el costo real es el TOTAL c/IVA.
    // Grupo Óptico factura a consumidor final → neto y total coinciden.
    const billedComparable = input.lab === 'OPTOVISION'
        ? (billedTotal ?? billedNet ?? null)
        : (billedNet ?? billedTotal ?? null);
    const systemCost = order ? systemCostForLab(order, input.lab) : null;

    // Una venta puede tener varios pedidos de lab ("580841-580844", típico en
    // 2x1: el lab cobra un par real y el otro ~$0). El costo sistema es de TODA
    // la venta, así que la comparación debe ser a NIVEL VENTA: sumar las
    // facturas de TODOS sus pedidos (cada uno buscado individualmente), no la
    // de un solo pedido. Si a algún pedido de la venta le falta factura, la
    // venta está incompleta → PENDING (no un falso ahorro/sobrecosto).
    const orderNumbers = numbersOf(order?.labOrderNumber);
    const multiPedido = orderNumbers.length > 1;

    // Entrada de POSTVENTA pura: matcheó por un caso de postventa y su número
    // NO es uno de los pedidos de la venta original. Un reproceso NO entra en
    // el cruce de costo de la venta (compararía la garantía de ~$0 contra el
    // costo del par completo → falso "a favor" en cada reproceso). Su auditoría
    // es sendChargedReworkAlert: si el reproceso vino CON cargo, alerta.
    const pvEntry = !!pvCase && !orderNumbers.includes(cleanNumber);

    // Comparable a nivel venta: importe de este pedido + el de sus hermanos ya
    // registrados (misma venta, otro nº DE LA VENTA — las entradas de postventa
    // que comparten orderId no cuentan como pedidos de la venta). Y cuántos
    // pedidos de la venta ya tienen factura, para saber si está completa.
    const billedForLab = (e: { billedNet: number | null; billedTotal: number | null }) =>
        input.lab === 'OPTOVISION' ? (e.billedTotal ?? e.billedNet ?? null) : (e.billedNet ?? e.billedTotal ?? null);
    let saleBilled = billedComparable;
    let facturadosEnVenta = billedComparable !== null ? 1 : 0;
    // Principal de la venta = pedido de mayor importe facturado; a igualdad,
    // el nº de pedido menor. Garantiza EXACTAMENTE un principal (una sola
    // alerta por venta), tanto si el 2º par va gratis como si se cobra igual.
    const myBilled = billedComparable ?? 0;
    let isPrimaryOfSale = true;
    if (multiPedido && order && !pvEntry) {
        const siblings = await prisma.labCostEntry.findMany({
            where: {
                orderId: order.id,
                labOrderNumber: { in: orderNumbers.filter(n => n !== cleanNumber) },
            },
            select: { labOrderNumber: true, billedNet: true, billedTotal: true },
        });
        for (const s of siblings) {
            const b = billedForLab(s);
            if (b !== null) { saleBilled = (saleBilled ?? 0) + b; facturadosEnVenta++; }
            const sb = b ?? 0;
            if (sb > myBilled || (sb === myBilled && s.labOrderNumber < cleanNumber)) isPrimaryOfSale = false;
        }
    }
    const ventaCompleta = !multiPedido || facturadosEnVenta >= orderNumbers.length;

    // UNMATCHED = sin venta en el sistema (¡pedido huérfano si vino del portal!)
    // PENDING   = con venta pero sin todas las facturas de la venta todavía
    let status = 'UNMATCHED';
    let difference: number | null = null;
    if (order && pvEntry) {
        // Reproceso: fuera del cruce de costo. PENDING hasta que llegue su
        // importe; con importe queda OK (la alerta de reproceso cobrado corre
        // aparte, más abajo).
        status = billedComparable === null ? 'PENDING' : 'OK';
    } else if (order && (billedComparable === null || !ventaCompleta)) {
        status = 'PENDING';
    } else if (order && saleBilled !== null && systemCost !== null) {
        difference = saleBilled - systemCost;
        if (difference > TOLERANCE) status = 'OVERCOST';
        else if (difference < -TOLERANCE) status = 'UNDERCOST';
        else status = 'OK';
    }

    // Conservar las notas existentes (p. ej. la del portal) cuando la
    // actualización no trae nota propia, y no duplicar la de multi-pedido.
    const baseNotes = input.notes ?? existing?.notes ?? null;
    const multiNote = multiPedido && !baseNotes?.includes('pedidos de lab')
        ? `La venta tiene ${orderNumbers.length} pedidos de lab (${order!.labOrderNumber}); el costo sistema es el total de la venta.`
        : null;
    // Resolución conocida del administrador (p. ej. "COSTO VENDEDOR"): queda
    // fija en el detalle de la entrada, venga de la fuente que venga.
    const resolucion = RESOLUCIONES_CONOCIDAS[cleanNumber];
    const resolucionNote = resolucion && !baseNotes?.includes('RESUELTO') ? resolucion : null;
    const pvNote = pvCase && !baseNotes?.includes('POSTVENTA (caso')
        ? `Pedido de POSTVENTA (caso ${pvCase.caseType || 's/tipo'}${pvCase.coverage ? `, cobertura: ${pvCase.coverage}` : ''}).`
        : null;
    // El marcador de "reproceso cobrado ya avisado" sobrevive a los rearmados
    // de notas (el proveedor manda su nota en cada corrida y la pisaría —
    // perdiendo el dedupe y reenviando la alerta en cada pasada).
    const reworkMark = existing?.notes?.includes('[Reproceso cobrado avisado]') && !baseNotes?.includes('[Reproceso cobrado avisado]')
        ? '[Reproceso cobrado avisado]' : null;
    const notes = [resolucionNote, pvNote, baseNotes, multiNote, reworkMark].filter(Boolean).join(' ') || null;

    const data = {
        orderId: order?.id ?? null,
        // Un reproceso no participa del cruce de costo de la venta: mostrar el
        // costo del sistema ahí sería comparar peras con garantías.
        systemCost: pvEntry ? null : systemCost,
        billedNet,
        billedTotal,
        difference,
        source,
        sourceFile,
        invoiceDate,
        status,
        notes,
        // Backfill: todo lo histórico queda marcado como ya alertado, así el
        // régimen normal solo avisa lo NUEVO desde el estreno del sistema.
        ...(quiet ? { alertedAt: new Date(), alertedStatus: status } : {}),
        // Transición SIN novedad para el administrador: un pedido que deja de
        // ser un hallazgo (pasa a OK o vuelve a esperar factura) no necesita
        // aviso — pero SÍ hay que realinear alertedStatus, si no queda como
        // "pendiente de avisar" para siempre y un cambio de criterio futuro
        // (o un recálculo masivo) lo vuelca todo junto en un resumen gigante.
        ...(!quiet && existing?.alertedAt && (status === 'OK' || status === 'PENDING')
            ? { alertedStatus: status }
            : {}),
    };

    const entry = existing
        ? await prisma.labCostEntry.update({ where: { id: existing.id }, data })
        : await prisma.labCostEntry.create({
            data: { lab: input.lab, labOrderNumber: cleanNumber, ...data },
        });

    // Comparable del importe previo con el MISMO criterio por lab que el nuevo
    // (para Optovision total-c/IVA-primero): comparar neto viejo contra total
    // nuevo hacía que "cambió el importe" diera true en cada corrida.
    const prevBilled = existing ? billedForLab(existing) : null;
    // "Llegó la factura": el pedido no tenía importe y ahora sí.
    const facturaRecienLlegada = billedComparable !== null && prevBilled === null;

    // Emails de diferencia de costo: SOLO montos gruesos (regla del
    // administrador). La factura de Optovision que coincide o difiere poco
    // ya no avisa — queda en la página de conciliación; alerta únicamente
    // cuando la diferencia (en cualquier dirección) supera ALERT_MIN_DIFF.
    // Los reprocesos (pvEntry) no entran acá: su auditoría es la alerta de
    // reproceso cobrado, más abajo. Al avisar una venta multi-pedido se marcan
    // también sus hermanos con el MISMO estado a nivel venta: el hallazgo es
    // uno solo — sin esto, el par $0 del 2x1 reaparecía después como fila
    // suelta en el barrido (email duplicado por la misma venta).
    // SIN EMAIL POR CADA FACTURA (cambio pedido por el administrador el 22/7):
    // las facturas que llegan y las diferencias de costo YA NO avisan de a una
    // — la entrada queda sin marcar y la junta el RESUMEN DIARIO
    // (alertNewFindings({ modo: 'diario' })). Lo único que sigue avisando en el
    // momento son los pedidos SIN VENTA, que son los que hay que resolver ya.
    // En el backfill inicial las entradas se estampan como vistas (quiet), así
    // que el histórico tampoco entra al primer resumen.
    if (quiet) {
        if (multiPedido && order) {
            await prisma.labCostEntry.updateMany({
                where: { lab: input.lab, orderId: order.id, labOrderNumber: { in: orderNumbers } },
                data: { alertedAt: new Date(), alertedStatus: status },
            }).catch(err => console.error('[LabCost] Error marcando hermanos de la venta:', err));
        }
    }

    // Auditoría de POSTVENTA: un reproceso debería venir sin cargo (garantía;
    // Optovision los factura a ~$0). Si el pedido nació de un caso de postventa
    // y la factura trae plata, avisa EN EL MOMENTO con el caso completo — es
    // plata a reclamarle al laboratorio y no puede esperar al resumen del día
    // (excepción confirmada por el administrador el 22/7, junto con los
    // pedidos sin venta). El marcador en la nota hace el aviso persistente: si
    // el email falla se reintenta en la próxima corrida, y una vez enviado no
    // se repite nunca; además deja la marca visible en la pantalla.
    const REWORK_MARK = '⚠️ REPROCESO DE GARANTÍA FACTURADO CON CARGO';
    if (pvCase && order && billedComparable !== null && billedComparable > 5000
        && !(entry.notes || '').includes(REWORK_MARK)) {
        const marcar = () => prisma.labCostEntry.update({
            where: { id: entry.id },
            data: { notes: `${REWORK_MARK}. ${entry.notes || ''}`.trim() },
        }).catch(err => console.error('[LabCost] Error estampando aviso de reproceso:', err));

        if (quiet) {
            // Backfill: el reproceso histórico queda marcado sin avisar.
            await marcar();
        } else {
            const ok = await sendChargedReworkAlert(entry, order, pvCase, billedComparable)
                .catch(err => { console.error('[LabCost] Error enviando alerta de reproceso cobrado:', err); return false; });
            if (ok) await marcar();
        }
    }

    // COSTO DEL CASO DE POSTVENTA: con la factura del lab ya se conoce el
    // costo real del caso → se completa el campo Costo del caso (sin pisar
    // lo cargado a mano), se deja nota firmada en el caso y se le avisa por
    // email al vendedor que lo cargó, con copia a Ishtar. Solo cuando el
    // importe RECIÉN llega (así lo histórico pre-feature no dispara nada) y
    // fuera del backfill. Vale para ambos labs.
    if (pvCase && order && billedComparable !== null && facturaRecienLlegada && !quiet) {
        await completePostSaleCost(entry, order, pvCase, billedComparable, cleanNumber)
            .catch(err => console.error('[LabCost] Error completando costo de postventa:', err));
    }

    // FACTURA = PEDIDO MÁS CERCA (regla del negocio, corregida por el
    // administrador): cuando Optovision factura, al pedido todavía le faltan
    // ~5 días hábiles para estar terminado — NO está listo. Acá solo se
    // adelanta el estado a "Procesado" (IN_PROGRESS) si venía más atrás; la
    // promoción a FINISHED (con su notificación LAB_READY y el circuito de
    // retiro) la hace promoteFinishedOptovision() recién cuando pasaron los
    // 5 días hábiles desde la factura. Guardas: solo cuando la factura RECIÉN
    // llega (persistente vía el importe guardado), sin reprocesos, sin backfill.
    if (input.lab === 'OPTOVISION' && order && !pvEntry && facturaRecienLlegada && !quiet) {
        const previa = order.labStatus || 'NONE';
        if (previa === 'NONE' || previa === 'SENT') {
            await prisma.order.update({ where: { id: order.id }, data: { labStatus: 'IN_PROGRESS' } })
                .catch(err => console.error('[LabCost] Error adelantando pedido Optovision a Procesado:', err));
        }
    }

    return entry;
}


/**
 * Re-cruza las entradas que pueden cambiar de estado en una segunda pasada,
 * reutilizando los montos ya guardados:
 *  - UNMATCHED: la factura llegó antes de cargar el nº de pedido en la venta.
 *  - PENDING: ventas multi-pedido (2x1) donde al procesar el 1er pedido el
 *    hermano aún no existía; ahora que están todos, el estado a nivel venta
 *    (OK/OVERCOST/UNDERCOST) queda correcto.
 */
export async function recheckUnmatched() {
    const pendientes = await prisma.labCostEntry.findMany({
        where: { status: { in: ['UNMATCHED', 'PENDING'] } },
    });
    let rematched = 0;
    for (const entry of pendientes) {
        const updated = await upsertEntry({
            lab: entry.lab,
            labOrderNumber: entry.labOrderNumber,
            billedNet: entry.billedNet,
            billedTotal: entry.billedTotal,
            source: entry.source as LabCostInput['source'],
            sourceFile: entry.sourceFile,
            invoiceDate: entry.invoiceDate,
            notes: entry.notes,
        });
        if (updated && updated.status !== entry.status) rematched++;
    }
    return { checked: pendientes.length, rematched };
}


/**
 * Registra pedidos vistos en el portal del laboratorio que no corresponden
 * a ninguna venta del sistema (pedidos huérfanos: plata gastada en el lab
 * sin venta que la respalde). Si la venta aparece después, el re-cruce
 * diario los pasa a PENDING automáticamente.
 */
export async function registerPortalOrphans(
    lab: LabName | string,
    portalOrders: { num: string; client?: string; date?: string }[]
) {
    let registered = 0;
    for (const po of portalOrders) {
        const clean = (po.num.match(/\d{4,}/) || [])[0];
        if (!clean) continue;
        const detail = [po.client, po.date && `ingreso ${po.date}`].filter(Boolean).join(', ');
        const entry = await upsertEntry({
            lab,
            labOrderNumber: clean,
            billedNet: null,
            billedTotal: null,
            source: 'SCRAPER',
            notes: `Pedido visto en el portal del laboratorio${detail ? ` (${detail})` : ''}.`,
        });
        if (entry) registered++;
    }
    return registered;
}

