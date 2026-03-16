'use client';

import { useState } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, Loader2/*, Download*/ } from 'lucide-react';

interface InvoiceModalProps {
    order: {
        id: string;
        total: number;
        client: {
            name: string;
            dni?: string | null;
            phone?: string | null;
        };
    };
    onClose: () => void;
    onSuccess: () => void;
}

const DOC_TYPES = [
    { value: 99, label: 'Sin identificar' },
    { value: 96, label: 'DNI' },
    { value: 80, label: 'CUIT' },
];

export default function InvoiceModal({ order, onClose, onSuccess }: InvoiceModalProps) {
    const [docTipo, setDocTipo] = useState(order.client.dni ? 96 : 99);
    const [docNro, setDocNro] = useState(order.client.dni || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<{
        cae: string;
        caeExpiration: string;
        voucherNumber: number;
        pointOfSale: number;
        voucherLabel: string;
    } | null>(null);

    const handleEmit = async () => {
        setLoading(true);
        setError('');

        // Validar documentación si no es "Sin identificar"  
        if (docTipo !== 99 && !docNro.trim()) {
            setError('Ingresá el número de documento del receptor');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    docTipo,
                    docNro: docTipo === 99 ? '0' : docNro.replace(/\D/g, ''),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al emitir la factura');
            }

            setSuccess({
                cae: data.cae,
                caeExpiration: data.caeExpiration,
                voucherNumber: data.voucherNumber,
                pointOfSale: data.pointOfSale,
                voucherLabel: data.voucherLabel,
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-stone-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6" />
                            <div>
                                <h2 className="text-lg font-black">Emitir Factura C</h2>
                                <p className="text-sm text-blue-100 opacity-80">Factura electrónica ARCA</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Success state */}
                    {success ? (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-black text-stone-800 dark:text-white mb-2">
                                ¡Factura emitida!
                            </h3>
                            <div className="bg-stone-50 dark:bg-stone-700 rounded-2xl p-4 space-y-2 text-left mt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Comprobante</span>
                                    <span className="text-sm font-black text-stone-800 dark:text-white">{success.voucherLabel}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">CAE</span>
                                    <span className="text-sm font-mono font-bold text-blue-600">{success.cae}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Vto. CAE</span>
                                    <span className="text-sm font-bold text-stone-600 dark:text-stone-300">{success.caeExpiration}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total</span>
                                    <span className="text-sm font-black text-emerald-600">${order.total.toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="mt-6 px-8 py-3 bg-stone-900 text-white rounded-2xl font-black text-sm hover:bg-stone-800 transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Order summary */}
                            <div className="bg-stone-50 dark:bg-stone-700 rounded-2xl p-4 mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Cliente</span>
                                    <span className="text-sm font-black text-stone-800 dark:text-white">{order.client.name}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Venta</span>
                                    <span className="text-sm font-bold text-stone-600 dark:text-stone-300">#{order.id.slice(-4).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-stone-200 dark:border-stone-600">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total a facturar</span>
                                    <span className="text-xl font-black text-emerald-600">${order.total.toLocaleString('es-AR')}</span>
                                </div>
                            </div>

                            {/* Receptor info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">
                                        Tipo de Documento
                                    </label>
                                    <div className="flex gap-2">
                                        {DOC_TYPES.map(dt => (
                                            <button
                                                key={dt.value}
                                                onClick={() => {
                                                    setDocTipo(dt.value);
                                                    if (dt.value === 99) setDocNro('0');
                                                    else if (dt.value === 96 && order.client.dni) setDocNro(order.client.dni);
                                                    else setDocNro('');
                                                }}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${docTipo === dt.value
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                    : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:bg-stone-200'
                                                    }`}
                                            >
                                                {dt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {docTipo !== 99 && (
                                    <div>
                                        <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">
                                            Número de Documento
                                        </label>
                                        <input
                                            type="text"
                                            value={docNro}
                                            onChange={e => setDocNro(e.target.value)}
                                            placeholder={docTipo === 96 ? 'Ej: 35123456' : 'Ej: 20351234564'}
                                            className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-700 border-2 border-stone-200 dark:border-stone-600 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                )}

                                <div className="bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-3 flex items-start gap-3">
                                    <FileText className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>Factura C</strong> — Comprobante de Monotributista. No discrimina IVA.
                                    </p>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mt-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-2xl p-3 flex items-start gap-3">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700 dark:text-red-300 font-bold">{error}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-2xl font-black text-sm hover:bg-stone-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleEmit}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-sm hover:shadow-lg hover:shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Emitiendo...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-4 h-4" />
                                            Emitir Factura
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
