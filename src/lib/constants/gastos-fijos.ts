/**
 * Los conceptos de gasto que tienen que estar TODOS los meses.
 *
 * Esta lista es la única fuente de verdad: la pantalla de /admin/gastos, la
 * API y el cierre de mes leen de acá. Antes vivía como `DEFAULT_TEMPLATES`
 * dentro del componente de la pantalla, así que era una plantilla que se
 * aplicaba UNA vez —el primer día que alguien abría un mes en blanco— y
 * después el mes quedaba a la deriva: un concepto agregado a la lista no
 * aparecía en los meses ya abiertos, y uno borrado por error no volvía nunca.
 *
 * Agregar un concepto acá alcanza para que aparezca en todos los meses, los
 * viejos incluidos.
 *
 * `fuente` dice quién escribe el importe:
 *   - "manual":      lo carga una persona en la pantalla.
 *   - "meta-ads":    lo lee la API de Meta (gasto real del mes, en pesos).
 *   - "google-ads":  lo lee la API de Google Ads.
 *   - "usd-fijo":    suscripción de importe fijo en dólares, convertida a pesos.
 *   - "laboratorio": lo calculan las ventas del mes (no está en esta lista;
 *                    los labs se descubren solos desde los pedidos).
 * Todo lo que no sea "manual" se muestra de solo lectura: si el importe se
 * pudiera pisar a mano, el número del cierre dejaría de ser el de la
 * plataforma y no habría forma de saber cuál de los dos es el verdadero.
 */

export type FuenteGasto = 'manual' | 'meta-ads' | 'google-ads' | 'usd-fijo' | 'laboratorio';

export interface ConceptoGasto {
    /** Identidad estable entre meses. NUNCA cambiar la de un concepto existente. */
    clave: string;
    name: string;
    /** Sección de la pantalla: FIJO | MARKETING | PROVEEDOR | OTRO. */
    type: string;
    category: string;
    fuente: FuenteGasto;
    /** Solo para fuente "usd-fijo": lo que se paga por mes, en dólares. */
    usdMensual?: number;
    /**
     * Nombres con los que el concepto pudo haberse guardado antes de tener
     * clave. Sirven para ADOPTAR esas filas viejas en vez de crear una
     * segunda: si no, el mes quedaba con "Meta Ads" dos veces —la de la
     * plantilla vieja y la nueva— y el reporte sumaba la publicidad dos veces.
     */
    alias?: string[];
}

export const CONCEPTOS_GASTO: ConceptoGasto[] = [
    // ── Operativos fijos ──────────────────────────────────────────────────
    { clave: 'alquiler', name: 'Alquiler', type: 'FIJO', category: 'ALQUILER', fuente: 'manual' },
    { clave: 'sueldos', name: 'Sueldos', type: 'FIJO', category: 'SUELDOS', fuente: 'manual' },
    { clave: 'cargas-sociales', name: 'Cargas sociales (vep)', type: 'FIJO', category: 'IMPUESTOS', fuente: 'manual' },
    { clave: 'monotributo-ishtar', name: 'Monotributo Ishtar', type: 'FIJO', category: 'IMPUESTOS', fuente: 'manual' },
    { clave: 'monotributo-yani', name: 'Monotributo Yani', type: 'FIJO', category: 'IMPUESTOS', fuente: 'manual' },
    { clave: 'contadora', name: 'Contadora', type: 'FIJO', category: 'CONTADORA', fuente: 'manual' },
    { clave: 'internet-telefonia', name: 'Internet / Telefonía', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'alarmas', name: 'Alarmas', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'limpieza', name: 'Limpieza', type: 'FIJO', category: 'LIMPIEZA', fuente: 'manual' },
    { clave: 'matricula', name: 'Matrícula / Colegio', type: 'FIJO', category: 'OTRO', fuente: 'manual' },
    { clave: 'servicios', name: 'Servicios (luz, agua, etc.)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },

    // ── Tecnología: lo que cuesta tener el sistema prendido ───────────────
    // Railway y Claude Code se pagan en dólares con tarjeta. Railway varía con
    // el uso, así que va a mano; Claude Code es un abono fijo y se convierte
    // solo. Las tres APIs van separadas a propósito: mezcladas en un renglón
    // no se puede ver cuál se disparó.
    { clave: 'railway', name: 'Railway (servidores)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'claude-code', name: 'Claude Code (abono 200 USD)', type: 'FIJO', category: 'SERVICIOS', fuente: 'usd-fijo', usdMensual: 200 },
    { clave: 'api-whatsapp', name: 'API de WhatsApp (Meta Cloud)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'api-gemini', name: 'API de Google Gemini / Vertex', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'api-google-cloud', name: 'API de Google Cloud (Maps y otros)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },

    // ── Marketing ─────────────────────────────────────────────────────────
    // Meta y Google los trae la plataforma: es el gasto que de verdad se
    // ejecutó en el mes, no lo que alguien recuerda haber puesto.
    { clave: 'meta-ads', name: 'Meta Ads', type: 'MARKETING', category: 'MARKETING', fuente: 'meta-ads' },
    { clave: 'google-ads', name: 'Google Ads', type: 'MARKETING', category: 'MARKETING', fuente: 'google-ads' },
    { clave: 'gestion-campanas', name: 'Gestión de campañas', type: 'MARKETING', category: 'MARKETING', fuente: 'manual' },

    // ── Proveedores ───────────────────────────────────────────────────────
    { clave: 'payway-servicios', name: 'Payway Costos de servicios', type: 'PROVEEDOR', category: 'PROVEEDOR', fuente: 'manual' },
    { clave: 'payway-impuestos', name: 'Payway Impuestos', type: 'PROVEEDOR', category: 'PROVEEDOR', fuente: 'manual' },
    { clave: 'comisiones', name: 'Comisiones', type: 'PROVEEDOR', category: 'PROVEEDOR', fuente: 'manual' },
];

/** Un importe de fuente automática no se edita a mano. */
export function esAutomatico(fuente?: string | null): boolean {
    return Boolean(fuente) && fuente !== 'manual';
}

export function conceptoPorClave(clave?: string | null): ConceptoGasto | undefined {
    if (!clave) return undefined;
    return CONCEPTOS_GASTO.find((c) => c.clave === clave);
}
