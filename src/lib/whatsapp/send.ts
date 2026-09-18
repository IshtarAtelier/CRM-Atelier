/**
 * Envío de WhatsApp desde el CRM — el ÚNICO helper que los flujos de negocio
 * deben usar para escribirle a un cliente (pedido listo, presupuesto,
 * comprobante, factura, tracking…). Encapsula la diferencia entre el
 * transporte legacy (WhatsApp Web: siempre texto libre) y la API oficial
 * (texto libre solo dentro de la ventana de 24 h; fuera, plantilla).
 *
 * Cómo decide:
 *   1. Manda el texto libre tal cual (con el PDF/imagen si hay). Con el
 *      transporte legacy esto siempre alcanza. Con la API oficial también,
 *      si el cliente escribió en las últimas 24 h.
 *   2. Si el wa-service responde 409 `needsTemplate` (ventana cerrada) y el
 *      llamador pasó `template`, reenvía como plantilla (mismo adjunto como
 *      encabezado). Si no pasó plantilla, devuelve `needsTemplate: true` y el
 *      llamador decide (avisar al vendedor, mandar email, etc.).
 *
 * Nunca lanza por errores de envío: devuelve `{ ok:false, … }` con el
 * código real (NOT_CONNECTED, WINDOW_CLOSED, INVALID_NUMBER, …) para que el
 * mensaje al vendedor diga la verdad. Lanza solo por mal uso (sin destino).
 */

import { fetchWa } from '@/lib/wa-config';
import { renderTemplate, WHATSAPP_TEMPLATES, type TemplateSpec, type TemplateName } from './templates';

export interface WhatsAppMedia {
    base64: string;
    mimetype: string;
    filename?: string;
}

export interface SendWhatsAppInput {
    /** Id del chat (cuid), waId legacy ("<num>@c.us") o teléfono E.164 ("549…"). */
    chatId: string;
    /** Texto libre (o caption del adjunto). Puede ir vacío si hay media. */
    message: string;
    media?: WhatsAppMedia | null;
    /** Quién lo manda (queda en el buzón). */
    senderName?: string;
    /** true = lo dispara un proceso automático, no una persona (afecta al transporte legacy). */
    isProactive?: boolean;
    /** Plantilla a usar si la ventana de 24 h está cerrada (API oficial). */
    template?: TemplateSpec | null;
    /**
     * Adjunto que va SOLO con la plantilla (como encabezado), no con el texto
     * libre. Para flujos que en texto libre mandan el archivo en un 2º mensaje.
     */
    templateMedia?: WhatsAppMedia | null;
    /** Si es true, va DIRECTO como plantilla sin intentar texto libre. */
    forceTemplate?: boolean;
}

export interface SendWhatsAppResult {
    ok: boolean;
    /** Cómo salió: texto libre o plantilla. */
    via?: 'text' | 'template';
    /** La ventana estaba cerrada y no había plantilla para caer. */
    needsTemplate?: boolean;
    /** Garantía de que NADA salió (para reintentar sin miedo a duplicar). */
    notSent?: boolean;
    /**
     * ¿El mensaje quedó guardado en la conversación?
     *
     * Un envío que no se guarda no se puede verificar después: no está en el
     * buzón ni en la ficha, y el "✅ enviado" que firma el CRM no lo puede
     * probar nadie. Pasó con 5 confirmaciones de compra de septiembre de 2026.
     * `undefined` = wa-service viejo que todavía no lo informa.
     */
    guardado?: boolean;
    status?: number;
    code?: string;
    error?: string;
}

/**
 * Resultado ambiguo: la request se cortó (timeout, socket, DNS, 502 del proxy)
 * antes de saber qué pasó. El mensaje PUEDE haber salido — el wa-service
 * ya se lo pudo haber pasado a Meta. Por eso `notSent` queda en false: los
 * llamadores lo leen como "verificá si le llegó antes de reintentar", que es
 * la verdad. Reintentar solo acá cuesta plata (Meta cobra por conversación) y
 * le llega dos veces al cliente.
 */
const AMBIGUO = 'SEND_UNKNOWN';

async function post(body: Record<string, unknown>): Promise<{ res: Response | null; json: Record<string, unknown> | null; networkError?: string }> {
    let res: Response;
    try {
        res = await fetchWa('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[sendWhatsApp] La request al wa-service se cortó sin respuesta:', msg);
        return { res: null, json: null, networkError: msg };
    }
    let json: Record<string, unknown> | null = null;
    try { json = await res.clone().json(); } catch { /* texto plano o vacío */ }
    return { res, json };
}

