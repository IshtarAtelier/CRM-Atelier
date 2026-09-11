'use client';

import { useState } from 'react';
import { Filter, X, User, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

import { WhatsAppIcon } from '@/components/ui/icons';
import TelefonoCopiable from '@/components/ui/TelefonoCopiable';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';

/**
 * LO QUE PROPONE EL EMBUDO — aparte de las tareas del vendedor.
 *
 * Existe por pedido de Ishtar (10/9/2026): "todo lo que se hace automático no
 * quiero que me muestre el registro en las tareas porque se mezcla con lo que
 * el vendedor debe hacer; en tal caso armá una que sea tareas de embudo, y que
 * se puedan ver, pero separado".
 *
 * Se ven, no se imponen: sin pop-up de vencidas y sin el rojo de la campanita.
 * El embudo las recalcula solo todos los días (`sincronizar-tareas.ts`), así
 * que no hay nada que "completar" a mano — lo que sí hay es el número a mano
 * para escribirle desde el WhatsApp propio y no gastar una plantilla.
 */
interface EmbudoTasksPanelProps {
    tasks: any[];
    onClose: () => void;
}

export default function EmbudoTasksPanel({ tasks, onClose }: EmbudoTasksPanelProps) {
    const [ocultas, setOcultas] = useState<Set<string>>(new Set());

    const finDeHoy = new Date();
    finDeHoy.setHours(23, 59, 59, 999);

    const visibles = tasks.filter(t => !ocultas.has(t.id));

    const paraHoy = (task: any) => !task.dueDate || new Date(task.dueDate) <= finDeHoy;

    return (
        <div className="fixed top-16 right-4 bottom-20 w-[calc(100vw-2rem)] max-w-[28rem] md:top-24 md:right-8 md:bottom-24 md:max-w-[34rem] bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-sky-50/50 dark:bg-sky-950/10">
                <div className="flex items-center gap-3 text-sky-600 dark:text-sky-400">
                    <Filter className="w-6 h-6" />
                    <div>
                        <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                            Tareas de embudo
                        </h3>
                        <p className="text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-widest mt-0.5">
                            Lo que propone el sistema
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 custom-scrollbar">
                {visibles.length > 0 ? (
                    visibles.map(task => (
                        <div key={task.id} className="relative group">
                            <Link
                                href={`/admin/contactos?clientId=${task.clientId}`}
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-4 md:p-5 rounded-[2rem] md:rounded-[2.5rem] border bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-sky-500/30 dark:hover:border-sky-500/20 hover:shadow-xl transition-all text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-500/30 group-hover:bg-sky-500 transition-colors" />

                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 bg-stone-50 dark:bg-stone-900 text-stone-400 group-hover:text-sky-500 group-hover:bg-sky-500/5 transition-all">
                                    <User className="w-5 h-5 md:w-6 md:h-6" />
                                </div>

                                <div className={`flex-1 min-w-0 ${task.client?.phone ? 'pr-24 md:pr-32' : 'pr-16 md:pr-20'}`}>
                                    <p className="font-black text-stone-800 dark:text-stone-200 text-sm tracking-tight uppercase mb-1 truncate">
                                        {task.client?.name || 'Cliente'}
                                    </p>
                                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400 line-clamp-2 leading-tight">
                                        {task.description}
                                    </p>
                                    {task.client?.phone && (
                                        <TelefonoCopiable phone={task.client.phone} className="text-xs mt-1.5" />
                                    )}
                                    {task.dueDate && (
                                        <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-black uppercase tracking-widest ${paraHoy(task) ? 'text-sky-700 dark:text-sky-400' : 'text-stone-600 dark:text-stone-400'}`}>
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                {paraHoy(task) ? 'para hoy' : 'para'} {format(new Date(task.dueDate), "d 'de' MMM", { locale: es })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-sky-500 transition-all group-hover:translate-x-1" />
                            </Link>

                            {task.client?.phone && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const phone = formatPhoneForWhatsApp(task.client.phone);
                                        if (!phone || phone.length <= 3) return;
                                        onClose();
                                        window.location.href = `/admin/whatsapp?phone=${phone}`;
                                    }}
                                    className="absolute right-12 md:right-16 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl md:rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                                    title="Abrir el chat en el buzón"
                                >
                                    <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            )}

                            {/* Ocultar de la lista: solo por esta vez. El embudo la
                                recalcula mañana si sigue haciendo falta — por eso
                                dice "ocultar" y no "completar". */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOcultas(prev => new Set(prev).add(task.id));
                                }}
                                className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-2 md:p-2.5 rounded-xl md:rounded-2xl bg-white hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 shadow-sm transition-all z-10"
                                title="Ocultar por ahora"
                            >
                                <X className="w-4 h-4 md:w-5 md:h-5" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Filter className="w-10 h-10 text-stone-200" />
                        </div>
                        <p className="text-sm font-black text-stone-600 dark:text-stone-400 uppercase tracking-widest leading-relaxed">El embudo no propone nada hoy</p>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 space-y-3">
                <Link
                    href="/admin/leads"
                    onClick={onClose}
                    className="block w-full py-4 bg-white dark:bg-stone-800 border-2 border-sky-500/20 text-sky-700 dark:text-sky-400 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 hover:text-white transition-all shadow-lg text-center"
                >
                    Ver el embudo completo
                </Link>
                <p className="text-[10px] font-black text-stone-600 dark:text-stone-400 uppercase tracking-[0.3em] text-center">
                    Se recalcula solo, todos los días
                </p>
            </footer>
        </div>
    );
}
