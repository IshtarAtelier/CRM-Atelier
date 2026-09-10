'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatPhoneForWhatsApp, telefonoLegible } from '@/lib/phone-utils';

/**
 * El teléfono del cliente, a la vista y en un click al portapapeles.
 *
 * Por qué existe (Ishtar, 10/9/2026): en Oportunidades de Cierre el
 * seguimiento lo hace un vendedor de verdad, desde SU WhatsApp. Mandarlo por
 * el botón verde sale por la API oficial y, si la conversación está cerrada,
 * GASTA UNA PLANTILLA. Teniendo el número a mano se copia, se pega en WhatsApp
 * y no cuesta nada.
 *
 * Se muestra en formato internacional legible (+54 9 351 200-8711, vía
 * `telefonoLegible`) y se copia en crudo (5493512008711): así sirve tanto para
 * buscar un contacto que ya existe como para abrir un chat con alguien que no
 * está agendado.
 */
interface Props {
    phone: string | null | undefined;
    /** Clase del texto, para que cada panel lo pinte como corresponda. */
    className?: string;
}

export default function TelefonoCopiable({ phone, className = '' }: Props) {
    const [copiado, setCopiado] = useState(false);
    if (!phone) return null;

    const e164 = formatPhoneForWhatsApp(phone);
    const aCopiar = e164.length > 3 ? e164 : phone.replace(/\D/g, '');

    const copiar = async (e: React.MouseEvent) => {
        // Vive adentro de un <Link>: sin esto, copiar navega a la ficha.
        e.preventDefault();
        e.stopPropagation();

        // `navigator.clipboard` es el camino bueno, pero se niega más seguido
        // de lo que uno cree (permiso denegado por política del navegador,
        // http sin TLS, algunas vistas embebidas). Fallaba EN SILENCIO: el
        // vendedor creía tener el número copiado y pegaba cualquier otra cosa.
        // El respaldo con textarea + execCommand está deprecado pero anda en
        // todos lados y no pide permiso.
        let ok = false;
        try {
            await navigator.clipboard.writeText(aCopiar);
            ok = true;
        } catch {
            try {
                const caja = document.createElement('textarea');
                caja.value = aCopiar;
                caja.setAttribute('readonly', '');
                caja.style.position = 'fixed';
                caja.style.opacity = '0';
                document.body.appendChild(caja);
                caja.select();
                ok = document.execCommand('copy');
                document.body.removeChild(caja);
            } catch {
                ok = false;
            }
        }

        setCopiado(ok);
        if (ok) {
            setTimeout(() => setCopiado(false), 1800);
        } else {
            // Último recurso: se lo dejamos seleccionado para un Ctrl/Cmd+C.
            const nodo = e.currentTarget as HTMLElement;
            const rango = document.createRange();
            rango.selectNodeContents(nodo);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(rango);
        }
    };

    return (
        <button
            type="button"
            onClick={copiar}
            title={copiado ? 'Número copiado' : `Copiar ${aCopiar}`}
            aria-label={copiado ? 'Número copiado' : `Copiar el número ${aCopiar}`}
            className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 -mx-1 font-bold tabular-nums transition-colors hover:bg-stone-100 dark:hover:bg-stone-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                copiado ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-300'
            } ${className}`}
        >
            {telefonoLegible(phone)}
            {copiado
                ? <Check className="w-3 h-3 shrink-0" />
                : <Copy className="w-3 h-3 shrink-0 opacity-50" />}
        </button>
    );
}
