import { prisma } from '../../lib/db';
import { sendEmail } from '../../lib/email';
import { logAudit } from '../../lib/audit';
import { notificationEmailFor, ISHTAR_INBOX, firstName } from '../../lib/vendor-email';
import { backfillKey, emailsEnabled } from './backfill';
import { OPTOVISION_DIAS_FACTURA_A_LISTO, appUrl as appUrlFn, fmtARS } from './types';

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


/**
 * Completa el costo del caso de postventa con lo que facturó el lab, deja
 * nota firmada en el caso y avisa por email al vendedor que cargó el caso
 * (con copia a Ishtar). Reglas: un costo cargado a mano NO se pisa (la nota
 * deja asentada la diferencia), y $0 también informa (garantía sin cargo).
 */
export async function completePostSaleCost(entry: any, order: any, pvCase: any, billed: number, pedido: string) {
    const costo = Math.round(billed * 100) / 100;
    const labLabel = entry.lab === 'GRUPO_OPTICO' ? 'Grupo Óptico' : 'Optovision';
    const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

    const costoManual = (pvCase.cost ?? 0) > 0;
    const completar = !costoManual && costo > 0;
    if (completar) {
        await prisma.postSaleCase.update({ where: { id: pvCase.id }, data: { cost: costo } });
    }

    const detalleFactura = `${labLabel}, pedido ${pedido}${entry.sourceFile ? `, ${entry.sourceFile}` : ''}`;
    const content = costo > 0
        ? (completar
            ? `Costo del caso completado automáticamente: ${fmt(costo)} según lo facturado por el laboratorio (${detalleFactura}).`
            : `El laboratorio facturó ${fmt(costo)} por el pedido de este caso (${detalleFactura}). El caso ya tenía cargado ${fmt(pvCase.cost)} a mano; se conserva ese valor.`)
        : `El laboratorio facturó el pedido de este caso SIN CARGO (garantía) — ${detalleFactura}.`;
    await prisma.postSaleNote.create({
        data: { caseId: pvCase.id, content, createdBy: 'Sistema' },
    });
    logAudit({
        userName: 'Sistema', action: 'UPDATE', entityType: 'ORDER', entityId: order.id,
        details: { evento: 'costo_postventa', caseId: pvCase.id, pedido, lab: entry.lab, costo, completado: completar },
    }).catch(console.error);

    if (!emailsEnabled()) return;
    // Vendedor que cargó el caso: quien hizo el primer movimiento del
    // historial (o la primera nota humana). Si no se resuelve a un usuario
    // con casilla propia, el aviso va a la casilla compartida del local.
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
    const user = cargadoPor
        ? await prisma.user.findFirst({
            where: { name: cargadoPor },
            select: { id: true, name: true, email: true, notificationEmail: true },
        })
        : null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
    const res: any = await sendEmail({
        to: notificationEmailFor(user),
        bcc: ISHTAR_INBOX,
        subject: `Costo del caso de postventa de ${order.client?.name || 'cliente'}: ${costo > 0 ? fmt(costo) : 'sin cargo'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <p>Hola${cargadoPor ? ` ${firstName(cargadoPor)}` : ''},</p>
                <p>Ya tenemos el costo del caso de postventa de <strong>${order.client?.name || 'cliente'}</strong> que cargaste:
                el laboratorio facturó <strong>${costo > 0 ? fmt(costo) : 'sin cargo (garantía)'}</strong> por el pedido
                <strong style="font-family: monospace;">${pedido}</strong> (${labLabel}).</p>
                <ul style="line-height: 1.7; font-size: 14px;">
                    <li>Caso: ${pvCase.caseType || 'sin tipo'}${pvCase.coverage ? ` · cobertura: ${pvCase.coverage}` : ''}${pvCase.fault ? ` · falla: ${pvCase.fault}` : ''}</li>
                    <li>${completar
                        ? 'El costo quedó cargado automáticamente en el caso.'
                        : (costoManual
                            ? `El caso ya tenía cargado ${fmt(pvCase.cost)} a mano; se conservó ese valor.`
                            : 'Sin cargo: no había costo que completar.')}</li>
                </ul>
                <p><a href="${appUrl}/admin/contactos?clientId=${order.clientId}">Ver ficha del cliente</a></p>
            </div>
        `,
    });
    if (!res?.success) {
        console.error(`[LabCost] Aviso de costo de postventa NO salió (caso ${pvCase.id}, pedido ${pedido}).`);
    } else {
        console.log(`[LabCost] Costo de postventa informado: caso ${pvCase.id}, pedido ${pedido}, ${costo}`);
    }
}

