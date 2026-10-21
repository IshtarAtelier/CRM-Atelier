'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { MessageCircle, User } from 'lucide-react';

/**
 * Muestra el texto de un mensaje del equipo con las rutas del CRM y las URLs
 * como links. Los avisos del Asistente terminan con "Ficha: /admin/contactos?id=…"
 * y hasta el 20/10/2026 era texto plano: había que copiarlo a mano (Ishtar:
 * "que me deje ir a ver el mensaje"). Y cuando el link es una ficha, salen
 * SIEMPRE dos botones: la ficha y la conversación de WhatsApp (Ishtar, 20/10:
 * "debe dejar entrar a la ficha y a la conversación, que estén siempre ambos").
 * Único lugar que decide qué es link dentro de un mensaje: el chat y el globo
 * de urgentes lo usan.
 */
const PATRON_LINK = /(https?:\/\/[^\s<>"'«»]+|\/admin\/[^\s<>"'«»]+)/g;
const PATRON_FICHA = /^\/admin\/contactos\?id=([A-Za-z0-9_-]+)$/;

function sinPuntuacionFinal(url: string): [string, string] {
    const m = url.match(/[.,;:!?)»]+$/);
    if (!m) return [url, ''];
    return [url.slice(0, -m[0].length), m[0]];
}

const BOTON = 'inline-flex items-center gap-1 rounded-md border border-current/30 px-2 py-0.5 text-xs font-bold no-underline hover:bg-black/5 transition';

function BotonesDeContacto({ contactoId }: { contactoId: string }) {
    return (
        <span className="inline-flex flex-wrap gap-1.5 align-middle">
            <Link href={`/admin/contactos?id=${contactoId}`} className={BOTON} onClick={(e) => e.stopPropagation()}>
                <User size={12} /> Ficha
            </Link>
            <Link href={`/admin/whatsapp?contacto=${contactoId}`} className={BOTON} onClick={(e) => e.stopPropagation()}>
                <MessageCircle size={12} /> Conversación
            </Link>
        </span>
    );
}

export function TextoConLinks({ texto, className }: { texto: string; className?: string }) {
    const partes = texto.split(PATRON_LINK);
    const nodos: ReactNode[] = partes.map((parte, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{parte}</Fragment>;
        const [href, resto] = sinPuntuacionFinal(parte);
        const ficha = href.match(PATRON_FICHA);
        if (ficha) return <Fragment key={i}><BotonesDeContacto contactoId={ficha[1]} />{resto}</Fragment>;
        const clase = `underline decoration-dotted underline-offset-2 font-semibold hover:text-primary ${className ?? ''}`;
        const link = href.startsWith('/')
            ? <Link href={href} className={clase} onClick={(e) => e.stopPropagation()}>{href}</Link>
            : <a href={href} target="_blank" rel="noopener noreferrer" className={clase} onClick={(e) => e.stopPropagation()}>{href}</a>;
        return <Fragment key={i}>{link}{resto}</Fragment>;
    });
    return <>{nodos}</>;
}
