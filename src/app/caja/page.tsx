'use client';

import { useState, useEffect } from 'react';
import {
    Wallet, Loader2, Plus, X, AlertCircle,
    ArrowUpRight, ArrowDownRight, ImageIcon,
    History, Banknote, Building2, PiggyBank, MoreHorizontal,
    CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { resolveStorageUrl } from '@/lib/utils/storage';

// ── Types ─────────────────────────────────────

interface CashMovement {
    id: string;
    type: 'IN' | 'OUT';
    amount: number;
    reason: string;
    category: string;
    laboratory?: string | null;
    receiptUrl?: string | null;
    createdAt: string;
    user: { name: string };
}

const CATEGORIES = [
    { key: 'VENTA', label: 'Venta Entrante', icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    { key: 'GASTO_GENERAL', label: 'Gasto General', icon: Banknote, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950' },
    { key: 'PAGO_LABORATORIO', label: 'Pago Laboratorio', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
    { key: 'APORTE_EFECTIVO', label: 'Aporte de Efectivo', icon: PiggyBank, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950' },
    { key: 'OTRO', label: 'Otro', icon: MoreHorizontal, color: 'text-stone-500', bg: 'bg-stone-50 dark:bg-stone-800' },
];

const getCategoryInfo = (key: string) => CATEGORIES.find(c => c.key === key) || CATEGORIES.find(c => c.key === 'OTRO') || CATEGORIES[0];

// ── Page ──────────────────────────────────

export default function CajaPage() {
    const [movements, setMovements] = useState<CashMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [movementType, setMovementType] = useState<'IN' | 'OUT'>('OUT');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [category, setCategory] = useState('GASTO_GENERAL');
    const [laboratory, setLaboratory] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

    useEffect(() => {
        fetchMovements();
    }, []);

    const fetchMovements = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/cash');
            const json = await res.json();
            if (json.movements) {
                setMovements(json.movements);
            }
        } catch (error) {
            console.error('Error fetching movements:', error);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setAmount('');
        setReason('');
        setCategory('GASTO_GENERAL');
        setLaboratory('');
        setReceiptFile(null);
        setMovementType('OUT');
    };

    const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setReceiptFile(file);
    };

    const handleSaveMovement = async () => {
        if (!amount || !reason) return;
        setIsSaving(true);
        try {
            const userRes = await fetch('/api/auth/me');
            const userData = await userRes.json();

            let receiptUrlStr = '';
            if (receiptFile) {
                const formData = new FormData();
                formData.append('file', receiptFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                
                if (!uploadRes.ok) {
                    throw new Error(uploadData.error || 'Error al subir la foto del comprobante');
                }
                receiptUrlStr = uploadData.url;
            }

            const res = await fetch('/api/cash/movement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userData.id
                },
                body: JSON.stringify({
                    type: movementType,
                    amount: parseFloat(amount),
                    reason,
                    category,
                    laboratory: category === 'PAGO_LABORATORIO' ? laboratory : undefined,
                    receiptUrl: receiptUrlStr || undefined
                })
            });

            if (res.ok) {
                setShowModal(false);
                resetForm();
                fetchMovements();
                setSuccessMessage(movementType === 'IN' ? '✅ Ingreso registrado' : '✅ Egreso registrado');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            console.error('Error saving movement:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && movements.length === 0) {
        return (
            <main className="p-4 lg:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Cargando caja...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="p-4 lg:p-8 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
                    <CheckCircle2 size={20} />
                    <span className="text-sm font-black">{successMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <Wallet className="w-5 h-5" />
                        </div>
                        Movimientos de Caja
                    </h1>
                    <p className="text-stone-400 text-xs mt-1.5 font-medium">
                        Registrá ingresos y egresos de efectivo
                    </p>
                </div>
            </div>

            {/* Action Buttons — Two big buttons */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    onClick={() => { setMovementType('IN'); setCategory('APORTE_EFECTIVO'); setShowModal(true); }}
                    className="group bg-white dark:bg-stone-900 border-2 border-emerald-200 dark:border-emerald-800 rounded-[2rem] p-6 sm:p-8 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/20 active:scale-[0.98]"
                >
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <ArrowUpRight className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm sm:text-base font-black text-stone-800 dark:text-white tracking-tight">Ingreso</p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Entrada de Efectivo</p>
                </button>

                <button
                    onClick={() => { setMovementType('OUT'); setCategory('GASTO_GENERAL'); setShowModal(true); }}
                    className="group bg-white dark:bg-stone-900 border-2 border-red-200 dark:border-red-900 rounded-[2rem] p-6 sm:p-8 hover:border-red-400 dark:hover:border-red-700 transition-all hover:shadow-xl hover:shadow-red-100/50 dark:hover:shadow-red-900/20 active:scale-[0.98]"
                >
                    <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <ArrowDownRight className="w-7 h-7 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-sm sm:text-base font-black text-stone-800 dark:text-white tracking-tight">Egreso</p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Salida de Efectivo</p>
                </button>
            </div>

            {/* Recent Movements List */}
            <div className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-stone-50 dark:border-stone-800 flex items-center gap-3">
                    <History className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-black text-stone-800 dark:text-white tracking-tight">Últimos Movimientos</h2>
                </div>

                {movements.length > 0 ? (
                    <div className="divide-y divide-stone-50 dark:divide-stone-800">
                        {movements.slice(0, 30).map((m) => {
                            const catInfo = getCategoryInfo(m.category || 'OTRO');
                            const CatIcon = catInfo.icon;
                            return (
                                <div key={m.id} className="px-6 sm:px-8 py-5 flex items-center gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors group">
                                    {/* Type icon */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                                        m.type === 'IN' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                    }`}>
                                        {m.type === 'IN' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-sm font-black text-stone-800 dark:text-white truncate">{m.reason}</p>
                                            {m.laboratory && (
                                                <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                                                    {m.laboratory}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-stone-400">
                                            <span className="flex items-center gap-1">
                                                <CatIcon size={10} className={catInfo.color} />
                                                {catInfo.label}
                                            </span>
                                            <span className="text-stone-200 dark:text-stone-700">|</span>
                                            <span>{m.createdAt ? format(new Date(m.createdAt), 'dd MMM, HH:mm', { locale: es }) : '---'}</span>
                                        </div>
                                    </div>

                                    {/* Receipt */}
                                    {m.receiptUrl && (
                                        <button 
                                            onClick={() => setViewingReceipt(resolveStorageUrl(m.receiptUrl || null))}
                                            className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                                            title="Ver comprobante"
                                        >
                                            <ImageIcon size={16} />
                                        </button>
                                    )}

                                    {/* Amount */}
                                    <p className={`text-lg font-black tracking-tight shrink-0 ${m.type === 'IN' ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {m.type === 'IN' ? '+' : '-'}${(m.amount ?? 0).toLocaleString('es-AR')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-stone-300 dark:text-stone-700">
                        <Wallet size={40} className="mb-3 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">No hay movimientos registrados</p>
                        <p className="text-[10px] text-stone-400 mt-1">Usá los botones de arriba para registrar un movimiento</p>
                    </div>
                )}
            </div>

            {/* Receipt View Modal */}
            {viewingReceipt && (
                <div
                    className="fixed inset-0 bg-stone-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300"
                    onClick={() => setViewingReceipt(null)}
                >
                    <div className="bg-white dark:bg-stone-800 rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-stone-400">Vista de Comprobante</span>
                            <button onClick={() => setViewingReceipt(null)} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-stone-50 dark:bg-stone-900/50 p-4">
                            <img src={viewingReceipt} alt="Comprobante" className="w-full h-auto rounded-2xl shadow-lg" />
                        </div>
                    </div>
                </div>
            )}

            {/* Movement Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-stone-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 sm:p-8">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                                        movementType === 'IN'
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                                            : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                    }`}>
                                        {movementType === 'IN' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-stone-800 dark:text-white tracking-tight">
                                            {movementType === 'IN' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                                        </h3>
                                        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">
                                            {movementType === 'IN' ? 'Entrada de Efectivo' : 'Salida de Efectivo'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Type Toggle */}
                            <div className="flex bg-stone-100 dark:bg-stone-900 p-1 rounded-xl mb-6">
                                <button
                                    onClick={() => { setMovementType('IN'); setCategory('APORTE_EFECTIVO'); }}
                                    className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        movementType === 'IN'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'text-stone-400 hover:text-stone-600'
                                    }`}
                                >
                                    <ArrowUpRight size={14} /> Ingreso
                                </button>
                                <button
                                    onClick={() => { setMovementType('OUT'); setCategory('GASTO_GENERAL'); }}
                                    className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        movementType === 'OUT'
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                            : 'text-stone-400 hover:text-stone-600'
                                    }`}
                                >
                                    <ArrowDownRight size={14} /> Egreso
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* Amount */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Monto</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-stone-300">$</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0"
                                            className={`w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl py-4 pl-10 pr-5 text-xl font-black outline-none focus:ring-4 transition-all placeholder:text-stone-200 ${
                                                movementType === 'IN' ? 'focus:ring-emerald-500/10' : 'focus:ring-red-500/10'
                                            }`}
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Categoría</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {CATEGORIES
                                            .filter(c => {
                                                // For IN: show APORTE_EFECTIVO and OTRO
                                                // For OUT: show GASTO_GENERAL, PAGO_LABORATORIO, OTRO
                                                if (movementType === 'IN') return c.key === 'APORTE_EFECTIVO' || c.key === 'OTRO';
                                                return c.key !== 'APORTE_EFECTIVO';
                                            })
                                            .map(c => {
                                                const CIcon = c.icon;
                                                const isSelected = category === c.key;
                                                return (
                                                    <button
                                                        key={c.key}
                                                        onClick={() => setCategory(c.key)}
                                                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                                            isSelected
                                                                ? `${c.bg} ${c.color} border-current shadow-sm`
                                                                : 'bg-white dark:bg-stone-900 text-stone-400 border-stone-100 dark:border-stone-700 hover:border-stone-300'
                                                        }`}
                                                    >
                                                        <CIcon size={14} />
                                                        <span className="truncate">{c.label}</span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* Laboratory (conditional) */}
                                {category === 'PAGO_LABORATORIO' && (
                                    <div className="animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Laboratorio</label>
                                        <select
                                            value={laboratory}
                                            onChange={e => setLaboratory(e.target.value)}
                                            className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        >
                                            <option value="">Seleccionar laboratorio...</option>
                                            <option value="GRUPO OPTICO">Grupo Óptico</option>
                                            <option value="OPTOVISION">Optovision</option>
                                            <option value="NEXO">Nexo</option>
                                            <option value="DAAS">Daas</option>
                                            <option value="IOL">IOL</option>
                                            <option value="OTRO">Otro</option>
                                        </select>
                                    </div>
                                )}

                                {/* Reason */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">
                                        Motivo / Descripción
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        placeholder={movementType === 'IN' ? 'Ej: Aporte de efectivo, Cambio...' : 'Ej: Pago cristales, Gastos limpieza...'}
                                        rows={2}
                                        className={`w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-4 transition-all resize-none ${
                                            movementType === 'IN' ? 'focus:ring-emerald-500/10' : 'focus:ring-red-500/10'
                                        }`}
                                    />
                                </div>

                                {/* Receipt Upload */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">
                                        Comprobante (Opcional)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleReceiptUpload}
                                            className="hidden"
                                            id="caja-receipt"
                                        />
                                        <label htmlFor="caja-receipt" className={`w-full h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                            receiptFile ? 'border-primary bg-primary/5 text-primary' : 'border-stone-100 dark:border-stone-800 text-stone-400 hover:bg-stone-50'
                                        }`}>
                                            {receiptFile ? (
                                                <>
                                                    <ImageIcon size={20} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Imagen Cargada ✓</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={20} className="opacity-30" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Subir Foto</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {/* Info Note */}
                                <div className={`p-4 rounded-xl flex gap-3 border ${
                                    movementType === 'OUT'
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'
                                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30'
                                }`}>
                                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                        movementType === 'OUT' ? 'text-amber-500' : 'text-blue-500'
                                    }`} />
                                    <p className={`text-[10px] font-medium leading-relaxed ${
                                        movementType === 'OUT' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'
                                    }`}>
                                        {movementType === 'OUT'
                                            ? 'Este egreso quedará registrado en la caja y se notificará a la administración.'
                                            : 'Este ingreso quedará registrado en la caja del local.'
                                        }
                                    </p>
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleSaveMovement}
                                    disabled={!amount || !reason || isSaving || (category === 'PAGO_LABORATORIO' && !laboratory)}
                                    className={`w-full py-5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:scale-100 ${
                                        movementType === 'IN'
                                            ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
                                            : 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-stone-900/20'
                                    }`}
                                >
                                    {isSaving ? <Loader2 className="animate-spin" /> : (
                                        movementType === 'IN' ? 'Confirmar Ingreso' : 'Confirmar Egreso'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
