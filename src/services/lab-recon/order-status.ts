import { prisma } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { logAudit } from '../../lib/audit';
import { backfillKey, emailsEnabled } from './backfill';
import { OPTOVISION_DIAS_FACTURA_A_LISTO, LAB_LABELS, billedForLab, adminInbox } from './types';

/**
 * ESTADO DEL PEDIDO en el laboratorio y costo del caso de postventa: lo que la
 * conciliación le devuelve al circuito operativo del CRM.
 *
 * Regla del negocio (corregida por el administrador el 22/7/2026): la factura
 * de Optovision NO significa que el pedido esté listo — le faltan unos días
 * hábiles. Por eso acá no se marca nada como terminado: a los 5 días hábiles se
 * genera una notificación de "corroborar con el laboratorio" y el estado lo
 * cambia una persona.
 */

/**
 * Aviso de CORROBORACIÓN para pedidos de Optovision facturados (regla del
 * administrador): la factura llega unos días hábiles antes de que el pedido
 * esté terminado. Cuando (a) TODAS las operaciones de la venta tienen factura
 * y (b) la última factura ya tiene 5+ días hábiles, el pedido YA DEBERÍA
 * estar terminado — pero NO se marca solo: se genera una notificación
 * "corroborar con el laboratorio" (tipo LAB_CHECK, una sola vez por venta) y
 * el estado lo cambia un humano cuando confirma. Corre en cada pase (10 min
 * y diario). Garantías anti-retroactivo: solo entradas creadas DESPUÉS del
 * backfill inicial de Optovision; FINISHED/READY/DELIVERED no se tocan.
 */
export async function promoteFinishedOptovision() {
    const flag = await prisma.systemSetting.findUnique({
        where: { key: backfillKey('OPTOVISION') },
    });
    if (!flag?.value) return { promoted: 0, reason: 'backfill_pendiente' };
    const backfillAt = new Date(flag.value);
    if (isNaN(backfillAt.getTime())) return { promoted: 0, reason: 'flag_invalido' };

    // Candidatas: entradas post-backfill, con venta y con importe.
    const entradas = await prisma.labCostEntry.findMany({
        where: {
            lab: 'OPTOVISION',
            createdAt: { gt: backfillAt },
            orderId: { not: null },
            OR: [{ billedTotal: { not: null } }, { billedNet: { not: null } }],
            order: { is: { isDeleted: false, labStatus: { in: ['NONE', 'SENT', 'IN_PROGRESS'] } } },
        },
        include: {
            order: {
                select: {
                    id: true, labStatus: true, labOrderNumber: true,
                    client: { select: { name: true } },
                },
            },
        },
    });
    if (entradas.length === 0) return { promoted: 0 };

    // Días hábiles (lun-vie) COMPLETOS transcurridos desde una fecha.
    const habilesDesde = (desde: Date): number => {
        let count = 0;
        const d = new Date(desde);
        d.setHours(0, 0, 0, 0);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        while (d < hoy) {
            d.setDate(d.getDate() + 1);
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) count++;
        }
        return count;
    };

    const porVenta = new Map<string, typeof entradas>();
    for (const e of entradas) {
        if (!porVenta.has(e.orderId!)) porVenta.set(e.orderId!, []);
        porVenta.get(e.orderId!)!.push(e);
    }

    let promoted = 0;
    for (const [orderId, grupo] of porVenta) {
        const order = grupo[0].order!;
        const nums = order.labOrderNumber?.match(/\d{4,}/g) || [];
        if (nums.length === 0) continue;

        // TODAS las operaciones de la venta tienen que estar facturadas (las
        // entradas pueden ser pre o post backfill: mirar la DB completa).
        const todas = await prisma.labCostEntry.findMany({
            where: { lab: 'OPTOVISION', orderId, labOrderNumber: { in: nums } },
            select: { labOrderNumber: true, billedNet: true, billedTotal: true, invoiceDate: true, createdAt: true },
        });
        const facturadas = todas.filter(t => t.billedTotal !== null || t.billedNet !== null);
        if (facturadas.length < nums.length) continue;

        // 5+ días hábiles desde la ÚLTIMA factura de la venta (fecha del email
        // de la factura; si no la hay, cuándo la registramos).
        const ultima = Math.max(...facturadas.map(t => (t.invoiceDate ?? t.createdAt).getTime()));
        if (habilesDesde(new Date(ultima)) < OPTOVISION_DIAS_FACTURA_A_LISTO) continue;

        // Una sola vez por venta: si ya existe el aviso de corroboración
        // (pendiente o resuelto), no se repite.
        const yaAvisado = await prisma.notification.findFirst({
            where: { type: 'LAB_CHECK', orderId },
            select: { id: true },
        });
        if (yaAvisado) continue;

        await prisma.notification.create({
            data: {
                type: 'LAB_CHECK',
                message: `🔎 Optovision: facturado hace 5+ días hábiles — YA DEBERÍA ESTAR TERMINADO. Corroborar con el laboratorio y actualizar el estado — ${order.client?.name ?? 'cliente'} (${nums.join(', ')})`,
                orderId,
                requestedBy: 'Conciliación Optovision',
                status: 'PENDING',
            },
        })
            .then(() => { promoted++; })
            .catch(err => console.error('[LabCost] Error creando aviso de corroboración Optovision:', err));
    }
    if (promoted > 0) console.log(`[LabCost] ${promoted} aviso(s) de corroboración Optovision creados (facturado hace 5+ días hábiles).`);
    return { promoted };
}


