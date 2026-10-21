'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

/**
 * Muestra el texto de un mensaje del equipo con las rutas del CRM y las URLs
 * como links. Los avisos del Asistente terminan con "Ficha: /admin/contactos?id=…"
 * y hasta el 20/10/2026 era texto plano: había que copiarlo a mano (Ishtar:
 * "que me deje ir a ver el mensaje"). Único lugar que decide qué es link
 * dentro de un mensaje: el chat y el globo de urgentes lo usan.
 */
const PATRON_LINK = /(https?:\/\/[^\s<>"'«»]+|\/admin\/[^\s<>"'«»]+)/g;

function sinPuntuacionFinal(url: string): [string, string] {
    const m = url.match(/[.,;:!?)»]+$/);
    if (!m) return [url, ''];
    return [url.slice(0, -m[0].length), m[0]];
}

export function TextoConLinks({ texto, className }: { texto: string; className?: string }) {
    const partes = texto.split(PATRON_LINK);
    const nodos: ReactNode[] = partes.map((parte, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{parte}</Fragment>;
        const [href, resto] = sinPuntuacionFinal(parte);
        const clase = `underline decoration-dotted underline-offset-2 font-semibold hover:text-primary ${className ?? ''}`;
        const link = href.startsWith('/')
            ? <Link href={href} className={clase} onClick={(e) => e.stopPropagation()}>{href}</Link>
            : <a href={href} target="_blank" rel="noopener noreferrer" className={clase} onClick={(e) => e.stopPropagation()}>{href}</a>;
        return <Fragment key={i}>{link}{resto}</Fragment>;
    });
    return <>{nodos}</>;
}
