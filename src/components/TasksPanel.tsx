'use client';

import { useState } from 'react';
import { Bell, X, User, ChevronRight, Clock, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface TasksPanelProps {
    tasks: any[];
    onClose: () => void;
}

export default function TasksPanel({ tasks, onClose }: TasksPanelProps) {
    const [showFuture, setShowFuture] = useState(false);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const urgentTasks = tasks.filter(task => {
        if (!task.dueDate) return true;
        return new Date(task.dueDate) <= today;
    });

    const futureTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) > today;
    });

    const displayedTasks = showFuture ? tasks : urgentTasks;

    return (
        <div className="fixed top-24 right-8 bottom-24 w-96 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/30">
                <div className="flex items-center gap-3 text-primary">
                    <Bell className="w-6 h-6 animate-pulse" />
                    <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                        {showFuture ? 'Todas las Tareas' : 'Tareas Urgentes'}
                    </h3>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {displayedTasks.length > 0 ? (
                    displayedTasks.map(task => (
                        <div key={task.id} className="relative group">
                            <Link
                                href={`/contactos?clientId=${task.clientId}`}
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-5 bg-white dark:bg-stone-800 rounded-[2.5rem] border border-stone-100 dark:border-stone-700 hover:border-primary/30 dark:hover:border-primary/20 hover:shadow-xl transition-all text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

                                <div className="w-12 h-12 bg-stone-50 dark:bg-stone-900 rounded-2xl flex items-center justify-center text-stone-400 group-hover:text-primary group-hover:bg-primary/5 transition-all shrink-0">
                                    <User className="w-6 h-6" />
                                </div>

                                <div className="flex-1 min-w-0 pr-8">
                                    <p className="font-black text-stone-800 dark:text-stone-200 text-sm truncate tracking-tight uppercase mb-1">
                                        {task.client?.name || 'Cliente'}
                                    </p>
                                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400 line-clamp-2 leading-tight lowercase">
                                        {task.description}
                                    </p>
                                    {task.dueDate && (
                                        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-black text-primary uppercase tracking-widest">
                                            <Clock className="w-3 h-3" />
                                            <span>vence {format(new Date(task.dueDate), "d 'de' MMM", { locale: es })}</span>
                                        </div>
                                    )}
                                </div>
                                <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
                            </Link>

                            {/* WhatsApp Action */}
                            {task.description.includes('Solicitar comentario') && task.client?.phone && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const message = `Hola ${task.client.name.split(' ')[0]}! Te escribimos para pedirte un favor enorme 🙏\n\n¿Nos dejarías una reseña en Google? Nos ayudaría muchísimo si podés mencionar por qué somos la mejor óptica en Córdoba para vos y cómo fue tu experiencia.\n\n👉 https://g.page/r/CcVls8v7ic_NEBM/review\n\n¡Nos suma muchísimo para seguir creciendo!\nEspero tu comentario 🤍✨🫶`;
                                        const phone = task.client.phone.replace(/\D/g, '');
                                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                    }}
                                    className="absolute right-12 top-1/2 -translate-y-1/2 p-3 bg-emerald-500 text-white rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                                    title="Enviar WhatsApp"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Bell className="w-10 h-10 text-stone-100" />
                        </div>
                        <p className="text-sm font-black text-stone-300 uppercase tracking-widest leading-relaxed">No hay tareas {showFuture ? 'pendientes' : 'urgentes'} hoy</p>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 space-y-4">
                {futureTasks.length > 0 && (
                    <button
                        onClick={() => setShowFuture(!showFuture)}
                        className="w-full py-4 bg-white dark:bg-stone-800 border-2 border-primary/20 text-primary rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg"
                    >
                        {showFuture ? 'Ver solo urgentes' : `Ver tareas futuras (${futureTasks.length})`}
                    </button>
                )}
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] text-center">Optica CRM v2.0</p>
            </footer>
        </div>
    );
}
