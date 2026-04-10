'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskManagerProps {
    tasks: any[];
    onAddTask: (description: string, dueDate?: string) => Promise<void>;
    onToggleTask: (taskId: string, currentStatus: string) => Promise<void>;
}

export default function TaskManager({
    tasks,
    onAddTask,
    onToggleTask
}: TaskManagerProps) {
    const [newTask, setNewTask] = useState('');
    const [taskDueDate, setTaskDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        if (!newTask.trim()) return;
        setIsSaving(true);
        try {
            await onAddTask(newTask, taskDueDate);
            setNewTask('');
            setTaskDueDate('');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-stone-50 dark:bg-stone-800/30 p-6 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 mb-2 block">Nueva tarea pendiente</label>
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Ej: Llamar para confirmar graduación..."
                        className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex gap-3">
                        <input
                            type="date"
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                            className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 text-xs font-black uppercase tracking-widest outline-none"
                        />
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving || !newTask.trim()}
                            className="flex-1 px-6 py-4 bg-stone-900 text-white dark:bg-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                        >
                            {isSaving ? '...' : 'Crear Tarea'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-3">
                {tasks.length === 0 ? (
                    <div className="text-center py-12 text-stone-300 italic text-sm">No hay tareas pendientes.</div>
                ) : (
                    tasks.sort((a, b) => a.status === 'PENDING' ? -1 : 1).map(task => (
                        <div 
                            key={task.id} 
                            className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${
                                task.status === 'COMPLETED' 
                                ? 'bg-stone-50/50 border-stone-100 opacity-60' 
                                : 'bg-white border-stone-100 shadow-sm hover:shadow-md'
                            }`}
                        >
                            <button 
                                onClick={() => onToggleTask(task.id, task.status)}
                                className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    task.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-200 text-transparent hover:border-emerald-500'
                                }`}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <div className="flex-1">
                                <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                                    {task.description}
                                </p>
                                {task.dueDate && (
                                    <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                        <Calendar className="w-3 h-3" />
                                        Vence: {format(new Date(task.dueDate), 'd MMM', { locale: es })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
