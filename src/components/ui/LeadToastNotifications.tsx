'use client';

/**
 * Los carteles de la esquina superior derecha del panel: lead nuevo, mensaje
 * entrante, tarea agendada por la IA y bot caído.
 *
 * Ya no abre su propio socket ni emite notificaciones del sistema: los eventos
 * llegan del `WhatsAppProvider`, que es el único que habla con el bot y el único
 * que muestra carteles del sistema operativo. Antes había tres sockets por
 * pestaña y el mismo mensaje avisaba dos veces.
 *
 * Lo único que sigue decidiendo acá es QUIÉN ve qué: los errores del bot son
 * ruido para quien no puede hacer nada con ellos, así que solo los ve ADMIN.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, ExternalLink, FileText, Link2, MessageCircle, UserPlus, X } from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/icons';
import { useWhatsAppAcciones, useWhatsAppDatos } from '@/components/whatsapp/WhatsAppProvider';

export function LeadToastNotifications() {
    const { eventos } = useWhatsAppDatos();
    const { descartarEvento } = useWhatsAppAcciones();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [saliendo, setSaliendo] = useState<string[]>([]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => (res.ok ? res.json() : null))
            .then(data => { if (data?.role) setUserRole(data.role); })
            .catch(() => {});
    }, []);

    const cerrar = (id: string) => {
        setSaliendo(prev => [...prev, id]);
        setTimeout(() => {
            descartarEvento(id);
            setSaliendo(prev => prev.filter(x => x !== id));
        }, 300);
    };

    const visibles = eventos.filter(e => e.tipo !== 'BOT_ERROR' || userRole === 'ADMIN');
    if (visibles.length === 0) return null;

    return (
        <div
            role="region"
            aria-live="polite"
            aria-label="Avisos de WhatsApp"
            className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none"
        >
            {visibles.map(evento => {
                const d = evento.data as Record<string, string | boolean | undefined>;
                const esError = evento.tipo === 'BOT_ERROR';
                const esMensaje = evento.tipo === 'MESSAGE';
                const esTarea = evento.tipo === 'TAREA';
                const esVinculado = !!d.isLinked;

                const titulo = esMensaje ? `💬 ${d.name}`
                    : esError ? '⚠️ Bot desactivado'
                    : esTarea ? '📅 Tarea programada'
                    : esVinculado ? `🔗 ${d.name}`
                    : `🌟 ${d.name}`;

                const barra = esMensaje ? 'bg-emerald-600'
                    : esError ? 'bg-red-600'
                    : esTarea ? 'bg-violet-600'
                    : esVinculado ? 'bg-indigo-600'
                    : 'bg-emerald-600';

                const icono = esMensaje ? <WhatsAppIcon className="w-5 h-5 text-white" />
                    : esError ? <AlertTriangle className="w-5 h-5 text-white" />
                    : esTarea ? <Calendar className="w-5 h-5 text-white" />
                    : esVinculado ? <Link2 className="w-5 h-5 text-white" />
                    : d.hasPrescription ? <FileText className="w-5 h-5 text-white" />
                    : <UserPlus className="w-5 h-5 text-white" />;

                const enlace = esMensaje || esError
                    ? (d.phone ? `/admin/whatsapp?phone=${d.phone}` : '/admin/whatsapp')
                    : esTarea ? null
                    : `/admin/contactos?id=${d.id}`;

                return (
                    <div
                        key={evento.id}
                        className={`pointer-events-auto w-[380px] bg-white dark:bg-stone-900 rounded-2xl border border-stone-300 dark:border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ${
                            saliendo.includes(evento.id) ? 'opacity-0 translate-x-[120%]' : 'opacity-100 translate-x-0'
                        }`}
                    >
                        <div className={`h-1 animate-shrink-width ${barra}`} />
                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${barra}`}>
                                    {icono}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-black text-stone-900 dark:text-white truncate">{titulo}</h4>
                                        <button
                                            type="button"
                                            onClick={() => cerrar(evento.id)}
                                            aria-label="Descartar el aviso"
                                            className="min-w-10 min-h-10 -m-2 inline-flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                        >
                                            <X className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                                        </button>
                                    </div>

                                    {esMensaje && (
                                        <p className="text-xs text-stone-700 dark:text-stone-300 font-medium mt-1 line-clamp-2 leading-relaxed">
                                            {d.content}
                                        </p>
                                    )}
                                    {esError && (
                                        <>
                                            <p className="text-xs text-stone-700 dark:text-stone-300 font-bold mt-1">
                                                Cliente: <span className="text-stone-900 dark:text-stone-100">{d.name}</span>
                                            </p>
                                            <p className="text-xs text-red-700 dark:text-red-400 font-semibold mt-0.5">Motivo: {d.error}</p>
                                        </>
                                    )}
                                    {esTarea && (
                                        <p className="text-xs text-stone-700 dark:text-stone-300 font-medium mt-1">
                                            La ficha inteligente agendó: {d.description}
                                        </p>
                                    )}
                                    {!esMensaje && !esError && !esTarea && (
                                        <>
                                            <p className="text-xs text-stone-700 dark:text-stone-300 font-medium mt-0.5">
                                                {esVinculado
                                                    ? 'Conversación vinculada a ficha existente.'
                                                    : <>Interés: <span className="font-bold text-stone-900 dark:text-stone-100">{d.interest || 'sin definir'}</span></>}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {d.hasPrescription && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 text-[11px] font-bold">
                                                        <FileText className="w-3 h-3" aria-hidden /> Envió receta
                                                    </span>
                                                )}
                                                {d.source && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-300 text-[11px] font-bold">
                                                        vía {d.source}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {enlace && (
                                        <a
                                            href={enlace}
                                            className="mt-3 flex items-center justify-center gap-2 w-full min-h-10 rounded-xl text-xs font-bold transition-all border bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                        >
                                            {esMensaje
                                                ? <><MessageCircle className="w-4 h-4" aria-hidden /> Ir al chat</>
                                                : <><ExternalLink className="w-4 h-4" aria-hidden /> {esError ? 'Atender conversación' : 'Ver ficha del contacto'}</>}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
