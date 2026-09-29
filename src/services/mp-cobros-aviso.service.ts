/**
 * Aviso de CADA cobro que entra a la cuenta de Mercado Pago, por todos los
 * medios: mail, WhatsApp al celular de la dueña y la campanita del CRM.
 *
 * Por qué existe (Ishtar, 28/9/2026): quería un mail de Mercado Pago por cada
 * pago recibido para poder controlarlos, y Mercado Pago no tiene esa opción
 * (en Comunicaciones solo ofrece promociones y novedades). Así que lo hace el
 * sistema: cada 10 minutos le pregunta a la cuenta qué cobros nuevos hay.
 *
 * Reglas:
 *  - Cada cobro se avisa UNA vez. En producción corren dos instancias con los
 *    mismos crons, así que antes de avisar se RESERVA el cobro con una fila
 *    `SystemSetting` de clave única: la segunda instancia choca y no manda nada.
 *  - No se avisa lo viejo: la primera corrida anota desde cuándo y solo cuenta
 *    lo aprobado después (regla del proyecto: nada viejo se reenvía).
 *  - Los importes van con la comisión real de Mercado Pago: es costo, así que
 *    el mail va solo a la dueña (PRIVATE_ADMIN_EMAILS), nunca a la casilla del local.
 *  - Solo la cuenta de Ishtar: la de Yani no tiene credenciales cargadas.
 */
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { PRIVATE_ADMIN_EMAILS } from '@/lib/constants';
import { formatearPrecio } from '@/lib/format-precio';
import { avisarEquipoPorWhatsApp } from '@/lib/whatsapp/aviso-interno';
import { buscarCobrosAprobados, isMercadoPagoEnabled, type MpCobroRecibido } from '@/services/mercadopago.service';
import { RECARGO_MP_CUOTAS_LARGAS, TOPE_VENDEDOR } from '@/lib/constants/descuentos';

const CLAVE_DESDE = 'mp_cobros_aviso_desde';
const PREFIJO_AVISADO = 'mp_cobro_avisado:';
/** Margen hacia atrás en cada consulta: MP a veces informa un cobro con demora. */
const VENTANA_MS = 6 * 60 * 60 * 1000;

const MEDIO: Record<string, string> = {
    credit_card: 'tarjeta de crédito',
    debit_card: 'tarjeta de débito',
    account_money: 'dinero en cuenta',
    bank_transfer: 'transferencia',
    ticket: 'efectivo (Pago Fácil / Rapipago)',
};
const ORIGEN: Record<string, string> = {
    pos_payment: 'posnet (Point)',
    regular_payment: 'link o QR',
    money_transfer: 'transferencia recibida',
    account_fund: 'ingreso de dinero',
};

const pesos = (n: number) => `$${formatearPrecio(Math.round(n))}`;
const horaAR = (iso: string) => {
    const d = new Date(iso);
    const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', ...o });
    return `${f({ day: '2-digit', month: '2-digit' })} a las ${f({ hour: '2-digit', minute: '2-digit', hour12: false })} h`;
};

export function describirCobro(c: MpCobroRecibido): { titulo: string; texto: string } {
    const medio = MEDIO[c.medio] || c.medio || 'otro medio';
    const cuotas = c.cuotas > 1 ? ` en ${c.cuotas} cuotas` : '';
    const origen = ORIGEN[c.tipoOperacion] ? ` · ${ORIGEN[c.tipoOperacion]}` : '';
    const quien = c.pagador ? ` de ${c.pagador}` : '';
    const titulo = `Cobro de ${pesos(c.bruto)} en Mercado Pago${quien}`;
    const texto = [
        `Entró un cobro de ${pesos(c.bruto)}${quien} el ${horaAR(c.aprobado)}.`,
        `Medio: ${medio}${cuotas}${origen}.`,
        c.comision > 0
            ? `Mercado Pago se queda ${pesos(c.comision)} y te quedan ${pesos(c.neto)}.`
            : `Sin comisión: te quedan ${pesos(c.neto)}.`,
        `Operación nº ${c.id}.`,
    ].join(' ');
    return { titulo, texto };
}

/** Reserva el cobro para avisarlo una sola vez. false = ya lo avisó otra corrida. */
async function reservar(id: string): Promise<boolean> {
    try {
        await prisma.systemSetting.create({ data: { key: PREFIJO_AVISADO + id, value: new Date().toISOString() }, select: { key: true } });
        return true;
    } catch {
        return false;
    }
}