/** Marcador persistente: el costo de este caso YA se cerró e informó. Vive en
 *  la nota del caso (mismo patrón que la alerta de reproceso cobrado), así que
 *  se redacta como una frase que le sirve a quien lee el caso, no como una
 *  etiqueta técnica. */
const COSTO_MARK = 'Costo del caso cerrado por la conciliación de laboratorio.';

/**
 * Completa el costo del caso de postventa con lo que facturó el lab, deja
 * nota firmada en el caso y avisa por email al administrador. Reglas: un costo
 * cargado a mano NO se pisa (la nota deja asentada la diferencia), y $0 también
 * informa (garantía sin cargo).
 *
 * SE AVISA UNA SOLA VEZ, Y RECIÉN CUANDO EL COSTO ESTÁ CERRADO (corrección del
 * administrador del 1/8/2026). Antes este aviso salía en loop y con un costo
 * que todavía no era el final. Dos causas, las dos arregladas acá:
 *
 *  1. UN CASO PUEDE TENER VARIAS OPERACIONES: cuando se rehacen los dos pares
 *     el caso queda con dos números ("80530908 - 80530914") y el lab factura
 *     cada uno por separado. La función corría POR FACTURA, así que informaba
 *     como costo final el de la primera que llegaba, y cuando llegaba la
 *     segunda volvía a avisar (y ya no la sumaba: el caso tenía costo > 0 y lo
 *     trataba como cargado a mano). Ahora el costo del caso es la SUMA de
 *     TODAS sus operaciones y no se toca nada hasta que estén todas facturadas.
 *  2. NO HABÍA MARCADOR DE "YA AVISADO": era el único aviso del módulo que se
 *     apoyaba solo en una condición transitoria (la factura recién llegada).
 *     Cada re-cruce de recheckUnmatched() que volviera a pasar por acá lo
 *     reenviaba. Ahora el aviso deja marca en la nota del caso y no se repite.
 */
