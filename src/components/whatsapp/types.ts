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

export interface Message {
    id: string;
    chatId: string;
    direction: string; // INBOUND | OUTBOUND
    type: string;
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