async function desde(): Promise<Date> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_DESDE }, select: { value: true } });
    if (fila) return new Date(fila.value);
    const ahora = new Date().toISOString();
    await prisma.systemSetting.upsert({ where: { key: CLAVE_DESDE }, update: {}, create: { key: CLAVE_DESDE, value: ahora }, select: { key: true } });
    return new Date(ahora);
}

/**
 * Umbral de comisión en 12 cuotas a partir del cual el recargo deja de cubrir el
 * precio en efectivo (Ishtar, 28/9/2026: "en el peor de los casos, el valor de
 * efectivo"). Lo que queda es lista × (1 + recargo) × (1 − comisión) y tiene que
 * ser ≥ lista × (1 − descuento efectivo), con el descuento MÁXIMO en efectivo (TOPE_VENDEDOR, el peor caso). Con 10% y 20%: 27,27%. Sale de las
 * constantes: si cambia el recargo o el descuento, el umbral se mueve solo.
 */
export function umbralComisionDoce(): number {
    const efectivo = 1 - TOPE_VENDEDOR.discountCash / 100;
    return 1 - efectivo / (1 + RECARGO_MP_CUOTAS_LARGAS / 100);
}

export function comisionDoceSuperaElEfectivo(c: MpCobroRecibido): string | null {
    if (c.medio !== 'credit_card' || c.cuotas !== 12 || c.bruto <= 0) return null;
    const pct = c.comision / c.bruto;
    const umbral = umbralComisionDoce();
    if (pct <= umbral) return null;
    const f = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')}%`;
    return `En el cobro de ${pesos(c.bruto)} en 12 cuotas (operación nº ${c.id}) Mercado Pago se quedó el ${f(pct)}. Con el recargo de ${RECARGO_MP_CUOTAS_LARGAS}% que se le cobra al cliente, lo que te deposita queda por DEBAJO del precio en efectivo (el límite es ${f(umbral)}; hasta ahora cobraba 25,2%). Hay que revisar el recargo de 12 cuotas.`;
}

const PREFIJO_COMISION = 'mp_comision_vista:';
/** Diferencia mínima (en puntos) para considerar que la comisión cambió: descarta redondeos. */
const TOLERANCIA_PUNTOS = 0.3;

/**
 * Compara la comisión de este cobro con la última vista para las mismas cuotas
 * y la guarda. Devuelve el texto del aviso si cambió. Solo tarjeta de crédito:
 * ahí es donde la comisión depende de las cuotas. El primer cobro de cada
 * cantidad de cuotas solo anota la referencia.
 */
async function cambioDeComision(c: MpCobroRecibido): Promise<string | null> {
    if (c.medio !== 'credit_card' || c.bruto <= 0) return null;
    const pct = (100 * c.comision) / c.bruto;
    // Por canal y cuotas: en 3 cuotas el posnet cobra 8,1% y el link 10,1%.
    const clave = `${PREFIJO_COMISION}${c.tipoOperacion}:${c.cuotas}`;
    const fila = await prisma.systemSetting.findUnique({ where: { key: clave }, select: { value: true } });
    await prisma.systemSetting.upsert({ where: { key: clave }, update: { value: String(pct) }, create: { key: clave, value: String(pct) }, select: { key: true } });
    if (!fila) return null;
    const antes = Number(fila.value);
    if (!Number.isFinite(antes) || Math.abs(pct - antes) < TOLERANCIA_PUNTOS) return null;
    const f = (x: number) => `${x.toFixed(2).replace('.', ',')}%`;
    const cuotas = `${c.cuotas === 1 ? 'un pago' : `${c.cuotas} cuotas`}${ORIGEN[c.tipoOperacion] ? ` (${ORIGEN[c.tipoOperacion]})` : ''}`;
    return `Mercado Pago cambió la comisión de ${cuotas}: antes se quedaba el ${f(antes)} y en el cobro de ${pesos(c.bruto)} (operación nº ${c.id}) se quedó el ${f(pct)}. ${pct > antes ? 'Subió' : 'Bajó'} ${f(Math.abs(pct - antes))}.${c.cuotas === 12 ? ` En 12 cuotas el límite para no quedar por debajo del efectivo es ${f(100 * umbralComisionDoce())}.` : ''}`;
}

