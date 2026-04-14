'use client';

import { useState } from 'react';
import { Plus, CheckCircle2, Clock, AlertCircle, Loader2, Calendar, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Task {
    id: string;
    description: string;
    status: string;
    dueDate?: string | null;
    createdAt: string;
}

interface TaskManagerProps {
    tasks: Task[];
    contact?: any;
    onAddTask: (description: string, dueDate?: string) => Promise<void>;
    onToggleTask: (taskId: string, status: string) => Promise<void>;
}

export default function TaskManager({ tasks, contact, onAddTask, onToggleTask }: TaskManagerProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const pendingTasks = tasks.filter(t => t.status === 'PENDING').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const completedTasks = tasks.filter(t => t.status !== 'PENDING').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onAddTask(description, dueDate || undefined);
            setDescription('');
            setDueDate('');
            setIsAdding(false);
        } catch (error) {
            console.error('Error adding task:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggle = async (taskId: string) => {
        if (togglingId) return;
        setTogglingId(taskId);
        try {
            // Mandamos 'COMPLETED' siempre porque desde este UI solo se completan las pendientes
            await onToggleTask(taskId, 'COMPLETED');
        } catch (error) {
            console.error('Error toggling task:', error);
            alert('Error al completar la tarea. Por favor, intente de nuevo.');
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header con botón de añadir */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Tareas Pendientes
                </h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-stone-900 dark:bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                    <Plus className="w-3.5 h-3.5" /> {isAdding ? 'Cancelar' : 'Nueva Tarea'}
                </button>
            </div>

            {/* Formulario de nueva tarea */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-[2rem] border-2 border-dashed border-stone-200 dark:border-stone-700 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Descripción</label>
                            <input
                                type="text"
                                placeholder="Ej: Llamar para confirmar graduación..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-white dark:bg-stone-900 px-4 py-3 rounded-2xl text-sm font-medium border-2 border-stone-100 dark:border-stone-800 focus:border-stone-900 dark:focus:border-primary transition-all outline-none"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-end gap-3">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Fecha de vencimiento (Opcional)</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full bg-white dark:bg-stone-900 px-4 py-3 rounded-2xl text-sm font-medium border-2 border-stone-100 dark:border-stone-800 focus:border-stone-900 dark:focus:border-primary transition-all outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || !description.trim()}
                                className="h-[48px] px-8 bg-stone-900 dark:bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Añadir'}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Lista de pendientes */}
            <div className="space-y-3">
                {pendingTasks.length > 0 ? (
                    pendingTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-5 bg-white dark:bg-stone-900 rounded-[2.5rem] border-2 border-stone-100 dark:border-stone-800 hover:border-emerald-500/30 dark:hover:border-emerald-500/20 transition-all group shadow-sm">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-stone-800 dark:text-stone-200 truncate">{task.description}</p>
                                {task.dueDate && (
                                    <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] font-black uppercase tracking-widest ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-stone-400'}`}>
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>vence {format(new Date(task.dueDate), "d 'de' MMM", { locale: es })}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                {task.description.includes('Solicitar comentario') && contact?.phone && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const message = `Hola ${contact.name.split(' ')[0]} Te molesto un segundito para que compartas tu experiencia de compra en nuestro perfil de Google y sobre mi atencion:\n👉 https://g.page/r/CcVls8v7ic_NEBM/review\nNos suma muchisimo para seguir creciendo\nEspero tu comentario 🤍✨🫶`;
                                            const phone = contact.phone.replace(/\D/g, '');
                                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                        }}
                                        className="p-3 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl transition-all shadow-sm"
                                        title="Enviar WhatsApp"
                                    >
                                        <MessageCircle className="w-6 h-6" />
                                    </button>
                                )}

                                <button
                                    onClick={() => handleToggle(task.id)}
                                    disabled={togglingId === task.id}
                                    className="p-3 text-stone-200 dark:text-stone-700 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-2xl transition-all disabled:opacity-50 group-hover:text-emerald-500/50"
                                    title="Completar tarea"
                                >
                                    {togglingId === task.id ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-6 h-6" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-stone-50 dark:bg-stone-800/10 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800/50">
                        <CheckCircle2 className="w-10 h-10 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                        <p className="text-xs font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">No hay tareas pendientes</p>
                    </div>
                )}
            </div>

            {/* Completadas */}
            {completedTasks.length > 0 && (
                <div className="pt-8 border-t border-stone-100 dark:border-stone-800">
                    <h4 className="text-[10px] font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                         <CheckCircle2 className="w-3.5 h-3.5" /> Completadas recentemente
                    </h4>
                    <div className="space-y-3">
                        {completedTasks.slice(0, 5).map((task) => (
                            <div key={task.id} className="flex items-center justify-between p-4 bg-stone-50/50 dark:bg-stone-800/30 rounded-2xl border border-stone-100 dark:border-stone-800 group transition-all opacity-60 hover:opacity-100">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400 line-through truncate">{task.description}</p>
                                    <p className="text-[9px] font-bold text-stone-300 uppercase tracking-widest mt-1">Completada</p>
                                </div>
                                <div className="p-2 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
