'use client';

/**
 * Una burbuja de la conversación.
 *
 * Accesibilidad: el estado de entrega se comunicaba solo con ✓✓ y un tono de
 * color (celeste = leído). Ahora cada estado lleva además su palabra
 * ("Enviado", "Entregado", "Leído", "No se entregó") — nunca solo color.
 */

import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { normalizarBusqueda } from '../format';
import { MessageMedia } from './MessageMedia';
import type { Message } from '../types';

/** Parte el texto en fragmentos marcando las coincidencias, sin tocar el original. */
export function resaltarCoincidencias(texto: string, consulta: string, esActivo: boolean): React.ReactNode {
    const q = consulta.trim();
    if (!q || !texto) return texto;

    const textoNorm = normalizarBusqueda(texto);
    const qNorm = normalizarBusqueda(q);
    const partes: React.ReactNode[] = [];
    let desde = 0;
    let pos = textoNorm.indexOf(qNorm);

    while (pos !== -1) {
        if (pos > desde) partes.push(texto.slice(desde, pos));
        partes.push(
            <mark
                key={`${pos}-${partes.length}`}
                className={esActivo
                    ? 'bg-amber-400 text-stone-900 rounded px-0.5 font-bold'
                    : 'bg-amber-200 text-stone-900 rounded px-0.5'}
            >
                {texto.slice(pos, pos + q.length)}
            </mark>
        );
        desde = pos + q.length;
        pos = textoNorm.indexOf(qNorm, desde);
    }

    if (desde < texto.length) partes.push(texto.slice(desde));
    return partes;
}


/**
 * Renderiza el marcado de WhatsApp (*negrita*, _cursiva_, ~tachado~, `mono`).
 *
 * POR QUÉ: el bot manda los presupuestos con negritas —"Precio contado:
 * *$170.000*"— porque en WhatsApp eso se ve en negrita. En el buzón se veían
 * los asteriscos crudos, así que el equipo leía símbolos donde el cliente lee
 * texto formateado, y no había forma de revisar de verdad lo que salió.
 *
 * Reglas (las de WhatsApp): el delimitador abre pegado a un carácter que no sea
 * espacio, cierra igual, y no cruza saltos de línea. Por eso "3 * 4" o
 * "$88.500 * 2" no se convierten en nada.
 */
const MARCADO = /(?<![\w*_~`])([*_~`])(?=\S)((?:(?!\1)[^\n])*\S)\1(?![\w*_~`])/;

const ETIQUETA_DE_MARCA: Record<string, 'strong' | 'em' | 's' | 'code'> = {
    '*': 'strong', '_': 'em', '~': 's', '`': 'code',
};

export function formatearMarkupWhatsApp(texto: string, hoja: (t: string) => React.ReactNode): React.ReactNode {
    const partes: React.ReactNode[] = [];
    let resto = texto;
    let n = 0;

    for (let m = MARCADO.exec(resto); m; m = MARCADO.exec(resto)) {
        if (m.index > 0) partes.push(hoja(resto.slice(0, m.index)));
        const Etiqueta = ETIQUETA_DE_MARCA[m[1]];
        partes.push(
            <Etiqueta key={`f${n++}`} className={m[1] === '`' ? 'font-mono text-[0.92em]' : undefined}>
                {formatearMarkupWhatsApp(m[2], hoja)}
            </Etiqueta>
        );
        resto = resto.slice(m.index + m[0].length);
    }

    if (resto) partes.push(hoja(resto));
    return partes.length ? partes : hoja(texto);
}

const ESTADOS: Record<string, { marca: string; palabra: string; clase: string }> = {
    FAILED: { marca: '✕', palabra: 'No se entregó', clase: 'text-red-100 font-black' },
    READ: { marca: '✓✓', palabra: 'Leído', clase: 'text-sky-100 font-black' },
    DELIVERED: { marca: '✓✓', palabra: 'Entregado', clase: 'font-black' },
};

export interface MessageBubbleProps {
    msg: Message;
    /** Inicial del contacto, para el avatar de los entrantes. */
    inicialContacto: string;
    /** Texto buscado en la conversación (para resaltar). */
    busqueda?: string;
    /** Es el resultado de búsqueda enfocado. */
    esResultadoActivo?: boolean;
    compacto?: boolean;
}

export function MessageBubble({
    msg,
    inicialContacto,
    busqueda = '',
    esResultadoActivo = false,
    compacto = false,
}: MessageBubbleProps) {
    const isOut = msg.direction === 'OUTBOUND';
    const estado = ESTADOS[msg.status];

    return (
        <div className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-2 ${compacto ? 'max-w-[88%]' : 'max-w-[80%]'} items-end`}>
                {!isOut && !compacto && (
                    <div aria-hidden className="w-6 h-6 rounded-full bg-stone-300 dark:bg-stone-700 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-stone-700 dark:text-stone-200 self-end mb-1">
                        {inicialContacto}
                    </div>
                )}

                <div className={`${compacto ? 'px-3.5 py-2.5' : 'px-5 py-3.5'} shadow-sm relative overflow-hidden ${
                    isOut
                        ? 'bg-emerald-700 text-white rounded-[22px] rounded-br-sm'
                        : 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-[22px] rounded-bl-sm border border-stone-200 dark:border-white/10'
                }`}>
                    <MessageMedia msg={msg} />

                    {msg.content ? (
                        <p className={`${compacto ? 'text-[13px]' : 'text-[15px]'} font-medium leading-relaxed whitespace-pre-wrap break-words`}>
                            {formatearMarkupWhatsApp(
                                msg.content,
                                t => busqueda.trim() ? resaltarCoincidencias(t, busqueda, esResultadoActivo) : t,
                            )}
                        </p>
                    ) : null}

                    <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${isOut ? 'text-emerald-50 justify-end' : 'text-stone-600 dark:text-stone-400'}`}>
                        {isOut && (
                            <span className="mr-1 uppercase tracking-wide">{msg.senderName || 'Teléfono'}</span>
                        )}
                        <time dateTime={msg.createdAt} className="tabular-nums">{format(new Date(msg.createdAt), 'HH:mm')}</time>
                        {isOut && msg.templateName && (
                            <span title={`Plantilla ${msg.templateName}`}>· plantilla</span>
                        )}
                        {isOut && (
                            estado
                                ? <span className={estado.clase} title={estado.palabra}>{estado.marca} {estado.palabra}</span>
                                : <span className="inline-flex items-center gap-1" title="Enviado"><CheckCircle2 className="w-3 h-3" aria-hidden /> Enviado</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
