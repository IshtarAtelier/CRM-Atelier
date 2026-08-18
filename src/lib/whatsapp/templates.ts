/**
 * Catálogo de plantillas de la API oficial de WhatsApp (Cloud API).
 *
 * Es la ÚNICA lista de nombres de plantilla del sistema. Cada flujo que le
 * escribe a un cliente fuera de la ventana de 24 h usa una de estas; el
 * nombre acá y el nombre en el WhatsApp Manager de Meta tienen que coincidir
 * letra por letra (minúsculas, guiones bajos).
 *
 * El texto de cada una está acá para (1) que la dueña lo revise antes de
 * enviarlo a aprobar, (2) que el script que las da de alta en Meta
 * (scripts/maintenance/whatsapp-plantillas/crear-plantillas.mjs) las lea de
 * un solo lugar y (3) que el CRM pueda mostrar una vista previa. Los {{n}}
 * son las variables, en el orden de `bodyParams`.
 *
 * Reglas de redacción (docs/buenas-practicas-meta-google.md §3 y el filtro
 * anti-spam del bot): categoría UTILITY, sin "gratis", "urgente", "oferta",
 * sin implicar condiciones de salud del lector, sin acortadores de URL.
 *
 * Correspondencia con el inventario del plan (docs/plan-whatsapp-api-oficial.md §3-bis).
 */

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export interface TemplateDef {
    /** Nombre exacto en Meta. */
    name: string;
    /** Ítem del inventario del plan al que reemplaza. */
    inventario: string;
    category: TemplateCategory;
    /** Encabezado con documento (PDF) o imagen, si lo lleva. */
    header?: 'DOCUMENT' | 'IMAGE';
    /** Texto del cuerpo tal cual se envía a aprobar. */
    body: string;
    /** Qué es cada {{n}}, en orden — y un ejemplo (Meta pide ejemplos al crear). */
    params: { label: string; example: string }[];
    footer?: string;
    /** Botones (URL fija o de respuesta rápida). */
    buttons?: ({ type: 'URL'; text: string; url: string } | { type: 'QUICK_REPLY'; text: string })[];
}

export const TEMPLATE_LANGUAGE = 'es_AR';

const STORE_URL = 'https://atelieroptica.com.ar';

export const WHATSAPP_TEMPLATES = {
    pedido_listo: {
        name: 'pedido_listo',
        inventario: 'A1',
        category: 'UTILITY',
        body: 'Hola {{1}}, tu pedido {{2}} ya está listo para retirar en Atelier Óptica (José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba). Te esperamos de lunes a viernes de 9 a 20 h. Cualquier consulta, respondé este mensaje.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'nº de pedido', example: '#A1B2' }],
        buttons: [{ type: 'URL', text: 'Cómo llegar', url: 'https://maps.app.goo.gl/atelieroptica' }],
    },
    pedido_listo_saldo: {
        name: 'pedido_listo_saldo',
        inventario: 'A12',
        category: 'UTILITY',
        body: 'Hola {{1}}, tu pedido {{2}} ya está listo para retirar en Atelier Óptica. Queda un saldo a abonar al retirar: con tarjeta o cuotas {{3}}, por transferencia {{4}}, en efectivo {{5}}. Te esperamos de lunes a viernes de 9 a 20 h.',
        params: [
            { label: 'nombre', example: 'Julio' }, { label: 'nº de pedido', example: '#A1B2' },
            { label: 'saldo tarjeta', example: '$ 120.000' }, { label: 'saldo transferencia', example: '$ 110.000' }, { label: 'saldo efectivo', example: '$ 105.000' },
        ],
    },
    venta_confirmada: {
        name: 'venta_confirmada',
        inventario: 'A2',
        category: 'UTILITY',
        header: 'DOCUMENT',
        body: 'Hola {{1}}, confirmamos tu compra {{2}} en Atelier Óptica por un total de {{3}}. Te adjuntamos el detalle. Te avisamos por acá cuando esté lista. ¡Gracias por elegirnos!',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'nº de pedido', example: '#A1B2' }, { label: 'total', example: '$ 250.000' }],
    },
    comprobante_pago: {
        name: 'comprobante_pago',
        inventario: 'A3',
        category: 'UTILITY',
        header: 'DOCUMENT',
        body: 'Hola {{1}}, registramos tu pago de {{2}} correspondiente al pedido {{3}}. Te adjuntamos el comprobante. ¡Gracias!',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'importe', example: '$ 50.000' }, { label: 'nº de pedido', example: '#A1B2' }],
    },
    presupuesto: {
        name: 'presupuesto',
        inventario: 'A4',
        category: 'UTILITY',
        body: 'Hola {{1}}, te enviamos el presupuesto que armamos para vos en Atelier Óptica: {{2}} de lista, con descuento por transferencia {{3}} y en efectivo {{4}}. Cualquier duda, respondé este mensaje y lo vemos juntos.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'total lista', example: '$ 250.000' }, { label: 'total transferencia', example: '$ 225.000' }, { label: 'total efectivo', example: '$ 212.500' }],
    },
    presupuesto_pdf: {
        name: 'presupuesto_pdf',
        inventario: 'A4/A5/A14',
        category: 'UTILITY',
        header: 'DOCUMENT',
        body: 'Hola {{1}}, te enviamos el presupuesto que armamos para vos en Atelier Óptica por {{2}}. Tiene validez de {{3}} días. Cualquier duda, respondé este mensaje y lo vemos juntos.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'total', example: '$ 250.000' }, { label: 'días de validez', example: '7' }],
    },
    pedido_enviado: {
        name: 'pedido_enviado',
        inventario: 'A6',
        category: 'UTILITY',
        body: 'Hola {{1}}, despachamos tu pedido {{2}} por {{3}}. Código de seguimiento: {{4}}. Cualquier consulta, respondé este mensaje.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'nº de pedido', example: '#A1B2' }, { label: 'transporte', example: 'Andreani' }, { label: 'código', example: 'AR123456789' }],
    },
    estado_pedido: {
        name: 'estado_pedido',
        inventario: 'A13',
        category: 'UTILITY',
        body: 'Hola {{1}}, te contamos cómo viene tu pedido {{2}} en Atelier Óptica: {{3}}. Te avisamos por acá cuando esté listo para retirar.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'nº de pedido', example: '#A1B2' }, { label: 'estado', example: 'los cristales ya están en el laboratorio' }],
    },
    factura_electronica: {
        name: 'factura_electronica',
        inventario: 'A11',
        category: 'UTILITY',
        header: 'DOCUMENT',
        body: 'Hola {{1}}, te enviamos adjunta la factura electrónica de tu compra en Atelier Óptica. ¡Gracias por elegirnos!',
        params: [{ label: 'nombre', example: 'Julio' }],
    },
    retomar_conversacion: {
        name: 'retomar_conversacion',
        inventario: 'A9',
        category: 'UTILITY',
        body: 'Hola {{1}}, te escribimos de Atelier Óptica por tu consulta sobre {{2}}. ¿Seguimos por acá? Respondé este mensaje y te atendemos.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'tema', example: 'tus lentes multifocales' }],
        buttons: [{ type: 'QUICK_REPLY', text: 'Sí, sigamos' }, { type: 'QUICK_REPLY', text: 'Ahora no' }],
    },
} as const satisfies Record<string, TemplateDef>;

