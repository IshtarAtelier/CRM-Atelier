/**
 * Tipos y parámetros compartidos de la conciliación de costos de laboratorio.
 *
 * Este es el único módulo que no depende de ningún otro: todo lo que haya que
 * ajustar para sumar un laboratorio nuevo o cambiar un umbral vive acá.
 */

export type LabName = 'OPTOVISION' | 'GRUPO_OPTICO';

export interface LabCostInput {
    lab: LabName | string;
    labOrderNumber: string;
    billedNet?: number | null;
    billedTotal?: number | null;
    source: 'IMAP_PDF' | 'CSV' | 'SCRAPER' | 'MANUAL';
    sourceFile?: string | null;
    invoiceDate?: Date | null;
    notes?: string | null;
    /**
     * Pase rápido (ventana corta): sus importes se calculan con un conjunto
     * TRUNCADO de comprobantes, así que si la entrada ya tiene facturación de una
     * pasada completa, se conserva la existente (evita el ping-pong OK↔OVERCOST
     * entre la corrida de 10 min y la diaria). Solo completa lo que falta.
     */
    preferExistingBilling?: boolean;
}

/** Tolerancia en pesos para diferencias de redondeo entre lista y factura. */
export const TOLERANCE = 100;

/**
 * Umbral de "monto grueso" para los EMAILS de diferencia de costo (regla del
 * administrador): las diferencias chicas no merecen mail — quedan visibles en
 * la página de conciliación — y solo alertan las que superan este monto, en
 * cualquier dirección. Los HUÉRFANOS (pedido sin venta NI postventa) alertan
 * SIEMPRE con todo su detalle, de ambos labs: eso no se filtra por monto.
 * Ajustable sin tocar código: env LAB_ALERT_MIN_DIFF (pesos).
 */
export const ALERT_MIN_DIFF = (() => {
    const v = Number(process.env.LAB_ALERT_MIN_DIFF);
    return Number.isFinite(v) && v > 0 ? v : 20000;
})();

/**
 * Optovision factura unos días antes de terminar el pedido: recién a los N días
 * hábiles de la factura se lo da por terminado (5 = margen "por si acaso").
 */
export const OPTOVISION_DIAS_FACTURA_A_LISTO = 5;

/**
 * Qué ítems de la orden pertenecen a cada laboratorio (el resto de la orden
 * —armazón, accesorios— no lo factura el lab y no debe entrar en el cruce).
 * SUMAR UN LABORATORIO = agregar su patrón acá + su proveedor en lab-providers.
 */
export const LAB_ITEM_PATTERNS: Record<string, RegExp> = {
    OPTOVISION: /optovision/i,
    GRUPO_OPTICO: /grupo[\s\-]?[oó]ptico/i,
};

/** Nombre legible de cada laboratorio, para emails y pantallas. */
export const LAB_LABELS: Record<string, string> = {
    OPTOVISION: 'Optovision',
    GRUPO_OPTICO: 'Grupo Óptico',
};

/** Importe comparable de una entrada según cómo factura su laboratorio.
 *  Optovision discrimina IVA y Atelier es monotributo (no lo recupera) → el
 *  costo real es el TOTAL c/IVA. Grupo Óptico factura a consumidor final → neto
 *  y total coinciden. */
export const billedForLab = (
    lab: string,
    e: { billedNet: number | null; billedTotal: number | null },
): number | null =>
    lab === 'OPTOVISION'
        ? (e.billedTotal ?? e.billedNet ?? null)
        : (e.billedNet ?? e.billedTotal ?? null);

/** URL pública del CRM, para los links de los emails. */
export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';

/** Casilla del administrador (destino de todos los avisos de conciliación). */
export const adminInbox = () => process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';

/** Formato de pesos para emails y logs. */
export const fmtARS = (n: number | null | undefined) =>
    n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

/** Fecha corta en hora argentina (dd/MM/yyyy), como la ve una persona. */
export const fmtFecha = (d: Date | string | null | undefined) =>
    d
        ? new Date(d).toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires',
        })
        : '—';