export async function completePostSaleCost(order: any, pvCase: any, pedido: string) {
    const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
    const labelDe = (lab: string) => LAB_LABELS[lab] || lab;

    // ¿Ya se informó el costo de este caso? Entonces no se vuelve a tocar ni a
    // avisar nunca más, pase lo que pase con las facturas.
    const yaInformado = await prisma.postSaleNote.findFirst({
        where: { caseId: pvCase.id, content: { contains: COSTO_MARK } },
        select: { id: true },
    });
    if (yaInformado) return;

    // Todas las operaciones del caso (si el caso no tiene números cargados, la
    // que vino: un caso de un solo par se comporta igual que antes).
    const nums = (pvCase.newOrderNumber as string | null)?.match(/\d{4,}/g) || [pedido];
    const entradas = await prisma.labCostEntry.findMany({
        where: { labOrderNumber: { in: nums } },
        select: { lab: true, labOrderNumber: true, orderId: true, billedNet: true, billedTotal: true, sourceFile: true },
    });
    // Un mismo número puede existir en dos labs (la unicidad es por lab+número):
    // gana la entrada que está colgada de ESTA venta.
    const facturadas = new Map<string, { lab: string; monto: number; sourceFile: string | null; propia: boolean }>();
    for (const e of entradas) {
        const monto = billedForLab(e.lab, e);
        if (monto === null) continue;
        const propia = e.orderId === order.id;
        const previa = facturadas.get(e.labOrderNumber);
        if (previa?.propia && !propia) continue;
        facturadas.set(e.labOrderNumber, { lab: e.lab, monto, sourceFile: e.sourceFile, propia });
    }
    const faltan = nums.filter(n => !facturadas.has(n));
    if (faltan.length > 0) {
        // Todavía es un costo parcial: no se carga ni se avisa nada. Lo cierra
        // la factura que falta cuando llegue.
        console.log(`[LabCost] Caso ${pvCase.id}: facturado ${nums.length - faltan.length}/${nums.length} — falta(n) ${faltan.join(', ')}. El costo del caso se completa cuando estén todas.`);
        return;
    }

    const detalle = nums.map(n => ({ pedido: n, ...facturadas.get(n)! }));
    const costo = Math.round(detalle.reduce((a, d) => a + d.monto, 0) * 100) / 100;
    const multi = nums.length > 1;

    // EL VALOR DEL LABORATORIO MANDA (regla del administrador del 2/8/2026). El
    // monto que carga el vendedor es una ESTIMACIÓN: la asigna antes de saber
    // qué va a facturar el lab. Cuando llega la factura de todas las
    // operaciones, ese es el costo real y pisa la estimación — antes se
    // conservaba lo cargado a mano y el caso quedaba con un número que nadie
    // había verificado. La estimación no se pierde: queda en costEstimated y la
    // nota deja asentada la diferencia.
    const estimado = pvCase.cost ?? 0;
    const previoEsEstimacion = pvCase.costSource !== 'LAB';
    const difiere = estimado > 0 && Math.abs(estimado - costo) >= 1;
    await prisma.postSaleCase.update({
        where: { id: pvCase.id },
        data: {
            cost: costo,
            costSource: 'LAB',
            ...(previoEsEstimacion && estimado > 0 ? { costEstimated: estimado } : {}),
        },
    });

    const detalleFactura = multi
        ? `${detalle.map(d => `${labelDe(d.lab)} ${d.pedido}: ${fmt(d.monto)}`).join(' + ')}`
        : `${labelDe(detalle[0].lab)}, pedido ${detalle[0].pedido}${detalle[0].sourceFile ? `, ${detalle[0].sourceFile}` : ''}`;
    const base = costo > 0
        ? `Costo real del caso según el laboratorio: ${fmt(costo)} (${detalleFactura}).`
        : `El laboratorio facturó ${multi ? 'los pedidos' : 'el pedido'} de este caso SIN CARGO (garantía) — ${detalleFactura}.`;
    const content = difiere
        ? `${base} Reemplaza la estimación de ${fmt(estimado)} que se había cargado a mano (diferencia: ${costo > estimado ? '+' : '−'}${fmt(Math.abs(costo - estimado))}).`
        : base;
    // La marca viaja en la nota: es el registro del costo Y el candado que
    // impide que este aviso se repita.
    await prisma.postSaleNote.create({
        data: { caseId: pvCase.id, content: `${content} ${COSTO_MARK}`, createdBy: 'Sistema' },
    });
    logAudit({
        userName: 'Sistema', action: 'UPDATE', entityType: 'ORDER', entityId: order.id,
        details: {
            evento: 'costo_postventa', caseId: pvCase.id, pedidos: nums,
            detalle: detalle.map(d => ({ pedido: d.pedido, lab: d.lab, monto: d.monto })),
            costo, estimado: estimado || null, difiere,
        },
    }).catch(console.error);

    if (!emailsEnabled()) return;
    // AVISO SOLO AL ADMINISTRADOR (decisión del administrador del 1/8/2026): el
    // aviso dejó de ir a la casilla del local. Lo revisa Ishtar y ella decide a
    // qué caja se imputa el costo antes de que el vendedor se entere.
    // Se sigue informando QUIÉN cargó el caso, pero como dato, no como destino.
    const [hist, primeraNota] = await Promise.all([
        prisma.postSaleStatusHistory.findFirst({
            where: { caseId: pvCase.id }, orderBy: { createdAt: 'asc' }, select: { changedBy: true },
        }),
        prisma.postSaleNote.findFirst({
            where: { caseId: pvCase.id, createdBy: { not: 'Sistema' } },
            orderBy: { createdAt: 'asc' }, select: { createdBy: true },
        }),
    ]);
    const cargadoPor = [hist?.changedBy, primeraNota?.createdBy]
        .find(n => n && n !== 'Sistema') || null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
    const listaPedidos = detalle
        .map(d => `<li><strong style="font-family: monospace;">${d.pedido}</strong> (${labelDe(d.lab)}): ${fmt(d.monto)}</li>`)
        .join('');
    // A qué caja va a proponer imputarse: la de quien se equivocó, y si el error
    // no fue de una persona de la óptica lo absorbe Atelier (caja del admin).
    const culpaEsDeLaOptica = pvCase.fault === 'Óptica' && !!pvCase.faultUserId;
    const responsableCaja = culpaEsDeLaOptica
        ? (await prisma.user.findUnique({
            where: { id: pvCase.faultUserId },
            select: { name: true },
        }))?.name || 'el responsable'
        : null;
    const destinoCaja = responsableCaja || 'caja Ishtar (lo cubre Atelier)';
    // Link directo al caso: abre la ficha, la solapa Post Venta (section=postsale,
    // que ya reconoce /admin/contactos) y el caso puntual para resaltarlo.
    const linkCaso = `${appUrl}/admin/contactos?clientId=${order.clientId}&section=postsale&postSaleCaseId=${pvCase.id}`;
    const res: any = await sendEmail({
        to: adminInbox(),
        subject: `Costo del caso de postventa de ${order.client?.name || 'cliente'}: ${costo > 0 ? fmt(costo) : 'sin cargo'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <p>Hola Ishtar,</p>
                <p>Ya tenemos el costo del caso de postventa de <strong>${order.client?.name || 'cliente'}</strong>${cargadoPor ? `, cargado por <strong>${cargadoPor}</strong>` : ''}:
                el laboratorio facturó <strong>${costo > 0 ? fmt(costo) : 'sin cargo (garantía)'}</strong>${multi ? ` en total por las ${nums.length} operaciones del caso` : ` por el pedido <strong style="font-family: monospace;">${detalle[0].pedido}</strong> (${labelDe(detalle[0].lab)})`}.</p>
                ${multi ? `<ul style="line-height: 1.7; font-size: 14px;">${listaPedidos}</ul>` : ''}
                <ul style="line-height: 1.7; font-size: 14px;">
                    <li>Caso: ${pvCase.caseType || 'sin tipo'}${pvCase.coverage ? ` · cobertura: ${pvCase.coverage}` : ''}${pvCase.fault ? ` · atribución: ${pvCase.fault}` : ''}</li>
                    <li>${difiere
                        ? `⚠️ La estimación cargada a mano era <strong>${fmt(estimado)}</strong> — difiere en ${costo > estimado ? '+' : '−'}${fmt(Math.abs(costo - estimado))}. Quedó el valor del laboratorio.`
                        : (estimado > 0
                            ? 'Coincide con lo que se había estimado a mano.'
                            : 'El caso no tenía costo estimado cargado.')}</li>
                </ul>
                ${costo > 0 ? `
                <div style="border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px; margin: 20px 0; background: #fafaf9;">
                    <p style="margin: 0 0 4px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #78716c; font-weight: 700;">Listo para cobrar</p>
                    <p style="margin: 0 0 14px; font-size: 14px;">Descontar <strong>${fmt(costo)}</strong> de <strong>${destinoCaja}</strong>.</p>
                    <a href="${linkCaso}" style="display: inline-block; background: #1c1917; color: #fff; text-decoration: none; padding: 11px 20px; border-radius: 9px; font-size: 14px; font-weight: 600;">Revisar y disparar el cobro</a>
                    <p style="margin: 12px 0 0; font-size: 12px; color: #78716c;">El descuento se genera desde el caso, con un click. Nada se mueve hasta que lo confirmes ahí.</p>
                </div>` : `
                <p style="font-size: 14px;">Sin cargo: no hay nada que imputar a caja.</p>
                <p><a href="${linkCaso}">Ver el caso</a></p>`}
            </div>
        `,
    });
    if (!res?.success) {
        console.error(`[LabCost] Aviso de costo de postventa NO salió (caso ${pvCase.id}, pedidos ${nums.join(', ')}).`);
    } else {
        console.log(`[LabCost] Costo de postventa informado: caso ${pvCase.id}, pedidos ${nums.join(', ')}, ${costo}`);
    }
}

