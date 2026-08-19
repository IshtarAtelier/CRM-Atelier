'use client';

/**
 * La barra superior del buzón.
 *
 * POR QUÉ existe como componente: vivía suelta dentro de las 2.763 líneas de
 * `admin/whatsapp/page.tsx`, con SIETE controles en una fila y todos con el
 * mismo peso visual. Apagar el asistente de IA —que cambia lo que el sistema
 * le escribe solo a los clientes— se veía igual que abrir la galería de fotos.
 *
 * Acá hay una jerarquía explícita, y es la regla para agregar cosas nuevas:
 *
 *   1. ESTADO      — a la izquierda: quién soy y si estoy conectado.
 *   2. INTERRUPTORES — lo que cambia el comportamiento del sistema. Van juntos,
 *      en su propio bloque, con el estado escrito en palabras ("Activa" /
 *      "Inactiva"), no solo en el color de una perilla.
 *   3. ACCIÓN PRIMARIA — lo único que se aprieta seguido (Sincronizar).
 *   4. EL RESTO    — pantallas que se abren de vez en cuando, dentro de un
 *      menú. Agregar una sexta no ensucia la barra: entra en la lista.
 *
 * Accesibilidad: los rótulos estaban en `text-[9px]`. Hay gente del equipo con
 * baja visión, así que el piso acá es 11px con peso alto y contraste medido
 * blanco-sobre-color; el estado además se lee en texto, nunca solo por color.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Play, Tag, Image as ImageIcon, Settings, MoreHorizontal } from 'lucide-react';

export interface InboxHeaderProps {
    conectado: boolean;
    telefono: string | null;
    /** Transporte oficial de Meta: no hay bot ni seguimientos que apagar. */
    esApiOficial: boolean;
    calidad?: string | null;
    error?: string | null;

    asistenteActivo: boolean;
    onToggleAsistente: (proximo: boolean) => void;
    seguimientosActivos: boolean;
    onToggleSeguimientos: (proximo: boolean) => void;

    sincronizando: boolean;
    onSincronizar: () => void;
    onProbarChat: () => void;
    onAbrirEtiquetas: () => void;
    onAbrirPersonalidad: () => void;
    personalidadAbierta: boolean;
}

