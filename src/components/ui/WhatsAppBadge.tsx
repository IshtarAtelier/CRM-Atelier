"use client";

/**
 * El número verde de "WhatsApp" en la barra lateral.
 *
 * Ya no abre nada: lee el contador del `WhatsAppProvider`, que es el único que
 * habla con el bot. Antes tenía su propio socket y su propio polling, y como
 * este componente se monta y desmonta cada vez que la barra se colapsa
 * (`!isCollapsed && <WhatsAppBadge/>`), cada apertura dejaba OTRA conexión viva:
 * con tres colgadas, un mensaje entrante sonaba tres veces.
 */

import { useWhatsAppDatos } from '@/components/whatsapp/WhatsAppProvider';

export function WhatsAppBadge() {
    const { unreadTotal } = useWhatsAppDatos();

    if (unreadTotal === 0) return null;

    return (
        <span
            aria-label={`${unreadTotal} conversaciones sin leer`}
            className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-black text-white bg-emerald-600 rounded-full shadow-sm"
        >
            {unreadTotal}
        </span>
    );
}
