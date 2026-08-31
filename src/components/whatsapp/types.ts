/**
 * Tipos del buzón de WhatsApp.
 *
 * Vivían inline dentro de las ~2.780 líneas de `admin/whatsapp/page.tsx`. Al
 * partir la pantalla en piezas (lista, conversación, redactor, cabecera) todas
 * necesitan las mismas formas, y una copia por archivo diverge sola. Este es el
 * único lugar donde se declaran.
 */

import type { TemplateName } from '@/lib/whatsapp/templates';

export interface Tag {
    id: string;
    name: string;
    color: string | null;
    botAction: string | null;
    notifyPhone: string | null;
    autoAssignCondition: string | null;
}

export interface ChatClient {
    id: string;
    name: string;
    phone: string;
    status: string;
    isFavorite?: boolean;
}

export interface Chat {
    id: string;
    waId: string;
    realPhone?: string | null;
    profileName: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string;
    botEnabled: boolean;
    archived: boolean;
    chatLabels: string[];
    chatSummary?: string | null;
    /** API oficial: último mensaje entrante (ventana de 24 h). */
    lastInboundAt?: string | null;
    client?: ChatClient | null;
    messages?: Message[];
}

/**
 * Tipo de mensaje, EN MAYÚSCULA — tal cual lo guarda `WhatsAppMessage.type`
 * (default `"TEXT"`) y tal cual lo comparan `MessageMedia` y `ChatListItem`.
 *
 * Es un union y no un `string` porque la burbuja optimista del provider los
 * escribía en minúscula (`'audio' | 'image' | 'text'`): un audio recién mandado
 * se veía como texto plano hasta que llegaba el refetch. Con el union eso ya no
 * compila. Medido contra la base local: los 5.929 mensajes usan exactamente
 * estos cinco valores.
 */
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

export interface Message {
    id: string;
    chatId: string;
    direction: string; // INBOUND | OUTBOUND
    type: MessageType;
    content: string;
    mediaUrl?: string;
    status: string;
    senderName?: string | null;
    createdAt: string;
    /** API oficial: nombre de la plantilla si salió como plantilla. */
    templateName?: string | null;
}

/** Estado del servicio de WhatsApp (wa-service o Cloud API). */
export interface WhatsAppStatus {
    connected: boolean;
    phone: string | null;
    qr: string | null;
    agentEnabled: boolean;
    transport?: string;
    qualityRating?: string | null;
    messagingLimitTier?: string | null;
    error?: string | null;
    socketUrl?: string;
    socketToken?: string;
    followupsEnabled?: boolean;
    prompt?: string;
}

/** Adjunto ya leído del disco, listo para mandar al endpoint de envío. */
export interface AdjuntoMedia {
    base64: string;
    mimetype: string;
    filename: string;
}

export interface QuickReply {
    label: string;
    text: string;
    /** Plantilla oficial aprobada en Meta: se envía como plantilla, no como texto. */
    templateName?: TemplateName;
}

/** Datos que la IA extrae de una conversación para armar la ficha. */
export interface ClienteExtraido {
    name: string;
    phone: string | null;
    interest: string | null;
    insurance: string | null;
    contactSource: string;
    notes: string | null;
}

/** Filtro de leídos de la lista. */
export type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

/** Qué se está mirando: el buzón entero o solo la conversación (ventana flotante). */
export type VistaWhatsApp = 'lista' | 'chat';
