import React from 'react';
import { Megaphone, Share2, AlertCircle } from 'lucide-react';
import { getContactOrigin, TONO_ANUNCIO } from '@/lib/contact-origin';

/**
 * De dónde vino un contacto, en dos formatos que salen del MISMO cálculo
 * (`src/lib/contact-origin.ts`):
 *   - `OrigenChips`  → compacto, para cada fila de la lista de contactos.
 *   - `OrigenBanner` → bloque del encabezado de la ficha.
 * Si mañana cambia el tono de un canal o el texto del anuncio, cambia en los dos
 * lugares a la vez.
 */

interface ConOrigen {
    contactSource?: string | null;
    adTag?: string | null;
}

const CHIP_BASE =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-black text-[10px] uppercase tracking-widest';

/** Chip del canal. Cuando no hay canal cargado muestra "Sin origen" en tono de advertencia. */
function CanalChip({ contact }: { contact: ConOrigen }) {
    const origen = getContactOrigin(contact);
    return (
        <span
            className={`${CHIP_BASE} ${origen.tonoCanal}`}
            title={origen.tieneCanal ? `Origen: ${origen.canal}` : 'Este contacto no tiene canal de origen cargado'}
        >
            {origen.tieneCanal
                ? <Share2 className="w-3 h-3 shrink-0" />
                : <AlertCircle className="w-3 h-3 shrink-0" />}
            <span className="max-w-[9rem] truncate">{origen.canal}</span>
        </span>
    );
}

/** Chip del anuncio de Meta que trajo al cliente. Tono fuerte: es el dato que se quiere ver de lejos. */
function AnuncioChip({ anuncio, conLeyenda }: { anuncio: string; conLeyenda?: boolean }) {
    return (
        <span className={`${CHIP_BASE} ${TONO_ANUNCIO}`} title={`Vino por el anuncio: ${anuncio}`}>
            <Megaphone className="w-3 h-3 shrink-0" />
            {conLeyenda && <span className="hidden sm:inline">Vino por el anuncio:</span>}
            <span className="max-w-[10rem] truncate normal-case tracking-normal font-black">{anuncio}</span>
        </span>
    );
}

/**
 * Canal + anuncio en compacto, para la lista de contactos.
 * Con anuncio y sin canal NO se muestra el chip "Sin origen": sería mentira
 * (se sabe de dónde vino, lo trajo ese anuncio) y taparía el dato bueno.
 */
export function OrigenChips({ contact }: { contact: ConOrigen }) {
    const origen = getContactOrigin(contact);
    return (
        <>
            {(origen.tieneCanal || !origen.anuncio) && <CanalChip contact={contact} />}
            {origen.anuncio && <AnuncioChip anuncio={origen.anuncio} />}
        </>
    );
}

/**
 * Bloque "Origen" del encabezado de la ficha. Clickeable: abre la edición del
 * contacto, igual que el resto de los datos del encabezado.
 */
export function OrigenBanner({ contact, onEdit }: { contact: ConOrigen; onEdit: () => void }) {
    const origen = getContactOrigin(contact);

    return (
        <button
            type="button"
            onClick={onEdit}
            title="Editar el origen de este contacto"
            className={`w-full flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 mt-1 px-3 py-2.5 rounded-2xl border text-left shadow-sm transition-all hover:border-primary/50 ${
                origen.sinOrigen
                    ? 'bg-amber-50/70 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700/60 border-dashed'
                    : 'bg-white dark:bg-stone-900/50 border-stone-200 dark:border-stone-700'
            }`}
        >
            <span className="text-[8px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-[0.2em]">
                Origen
            </span>

            {origen.sinOrigen ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Sin origen registrado — preguntale cómo nos encontró y cargalo acá
                </span>
            ) : (
                <>
                    {origen.tieneCanal && <CanalChip contact={contact} />}
                    {origen.anuncio && <AnuncioChip anuncio={origen.anuncio} conLeyenda />}
                    {!origen.tieneCanal && (
                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                            Falta el canal: cargalo para que la venta cuente en el reporte
                        </span>
                    )}
                </>
            )}
        </button>
    );
}
