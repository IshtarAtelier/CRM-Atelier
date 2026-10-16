/**
 * Presupuestos de la TIENDA que quedaron abiertos, y el aviso a Ishtar para
 * que les escriba ella.
 *
 * Pedido de Ishtar, 15/10/2026: "que me mande un mensaje a mí entonces para
 * recuperar y yo me ocupo de escribirles". Contexto: de 18 personas que
 * escribieron desde la tienda en el mes, 13 recibieron presupuesto y ninguna
 * compró, y en varias nadie retomó cuando el cliente respondió. Ninguna dejó
 * mail: el único canal es WhatsApp, y fuera de las 24 h eso lo hace una
 * persona desde su teléfono (o una plantilla aprobada por Meta, que todavía
 * no hay).
 *
 * Qué hace: una vez por día (cron `presupuestos-tienda`, 9:00 ART) arma la
 * lista de personas con origen "Tienda online" / "Carrito Web", con presupuesto
 * y sin compra, y se la manda a los ADMIN por la mensajería interna con, para
 * cada una, el teléfono, qué cotizó y el TEXTO listo para copiar y pegar
 * (con el cupón de recupero de /admin/web si hay uno activo).
 *
 * La misma lista la usa el script scripts/maintenance/campania-cupon-presupuestos.mjs.
 * Nunca lanza desde el aviso: si falla, log y nada más (regla de avisos).
 */
import type { PrismaClient } from '@prisma/client';
import { formatDate } from '@/lib/format-date';
import { precioConSigno } from '@/lib/format-precio';
import { textoWhatsAppCampaniaCupon, type CuponParaMail } from '@/lib/email/campania-cupon';
import { LINEA_CUOTAS } from '@/lib/promo-cuotas';
import { LEYENDA_ENVIO_Y_RETIRO } from '@/lib/constants/envio';

export const ORIGENES_TIENDA = ['Tienda online', 'Carrito Web'] as const;
/** Cuántos días para atrás se mira. Más viejo que esto ya no se "recupera": se persigue aparte. */
export const DIAS_VENTANA_PRESUPUESTOS_TIENDA = 35;
/** Un presupuesto de hoy todavía está en conversación: se avisa recién pasadas estas horas. */
export const HORAS_MINIMAS_SIN_RESPUESTA = 24;

export interface PresupuestoTiendaAbierto {
    clienteId: string;
    nombre: string;
    telefono: string;
    email: string | null;
    presupuesto: number;
    fechaPresupuesto: Date;
    /** Nombre de la ficha de la tienda que cotizó, si se sabe. */
    producto: string | null;
    diasAbierto: number;
}

export async function listarPresupuestosTiendaAbiertos(
    prisma: PrismaClient,
    opts: { dias?: number; horasMinimas?: number } = {},
): Promise<PresupuestoTiendaAbierto[]> {
    const dias = opts.dias ?? DIAS_VENTANA_PRESUPUESTOS_TIENDA;
    const horasMin = opts.horasMinimas ?? HORAS_MINIMAS_SIN_RESPUESTA;
    const desde = new Date(Date.now() - dias * 86400000);
    const clientes = await prisma.client.findMany({
        where: { createdAt: { gte: desde }, contactSource: { in: [...ORIGENES_TIENDA] } },
        select: {
            id: true, name: true, phone: true, email: true,
            orders: {
                where: { isDeleted: false },
                select: { total: true, labSentAt: true, createdAt: true, items: { select: { productId: true } } },
                orderBy: { createdAt: 'desc' },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    const salida: PresupuestoTiendaAbierto[] = [];
    for (const c of clientes) {
        if (/joonix|storebot/i.test(c.email || '')) continue; // robot de Google Merchant
        if (!c.orders.length || c.orders.some((o) => o.labSentAt)) continue; // sin presupuesto, o ya compró
        const o = c.orders[0];
        const horas = (Date.now() - o.createdAt.getTime()) / 3600000;
        if (horas < horasMin) continue;
        const ids = o.items.map((i) => i.productId).filter((x): x is string => !!x);
        const ficha = ids.length
            ? await prisma.webProduct.findFirst({ where: { productId: { in: ids } }, select: { name: true } })
            : null;
        salida.push({
            clienteId: c.id,
            nombre: c.name || 'Cliente',
            telefono: (c.phone || '').replace(/\D/g, ''),
            email: c.email,
            presupuesto: o.total,
            fechaPresupuesto: o.createdAt,
            producto: ficha?.name || null,
            diasAbierto: Math.floor(horas / 24),
        });
    }
    return salida;
}

/** El texto para mandarle a la persona, con cupón si hay uno activo y sin cupón si no. */
export function textoParaRetomar(p: PresupuestoTiendaAbierto, cupon?: CuponParaMail | null): string {
    if (cupon) {
        return textoWhatsAppCampaniaCupon({
            nombre: p.nombre, cupon, motivo: 'presupuesto', producto: p.producto,
            urlTienda: 'https://atelieroptica.com.ar/tienda',
        });
    }
    const nombre = p.nombre.split(' ')[0];
    const que = p.producto ? ` por ${p.producto}` : '';
    return [
        `Hola ${nombre}! Soy de Atelier Óptica. Te pasamos el precio${que} hace unos días y no queremos que quede en la nada.`,
        `Si querés, te lo reservo para que vengas a probártelo. ¿Qué día te queda cómodo?`,
        `${LINEA_CUOTAS}. ${LEYENDA_ENVIO_Y_RETIRO}.`,
    ].join('\n\n');
}

/** El cuerpo del aviso que le llega a Ishtar por la mensajería interna. */
export function cuerpoAvisoPresupuestosTienda(lista: PresupuestoTiendaAbierto[], cupon?: CuponParaMail | null): string {
    const total = lista.reduce((s, p) => s + p.presupuesto, 0);
    const cab = [
        `🛒 Presupuestos de la tienda sin cerrar: ${lista.length} · ${precioConSigno(total)} en juego`,
        '',
        cupon
            ? `Cupón de recupero activo: ${cupon.code} (${cupon.label}, vence el ${cupon.venceEl}). Se cambia en /admin/web → cupón de recupero.`
            : 'Sin cupón de recupero activo (se elige en /admin/web → cupón de recupero): los textos van sin descuento.',
        'Cada uno trae el texto listo para copiar y pegar en WhatsApp.',
        '',
    ];
    const bloques = lista.map((p, i) => [
        `${i + 1}. ${p.nombre} · wa.me/${p.telefono} · ${precioConSigno(p.presupuesto)} del ${formatDate(p.fechaPresupuesto)} (${p.diasAbierto} días)${p.producto ? ` · ${p.producto}` : ''}`,
        textoParaRetomar(p, cupon).split('\n').map((l) => (l ? `   ${l}` : '')).join('\n'),
        '',
    ].join('\n'));
    return cab.concat(bloques).join('\n');
}
