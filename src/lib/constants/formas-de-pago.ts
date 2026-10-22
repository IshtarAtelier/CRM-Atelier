import { METODO_ESPECIAL } from '@/lib/payment-card';

/**
 * Formas de pago agrupadas POR CUENTA, con su título (Ishtar, 28/9/2026: "hay
 * muchas formas de pago, que quede bien y sea fácil de usar"). Única lista: la
 * leen el modal de pagos y el calculador, así no pueden divergir. Los ids no
 * cambian: son los que se guardan en Payment.
 *
 * Mercado Pago: 3/6 sin interés (lista); 12 con costo financiero fijo — el
 * cliente paga lista × 1,10 y el saldo divide por 1,10 (PricingService). La
 * etiqueta lo aclara SIEMPRE. El 18 se retiró el 27/8/26 (reevaluar).
 */
export type ColorFormaDePago = 'emerald' | 'violet' | 'pink' | 'rose' | 'stone' | 'sky' | 'orange';
export type IconoFormaDePago = 'efectivo' | 'transferencia' | 'tarjeta' | 'especial';

export interface FormaDePago {
    id: string;
    label: string;
    icono: IconoFormaDePago;
    color: ColorFormaDePago;
}

export interface GrupoFormasDePago {
    id: string;
    titulo: string;
    items: FormaDePago[];
    /** Cuenta frenada hasta esta fecha (YYYY-MM-DD, hora de Córdoba, exclusive). */
    pausadaHasta?: string;
    /** Qué usar mientras está frenada — se le muestra al vendedor. */
    motivoPausa?: string;
}

export const GRUPOS_FORMAS_DE_PAGO: GrupoFormasDePago[] = [
    {
        id: 'principales',
        titulo: 'Efectivo y transferencias',
        items: [
            { id: 'EFECTIVO', label: 'Efectivo', icono: 'efectivo', color: 'emerald' },
            { id: 'TRANSFERENCIA_LUCIA', label: 'Transf. Lucía', icono: 'transferencia', color: 'violet' },
            { id: 'TRANSFERENCIA_ISHTAR', label: 'Transf. Ishtar', icono: 'transferencia', color: 'pink' },
            { id: 'TRANSFERENCIA_ESSILOR', label: 'Transf. Essilor', icono: 'transferencia', color: 'orange' },
        ],
    },
    {
        id: 'mercadopago',
        titulo: 'Mercado Pago · Ishtar',
        items: [
            { id: 'MERCADO_PAGO_3_ISH', label: '3 cuotas', icono: 'tarjeta', color: 'sky' },
            { id: 'MERCADO_PAGO_6_ISH', label: '6 cuotas', icono: 'tarjeta', color: 'sky' },
            { id: 'MERCADO_PAGO_12_ISH', label: '12 cuotas (+10%)', icono: 'tarjeta', color: 'sky' },
        ],
    },
    {
        id: 'mercadopago-yani',
        titulo: 'Mercado Pago · Yani',
        // Ishtar, 21/10/2026: la cuenta pasó el tope de $5.000.000 del mes
        // (llevaba $7,75 M). Hasta noviembre, todo Mercado Pago va a Ishtar.
        pausadaHasta: '2026-11-01',
        motivoPausa: 'Mercado Pago de Yani llegó al tope del mes: cobrá con Mercado Pago · Ishtar hasta el 1/11.',
        items: [
            { id: 'MERCADO_PAGO_3_YANI', label: '3 cuotas', icono: 'tarjeta', color: 'sky' },
            { id: 'MERCADO_PAGO_6_YANI', label: '6 cuotas', icono: 'tarjeta', color: 'sky' },
            { id: 'MERCADO_PAGO_12_YANI', label: '12 cuotas (+10%)', icono: 'tarjeta', color: 'sky' },
        ],
    },
    {
        id: 'ish',
        titulo: 'Tarjetas · Ishtar',
        items: [
            { id: 'PAY_WAY_3_ISH', label: 'Pay Way 3', icono: 'tarjeta', color: 'rose' },
            { id: 'PAY_WAY_6_ISH', label: 'Pay Way 6', icono: 'tarjeta', color: 'rose' },
            { id: 'GO_CUOTAS_ISH', label: 'Go Cuotas', icono: 'tarjeta', color: 'rose' },
            { id: 'NARANJA_Z_ISH', label: 'Naranja Z', icono: 'tarjeta', color: 'rose' },
        ],
    },
    {
        id: 'yani',
        titulo: 'Tarjetas · Yani',
        items: [
            { id: 'PAY_WAY_3_YANI', label: 'Pay Way 3', icono: 'tarjeta', color: 'orange' },
            { id: 'PAY_WAY_6_YANI', label: 'Pay Way 6', icono: 'tarjeta', color: 'orange' },
            { id: 'NARANJA_Z_YANI', label: 'Naranja Z', icono: 'tarjeta', color: 'orange' },
        ],
    },
    {
        // Cuenta especial, al final de todo (pedido de Ishtar 14/9/26): lo que
        // no entra en ninguna forma de pago de arriba —canje, cheque, descuento
        // a un empleado—. Obliga a ESCRIBIR cuál fue: un "otro" sin explicación
        // es un agujero en la caja que después nadie puede reconstruir.
        id: 'especial',
        titulo: 'Otra',
        items: [
            { id: METODO_ESPECIAL, label: 'Otra forma de pago', icono: 'especial', color: 'stone' },
        ],
    },
];

export const FORMAS_DE_PAGO: FormaDePago[] = GRUPOS_FORMAS_DE_PAGO.flatMap(g => g.items);

/** "Mercado Pago · Ishtar · 6 cuotas" — la forma de pago como se le dice al cliente. */
export function etiquetaFormaDePago(id: string): string {
    for (const grupo of GRUPOS_FORMAS_DE_PAGO) {
        const item = grupo.items.find(i => i.id === id);
        if (item) return grupo.id === 'principales' || grupo.id === 'especial' ? item.label : `${grupo.titulo} · ${item.label}`;
    }
    return id;
}

/** Fecha de hoy en Córdoba como YYYY-MM-DD (en-CA da ese formato). */
function hoyCordoba(ahora: Date): string {
    return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Cordoba' });
}

/** El grupo está frenado hoy: no se ofrece y la API rechaza cobros nuevos. */
export function grupoPausado(grupo: GrupoFormasDePago, ahora = new Date()): boolean {
    return !!grupo.pausadaHasta && hoyCordoba(ahora) < grupo.pausadaHasta;
}

/** Si la forma de pago está frenada hoy, el motivo; si no, null. */
export function motivoFormaPausada(id: string, ahora = new Date()): string | null {
    const grupo = GRUPOS_FORMAS_DE_PAGO.find(g => g.items.some(i => i.id === id));
    return grupo && grupoPausado(grupo, ahora) ? (grupo.motivoPausa ?? `${grupo.titulo}: cuenta pausada.`) : null;
}

/** Los grupos que se pueden usar hoy. */
export function gruposFormasDePagoActivos(ahora = new Date()): GrupoFormasDePago[] {
    return GRUPOS_FORMAS_DE_PAGO.filter(g => !grupoPausado(g, ahora));
}

/** Avisos de cuentas frenadas hoy, para mostrar arriba del selector. */
export function avisosFormasPausadas(ahora = new Date()): string[] {
    return GRUPOS_FORMAS_DE_PAGO.filter(g => grupoPausado(g, ahora)).map(g => g.motivoPausa ?? `${g.titulo}: cuenta pausada.`);
}
