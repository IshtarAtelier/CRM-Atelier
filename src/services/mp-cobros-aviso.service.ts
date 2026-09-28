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