export type TemplateName = keyof typeof WHATSAPP_TEMPLATES;

/** Lo que viaja al wa-service en `body.template` de POST /api/send. */
export interface TemplateSpec {
    name: TemplateName | string;
    language?: string;
    bodyParams?: string[];
    /** Documento del encabezado (si no se pasa `media` en el envío). */
    headerDocument?: { link?: string; id?: string; filename?: string };
    headerImage?: { link?: string; id?: string };
    buttonUrlParams?: string[];
}

/** Arma el spec de envío para una plantilla del catálogo, validando la cantidad de variables. */
export function templateSpec(name: TemplateName, bodyParams: (string | number | null | undefined)[], extra: Omit<TemplateSpec, 'name' | 'bodyParams'> = {}): TemplateSpec {
    const def = WHATSAPP_TEMPLATES[name];
    if (bodyParams.length !== def.params.length) {
        throw new Error(`Plantilla ${name}: espera ${def.params.length} variables (${def.params.map(p => p.label).join(', ')}) y llegaron ${bodyParams.length}`);
    }
    return {
        name,
        language: TEMPLATE_LANGUAGE,
        // Meta rechaza variables vacías y saltos de línea dentro de una variable.
        bodyParams: bodyParams.map(v => String(v ?? '-').replace(/\s*\n\s*/g, ' ').trim() || '-'),
        ...extra,
    };
}

/** Vista previa del texto con las variables reemplazadas (para el buzón / confirmaciones). */
export function renderTemplate(name: TemplateName, bodyParams: string[]): string {
    return WHATSAPP_TEMPLATES[name].body.replace(/\{\{(\d+)\}\}/g, (_, i) => bodyParams[Number(i) - 1] ?? `{{${i}}}`);
}

/**
 * Componentes en el formato que espera POST /{waba_id}/message_templates,
 * para darlas de alta en Meta desde el script de mantenimiento.
 */
export function toMetaComponents(def: TemplateDef) {
    const components: unknown[] = [];
    if (def.header === 'DOCUMENT') components.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: ['<<subir_un_pdf_de_ejemplo>>'] } });
    if (def.header === 'IMAGE') components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: ['<<subir_una_imagen_de_ejemplo>>'] } });
    components.push({ type: 'BODY', text: def.body, example: { body_text: [def.params.map(p => p.example)] } });
    if (def.footer) components.push({ type: 'FOOTER', text: def.footer });
    if (def.buttons?.length) {
        components.push({
            type: 'BUTTONS',
            buttons: def.buttons.map(b => b.type === 'URL' ? { type: 'URL', text: b.text, url: b.url } : { type: 'QUICK_REPLY', text: b.text }),
        });
    }
    return components;
}

export { STORE_URL as TEMPLATE_STORE_URL };