export async function avisarCobrosNuevos(): Promise<{ revisados: number; avisados: number; motivo?: string }> {
    if (!isMercadoPagoEnabled()) return { revisados: 0, avisados: 0, motivo: 'Mercado Pago sin credenciales' };
    const inicio = await desde();
    const consultaDesde = new Date(Math.max(inicio.getTime(), Date.now() - VENTANA_MS));
    const cobros = (await buscarCobrosAprobados(consultaDesde)).filter((c) => new Date(c.aprobado) >= inicio);

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, name: true, whatsappPhone: true } });
    let avisados = 0;
    for (const c of cobros.reverse()) {
        if (!(await reservar(c.id))) continue;
        const { titulo, texto } = describirCobro(c);
        avisados++;
        // ¿Cambió la comisión de Mercado Pago para estas cuotas? (Ishtar, 28/9:
        // "apenas cambie que avise").
        const cambio = await cambioDeComision(c);
        if (cambio) {
            await Promise.allSettled([
                sendEmail({ to: PRIVATE_ADMIN_EMAILS, subject: `⚠️ Mercado Pago cambió la comisión de ${c.cuotas === 1 ? '1 pago' : `${c.cuotas} cuotas`}`, text: cambio, html: `<p style="font-size:16px">${cambio}</p>` }),
                prisma.notification.create({ data: { type: 'MP_COBRO', message: `⚠️ ${cambio}`, requestedBy: 'Sistema (Mercado Pago)', status: 'PENDING' }, select: { id: true } }),
            ]);
        }
        // ¿El 10% de las 12 cuotas sigue cubriendo al menos el precio en efectivo?
        const alerta = comisionDoceSuperaElEfectivo(c);
        if (alerta) {
            await Promise.allSettled([
                sendEmail({ to: PRIVATE_ADMIN_EMAILS, subject: '🚨 URGENTE: Mercado Pago subió la comisión de 12 cuotas', text: alerta, html: `<p style="font-size:16px"><strong>URGENTE.</strong> ${alerta}</p>` }),
                prisma.notification.create({ data: { type: 'MP_COBRO', message: `🚨 ${alerta}`, requestedBy: 'Sistema (Mercado Pago)', status: 'PENDING' }, select: { id: true } }),
            ]);
        }
        // Los tres canales por separado: que falle uno no frena a los otros.
        await Promise.allSettled([
            sendEmail({ to: PRIVATE_ADMIN_EMAILS, subject: `💰 ${titulo}`, text: texto, html: `<p style="font-size:16px">${texto}</p>` }),
            prisma.notification.create({
                data: { type: 'MP_COBRO', message: texto, requestedBy: 'Sistema (Mercado Pago)', status: 'PENDING' },
                select: { id: true },
            }),
            avisarEquipoPorWhatsApp({
                destinatarios: admins,
                remitente: { id: null, name: 'Sistema' },
                contexto: 'un cobro en Mercado Pago',
                texto,
            }),
        ]).then((r) => r.forEach((x, i) => x.status === 'rejected' && console.error(`[mp-cobros] canal ${['mail', 'campanita', 'whatsapp'][i]} falló:`, x.reason)));
    }
    return { revisados: cobros.length, avisados };
}

// ── Alerta URGENTE: cobro en 12 cuotas cargado de otra forma ────────────────
//
// Pedido de Ishtar (28/9/2026, caso Cecilia Olmos): en 12 cuotas el cliente
// paga lista × 1,10 (RECARGO_MP_CUOTAS_LARGAS). Si el cobro se hizo en 12 y en
// el CRM quedó como 3, 6, Pay Way o cualquier otra cosa, el saldo de la venta
// queda MAL: no se ve que faltó cobrar el 10%. 3 contra 6 no importa (las dos
// van a precio de lista), así que la alerta es solo por las 12.

const CLAVE_CUOTAS_DESDE = 'mp_cuotas_control_desde';
const PREFIJO_CUOTAS = 'mp_cuotas_alertado:';
/** Hasta cuántos días después del cobro se espera que alguien lo cargue en el CRM. */
const DIAS_PARA_CARGAR = 14;

/** Cuotas del método cargado: "MERCADO_PAGO_12_ISH" → 12. null si el método no dice. */
export function cuotasDelMetodo(method: string): number | null {
    const m = (method || '').toUpperCase().match(/_(\d{1,2})(_|$)/);
    return m ? Number(m[1]) : null;
}

/** ¿Hay que alertar? Solo cuando uno de los dos lados es 12 y el otro no. */
export function cuotasMalCargadas(cuotasMp: number, method: string): boolean {
    const crm = cuotasDelMetodo(method);
    const es12 = (n: number | null) => n === 12;
    const esMp12 = (method || '').toUpperCase().includes('MERCADO_PAGO') && es12(crm);
    return (cuotasMp === 12 && !esMp12) || (cuotasMp !== 12 && esMp12);
}

