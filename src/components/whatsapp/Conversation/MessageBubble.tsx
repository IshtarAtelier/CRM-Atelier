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

const ESTADOS: Record<string, { marca: string; palabra: string; clase: string; claseMovil: string }> = {
    FAILED: { marca: '✕', palabra: 'No se entregó', clase: 'text-red-100 font-black', claseMovil: 'max-lg:text-red-700 max-lg:dark:text-red-400' },
    READ: { marca: '✓✓', palabra: 'Leído', clase: 'text-sky-100 font-black', claseMovil: 'max-lg:text-[#027eb5] max-lg:dark:text-[#53bdeb]' },
    DELIVERED: { marca: '✓✓', palabra: 'Entregado', clase: 'font-black', claseMovil: '' },
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
    // En el celular el buzón completo se ve como WhatsApp: burbuja verde clara
    // con letra oscura, entrante blanca, hora y tildes adentro de la burbuja.
    // Son todas clases `max-lg:` — la compu y la ventana flotante no cambian.
    const movil = !compacto;

    return (
        <div className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-2 ${compacto ? 'max-w-[88%]' : 'max-w-[80%] max-lg:max-w-[85%]'} items-end`}>
                {!isOut && !compacto && (
                    <div aria-hidden className="max-lg:hidden w-6 h-6 rounded-full bg-stone-300 dark:bg-stone-700 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-stone-700 dark:text-stone-200 self-end mb-1">
                        {inicialContacto}
                    </div>
                )}

                <div className={`${compacto ? 'px-3.5 py-2.5' : 'px-5 py-3.5 max-lg:px-2.5 max-lg:pt-1.5 max-lg:pb-1'} shadow-sm relative overflow-hidden ${
                    isOut
                        ? `bg-emerald-700 text-white rounded-[22px] rounded-br-sm ${movil ? 'max-lg:bg-[#d9fdd3] max-lg:text-[#111b21] max-lg:dark:bg-[#005c4b] max-lg:dark:text-[#e9edef] max-lg:rounded-lg max-lg:rounded-tr-none' : ''}`
                        : `bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-[22px] rounded-bl-sm border border-stone-200 dark:border-white/10 ${movil ? 'max-lg:text-[#111b21] max-lg:dark:bg-[#202c33] max-lg:dark:text-[#e9edef] max-lg:border-0 max-lg:rounded-lg max-lg:rounded-tl-none' : ''}`
                }`}>
                    <MessageMedia msg={msg} />

                    {msg.content ? (
                        <p className={`${compacto ? 'text-[13px]' : 'text-[15px] max-lg:leading-snug max-lg:font-normal'} font-medium leading-relaxed whitespace-pre-wrap break-words`}>
                            {formatearMarkupWhatsApp(
                                msg.content,
                                t => busqueda.trim() ? resaltarCoincidencias(t, busqueda, esResultadoActivo) : t,
                            )}
                        </p>
                    ) : null}

                    <div className={`mt-2 ${movil ? 'max-lg:mt-0.5 max-lg:text-[11px] max-lg:font-medium max-lg:justify-end' : ''} flex items-center gap-1.5 text-[11px] font-bold ${
                        isOut
                            ? `text-emerald-50 justify-end ${movil ? 'max-lg:text-[#667781] max-lg:dark:text-[#aebac1]' : ''}`
                            : `text-stone-600 dark:text-stone-400 ${movil ? 'max-lg:text-[#667781] max-lg:dark:text-[#aebac1]' : ''}`
                    }`}>
                        {isOut && (
                            <span className="mr-1 uppercase tracking-wide max-lg:normal-case max-lg:tracking-normal max-lg:mr-0">{msg.senderName || 'Teléfono'}</span>
                        )}
                        <time dateTime={msg.createdAt} className="tabular-nums">{format(new Date(msg.createdAt), 'HH:mm')}</time>
                        {isOut && msg.templateName && (
                            <span title={`Plantilla ${msg.templateName}`}>· plantilla</span>
                        )}
                        {isOut && (
                            estado
                                ? <span className={`${estado.clase} ${movil ? estado.claseMovil : ''}`} title={estado.palabra}>
                                    {estado.marca}{' '}
                                    {/* En el celular la palabra queda para el lector de pantalla,
                                        salvo "No se entregó", que tiene que verse sí o sí. */}
                                    <span className={movil && msg.status !== 'FAILED' ? 'max-lg:sr-only' : ''}>{estado.palabra}</span>
                                  </span>
                                : <span className="inline-flex items-center gap-1" title="Enviado">
                                    <CheckCircle2 className={`w-3 h-3 ${movil ? 'max-lg:hidden' : ''}`} aria-hidden />
                                    {movil && <span aria-hidden className="lg:hidden font-black">✓</span>}
                                    <span className={movil ? 'max-lg:sr-only' : ''}>Enviado</span>
                                  </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
