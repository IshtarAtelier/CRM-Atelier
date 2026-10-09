/**
 * Texto de WhatsApp que acompaña a una gift card. Un solo lugar: lo usan la
 * pantalla de /admin/gift-cards (botón "Abrir WhatsApp" y "Compartir") y
 * cualquier aviso futuro, para que la tarjeta no se describa de dos maneras.
 */

import { BUSINESS_INFO } from '@/lib/business-info';
import { precioConSigno } from '@/lib/format-precio';
import { formatDate } from '@/lib/format-date';

export interface DatosMensajeGiftCard {
    para: string;
    de?: string | null;
    monto: number;
    code: string;
    /** "AAAA-MM-DD" (día de Córdoba) o null. */
    validaHasta?: string | null;
}

export function mensajeWhatsAppGiftCard(d: DatosMensajeGiftCard): string {
    const para = d.para.trim();
    const de = d.de?.trim();
    const lineas = [
        `¡Hola${para ? ` ${para}` : ''}!`,
        `${de ? `${de} te regaló` : 'Te regalaron'} una Gift Card de ${BUSINESS_INFO.name}${d.monto ? ` por ${precioConSigno(d.monto)}` : ''}.`,
        `Código: ${d.code}${d.validaHasta ? ` · Válida hasta el ${formatDate(d.validaHasta)}` : ''}`,
        `Te esperamos en ${BUSINESS_INFO.address} (frente a Cremolatti).`,
        BUSINESS_INFO.hoursWhatsAppBlock,
        'Te mando la tarjeta en la imagen.',
    ];
    return lineas.join('\n');
}

/**
 * Link a WhatsApp con el mensaje escrito. `telefono` son los dígitos que
 * tipeó el equipo ("351 555-1234"): si no trae el 54 adelante se asume un
 * celular argentino y se le agrega 549. Sin teléfono, WhatsApp pide el chat.
 */
export function linkWhatsAppGiftCard(mensaje: string, telefono?: string | null): string {
    let n = (telefono || '').replace(/\D/g, '');
    if (n && !n.startsWith('54')) n = '549' + n.replace(/^0/, '');
    return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}
