/**
 * Presentación del buzón: cómo se escribe una fecha, de dónde sale una imagen,
 * cómo se llama un contacto y qué color lleva una etiqueta.
 *
 * Todo esto estaba suelto arriba de `admin/whatsapp/page.tsx`. Ahora lo comparten
 * la pantalla completa, la ventana flotante y el listado compacto — un dato que se
 * muestra en más de un lugar se arma en UN solo helper (regla de CLAUDE.md).
 */

import type { Chat } from './types';

export const CHAT_LABEL_OPTIONS = [
    { label: 'Cancelar Bot', color: 'bg-red-100/80 text-red-800 border-red-300' },
    { label: 'VIP', color: 'bg-amber-100/80 text-amber-800 border-amber-300' },
    { label: 'Proveedor', color: 'bg-slate-100/80 text-slate-800 border-slate-300' },
    { label: 'Interesado', color: 'bg-emerald-100/80 text-emerald-800 border-emerald-300' },
    { label: 'No interesado', color: 'bg-stone-100/80 text-stone-700 border-stone-300' },
    { label: 'Seguimiento', color: 'bg-blue-100/80 text-blue-800 border-blue-300' },
    { label: 'Pendiente', color: 'bg-orange-100/80 text-orange-800 border-orange-300' },
];

/** Clases Tailwind de una etiqueta conocida; violeta para las que no lo son. */
export const getLabelStyle = (label: string) =>
    CHAT_LABEL_OPTIONS.find(o => o.label === label)?.color
    ?? 'bg-violet-100/80 text-violet-800 border-violet-300';

/**
 * Colores de una etiqueta creada por el equipo (viene un hex de la base).
 * El texto va en el hex puro sobre un fondo al 10 %: mantiene el contraste que
 * un texto teñido al mismo tono perdería.
 */
export const getLabelStyleInline = (hexColor: string | null | undefined) => {
    let r = 128, g = 128, b = 128;
    const h = hexColor || '#9e7f65';
    if (h.startsWith('#') && h.length === 7) {
        r = parseInt(h.slice(1, 3), 16);
        g = parseInt(h.slice(3, 5), 16);
        b = parseInt(h.slice(5, 7), 16);
    }
    return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
        color: h,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
    };
};

/** "Hoy" / "Ayer" / "Martes" / "3 de marzo" — el separador de días del hilo. */
export const formatDateDivider = (dateString: string | Date) => {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';

    const diffTime = today.getTime() - d.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7 && diffDays > 0) {
        return d.toLocaleDateString('es-AR', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase());
    }

    return d.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
};

/** `local://clave` y claves sueltas se sirven por el proxy de storage. */
export const resolveMediaUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('local://')) {
        return `/api/storage/view?key=${encodeURIComponent(url.replace('local://', ''))}`;
    }
    if (url.startsWith('/') || url.startsWith('http')) {
        return url;
    }
    return `/api/storage/view?key=${encodeURIComponent(url)}`;
};

/** "buen día" / "buenas tardes" / "buenas noches" — mismo criterio que el bot (src/lib/whatsapp-followup.ts). */
export function saludoSegunHora(): string {
    const hour = new Date().getHours();
    if (hour < 13) return 'buen día';
    if (hour < 20) return 'buenas tardes';
    return 'buenas noches';
}

/** Cómo se llama este chat en pantalla: ficha del CRM > perfil de WhatsApp > número. */
export function getDisplayName(chat: Chat): string {
    if (chat.client?.name) return chat.client.name;
    if (chat.profileName && chat.profileName.trim() !== '') return chat.profileName;
    if (chat.realPhone && chat.realPhone.length >= 8) return `+${chat.realPhone}`;
    const id = chat.waId || '';
    if (id.includes('@c.us') || id.includes('@s.whatsapp.net')) {
        return `+${id.split('@')[0]}`;
    }
    // @lid sin teléfono resuelto: no hay nada mejor que mostrar.
    if (id.includes('@lid')) return 'Contacto WhatsApp';
    return id.split('@')[0] || 'Desconocido';
}

/** La inicial del avatar, tolerante a nombres vacíos. */
export function inicialDe(chat: Chat): string {
    const nombre = getDisplayName(chat);
    return (nombre[0] || '?').toUpperCase();
}

/** El teléfono que se muestra en la cabecera de la conversación. */
export function telefonoVisible(chat: Chat): string {
    const ph = chat.realPhone || chat.client?.phone || '';
    if (ph && ph.length >= 8) return ph;
    if (chat.waId.includes('@lid')) return 'Número pendiente';
    return chat.waId.replace('@c.us', '').replace('@s.whatsapp.net', '') || 'Sin número';
}

/** El número crudo para armar `/admin/whatsapp?phone=`. */
export function telefonoParaLink(chat: Chat): string {
    return (chat.realPhone || chat.client?.phone || chat.waId.split('@')[0] || '').replace(/\D/g, '');
}

/** mm:ss del contador de grabación. */
export const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Sin mayúsculas ni tildes: así busca la lupa dentro de la conversación. */
export const normalizarBusqueda = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Ventana de servicio de 24 h de la API oficial: dentro se responde con texto
 * libre, fuera solo con plantilla aprobada. Se calcula con `lastInboundAt`.
 */
export function ventana24h(chat: Chat): { abierta: boolean; restanteMs: number; texto: string } {
    const t = chat.lastInboundAt ? new Date(chat.lastInboundAt).getTime() : 0;
    const restanteMs = t ? 24 * 3600e3 - (Date.now() - t) : 0;
    if (restanteMs > 0) {
        const h = Math.floor(restanteMs / 3600e3);
        const m = Math.floor((restanteMs % 3600e3) / 60e3);
        return { abierta: true, restanteMs, texto: h > 0 ? `${h} h ${m} min` : `${m} min` };
    }
    return { abierta: false, restanteMs: 0, texto: 'solo plantilla' };
}

/** Etiquetas de seguimiento: son estado accionable, no rótulos comunes. */
export const esEtiquetaDeEstado = (l: string) =>
    l.startsWith('SEGUIMIENTO_') || l === 'SIN_SEGUIMIENTO';

/** "SEGUIMIENTO_DIA_4" → "Seg. Día 4". */
export function rotuloSeguimiento(lbl: string, largo = false): string {
    if (lbl === 'SEGUIMIENTO_DIA_1') return largo ? 'Día 1 (24hs)' : 'Seg. Día 1';
    if (lbl === 'SEGUIMIENTO_DIA_4') return largo ? 'Día 4 (96hs)' : 'Seg. Día 4';
    if (lbl === 'SEGUIMIENTO_DIA_15') return largo ? 'Día 15' : 'Seg. Día 15';
    return lbl;
}
