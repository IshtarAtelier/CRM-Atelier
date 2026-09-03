/**
 * Copia por WhatsApp de notas y mensajes INTERNOS del equipo — al celular
 * propio de cada colaborador (`User.whatsappPhone`).
 *
 * Es el ÚNICO lugar que resuelve "el WhatsApp de este usuario", igual que
 * `vendor-email.ts` es el único que resuelve su email. Antes los teléfonos del
 * staff eran constantes en `src/lib/constants.ts` y un flujo viejo
 * (`api/equipo/mensajes`) los tenía hardcodeados con un ruteo fijo
 * Ishtar↔Matías: sumar una vendedora era tocar código.
 *
 * Reglas:
 *  - Fire-and-forget SIEMPRE. La nota ya quedó guardada en la base; que falle
 *    el WhatsApp no puede hacer fallar la nota (mismo criterio que el aviso de
 *    pago a la administración en contact.service.ts).
 *  - Sin número cargado, esa persona no recibe copia. No hay fallback a un
 *    teléfono "del local": la copia es personal.
 *  - El colaborador casi nunca le escribió al número del negocio en las
 *    últimas 24 h, así que el envío cae a la plantilla `nota_interna`
 *    (sendWhatsApp lo resuelve solo: texto libre si la ventana está abierta,
 *    plantilla si no).
 *  - Nunca se le manda a quien escribió la nota.
 */

import { sendWhatsApp } from './send';
import { templateSpec } from './templates';
// phone-utils y no contact.service: contact.service importa este módulo, y un
// ciclo de imports acá es la clase de bug que aparece solo en producción.
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';

export interface UsuarioConWhatsApp {
    id?: string | null;
    name?: string | null;
    whatsappPhone?: string | null;
}

/** Meta rechaza variables de más de 1024 caracteres; un renglón de nota alcanza con menos. */
const MAX_TEXTO_PLANTILLA = 700;

/** Número E.164 ("549…") del colaborador, o null si no tiene cargado uno válido. */
export function whatsappPhoneFor(user?: UsuarioConWhatsApp | null): string | null {
    const raw = (user?.whatsappPhone || '').trim();
    if (!raw) return null;
    const normalizado = formatPhoneForWhatsApp(raw);
    // "549" pelado = el número quedó vacío después de limpiar.
    return normalizado && normalizado.length >= 12 ? normalizado : null;
}

/** Una nota de varios renglones, en un renglón y con tope, para la variable de la plantilla. */
export function textoParaPlantilla(texto: string): string {
    const plano = (texto || '').replace(/\s+/g, ' ').trim();
    if (plano.length <= MAX_TEXTO_PLANTILLA) return plano;
    return plano.slice(0, MAX_TEXTO_PLANTILLA - 1).trimEnd() + '…';
}

export interface AvisoInternoInput {
    /** A quiénes va la copia (se saltea a los que no tienen número y al remitente). */
    destinatarios: UsuarioConWhatsApp[];
    /** Quién escribió la nota. */
    remitente: { id?: string | null; name?: string | null };
    /** De qué es la nota: "el cliente Julio Lescano", "la conversación 'Pedido de Rocío'". */
    contexto: string;
    /** El texto completo de la nota. */
    texto: string;
    /** Link para abrirla en el CRM (va solo en el texto libre; la plantilla no lo admite). */
    link?: string | null;
}

export interface AvisoInternoResultado {
    userId: string | null;
    phone: string;
    ok: boolean;
    via?: 'text' | 'template';
    error?: string;
}

/**
 * Manda la copia a cada destinatario con número. Devuelve el detalle por
 * persona para que el llamador lo registre si quiere; no lanza nunca.
 */
export async function avisarEquipoPorWhatsApp(input: AvisoInternoInput): Promise<AvisoInternoResultado[]> {
    const remitenteNombre = (input.remitente.name || 'Alguien del equipo').trim();
    const contexto = input.contexto.trim() || 'el sistema';
    const resumen = textoParaPlantilla(input.texto);

    // Texto libre (solo sale si la ventana de 24 h está abierta): completo y
    // con link. La plantilla lleva la versión de un renglón.
    const textoLibre =
        `📝 *${remitenteNombre}* te dejó un mensaje sobre ${contexto}:\n\n${input.texto.trim()}` +
        (input.link ? `\n\n${input.link}` : '');

    const vistos = new Set<string>();
    const resultados: AvisoInternoResultado[] = [];
    for (const u of input.destinatarios) {
        if (!u || (u.id && input.remitente.id && u.id === input.remitente.id)) continue;
        const phone = whatsappPhoneFor(u);
        if (!phone || vistos.has(phone)) continue;
        vistos.add(phone);
        try {
            const r = await sendWhatsApp({
                chatId: phone,
                message: textoLibre,
                senderName: 'Sistema Atelier',
                isProactive: true,
                template: templateSpec('nota_interna', [remitenteNombre, contexto, resumen]),
            });
            resultados.push({ userId: u.id ?? null, phone, ok: r.ok, via: r.via, error: r.ok ? undefined : (r.error || r.code) });
            if (!r.ok) console.error(`[aviso-interno] Copia por WhatsApp a ${u.name || phone} no salió:`, r.code, r.error);
        } catch (e: any) {
            resultados.push({ userId: u.id ?? null, phone, ok: false, error: e?.message });
            console.error(`[aviso-interno] Copia por WhatsApp a ${u.name || phone}:`, e?.message);
        }
    }
    return resultados;
}
