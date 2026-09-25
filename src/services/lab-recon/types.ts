/**
 * Tipos y parámetros compartidos de la conciliación de costos de laboratorio.
 *
 * Este es el único módulo que no depende de ningún otro: todo lo que haya que
 * ajustar para sumar un laboratorio nuevo o cambiar un umbral vive acá.
 */

export type LabName = 'OPTOVISION' | 'GRUPO_OPTICO';

/**
 * Un comprobante de un pedido de laboratorio: qué es, cuánto le cobra A ESTE
 * pedido y dónde verlo. Grupo Óptico: link al PDF del comprobante en su portal
 * (verificado el 25/9/2026: abre aun sin la sesión del portal). Optovisión:
 * link al correo con el PDF en Gmail.
 */
export interface InvoiceRef {
    /** Como lo muestra el lab: "X-0004-00023793" (Grupo Óptico) o "3008-00079329" (Optovisión). */
    comprobante: string;
    /** Lo que este comprobante le cobra a ESTE pedido (con el descuento de cuenta). */
    importe: number | null;
    url: string | null;
    tipo?: 'remito' | 'factura' | 'correo';
}

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
    /**
     * `labOrderNumber` es una CLAVE LITERAL, no un nº de pedido del que haya que
     * extraer los dígitos. Se usa para las facturas emitidas contra REMITO (sin
     * nº de pedido): se registran con la clave "S/PEDIDO 3008-00063271" para que
     * el importe quede a la vista en vez de descartarse en silencio.
     */
    claveLiteral?: boolean;
    /**
     * OTROS identificadores del MISMO pedido, para poder encontrar la venta
     * aunque se haya cargado con uno distinto del que usa el sistema. Hoy: el
     * número de la planilla de Optovisión ("Ped: TI-7101568(587979)" → alias
     * "7101568" del pedido 587979). Se usan solo para BUSCAR la venta; la
     * entrada se sigue guardando con el nº de pedido como clave.
     */
    aliases?: string[];
    /**
     * Los comprobantes del pedido con su importe y su link. Se SUMAN a los que
     * ya tenía la entrada (por nº de comprobante, el nuevo manda): un pedido
     * puede llegar en dos corridas o en dos correos distintos.
     */
    invoiceRefs?: InvoiceRef[];
    /**
     * Esta fuente es la verdad sobre el importe y dice que el pedido NO tiene
     * líneas: se borra el importe que ELLA MISMA había guardado (nunca el de
     * otra fuente, p. ej. la planilla importada a mano). Lo usa la pasada
     * completa y sana de Grupo Óptico: un pedido que tenía plata solo por el
     * viejo reparto de líneas sin nº (retirado el 25/9/2026) quedaba con ese
     * importe para siempre.
     */
    sinImporteDeEstaFuente?: boolean;
}

/**
 * Link a un correo de Gmail por su Message-ID, abierto en la cuenta que lo
 * recibió (`authuser`): así el link lleva al correo aunque el navegador tenga
 * varias cuentas de Google abiertas. Sin Message-ID no hay link.
 */
export function linkGmail(cuenta: string | null | undefined, messageId: string | null | undefined): string | null {
    const id = String(messageId || '').trim().replace(/^<|>$/g, '');
    if (!id) return null;
    const quien = cuenta ? `?authuser=${encodeURIComponent(cuenta)}` : '';
    return `https://mail.google.com/mail/${quien}#search/rfc822msgid%3A${encodeURIComponent(id)}`;
}

/** "FA_3025-00051752.pdf" → "3025-00051752": el nº de comprobante de Optovisión, del nombre del adjunto. */
export function comprobanteDeArchivo(nombre: string | null | undefined): string | null {
    const m = String(nombre || '').match(/(\d{4})-?(\d{6,8})/);
    return m ? `${m[1]}-${m[2].padStart(8, '0')}` : null;
}

/**
 * Clave de un comprobante sin la letra: "X-0004-00023793" y "0004-00023793" son
 * el mismo (el PDF no trae la letra; la API sí). Sin esto quedaban los dos.
 */
const claveComprobante = (c: string) => c.replace(/^[A-Z]{1,2}-(?=\d)/, '');

