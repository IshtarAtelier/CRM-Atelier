import React, { useState, useEffect } from 'react';
import { X, Clock, Save, Loader2 } from 'lucide-react';

interface SettingsModalProps {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [times, setTimes] = useState({
        monofocalStock: '~5 días hábiles',
        monofocalLab: '~10 días hábiles',
        bifocal: '~10 días hábiles',
        multifocalGrupoOptico: '~10 días hábiles',
        multifocalOptovision: '~15 a 20 días hábiles',
        contactoEsfericas: '~2 días hábiles',
        contactoToricas: 'A consultar / a pedido',
        aclaracion: 'Siempre aclara que los días son aproximados y que la óptica avisa por WhatsApp cuando están listos para retirar.'
    });

    useEffect(() => {
        fetch('/api/settings?key=MANUFACTURING_TIMES')
            .then(res => res.json())
            .then(data => {
                if (data && data.value) {
                    setTimes(data.value);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'MANUFACTURING_TIMES', value: times })
            });
            if (res.ok) {
                onClose();
            } else {
                alert('Error al guardar configuraciones');
            }
        } catch (e) {
            alert('Error de conexión');
        }
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[3rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300">
                <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-stone-800 dark:text-white tracking-tighter italic">Tiempos de <span className="text-primary not-italic">Confección</span></h2>
                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">Configuración del Bot IA</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-colors">
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </header>

                <div className="p-6 md:p-8 overflow-y-auto flex-1 no-scrollbar space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Cargando tiempos...</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex gap-4">
                                <Clock className="w-6 h-6 text-primary shrink-0" />
                                <div>
                                    <h4 className="text-sm font-black text-primary uppercase tracking-widest">Atención</h4>
                                    <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mt-1">
                                        El asistente de inteligencia artificial leerá estos tiempos para informar a los clientes de manera automática sobre las demoras.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Monofocales Stock</label>
                                    <input type="text" value={times.monofocalStock} onChange={e => setTimes({ ...times, monofocalStock: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Monofocales Laboratorio</label>
                                    <input type="text" value={times.monofocalLab} onChange={e => setTimes({ ...times, monofocalLab: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Bifocales</label>
                                    <input type="text" value={times.bifocal} onChange={e => setTimes({ ...times, bifocal: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Multifocales (Grupo Óptico)</label>
                                    <input type="text" value={times.multifocalGrupoOptico} onChange={e => setTimes({ ...times, multifocalGrupoOptico: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Multifocales (Optovision)</label>
                                    <input type="text" value={times.multifocalOptovision} onChange={e => setTimes({ ...times, multifocalOptovision: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">L. de Contacto Esféricas</label>
                                    <input type="text" value={times.contactoEsfericas} onChange={e => setTimes({ ...times, contactoEsfericas: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">L. de Contacto Tóricas / Especiales</label>
                                    <input type="text" value={times.contactoToricas} onChange={e => setTimes({ ...times, contactoToricas: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Aclaración para el Cliente</label>
                                    <textarea value={times.aclaracion} onChange={e => setTimes({ ...times, aclaracion: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary min-h-[100px] resize-none" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <footer className="p-6 md:p-8 border-t border-stone-100 dark:border-stone-800 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="w-full py-4 bg-stone-900 dark:bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl"
                    >
                        {saving ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                        ) : (
                            <><Save className="w-5 h-5" /> Guardar Tiempos</>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
}
