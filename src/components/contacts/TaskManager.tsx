'use client';

import { useState } from 'react';
import { Plus, CheckCircle2, Clock, AlertCircle, Loader2, Calendar, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg 
            viewBox="0 0 24 24" 
            className={className}
            fill="currentColor"
        >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

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
                    pendingTasks.map((task, idx) => {
                        const isReview = task.description?.includes('Solicitar comentario') || false;
                        return (
                        <div key={task.id || `task-${idx}`} className={`flex items-center justify-between p-5 bg-white dark:bg-stone-900 rounded-[2.5rem] border-2 transition-all group shadow-sm ${isReview ? 'border-pink-200 dark:border-pink-900/50 hover:border-pink-400 dark:hover:border-pink-500/50 bg-pink-50/30' : 'border-stone-100 dark:border-stone-800 hover:border-emerald-500/30 dark:hover:border-emerald-500/20'}`}>
                            <div className="flex-1 min-w-0 pr-4">
                                <p className={`text-sm font-bold break-words leading-relaxed ${isReview ? 'text-pink-900 dark:text-pink-100' : 'text-stone-800 dark:text-stone-200'}`}>
                                    {task.description}
                                </p>
                                {task.dueDate && (
                                    <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-black uppercase tracking-widest ${new Date(task.dueDate) < new Date() ? 'text-red-500' : isReview ? 'text-pink-400' : 'text-stone-400'}`}>
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>vence {format(new Date(task.dueDate), "d 'de' MMM", { locale: es })}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 ml-4">
                                {isReview && contact?.phone && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const clientName = contact?.name ? contact.name.split(' ')[0] : 'Cliente';
                                            const message = `Hola ${clientName}! Te escribimos para pedirte un favor enorme 🙏\n\n¿Nos dejarías una reseña en Google? Nos ayudaría muchísimo si podés mencionar por qué somos la mejor óptica en Córdoba para vos y cómo fue tu experiencia.\n\nSi podés, contá en la reseña qué anteojos o cristales te hiciste (por ejemplo: multifocales, lentes de sol, cristales Crizal, etc.), ¡nos ayuda un montón! 🙌\n\n👉 https://g.page/r/CcVls8v7ic_NEBM/review\n\n¡Nos suma muchísimo para seguir creciendo!\nEspero tu comentario 🤍✨🫶`;
                                            const phone = contact.phone.replace(/\D/g, '');
                                            
                                            // Copiar mensaje al portapapeles y redirigir al agente activo de WhatsApp en el CRM
                                            navigator.clipboard.writeText(message).catch(() => {});
                                            window.location.href = `/admin/whatsapp?phone=${phone}`;
                                        }}
                                        className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                                        title="Ir al chat de WhatsApp en el CRM (Copia mensaje al portapapeles)"
                                    >
                                        <WhatsAppIcon className="w-5 h-5" />
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
                        );
                    })
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
                        {completedTasks.slice(0, 5).map((task, idx) => (
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
