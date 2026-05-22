'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Loader2, Trash2, Pencil, FlaskConical, AlertCircle, Save, X } from 'lucide-react';

interface LabConfig {
    id: string;
    name: string;
    calibrado: number;
    iva: number;
}

export default function LaboratoriosConfigPage() {
    const [laboratories, setLaboratories] = useState<LabConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', calibrado: 0, iva: 0 });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchLaboratories();
    }, []);

    const fetchLaboratories = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/laboratories');
            if (res.ok) {
                const data = await res.json();
                setLaboratories(data.laboratories || []);
            }
        } catch (e) {
            setError('Error al cargar los laboratorios');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            const url = editingId ? `/api/laboratories/${editingId}` : '/api/laboratories';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                await fetchLaboratories();
                setShowForm(false);
                setEditingId(null);
                setForm({ name: '', calibrado: 0, iva: 0 });
            } else {
                const data = await res.json();
                alert(data.error || 'Error al guardar');
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar definitivamente el laboratorio ${name}?`)) return;
        try {
            const res = await fetch(`/api/laboratories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setLaboratories(prev => prev.filter(l => l.id !== id));
            } else {
                const data = await res.json();
                alert(data.error || 'Error al eliminar');
            }
        } catch (e) {
            alert('Error de conexión');
        }
    };

    const startEdit = (lab: LabConfig) => {
        setEditingId(lab.id);
        setForm({ name: lab.name, calibrado: lab.calibrado, iva: lab.iva });
        setShowForm(true);
    };

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: '', calibrado: 0, iva: 0 });
        setShowForm(true);
    };

    return (
        <main className="p-4 lg:p-8 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
                        <FlaskConical className="w-8 h-8 text-violet-500" />
                        Laboratorios
                    </h1>
                    <p className="text-stone-400 mt-1 font-bold text-xs">
                        Configuración de márgenes, calibrado e IVA por laboratorio.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-full text-[11px] font-black shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4" strokeWidth={3} /> Nuevo Lab
                </button>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-stone-300" />
                </div>
            ) : laboratories.length === 0 ? (
                <div className="bg-stone-50/50 dark:bg-stone-800/30 backdrop-blur-md rounded-3xl border border-stone-200/50 dark:border-stone-700/50 p-12 flex flex-col items-center text-center">
                    <AlertCircle className="w-12 h-12 text-stone-300 mb-4" />
                    <p className="text-sm font-black text-stone-500 uppercase tracking-widest">Sin Laboratorios</p>
                    <p className="text-xs text-stone-400 mt-1">Hacé clic en Nuevo Lab para registrar uno.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {laboratories.map(lab => (
                        <div key={lab.id} className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border border-stone-200/50 dark:border-stone-700/50 rounded-[2rem] p-6 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-lg transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-violet-50 dark:bg-violet-950/30 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <FlaskConical className="w-6 h-6 text-violet-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-stone-800 dark:text-white uppercase tracking-tight">{lab.name}</h3>
                                    <div className="flex gap-4 mt-1 text-[10px] font-black uppercase tracking-widest text-stone-400">
                                        <span>Calibrado: <span className="text-violet-600 dark:text-violet-400">${lab.calibrado.toLocaleString('es-AR')}</span></span>
                                        <span>IVA: <span className="text-blue-600 dark:text-blue-400">{lab.iva}%</span></span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => startEdit(lab)} className="p-3 bg-stone-50 dark:bg-stone-800 text-stone-500 hover:text-primary rounded-xl transition-all"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(lab.id, lab.name)} className="p-3 bg-red-50 dark:bg-red-950/30 text-red-400 hover:text-red-600 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-stone-200/50 dark:border-stone-800/50 overflow-hidden animate-in zoom-in-95 duration-300">
                        <header className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/20">
                            <div>
                                <h2 className="text-lg font-black text-stone-800 dark:text-white uppercase tracking-tighter">
                                    {editingId ? 'Editar Laboratorio' : 'Nuevo Laboratorio'}
                                </h2>
                            </div>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full transition-colors text-stone-400">
                                <X className="w-5 h-5" />
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Nombre (Ej: OPTOVISION)</label>
                                <input 
                                    type="text" 
                                    value={form.name} 
                                    onChange={e => setForm({...form, name: e.target.value.toUpperCase()})}
                                    className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-violet-500 transition-all uppercase"
                                    placeholder="Nombre del laboratorio"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Calibrado ($)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={form.calibrado} 
                                            onChange={e => setForm({...form, calibrado: parseFloat(e.target.value) || 0})}
                                            className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl font-black text-base outline-none focus:border-violet-500 transition-all text-violet-600 dark:text-violet-400"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-400 font-black">$</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">IVA Ajuste (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={form.iva} 
                                            onChange={e => setForm({...form, iva: parseFloat(e.target.value) || 0})}
                                            className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl font-black text-base outline-none focus:border-blue-500 transition-all text-blue-600 dark:text-blue-400"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-400 font-black">%</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleSave}
                                disabled={saving || !form.name.trim()}
                                className="w-full py-5 mt-2 bg-stone-900 text-white dark:bg-white dark:text-stone-900 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'GUARDANDO...' : 'GUARDAR LABORATORIO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