/** Junta dos listas de comprobantes por nº de comprobante; el nuevo pisa al viejo. */
export function juntarComprobantes(viejos: unknown, nuevos: InvoiceRef[] | undefined): InvoiceRef[] | null {
    const base: InvoiceRef[] = Array.isArray(viejos) ? (viejos as InvoiceRef[]).filter(r => r && r.comprobante) : [];
    if (!nuevos?.length) return base.length ? base : null;
    const porNumero = new Map(base.map(r => [claveComprobante(r.comprobante), r]));
    for (const r of nuevos) {
        if (!r?.comprobante) continue;
        const k = claveComprobante(r.comprobante);
        const previo = porNumero.get(k);
        // Una corrida sin importes (PDF a medias, pase rápido que no llega a ese
        // comprobante) no borra el importe ni el link que ya estaban.
        porNumero.set(k, {
            ...previo, ...r,
            // El nombre con letra ("X-0004-…") gana al pelado.
            comprobante: /^[A-Z]/.test(r.comprobante) || !previo ? r.comprobante : previo.comprobante,
            importe: r.importe ?? previo?.importe ?? null,
            url: r.url ?? previo?.url ?? null,
        });
    }
    return [...porNumero.values()];
}

/** Tolerancia en pesos para diferencias de redondeo entre lista y factura. */
export const TOLERANCE = 100;

/**
 * TOPE DEL PAR BONIFICADO DE UN 2x1 (regla de Ishtar, 25/9/2026): "siempre que
 * esté tildado el 2x1 en cristales, SIEMPRE tiene que haber uno sin costo o con
 * costos mínimos que no superen 30.000".
 *
 * El 2x1 de los cristales lo hace el LABORATORIO: manda el segundo par sin
 * cargo. En la práctica Optovisión lo factura a unos pesos ($5 a $41) y a veces
 * con un cargo chico (Gabriela Peralta, 21/9/2026: $25.410); hasta este importe
 * se acepta como "sin cargo". Si TODOS los pedidos de una venta 2x1 vinieron por
 * encima, el lab cobró el par bonificado, y eso se reclama aunque la SUMA de las
 * facturas cierre contra el costo de sistema: un descuento en el par cobrado no
 * compensa un par que tenía que ser gratis, son dos cosas distintas.
 */
export const TOPE_PAR_BONIFICADO_2X1 = 30000;

/**
 * VENTANA DE LOS AVISOS (Ishtar, 25/9/2026): el reporte semanal informa lo de
 * los últimos 30 días y nada más. Antes los "sobrecostos vigentes" eran TODOS
 * los de la historia y un +$97.707 de junio salía en cada mail, para siempre.
 * Lo viejo que sigue abierto se resuelve A MANO en la pantalla (`resolvedAt`),
 * no se repite en el mail.
 */
export const VENTANA_REPORTE_DIAS = 30;

/**
 * Un reproceso de garantía debería venir sin cargo (Optovisión los factura a
 * ~$0). Por encima de este importe se considera COBRADO y va al reporte
 * semanal como plata a reclamar.
 */
export const REPROCESO_CON_CARGO_MIN = 5000;

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
 * Margen antes de avisar un pedido SIN VENTA (pedido del administrador el
 * 10/8/2026): el aviso `urgente` corre cada 10 min y puede pasar apenas
 * segundos después de que el pedido apareció en el portal/factura del
 * laboratorio — el vendedor todavía no tuvo tiempo de cargarle el nº de
 * operación a la venta. Se espera este margen desde el alta de la entrada
 * (LabCostEntry.createdAt) antes de darlo por huérfano.
 *
 * LA OPERATIVA (administradora, 12/8/2026), que es lo que este margen modela:
 * el vendedor procesa el pedido en el laboratorio, el laboratorio le devuelve
 * el nº de operación, y recién ahí el vendedor lo sube a nuestro sistema. O
 * sea: el pedido SIEMPRE existe primero en el lab y después en la venta. El
 * aviso no puede salir en el momento en que el pedido aparece — tiene que
 * anotarse el número, esperar, volver a fijarse si ya está en el sistema, y
 * avisar solo si no llegó. Eso es exactamente lo que hace el par
 * `recheckUnmatched()` (cada pase de 10 min) + este margen.
 *
 * POR QUÉ UNA HORA (administradora, 18/8/2026). Con 4 minutos el aviso salía
 * antes de que el vendedor llegara a cargar el número, y el mail terminaba
 * avisando lo que se iba a resolver solo. La medición de 90 días de
 * producción (scripts/checks/lab-desfase-numero-operacion.check.mjs) lo
 * confirma: de 94 pedidos, en 57 el número YA estaba cargado antes de que el
 * pedido apareciera en el lab (nunca alertan), y de los 37 restantes solo 10
 * entraban dentro de los 4 minutos — la mediana real es de 18,8 min y el
 * pelotón grande cae entre 4 y 15 min. La regla del negocio: en una hora el
 * número tiene que estar cargado; si pasó una hora y no está, ahí sí es un
 * hallazgo y hay que avisar. Los casos de horas o días (18 de 37) siguen
 * alertando igual, que es para lo que sirve el aviso.
 */
export const UNMATCHED_GRACE_MS = 60 * 60 * 1000;

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
