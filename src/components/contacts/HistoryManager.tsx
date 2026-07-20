'use client';

import React, { useState, useEffect } from 'react';
import {
    MessageCircle,
    Calculator,
    ShoppingBag,
    CheckCircle2,
    Sparkles,
    AlertCircle,
    AtSign,
    Image as ImageIcon,
    X
} from 'lucide-react';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryManagerProps {
    contactId: string;
    contactCreatedAt: string;
    contactCreatedBy?: string;
    interactions: any[];
    onAddInteraction: (content: string, directedToId?: string | null, imageUrl?: string | null) => Promise<void>;
}

interface DirectableUser {
    id: string;
    name: string;
    role: string;
}

export default function HistoryManager({
    contactId,
    contactCreatedAt,
    contactCreatedBy = 'Sistema',
    interactions,
    onAddInteraction
}: HistoryManagerProps) {
    const [newNote, setNewNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [directedToId, setDirectedToId] = useState('');
    const [users, setUsers] = useState<DirectableUser[]>([]);
    // Imagen adjunta a la anotación (se sube recién al registrar)
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Usuarios internos a los que se les puede dirigir la nota (se les avisa
    // por email). Se excluyen las cuentas de ópticas mayoristas.
    useEffect(() => {
        fetch('/api/users')
            .then(res => (res.ok ? res.json() : []))
            .then((data: DirectableUser[]) => {
                if (Array.isArray(data)) {
                    setUsers(data.filter(u => u.role !== 'OPTICA'));
                }
            })
            .catch(() => setUsers([]));
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async () => {
        // Se puede registrar solo una imagen (sin texto) o texto con imagen.
        if (!newNote.trim() && !imageFile) return;
        setIsSaving(true);
        try {
            let uploadedUrl: string | null = null;
            if (imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);
                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert(`No se pudo subir la imagen: ${err.error || 'error desconocido'}. La anotación no se registró.`);
                    return;
                }
                const data = await res.json();
                uploadedUrl = data.url || data.fileUrl || null;
            }
            await onAddInteraction(newNote.trim() || '📎 Imagen adjunta', directedToId || null, uploadedUrl);
            setNewNote('');
            setDirectedToId('');
            clearImage();
        } finally {
            setIsSaving(false);
        }
    };

    const getInteractionStyles = (type: string) => {
        switch (type) {
            case 'BUDGET_SENT':
                return {
                    icon: Calculator,
                    borderColor: 'border-amber-400 dark:border-amber-600',
                    textColor: 'text-amber-500 dark:text-amber-400',
                    bgColor: 'bg-amber-50/50 dark:bg-amber-950/10'
                };
            case 'SALE_CONFIRMED':
                return {
                    icon: ShoppingBag,
                    borderColor: 'border-emerald-400 dark:border-emerald-600',
                    textColor: 'text-emerald-500 dark:text-emerald-400',
                    bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/10'
                };
            case 'TASK_COMPLETED':
                return {
                    icon: CheckCircle2,
                    borderColor: 'border-blue-400 dark:border-blue-600',
                    textColor: 'text-blue-500 dark:text-blue-400',
                    bgColor: 'bg-blue-50/50 dark:bg-blue-950/10'
                };
            case 'SYSTEM':
                return {
                    icon: Sparkles,
                    borderColor: 'border-purple-400 dark:border-purple-600',
                    textColor: 'text-purple-500 dark:text-purple-400',
                    bgColor: 'bg-purple-50/50 dark:bg-purple-950/10'
                };
            case 'ERROR':
                return {
                    icon: AlertCircle,
                    borderColor: 'border-red-400 dark:border-red-600',
                    textColor: 'text-red-500 dark:text-red-400',
                    bgColor: 'bg-red-50/50 dark:bg-red-950/10'
                };
            default:
                return {
                    icon: MessageCircle,
                    borderColor: 'border-stone-300 dark:border-stone-700',
                    textColor: 'text-stone-500 dark:text-stone-400',
                    bgColor: 'bg-white dark:bg-stone-900/50'
                };
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-stone-50 dark:bg-stone-800/30 p-6 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 mb-2 block">Nueva anotación</label>
                <div className="flex gap-3">
                    <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Registra una llamada, consulta o detalle..."
                        className="flex-1 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none h-24"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving || (!newNote.trim() && !imageFile)}
                        className="self-end px-6 py-4 bg-stone-900 text-white dark:bg-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                    >
                        {isSaving ? '...' : 'Registrar'}
                    </button>
                </div>

                {/* Adjuntar una imagen a la anotación (queda guardada en el historial) */}
                <div className="flex items-center gap-3 mt-3 ml-1">
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl cursor-pointer hover:border-amber-400 transition-colors">
                        <ImageIcon className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                            {imageFile ? 'Cambiar imagen' : 'Adjuntar imagen'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                    </label>
                    {imagePreview && (
                        <div className="flex items-center gap-2">
                            <img src={imagePreview} alt="Vista previa" className="w-10 h-10 rounded-lg object-cover border border-stone-200 dark:border-stone-700" />
                            <span className="text-[10px] font-medium text-stone-400 truncate max-w-[160px]">{imageFile?.name}</span>
                            <button
                                onClick={clearImage}
                                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 transition-colors"
                                title="Quitar imagen"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
                {/* Dirigir la nota a un compañero: se le avisa por email con link a esta ficha */}
                <div className="flex items-center gap-2 mt-3 ml-1">
                    <AtSign className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 flex-shrink-0">Dirigir a</label>
                    <select
                        value={directedToId}
                        onChange={(e) => setDirectedToId(e.target.value)}
                        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                    >
                        <option value="">Nadie (nota general)</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                    {directedToId && (
                        <span className="text-[10px] font-medium text-stone-400">
                            le llega un email con el link a esta ficha
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Creation Block */}
                <div className="relative pl-8">
                    {interactions.length > 0 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-100 dark:bg-stone-800" />
                    )}
                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-stone-900 rounded-full border-2 border-indigo-400 dark:border-indigo-600 flex items-center justify-center z-10">
                        <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900 shadow-sm transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                {contactCreatedAt && !isNaN(new Date(contactCreatedAt).getTime()) ? format(new Date(contactCreatedAt), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : 'FECHA DESCONOCIDA'}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 leading-relaxed">
                            Ficha creada por <strong className="font-bold">{contactCreatedBy}</strong>
                        </p>
                    </div>
                </div>

                {interactions.map((interaction, idx) => {
                    const styles = getInteractionStyles(interaction.type);
                    const IconComponent = styles.icon;

                    return (
                        <div key={interaction.id || `int-${idx}`} className="relative pl-8">
                            {idx !== interactions.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-stone-100 dark:bg-stone-800" />
                            )}
                            <div className={`absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-stone-900 rounded-full border-2 ${styles.borderColor} flex items-center justify-center z-10`}>
                                <IconComponent className={`w-3 h-3 ${styles.textColor}`} />
                            </div>
                            <div className={`${styles.bgColor} p-5 rounded-2xl border border-stone-100 dark:border-stone-800/80 shadow-sm transition-all`}>
                                <div className="flex justify-between items-start mb-2 gap-2">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                        {format(new Date(interaction.createdAt), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                                    </span>
                                    <span className="flex items-center gap-2 flex-shrink-0">
                                        {interaction.directedToName && (
                                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                                                📣 para {interaction.directedToName}
                                            </span>
                                        )}
                                        {interaction.userName && (
                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                👤 {interaction.userName}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">{interaction.content}</p>
                                {interaction.imageUrl && (
                                    <a
                                        href={resolveStorageUrl(interaction.imageUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block mt-2"
                                        title="Abrir imagen en tamaño completo"
                                    >
                                        <img
                                            src={resolveStorageUrl(interaction.imageUrl)}
                                            alt="Imagen adjunta"
                                            className="max-h-48 rounded-xl border border-stone-200 dark:border-stone-700 hover:opacity-90 transition-opacity"
                                        />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