function resultadoAmbiguo(via: 'text' | 'template', detalle: string): SendWhatsAppResult {
    return {
        ok: false,
        via,
        notSent: false, // NO sabemos si salió: nunca prometer que no salió.
        status: 502,
        code: AMBIGUO,
        error: `No hubo respuesta del servidor de WhatsApp (${detalle}). El mensaje PUDO haber salido.`,
    };
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
    if (!input.chatId) throw new Error('sendWhatsApp: falta chatId');
    const base = {
        chatId: input.chatId,
        message: input.message ?? '',
        media: input.media ?? undefined,
        senderName: input.senderName,
        isProactive: input.isProactive === true,
    };

    const asTemplate = async (): Promise<SendWhatsAppResult> => {
        // El buzón guarda `message` como contenido del saliente: se manda el
        // texto de la plantilla ya renderizado para que se lea lo que vio el
        // cliente (el wa-service no conoce el catálogo; en modo plantilla no
        // usa `message` para el envío).
        const tpl = input.template!;
        const preview = (tpl.name in WHATSAPP_TEMPLATES && tpl.bodyParams)
            ? renderTemplate(tpl.name as TemplateName, tpl.bodyParams)
            : `[Plantilla ${tpl.name}]`;
        const { res, json, networkError } = await post({ ...base, message: preview, media: input.templateMedia ?? base.media, template: tpl });
        if (!res) return resultadoAmbiguo('template', networkError || 'sin detalle');
        if (res.ok) return { ok: true, via: 'template', status: res.status, guardado: json?.guardado !== false };
        return { ok: false, via: 'template', status: res.status, code: String(json?.code ?? ''), error: String(json?.error ?? `HTTP ${res.status}`), notSent: json?.notSent === true };
    };

    if (input.forceTemplate && input.template) return asTemplate();

    const { res, json, networkError } = await post(base);
    if (!res) return resultadoAmbiguo('text', networkError || 'sin detalle');
    if (res.ok) return { ok: true, via: 'text', status: res.status, guardado: json?.guardado !== false };

    const needsTemplate = res.status === 409 && json?.needsTemplate === true;
    if (needsTemplate && input.template) return asTemplate();

    return {
        ok: false,
        via: 'text',
        needsTemplate,
        status: res.status,
        code: String(json?.code ?? ''),
        error: String(json?.error ?? `HTTP ${res.status}`),
        notSent: json?.notSent === true,
    };
}

/**
 * ¿El envío falló por un tropiezo pasajero del lado de Meta o del wa-service,
 * que un segundo intento suele resolver?
 *
 * SÍ: un 5xx real del wa-service, el bot desconectado un instante, o Meta
 * contestando "(#131000) Something went wrong" / 5xx — su error genérico
 * transitorio, documentado como "reintentar".
 *
 * NO, nunca: el resultado AMBIGUO (la request se cortó sin respuesta: el
 * mensaje PUDO haber salido, y reintentar se lo manda dos veces al cliente y
 * cobra dos conversaciones), ni los fallos definitivos — ventana cerrada sin
 * plantilla, número inválido, plantilla rechazada, destinatario no permitido,
 * regla anti-spam —, que no cambian por insistir.
 */
export function esFalloTransitorio(r: SendWhatsAppResult): boolean {
    if (r.ok) return false;
    if (r.code === AMBIGUO) return false;
    const definitivos = new Set(['WINDOW_CLOSED', 'INVALID_NUMBER', 'TEMPLATE_ERROR', 'RECIPIENT_NOT_ALLOWED', 'BLOCKED']);
    if (r.code && definitivos.has(r.code)) return false;
    if (r.code === 'NOT_CONNECTED' || r.code === 'TIMEOUT') return true;
    if (typeof r.status === 'number' && r.status >= 500) return true;
    const e = r.error || '';
    return /Graph 5\d\d/.test(e) || /#131000\b/.test(e) || /#131016\b/.test(e) || /#130429\b/.test(e);
}

const ESPERA_ENTRE_INTENTOS_MS = [2000, 5000];

/**
 * `sendWhatsApp` con hasta tres intentos ante un fallo transitorio.
 *
 * Para los envíos que son plata o compromiso con el cliente: el recibo de un
 * pago, la confirmación de compra, el aviso interno de cobro. Con un solo
 * intento, un "Something went wrong" de Meta que dura dos segundos se llevaba
 * el recibo para siempre: pasó el 7/9, el 8/9 y el 17/9/2026 (Luis Greca) —
 * tres recibos en diez días, cada uno con la ficha marcada en rojo y una
 * vendedora reenviándolo a mano.
 *
 * Devuelve el ÚLTIMO resultado tal cual, así los llamadores siguen leyendo
 * `ok`, `code` y `error` como siempre; la diferencia es que solo llegan a ver
 * un fallo cuando de verdad no hubo forma.
 */
export async function sendWhatsAppConReintento(
    input: SendWhatsAppInput,
    opts: { intentos?: number; label?: string } = {},
): Promise<SendWhatsAppResult> {
    const intentos = Math.max(1, opts.intentos ?? 3);
    const label = opts.label || 'envío';
    let r = await sendWhatsApp(input);
    for (let i = 1; i < intentos && esFalloTransitorio(r); i++) {
        const espera = ESPERA_ENTRE_INTENTOS_MS[Math.min(i - 1, ESPERA_ENTRE_INTENTOS_MS.length - 1)];
        console.warn(`[sendWhatsApp] ${label}: fallo transitorio (${r.code || r.status}: ${r.error}). Reintento ${i}/${intentos - 1} en ${espera} ms.`);
        await new Promise(res => setTimeout(res, espera));
        r = await sendWhatsApp(input);
    }
    return r;
}

/** Texto corto para mostrarle al vendedor cuando un envío no salió. */
export function explainSendFailure(r: SendWhatsAppResult): string {
    switch (r.code) {
        case 'WINDOW_CLOSED': return 'El cliente no escribió en las últimas 24 h y no hay plantilla para este mensaje: hay que mandarle una plantilla aprobada.';
        case 'NOT_CONNECTED': return 'WhatsApp no está conectado en este momento. Nada salió: reintentá en unos minutos.';
        case 'INVALID_NUMBER': return 'El número no tiene WhatsApp o está mal cargado en la ficha.';
        case 'RECIPIENT_NOT_ALLOWED': return 'El número de prueba de Meta solo puede escribirle a los números de la lista de prueba.';
        case 'TEMPLATE_ERROR': return 'La plantilla no está aprobada o las variables no coinciden con lo que Meta espera.';
        case AMBIGUO: return 'El servidor de WhatsApp no respondió a tiempo. NO sabemos si el mensaje salió: abrí el chat y fijate antes de reenviarlo (si lo reenviás y ya había salido, al cliente le llega dos veces).';
        default: return r.error || 'No se pudo enviar el WhatsApp.';
    }
}