/** Un interruptor con su estado escrito al lado, no solo pintado. */
function Interruptor({ rotulo, activo, textoActivo, textoInactivo, color, onToggle, title }: {
    rotulo: string;
    activo: boolean;
    textoActivo: string;
    textoInactivo: string;
    color: 'emerald' | 'sky';
    onToggle: () => void;
    title?: string;
}) {
    const encendido = color === 'emerald' ? 'bg-emerald-600' : 'bg-sky-600';
    const textoOn = color === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-sky-700 dark:text-sky-400';

    return (
        <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-end leading-tight">
                <span className="text-[11px] font-bold uppercase tracking-wide text-stone-600 dark:text-stone-400">{rotulo}</span>
                <span className={`text-[11px] font-bold ${activo ? textoOn : 'text-stone-600 dark:text-stone-400'}`}>
                    {activo ? textoActivo : textoInactivo}
                </span>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={activo}
                aria-label={`${rotulo}: ${activo ? textoActivo : textoInactivo}`}
                title={title}
                onClick={onToggle}
                className={`w-11 h-6 rounded-full transition-colors relative shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-500 ${activo ? encendido : 'bg-stone-400 dark:bg-stone-700'}`}
            >
                <span className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${activo ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
            </button>
        </div>
    );
}

export default function InboxHeader({
    conectado, telefono, esApiOficial, calidad, error,
    asistenteActivo, onToggleAsistente,
    seguimientosActivos, onToggleSeguimientos,
    sincronizando, onSincronizar, onProbarChat,
    onAbrirEtiquetas, onAbrirPersonalidad, personalidadAbierta,
}: InboxHeaderProps) {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Un menú que no se cierra al clickear afuera queda tapando la lista de
    // chats, que es justo lo que hay que seguir mirando.
    useEffect(() => {
        if (!menuAbierto) return;
        const fuera = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
        };
        const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', escape); };
    }, [menuAbierto]);

    const itemMenu = 'flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left';

    return (
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-stone-200/70 dark:border-white/5 bg-white/70 dark:bg-black/30 backdrop-blur-2xl flex-shrink-0 z-20">
            {/* ── 1. Estado ─────────────────────────────────────────────── */}
            <div className="min-w-0">
                <h1 className="text-lg font-black text-stone-900 dark:text-white tracking-tight leading-none">Comunicaciones</h1>
                <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400 flex items-center gap-1.5 mt-1.5 truncate">
                    <span
                        aria-hidden
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${conectado ? 'bg-emerald-600 animate-pulse' : 'bg-red-600'}`}
                    />
                    {conectado
                        ? <>{esApiOficial ? 'API oficial' : 'Conectado'} · {telefono}{esApiOficial && calidad ? ` · calidad ${calidad}` : ''}</>
                        : <>{esApiOficial ? `Sin conexión con la API${error ? `: ${error}` : ''}` : 'Desconectado'}</>}
                </p>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
                {/* ── 2. Lo que cambia el comportamiento ─────────────────── */}
                {!esApiOficial && (
                    <div className="flex items-center gap-5 bg-white/80 dark:bg-stone-900/70 px-4 py-2 rounded-2xl border border-stone-300/70 dark:border-stone-800 shadow-sm">
                        <Interruptor
                            rotulo="Asistente IA"
                            activo={asistenteActivo}
                            textoActivo="Activa" textoInactivo="Inactiva"
                            color="emerald"
                            onToggle={() => onToggleAsistente(!asistenteActivo)}
                        />
                        <span aria-hidden className="w-px h-8 bg-stone-300 dark:bg-stone-700" />
                        <Interruptor
                            rotulo="Seguimientos"
                            activo={seguimientosActivos}
                            textoActivo="Activos" textoInactivo="Pausados"
                            color="sky"
                            onToggle={() => onToggleSeguimientos(!seguimientosActivos)}
                            title={seguimientosActivos
                                ? 'Pausar todos los seguimientos automáticos salientes'
                                : 'Reanudar los seguimientos automáticos salientes'}
                        />
                    </div>
                )}

                {/* ── 3. La acción de todos los días ─────────────────────── */}
                {conectado && !esApiOficial && (
                    <button
                        type="button"
                        onClick={onSincronizar}
                        disabled={sincronizando}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-500"
                    >
                        <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
                        {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
                    </button>
                )}

                {/* ── 4. Lo que se abre de vez en cuando ─────────────────── */}
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setMenuAbierto(v => !v)}
                        aria-haspopup="menu"
                        aria-expanded={menuAbierto}
                        aria-label="Más opciones"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors border shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-stone-500 ${
                            menuAbierto || personalidadAbierta
                                ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-white border-stone-300 dark:border-stone-600'
                                : 'bg-white/90 dark:bg-stone-800/90 text-stone-700 dark:text-stone-200 border-stone-300/70 dark:border-white/10 hover:bg-white dark:hover:bg-stone-800'
                        }`}
                    >
                        <MoreHorizontal className="w-4 h-4" /> Más
                    </button>

                    {menuAbierto && (
                        <div
                            role="menu"
                            className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden py-1.5 z-30"
                        >
                            <button type="button" role="menuitem" className={itemMenu} onClick={() => { setMenuAbierto(false); onAbrirEtiquetas(); }}>
                                <Tag className="w-4 h-4 text-stone-500" /> Etiquetas
                            </button>
                            <Link href="/admin/whatsapp/fotos" role="menuitem" className={itemMenu} onClick={() => setMenuAbierto(false)}>
                                <ImageIcon className="w-4 h-4 text-stone-500" /> Galería de fotos
                            </Link>
                            {!esApiOficial && (
                                <>
                                    <span aria-hidden className="block h-px my-1.5 bg-stone-200 dark:bg-stone-800" />
                                    <button type="button" role="menuitem" className={itemMenu} onClick={() => { setMenuAbierto(false); onProbarChat(); }}>
                                        <Play className="w-4 h-4 text-stone-500" /> Probar chat
                                    </button>
                                    <button type="button" role="menuitem" className={itemMenu} onClick={() => { setMenuAbierto(false); onAbrirPersonalidad(); }}>
                                        <Settings className="w-4 h-4 text-stone-500" /> Personalidad del asistente
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
