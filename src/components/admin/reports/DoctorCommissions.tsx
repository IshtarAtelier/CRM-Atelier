import React, { useState, useEffect } from 'react';
import { Stethoscope, Check, Minus, MessageCircle } from 'lucide-react';

export function DoctorCommissions() {
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDoctors = async () => {
        try {
            const res = await fetch('/api/doctors/report');
            if (res.ok) {
                const data = await res.json();
                setDoctors(data);
            }
        } catch (err) {
            console.error('Error loading doctors report', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDoctors();
    }, []);

    const handleSettle = async (doctorId: string) => {
        if (!confirm('¿Marcar todas las comisiones pendientes de este médico como liquidadas?')) return;
        try {
            const res = await fetch(`/api/doctors/report?id=${doctorId}`, { method: 'POST' });
            if (res.ok) {
                loadDoctors();
            } else {
                alert('Error al liquidar comisiones.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de red.');
        }
    };

    if (loading) {
        return (
            <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 mt-8 h-48 flex items-center justify-center shadow-xl shadow-stone-200/20 dark:shadow-none">
                <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!doctors || doctors.length === 0) return null;

    return (
        <div className="bg-white/80 dark:bg-stone-800/80 backdrop-blur-xl border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 lg:p-8 mt-8 shadow-xl shadow-stone-200/20 dark:shadow-none">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-900/40 text-pink-500">
                    <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Honorarios</h2>
                    <p className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Comisiones Médicas Pendientes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map(doc => {
                    const sortedSales = [...doc.pendingSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    return (
                        <div key={doc.id} className="group relative bg-white dark:bg-stone-900/50 rounded-2xl border border-stone-100 dark:border-stone-800 p-6 hover:shadow-xl hover:shadow-pink-100/40 dark:hover:shadow-stone-900/50 transition-all duration-300 hover:-translate-y-1 hover:border-pink-200 dark:hover:border-pink-900/50">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <h3 className="font-black text-stone-800 dark:text-white text-lg tracking-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{doc.name}</h3>
                                    <p className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-widest">{doc.pendingSales.length} órdenes pend.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">A Liquidar</p>
                                    <p className="text-xl font-black text-pink-500">${doc.totalPending.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div className="max-h-[160px] overflow-y-auto pr-2 mb-6 space-y-2 custom-scrollbar">
                                {sortedSales.map((sale: any) => (
                                    <div key={sale.id} className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-700/50">
                                        <div>
                                            <p className="text-[10px] font-bold text-stone-700 dark:text-stone-300">
                                                {sale.clientName}
                                            </p>
                                            <p className="text-[8px] font-medium text-stone-400">
                                                {new Date(sale.date).toLocaleDateString('es-AR')} · OP #{sale.id.slice(-4)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-stone-800 dark:text-white">${sale.commission.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex items-center gap-2 pt-4 border-t border-stone-100 dark:border-stone-800">
                                <button
                                    onClick={() => handleSettle(doc.id)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors"
                                >
                                    <Check className="w-4 h-4" />
                                    Liquidar
                                </button>
                                {doc.phone && (
                                    <a
                                        href={`https://wa.me/${doc.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${doc.name}, te escribimos para liquidar tus honorarios por $${doc.totalPending.toLocaleString()}.`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                        title="Enviar comprobante por WhatsApp"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                    </a>
                                )}
                            </div>

                            {/* Ambient background glow on hover */}
                            <div className="absolute -right-8 -top-8 w-24 h-24 bg-pink-400/5 dark:bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-400/10 transition-all duration-500 pointer-events-none" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
