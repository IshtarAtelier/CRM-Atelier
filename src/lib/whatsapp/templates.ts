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
    /** header:'IMAGE' — ruta (relativa a la raíz del repo) del JPEG que se sube
     * a Meta como muestra al crear la plantilla. Obligatorio si header='IMAGE'. */
    imagenMuestra?: string;
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
    // ── Seguimientos y reseñas: textos TAL CUAL los del sistema ──────────────
    // No se redactó nada nuevo. Son los mismos textos que hoy precargan los
    // botones del dashboard; lo único que cambia es que lo variable pasa a ser
    // {{n}}: el nombre y el saludo por hora (`greetingFor`) en los seguimientos,
    // y los productos de la última venta en el pedido de reseña. Se toma la
    // primera de las cuatro redacciones de `src/lib/whatsapp-followup.ts` —
    // las otras tres existían solo para que WhatsApp Web no viera textos
    // idénticos (anti-ban), algo que la API oficial no necesita.
    seguimiento_presupuesto: {
        name: 'seguimiento_presupuesto',
        inventario: 'E4 (Oportunidades de cierre · presupuesto pendiente)',
        category: 'UTILITY',
        body: 'Hola {{1}}, {{2}}! ¿Cómo estás? Contame, ¿pudiste ver el presupuesto que te pasamos? ¿Qué te pareció, está dentro de lo que estabas buscando? Si querés te mando fotitos de los modelos que tenemos disponibles.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'saludo según la hora', example: 'buen día' }],
    },
    seguimiento_lentes: {
        name: 'seguimiento_lentes',
        inventario: 'E4 (Oportunidades de cierre · charla frenada)',
        category: 'UTILITY',
        body: 'Hola {{1}}, {{2}}! ¿Cómo estás? Te escribo por los lentes que estuvimos viendo, ¿seguís con la idea? Si querés te mando fotitos de los modelos que tenemos ahora.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'saludo según la hora', example: 'buen día' }],
    },
    seguimiento_carrito: {
        name: 'seguimiento_carrito',
        inventario: 'E4 / A15 (carrito abandonado)',
        category: 'UTILITY',
        body: 'Hola {{1}}, {{2}}! ¿Cómo estás? Vi que te quedaron unos productos en el carrito de la tienda, ¿te surgió alguna duda? Si querés te doy una mano para terminarlo.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'saludo según la hora', example: 'buen día' }],
    },
    invitacion_local: {
        name: 'invitacion_local',
        inventario: 'E4 (segundo seguimiento: invitar al local)',
        category: 'UTILITY',
        body: 'Hola {{1}}, {{2}}! ¿Cómo estás? Contame, ¿te gustó alguna de las opciones que te mandé? Si querés pasá por el local y las ves en persona, estamos en José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba. Lunes a Viernes de 8:00 a 20:00. Sábados de 9:00 a 17:00. ¿Qué día te queda más cómodo?',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'saludo según la hora', example: 'buen día' }],
    },
    // Marketing, no utilidad: menciona un descuento. Meta la cobra más caro y
    // el cliente puede bloquearla — es el texto del tercer toque, tal cual.
    ultimo_seguimiento: {
        name: 'ultimo_seguimiento',
        inventario: 'E4 (tercer seguimiento)',
        category: 'MARKETING',
        body: 'Hola {{1}}, {{2}}! ¿Cómo estás? Te quería invitar a seguirnos en Instagram, ahí subimos los modelos que van entrando: https://www.instagram.com/atelieroptica_. Y contame, ¿al final resolviste lo de tus anteojitos? Si todavía no, tengo un descuento especial para hacerte.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'saludo según la hora', example: 'buen día' }],
    },
    // Campaña puntual agosto 2026 (acuerdo MP de Ishtar): 12 cuotas por
    // Mercado Pago. El 10% de costo financiero va SIEMPRE aclarado — "sin
    // interés" son solo 3 y 6 (regla de negocio, ver CLAUDE.md).
    // OJO: category=MARKETING → cada envío tiene costo (Meta cobra por
    // conversación abierta, no por mensaje). Ver el costo real medido en
    // docs/ o preguntar antes de mandar en volumen.
    promo_12_cuotas: {
        name: 'promo_12_cuotas',
        inventario: 'Campaña MP 12 cuotas (ago 2026) — DEPRECADA, ver promo_12_cuotas_v2',
        category: 'MARKETING',
        body: 'Hola {{1}}! Te escribimos de Atelier Óptica 👋 Esta semana podés comprar tus anteojos hasta en 12 cuotas a través de Mercado Pago (con un 10% de costo financiero). Y como siempre: 3 y 6 cuotas sin interés, 20% de descuento en efectivo y 15% por transferencia. Si querés, retomamos tu consulta y te pasamos un presupuesto sin compromiso. ¿Te interesa?',
        params: [{ label: 'nombre', example: 'Julio' }],
    },
    // v2 (30/8/26, texto de Ishtar): saca "a través de Mercado Pago" (no
    // importa el medio), corrige el 20%→15% en efectivo (mismo % que
    // transferencia, como en toda la tienda — el 20% de la v1 quedó
    // desactualizado), y suma el link a la tienda + horario del local.
    promo_12_cuotas_v2: {
        name: 'promo_12_cuotas_v2',
        inventario: 'Campaña MP 12 cuotas v2 (ago-sep 2026)',
        category: 'MARKETING',
        body: 'Hola {{1}}! Te escribimos de Atelier Óptica 👋 Solo esta semana podés comprar tus anteojos hasta en 12 cuotas. Y como siempre: 3 y 6 cuotas sin interés, 15% de descuento en efectivo o transferencia. Si querés, retomamos tu consulta y te pasamos un presupuesto sin compromiso. Te esperamos en el local para tomar tu receta: Lunes a Viernes de 8 a 20, Sábados de 9 a 17.',
        params: [{ label: 'nombre', example: 'Julio' }],
        buttons: [{ type: 'URL', text: 'Ver catálogo', url: 'https://atelieroptica.com.ar/tienda' }],
    },
    // v3 (31/8/26): la v2 PERDIÓ el "(con un 10% de costo financiero)" que la
    // v1 sí tenía — se cayó al reescribirla para corregir el 20%→15%. Peor que
    // omitirlo: la frase encadenaba "hasta en 12 cuotas. Y como siempre: 3 y 6
    // cuotas sin interés", que se lee como un solo paquete sin interés.
    // Ishtar decidió el 31/8 que el 10% se aclara SIEMPRE, en toda superficie.
    promo_12_cuotas_v3: {
        name: 'promo_12_cuotas_v3',
        inventario: 'Campaña MP 12 cuotas v3 (sep 2026) — la vigente',
        category: 'MARKETING',
        body: 'Hola {{1}}! Te escribimos de Atelier Óptica 👋 Podés comprar tus anteojos hasta en 12 cuotas con Mercado Pago (llevan un 10% de costo financiero). Y con tarjeta, 3 y 6 cuotas sin interés. Pagando en efectivo o por transferencia, 15% de descuento. Si querés, retomamos tu consulta y te pasamos un presupuesto sin compromiso. Te esperamos en el local para tomar tu receta: Lunes a Viernes de 8 a 20, Sábados de 9 a 17.',
        params: [{ label: 'nombre', example: 'Julio' }],
        buttons: [{ type: 'URL', text: 'Ver catálogo', url: 'https://atelieroptica.com.ar/tienda' }],
    },
    // Campaña "ya sos cliente" (30/8/26, pedido de Ishtar): avisar a clientes
    // viejos (venta real anterior a junio 2026, o del sistema anterior via
    // contactSource='Importado') que ya está la tienda online, con el cupón
    // SOYCLIENTE (15% OFF, sin mínimo — ver panel Cupones). Excluye a quien
    // tenga actividad reciente (jun-ago 2026, ya cubiertos por la campaña de
    // 12 cuotas). OJO category=MARKETING → cobra por conversación.
    tienda_online_soycliente: {
        name: 'tienda_online_soycliente',
        inventario: 'Campaña tienda online + cupón SOYCLIENTE (ago-sep 2026)',
        category: 'MARKETING',
        header: 'IMAGE',
        imagenMuestra: 'public/social/campania-cupon-soycliente/01.jpg',
        body: 'Hola {{1}}! Te escribimos de Atelier Óptica 👋 Ya está online nuestra tienda 🛍️ Por ser cliente nuestro, tenés un 15% OFF con el cupón SOYCLIENTE, válido hasta fin de septiembre. Dale una vuelta a atelieroptica.com.ar/tienda y aprovechá para ver los modelos nuevos o retomar algo que te haya gustado. Y seguinos en Instagram para enterarte primero de las novedades 👓',
        params: [{ label: 'nombre', example: 'Julio' }],
        buttons: [
            { type: 'URL', text: 'Ver tienda', url: 'https://atelieroptica.com.ar/tienda' },
            { type: 'URL', text: 'Seguinos en Instagram', url: 'https://www.instagram.com/atelieroptica_' },
        ],
    },
    // Seguimiento a quien YA recibió la campaña de 12 cuotas y no es cliente
    // todavía (30/8/26, pedido de Ishtar): sumar lo que le faltaba al mensaje
    // original — tienda online, cupón QUIEROMISLENTES (10% OFF, mín $100.000,
    // pensado para armazones aunque el cupón no distingue categoría — el
    // sistema de cupones no soporta restringir por rubro, ver Coupon en
    // schema.prisma) e invitación a Instagram. OJO category=MARKETING.
    seguimiento_12_cuotas_armazones: {
        name: 'seguimiento_12_cuotas_armazones',
        inventario: 'Seguimiento campaña 12 cuotas — cupón QUIEROMISLENTES (ago-sep 2026)',
        category: 'MARKETING',
        body: 'Hola {{1}}! Un dato más de Atelier Óptica 👋 Ya podés ver nuestros armazones nuevos en la tienda online 🕶️ Con el código QUIEROMISLENTES tenés 10% OFF (válido en compras desde $100.000). Y seguinos en Instagram para ver las novedades primero 👓',
        params: [{ label: 'nombre', example: 'Julio' }],
        buttons: [
            { type: 'URL', text: 'Ver armazones', url: 'https://atelieroptica.com.ar/tienda' },
            { type: 'URL', text: 'Seguinos en Instagram', url: 'https://www.instagram.com/atelieroptica_' },
        ],
    },
    // v2 de las dos campañas de reactivación (30/8/26, correcciones de Ishtar
    // sobre la primera versión): las dos suman "contanos qué modelito te
    // gustó" (invita a responder, abre conversación) y mantienen SÍ O SÍ
    // tienda + Instagram en texto y botones. Regla de códigos confirmada por
    // ella: ya es cliente → SOYCLIENTE (15%), no es cliente → QUIEROMISLENTES
    // (10%, mín $100.000). OJO category=MARKETING → cobra por conversación.
    tienda_online_soycliente_v2: {
        name: 'tienda_online_soycliente_v2',
        inventario: 'Campaña tienda online clientes — cupón SOYCLIENTE v2 (ago-sep 2026)',
        category: 'MARKETING',
        header: 'IMAGE',
        imagenMuestra: 'public/social/campania-cupon-soycliente/01.jpg',
        body: 'Hola {{1}}! Te escribimos de Atelier Óptica 👋 Ya está online nuestra tienda 🛍️ Por ser cliente nuestro tenés un 15% OFF con el cupón SOYCLIENTE hasta fin de septiembre. Date una vuelta y contanos qué modelito te gustó 🕶️ Y seguinos en Instagram para enterarte primero de las novedades 👓',
        params: [{ label: 'nombre', example: 'Julio' }],
        buttons: [
            { type: 'URL', text: 'Ver tienda', url: 'https://atelieroptica.com.ar/tienda' },
            { type: 'URL', text: 'Seguinos en Instagram', url: 'https://www.instagram.com/atelieroptica_' },
        ],
    },
    tienda_online_quieromislentes: {
        name: 'tienda_online_quieromislentes',
        inventario: 'Campaña tienda online prospectos — cupón QUIEROMISLENTES (ago-sep 2026)',
        category: 'MARKETING',
        header: 'IMAGE',
        imagenMuestra: 'public/social/campania-cupon-quieromislentes/01.jpg',
        body: 'Hola {{1}}! Te escribimos de Atelier Óptica 👋 ¿Ya conocés nuestra tienda online? Date una vuelta y contanos qué modelito te gustó 🕶️ Con el código QUIEROMISLENTES tenés un 10% OFF en compras desde $100.000. Y seguinos en Instagram para ver las novedades primero 👓',
        params: [{ label: 'nombre', example: 'Julio' }],
        buttons: [
            { type: 'URL', text: 'Ver tienda', url: 'https://atelieroptica.com.ar/tienda' },
            { type: 'URL', text: 'Seguinos en Instagram', url: 'https://www.instagram.com/atelieroptica_' },
        ],
    },
    // Reseñas: SIEMPRE manual — la plantilla no cambia eso, la dispara una
    // persona desde el panel. Texto idéntico al de ReviewRequestsPanel.
    pedido_resena: {
        name: 'pedido_resena',
        inventario: 'E5 (Reseñas pendientes)',
        category: 'MARKETING',
        body: 'Hola {{1}}, Te escribo para pedirte un favor enorme 🙏\n\nMe dejarias una reseña en Google? me ayuda muchísimo, si podés compartir cómo fue tu experiencia y qué fue lo que más te gustó de nuestra atención.\n\nSi podés, contá en la reseña qué te parecieron tus {{2}}, ¡nos ayuda un montón! 🙌\n\n👉 https://g.page/r/CcVls8v7ic_NEBM/review\n\nMe suma muchísimo para seguir creciendo! Espero tu comentario 🤍✨🫶',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'productos de la última venta', example: 'multifocales Crizal' }],
    },
    retomar_conversacion: {
        name: 'retomar_conversacion',
        inventario: 'A9',
        category: 'UTILITY',
        body: 'Hola {{1}}, te escribimos de Atelier Óptica por tu consulta sobre {{2}}. ¿Seguimos por acá? Respondé este mensaje y te atendemos.',
        params: [{ label: 'nombre', example: 'Julio' }, { label: 'tema', example: 'tus lentes multifocales' }],
        buttons: [{ type: 'QUICK_REPLY', text: 'Sí, sigamos' }, { type: 'QUICK_REPLY', text: 'Ahora no' }],
    },

    // ── Avisos internos (van al celular de la administración, no a clientes) ──
    // Pedido del 24/8: al retomar los avisos por WhatsApp con la API oficial,
    // el primero es el de pagos — con el recibo adjunto y si fue seña o saldo.
    aviso_pago_interno: {
        name: 'aviso_pago_interno',
        inventario: 'B2',
        category: 'UTILITY',
        header: 'DOCUMENT',
        body: 'Aviso de Atelier Sistema — Pago registrado: {{1}} abonó {{2}} {{3}} del pedido {{4}}. Total del pedido: {{5}}. {{6}}. Recibo adjunto.',
        params: [
            { label: 'cliente', example: 'Julio Lescano' },
            { label: 'importe', example: '$ 50.000' },
            { label: 'forma de pago', example: 'en efectivo' },
            { label: 'nº de pedido', example: '#A1B2' },
            { label: 'total', example: '$ 250.000' },
            { label: 'seña o saldo', example: 'SEÑA — queda saldo $ 200.000' },
        ],
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
