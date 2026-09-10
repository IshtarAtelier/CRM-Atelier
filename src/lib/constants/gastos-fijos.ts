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
    // ── Local y servicios ─────────────────────────────────────────────────
    { clave: 'alquiler', name: 'Alquiler', type: 'FIJO', category: 'ALQUILER', fuente: 'manual',
      alias: ['Alquiler Actualizado'] },
    // El renglón general de servicios se usó de marzo a junio y desde julio
    // pasó a ser la boleta de EPEC con tres nombres distintos. Es el mismo
    // gasto: se unifica con el nombre que se viene usando.
    { clave: 'luz', name: 'Luz (EPEC)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual',
      alias: ['Servicios (luz, agua, etc.)', 'epec', 'Luz epec'] },
    { clave: 'internet-telefonia', name: 'Internet y telefonía', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual',
      alias: ['Internet / Telefonía', 'intenet y celulares'] },
    { clave: 'alarmas', name: 'Alarmas', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'limpieza', name: 'Limpieza', type: 'FIJO', category: 'LIMPIEZA', fuente: 'manual' },
    { clave: 'seguro-art', name: 'Seguro y ART', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'banco', name: 'Banco (mantenimiento de cuenta)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },

    // ── Personal ──────────────────────────────────────────────────────────
    // Un renglón por persona (decisión de Ishtar, 9/9/2026): así se ve cuánto
    // pesa cada sueldo. El "Sueldos" en bloque de marzo a junio y de
    // septiembre queda como gasto suelto en su mes — NO se le pone alias a
    // ninguna persona, porque era un total y atribuírselo a una sola sería
    // inventar el dato.
    { clave: 'sueldo-matias', name: 'Sueldo Matías', type: 'FIJO', category: 'SUELDOS', fuente: 'manual',
      alias: ['Matias sueldo', 'sueldo matias'] },
    { clave: 'sueldo-milena', name: 'Sueldo Milena', type: 'FIJO', category: 'SUELDOS', fuente: 'manual',
      alias: ['milena sueldo', 'sueldo mile'] },
    // "vop" era un VEP 931 mal tipeado (aclarado por Ishtar el 9/9/2026).
    { clave: 'cargas-sociales', name: 'Cargas sociales (VEP F.931)', type: 'FIJO', category: 'IMPUESTOS', fuente: 'manual',
      alias: ['Cargas sociales (vep)', 'Vep Matias', 'Veps empleados', 'vop'] },
    { clave: 'monotributo-ishtar', name: 'Monotributo Ishtar', type: 'FIJO', category: 'IMPUESTOS', fuente: 'manual',
      alias: ['mono ishtar'] },
    { clave: 'monotributo-yani', name: 'Monotributo Yani', type: 'FIJO', category: 'IMPUESTOS', fuente: 'manual',
      alias: ['mono yani'] },

    // ── Externos ──────────────────────────────────────────────────────────
    { clave: 'contadora', name: 'Contadora', type: 'FIJO', category: 'CONTADORA', fuente: 'manual',
      alias: ['Contadora Camila'] },
    // El orden de los alias importa en julio de 2026: ese mes tiene DOS filas de
    // $200.000 ("Barbara contenido" y "barbara CM") y es una sola carga
    // duplicada (confirmado por Ishtar el 9/9/2026). Se adopta la primera que
    // matchee, así que va primero la del nombre más descriptivo y la otra
    // queda como gasto suelto, visible y borrable desde la pantalla. Julio
    // tiene $200.000 de gasto de más hasta que se borre.
    { clave: 'community-manager', name: 'Community manager (Bárbara)', type: 'FIJO', category: 'OTRO', fuente: 'manual',
      alias: ['Barbara contenido', 'Commiunty barbara', 'barbara CM', 'Barbara'] },
    { clave: 'matricula', name: 'Matrícula y colegio', type: 'FIJO', category: 'OTRO', fuente: 'manual',
      alias: ['Matrícula / Colegio'] },

    // ── Tecnología: lo que cuesta tener el sistema prendido ───────────────
    // Railway y las APIs van a mano porque ninguna expone su facturación;
    // separadas a propósito, mezcladas en un renglón no se ve cuál se disparó.
    // Claude Code es un abono fijo y se convierte solo.
    { clave: 'sistema-gestion', name: 'Sistema de gestión', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'railway', name: 'Railway (servidores)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'claude-code', name: 'Claude Code (abono USD 200)', type: 'FIJO', category: 'SERVICIOS', fuente: 'usd-fijo', usdMensual: 200,
      alias: ['Claude Code (abono 200 USD)'] },
    { clave: 'api-whatsapp', name: 'API de WhatsApp (Meta Cloud)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },
    { clave: 'api-gemini', name: 'API de Google Gemini', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual',
      alias: ['API de Google Gemini / Vertex'] },
    { clave: 'api-google-cloud', name: 'API de Google Cloud (Maps y otros)', type: 'FIJO', category: 'SERVICIOS', fuente: 'manual' },

    // ── Marketing ─────────────────────────────────────────────────────────
    // Meta y Google los trae la plataforma: es el gasto que de verdad se
    // ejecutó en el mes, no lo que alguien recuerda haber puesto.
    { clave: 'meta-ads', name: 'Meta Ads', type: 'MARKETING', category: 'MARKETING', fuente: 'meta-ads',
      alias: ['Meta'] },
    { clave: 'google-ads', name: 'Google Ads', type: 'MARKETING', category: 'MARKETING', fuente: 'google-ads',
      alias: ['Gooogle', 'Google'] },
    // La gestión de campañas se pagaba a Uriel hasta agosto de 2026 y ya no se
    // paga (Ishtar, 9/9/2026), así que NO es un concepto fijo: pedirlo todos
    // los meses sería un renglón en $0 para siempre. Los $165.000 de marzo a
    // agosto quedan como gasto suelto en su mes. Si vuelve a haber alguien
    // gestionando campañas, se agrega acá.

    // ── Proveedores ───────────────────────────────────────────────────────
    { clave: 'payway-servicios', name: 'Payway — costos de servicio', type: 'PROVEEDOR', category: 'PROVEEDOR', fuente: 'manual',
      alias: ['Payway Costos de servicios'] },
    { clave: 'payway-impuestos', name: 'Payway — impuestos', type: 'PROVEEDOR', category: 'PROVEEDOR', fuente: 'manual',
      alias: ['Payway Impuestos'] },
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
