'use client';

import { useState, useEffect } from 'react';
import {
    Wallet, Loader2, Plus, X, AlertCircle,
    ArrowUpRight, ArrowDownRight, ImageIcon,
    History, Banknote, Percent, HandCoins, Wrench, MoreHorizontal,
    CheckCircle2, Trash2, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { resolveStorageUrl } from '@/lib/utils/storage';

interface VendorSummary {
    id: string;
    name: string;
    role: string;
    balance: number;
}

interface VendorCashEntry {
    id: string;
    vendorId: string;
    vendorName: string;
    type: 'CREDITO' | 'DEBITO';
    amount: number;
    reason: string;
    category: string;
    receiptUrl?: string | null;
    createdByName?: string | null;
    createdAt: string;
}

const CATEGORIES = [
    { key: 'PAGO', label: 'Pago', icon: Banknote, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950', types: ['CREDITO', 'DEBITO'] },
    { key: 'COMISION', label: 'Comisión', icon: Percent, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950', types: ['CREDITO'] },
    { key: 'ADELANTO', label: 'Adelanto', icon: HandCoins, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950', types: ['DEBITO'] },
    { key: 'POST_VENTA', label: 'Post Venta', icon: Wrench, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950', types: ['DEBITO'] },
    { key: 'OTRO', label: 'Otro', icon: MoreHorizontal, color: 'text-stone-500', bg: 'bg-stone-50 dark:bg-stone-800', types: ['CREDITO', 'DEBITO'] },
];

const getCategoryInfo = (key: string) => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

// ── Page ──────────────────────────────────

export default function CajaVendedoresPage() {
    const [vendors, setVendors] = useState<VendorSummary[]>([]);
    const [entries, setEntries] = useState<VendorCashEntry[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [movementType, setMovementType] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
    const [formVendorId, setFormVendorId] = useState('');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [category, setCategory] = useState('PAGO');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vendor-cash');
            const json = await res.json();
            if (res.ok) {
                setVendors(json.vendors || []);
                setEntries(json.entries || []);
                setIsAdmin(!!json.isAdmin);
            }
        } catch (error) {
            console.error('Error cargando caja de vendedores:', error);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setAmount('');
        setReason('');
        setCategory('PAGO');
        setReceiptFile(null);
        setMovementType('CREDITO');
        setFormVendorId('');
    };

    const openModal = (type: 'CREDITO' | 'DEBITO') => {
        setMovementType(type);
        setCategory(type === 'CREDITO' ? 'PAGO' : 'ADELANTO');
        setFormVendorId(selectedVendorId || '');
        setShowModal(true);
    };

    const switchType = (type: 'CREDITO' | 'DEBITO') => {
        setMovementType(type);
        const current = getCategoryInfo(category);
        if (!current.types.includes(type)) {
            setCategory(type === 'CREDITO' ? 'PAGO' : 'ADELANTO');
        }
    };

    const handleSaveMovement = async () => {
        if (!amount || !reason || (isAdmin && !formVendorId)) return;
        setIsSaving(true);
        try {
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

            const res = await fetch('/api/vendor-cash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendorId: formVendorId || undefined,
                    type: movementType,
                    amount: parseFloat(amount),
                    reason,
                    category,
                    receiptUrl: receiptUrlStr || undefined,
                }),
            });

            if (res.ok) {
                setShowModal(false);
                resetForm();
                fetchData();
                setSuccessMessage(movementType === 'CREDITO' ? '✅ Movimiento a favor registrado' : '✅ Descuento registrado');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'No se pudo registrar el movimiento');
            }
        } catch (error: any) {
            console.error('Error guardando movimiento:', error);
            alert(error?.message || 'No se pudo registrar el movimiento');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (entry: VendorCashEntry) => {
        if (!confirm(`¿Borrar este movimiento de ${entry.vendorName} por $${entry.amount.toLocaleString('es-AR')}?`)) return;
        setDeletingId(entry.id);
        try {
            const res = await fetch(`/api/vendor-cash/${entry.id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
                setSuccessMessage('🗑️ Movimiento borrado');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'No se pudo borrar el movimiento');
            }
        } finally {
            setDeletingId(null);
        }
    };

    const visibleEntries = selectedVendorId ? entries.filter(e => e.vendorId === selectedVendorId) : entries;
    const myVendor = !isAdmin && vendors.length === 1 ? vendors[0] : null;
    const selectedVendor = vendors.find(v => v.id === selectedVendorId) || null;

    if (loading && entries.length === 0 && vendors.length === 0) {
        return (
            <main className="p-4 lg:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-sm font-bold text-stone-400">Cargando caja de vendedores...</p>
                </div>
            </main>
        );
    }

    const BalanceCard = ({ vendor, big }: { vendor: VendorSummary; big?: boolean }) => (
        <div className={`bg-gradient-to-br rounded-[2rem] p-6 text-center flex flex-col items-center justify-center shadow-lg border transition-all duration-300 ${
            vendor.balance >= 0
                ? 'from-emerald-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:to-emerald-950/20 border-emerald-500/20 dark:border-emerald-500/10'
                : 'from-red-500/10 to-red-500/5 dark:from-red-950/40 dark:to-red-950/20 border-red-500/20 dark:border-red-500/10'
        }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-md text-white ${
                vendor.balance >= 0 ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'
            }`}>
                <Wallet className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-[0.25em] mb-1">
                {vendor.name}
            </p>
            <p className={`${big ? 'text-4xl' : 'text-2xl'} font-black tracking-tight ${
                vendor.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
                {vendor.balance < 0 ? '-' : ''}${Math.abs(vendor.balance).toLocaleString('es-AR')}
            </p>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                vendor.balance >= 0 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-red-600/70 dark:text-red-400/70'
            }`}>
                {vendor.balance > 0 ? 'Tiene para cobrar' : vendor.balance < 0 ? 'Debe' : 'Sin saldo'}
            </p>
        </div>
    );

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
                            <Users className="w-5 h-5" />
                        </div>
                        Caja de Vendedores
                    </h1>
                    <p className="text-stone-400 text-xs mt-1.5 font-medium">
                        Saldo positivo: hay para cobrar · Saldo negativo: se debe (adelantos, post venta)
                    </p>
                </div>
            </div>

            {/* Admin: vendor cards / STAFF: own balance */}
            {isAdmin ? (
                <div className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vendors.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setSelectedVendorId(selectedVendorId === v.id ? '' : v.id)}
                                className={`text-left rounded-[2rem] transition-all active:scale-[0.98] ${
                                    selectedVendorId === v.id ? 'ring-4 ring-primary/30 scale-[1.01]' : 'hover:scale-[1.01]'
                                }`}
                            >
                                <BalanceCard vendor={v} />
                            </button>
                        ))}
                    </div>
                    {selectedVendor && (
                        <p className="text-center text-[10px] font-black uppercase tracking-widest text-stone-400 mt-3">
                            Mostrando movimientos de {selectedVendor.name} · click de nuevo para ver todos
                        </p>
                    )}
                </div>
            ) : myVendor && (
                <div className="mb-8 flex justify-center">
                    <div className="w-full max-w-md">
                        <BalanceCard vendor={myVendor} big />
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    onClick={() => openModal('CREDITO')}
                    className="group bg-white dark:bg-stone-900 border-2 border-emerald-200 dark:border-emerald-800 rounded-[2rem] p-6 sm:p-8 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/20 active:scale-[0.98]"
                >
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <ArrowUpRight className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm sm:text-base font-black text-stone-800 dark:text-white tracking-tight">A Favor</p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Pago · Comisión</p>
                </button>

                <button
                    onClick={() => openModal('DEBITO')}
                    className="group bg-white dark:bg-stone-900 border-2 border-red-200 dark:border-red-900 rounded-[2rem] p-6 sm:p-8 hover:border-red-400 dark:hover:border-red-700 transition-all hover:shadow-xl hover:shadow-red-100/50 dark:hover:shadow-red-900/20 active:scale-[0.98]"
                >
                    <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <ArrowDownRight className="w-7 h-7 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-sm sm:text-base font-black text-stone-800 dark:text-white tracking-tight">Descuento</p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Adelanto · Post Venta</p>
                </button>
            </div>

            {/* Movements List */}
            <div className="bg-white dark:bg-stone-900 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-stone-50 dark:border-stone-800 flex items-center gap-3">
                    <History className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-black text-stone-800 dark:text-white tracking-tight">
                        Movimientos{selectedVendor ? ` · ${selectedVendor.name}` : ''}
                    </h2>
                </div>

                {visibleEntries.length > 0 ? (
                    <div className="divide-y divide-stone-50 dark:divide-stone-800">
                        {visibleEntries.slice(0, 50).map((e) => {
                            const catInfo = getCategoryInfo(e.category);
                            const CatIcon = catInfo.icon;
                            return (
                                <div key={e.id} className="px-6 sm:px-8 py-5 flex items-center gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors group">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                                        e.type === 'CREDITO' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                    }`}>
                                        {e.type === 'CREDITO' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-sm font-black text-stone-800 dark:text-white truncate">{e.reason}</p>
                                            {isAdmin && !selectedVendorId && (
                                                <span className="text-[9px] font-black bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">
                                                    {e.vendorName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-stone-400 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <CatIcon size={10} className={catInfo.color} />
                                                {catInfo.label}
                                            </span>
                                            <span className="text-stone-200 dark:text-stone-700">|</span>
                                            <span>{e.createdAt ? format(new Date(e.createdAt), 'dd MMM, HH:mm', { locale: es }) : '---'}</span>
                                            {e.createdByName && (
                                                <>
                                                    <span className="text-stone-200 dark:text-stone-700">|</span>
                                                    <span>por {e.createdByName}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {e.receiptUrl && (
                                        <button
                                            onClick={() => setViewingReceipt(resolveStorageUrl(e.receiptUrl || null))}
                                            className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                                            title="Ver comprobante"
                                        >
                                            <ImageIcon size={16} />
                                        </button>
                                    )}

                                    <p className={`text-lg font-black tracking-tight shrink-0 ${e.type === 'CREDITO' ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {e.type === 'CREDITO' ? '+' : '-'}${(e.amount ?? 0).toLocaleString('es-AR')}
                                    </p>

                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(e)}
                                            disabled={deletingId === e.id}
                                            className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                            title="Borrar movimiento"
                                        >
                                            {deletingId === e.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    )}
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
                                        movementType === 'CREDITO'
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                                            : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                    }`}>
                                        {movementType === 'CREDITO' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-stone-800 dark:text-white tracking-tight">
                                            {movementType === 'CREDITO' ? 'Movimiento a Favor' : 'Registrar Descuento'}
                                        </h3>
                                        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest">
                                            {movementType === 'CREDITO' ? 'Suma al saldo del vendedor' : 'Resta del saldo del vendedor'}
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
                                    onClick={() => switchType('CREDITO')}
                                    className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        movementType === 'CREDITO'
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                            : 'text-stone-400 hover:text-stone-600'
                                    }`}
                                >
                                    <ArrowUpRight size={14} /> A Favor
                                </button>
                                <button
                                    onClick={() => switchType('DEBITO')}
                                    className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                        movementType === 'DEBITO'
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                            : 'text-stone-400 hover:text-stone-600'
                                    }`}
                                >
                                    <ArrowDownRight size={14} /> Descuento
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* Vendor selector (admin only) */}
                                {isAdmin && (
                                    <div>
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Vendedor</label>
                                        <select
                                            value={formVendorId}
                                            onChange={e => setFormVendorId(e.target.value)}
                                            className="w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                        >
                                            <option value="">Seleccionar vendedor...</option>
                                            {vendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

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
                                                movementType === 'CREDITO' ? 'focus:ring-emerald-500/10' : 'focus:ring-red-500/10'
                                            }`}
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">Categoría</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {CATEGORIES
                                            .filter(c => c.types.includes(movementType))
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

                                {/* Reason */}
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 block">
                                        Motivo / Descripción
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        placeholder={movementType === 'CREDITO' ? 'Ej: Comisión ventas junio, Pago pendiente...' : 'Ej: Adelanto de sueldo, Descuento post venta pedido #123...'}
                                        rows={2}
                                        className={`w-full bg-stone-50 dark:bg-stone-900 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-4 transition-all resize-none ${
                                            movementType === 'CREDITO' ? 'focus:ring-emerald-500/10' : 'focus:ring-red-500/10'
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
                                            onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                            id="vendor-cash-receipt"
                                        />
                                        <label htmlFor="vendor-cash-receipt" className={`w-full h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
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
                                    movementType === 'DEBITO'
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'
                                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30'
                                }`}>
                                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                        movementType === 'DEBITO' ? 'text-amber-500' : 'text-blue-500'
                                    }`} />
                                    <p className={`text-[10px] font-medium leading-relaxed ${
                                        movementType === 'DEBITO' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'
                                    }`}>
                                        {movementType === 'DEBITO'
                                            ? 'Este descuento resta del saldo del vendedor. Si el saldo queda negativo, el vendedor debe esa diferencia.'
                                            : 'Este movimiento suma al saldo a favor del vendedor. Queda registrado quién lo cargó.'
                                        }
                                    </p>
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleSaveMovement}
                                    disabled={!amount || !reason || isSaving || (isAdmin && !formVendorId)}
                                    className={`w-full py-5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:scale-100 ${
                                        movementType === 'CREDITO'
                                            ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
                                            : 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-stone-900/20'
                                    }`}
                                >
                                    {isSaving ? <Loader2 className="animate-spin" /> : (
                                        movementType === 'CREDITO' ? 'Confirmar a Favor' : 'Confirmar Descuento'
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