async function desdeControlCuotas(): Promise<Date> {
    const fila = await prisma.systemSetting.findUnique({ where: { key: CLAVE_CUOTAS_DESDE }, select: { value: true } });
    if (fila) return new Date(fila.value);
    const ahora = new Date().toISOString();
    await prisma.systemSetting.upsert({ where: { key: CLAVE_CUOTAS_DESDE }, update: {}, create: { key: CLAVE_CUOTAS_DESDE, value: ahora }, select: { key: true } });
    return new Date(ahora);
}

export async function alertarCuotasMalCargadas(opts: { desde?: Date; soloMostrar?: boolean } = {}) {
    if (!isMercadoPagoEnabled()) return { revisados: 0, alertados: 0, hallazgos: [] as string[] };
    const inicio = opts.desde ?? (await desdeControlCuotas());
    const consultaDesde = new Date(Math.max(inicio.getTime(), Date.now() - DIAS_PARA_CARGAR * 864e5));
    const cobros = (await buscarCobrosAprobados(consultaDesde)).filter((c) => c.medio === 'credit_card');
    if (!cobros.length) return { revisados: 0, alertados: 0, hallazgos: [] as string[] };

    // Pagos con tarjeta del CRM en la misma ventana, para encontrar la pareja.
    const pagos = await prisma.payment.findMany({
        where: {
            date: { gte: new Date(consultaDesde.getTime() - 4 * 864e5) },
            OR: [{ method: { contains: 'MERCADO_PAGO' } }, { method: { contains: 'PAY_WAY' } }],
            order: { isDeleted: false },
        },
        select: { id: true, amount: true, method: true, date: true, notes: true, orderId: true, createdByName: true, order: { select: { client: { select: { name: true } } } } },
    });

    const usados = new Set<string>();
    const hallazgos: string[] = [];
    let alertados = 0;
    for (const c of cobros) {
        // Pareja: primero por nº de operación en las notas, después por monto y fecha.
        let pago = pagos.find((p) => !usados.has(p.id) && (p.notes || '').includes(c.id));
        if (!pago) {
            pago = pagos
                .filter((p) => !usados.has(p.id) && Math.abs(p.amount - c.bruto) <= 1 && Math.abs(p.date.getTime() - new Date(c.aprobado).getTime()) < 4 * 864e5)
                .sort((a, b) => Math.abs(a.date.getTime() - new Date(c.aprobado).getTime()) - Math.abs(b.date.getTime() - new Date(c.aprobado).getTime()))[0];
        }
        if (!pago) continue; // todavía no lo cargaron: se vuelve a mirar en la próxima corrida
        usados.add(pago.id);
        if (!cuotasMalCargadas(c.cuotas, pago.method)) continue;

        const cliente = pago.order?.client?.name || 'cliente';
        const link = `https://atelieroptica.com.ar/admin/ventas?id=${pago.orderId}`;
        const texto =
            c.cuotas === 12
                ? `El cobro de ${pesos(c.bruto)} a ${cliente} se hizo en 12 CUOTAS en Mercado Pago, pero en el CRM está cargado como ${pago.method}${pago.createdByName ? ` (lo cargó ${pago.createdByName})` : ''}. En 12 cuotas el cliente paga el 10% más: con este error el saldo de la venta está MAL y no se ve si faltó cobrar el recargo. Revisá la venta: ${link}`
                : `El cobro de ${pesos(c.bruto)} a ${cliente} se hizo en ${c.cuotas} cuotas en Mercado Pago, pero en el CRM está cargado como 12 cuotas (${pago.method}). El saldo de la venta está MAL: el sistema cree que se cobró con el 10% de recargo. Revisá la venta: ${link}`;
        hallazgos.push(texto);
        if (opts.soloMostrar) continue;
        try {
            await prisma.systemSetting.create({ data: { key: PREFIJO_CUOTAS + c.id, value: new Date().toISOString() }, select: { key: true } });
        } catch {
            continue; // ya alertado (otra corrida u otra instancia)
        }
        alertados++;
        await Promise.allSettled([
            sendEmail({
                to: PRIVATE_ADMIN_EMAILS,
                subject: `🚨 URGENTE: cobro en 12 cuotas mal cargado — ${cliente}`,
                text: texto,
                html: `<p style="font-size:16px"><strong>URGENTE.</strong> ${texto.replace(link, `<a href="${link}">abrir la venta</a>`)}</p>`,
            }),
            prisma.notification.create({
                data: { type: 'MP_COBRO', message: `🚨 ${texto}`, orderId: pago.orderId, requestedBy: 'Sistema (Mercado Pago)', status: 'PENDING' },
                select: { id: true },
            }),
        ]).then((r) => r.forEach((x) => x.status === 'rejected' && console.error('[mp-cuotas] aviso falló:', x.reason)));
    }
    return { revisados: cobros.length, alertados, hallazgos };
}
