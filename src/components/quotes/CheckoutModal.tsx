'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle2, AlertCircle, Banknote, 
    Glasses, User, Receipt, ArrowRight,
    Loader2, Phone, CreditCard, History, Plus,
    Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { safePrice } from '@/lib/promo-utils';
import PrescriptionDetails from '../prescriptions/PrescriptionDetails';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { PricingService } from '@/services/PricingService';

interface CheckoutModalProps {
    order: any;
    contact: any;
    onClose: () => void;
    onComplete: (data: any) => Promise<void>;
    onRefreshContact: () => Promise<void>;
}

export default function CheckoutModal({
    order,
    contact,
    onClose,
    onComplete,
    onRefreshContact
}: CheckoutModalProps) {
    const [step, setStep] = useState<'review' | 'payment' | 'processing'>('review');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Client Data Validation
    const [clientForm, setClientForm] = useState({
        dni: contact.dni || '',
        address: contact.address || '',
        phone: contact.phone || ''
    });
    const isClientDataComplete = clientForm.dni && clientForm.address && clientForm.phone;
    const [isEditingClient, setIsEditingClient] = useState(!isClientDataComplete);

    // Repaso Final: Usar PricingService para consistencia total
    const financials = PricingService.calculateOrderFinancials(order);
    const total = financials.totalCard; // El total de lista es el base
    const paid = financials.paidReal;
    const balance = financials.remainingCard;
    const minRequired = total * 0.4;
    
    // Prescription Selection
    const hasCrystals = order.items?.some((it: any) => 
        it.product?.type === 'Cristal' || it.product?.category === 'LENS' || (it.product?.name || '').includes('Cristal')
    );
    const [selectedRxId, setSelectedRxId] = useState<string | null>(order.prescriptionId || (contact.prescriptions?.[0]?.id || null));

    // Effect to ensure we pick a prescription if it becomes available or if one was just added
    useEffect(() => {
        if (!selectedRxId && contact.prescriptions?.length > 0) {
            setSelectedRxId(contact.prescriptions[0].id);
        }
    }, [contact.prescriptions, selectedRxId]);

    const canConvert = Number(paid) >= Number(minRequired) && isClientDataComplete && (!hasCrystals || selectedRxId);

    const handleUpdateClient = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/contacts/${contact.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientForm)
            });
            if (res.ok) {
                await onRefreshContact();
                setIsEditingClient(false);
            }
        } catch (e) {
            setError('Error al actualizar cliente');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Update client data first if it was edited
            if (isEditingClient && isClientDataComplete) {
                const res = await fetch(`/api/contacts/${contact.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clientForm)
                });
                if (res.ok) {
                    await onRefreshContact();
                }
            }

            // 2. Convert to Sale - Con validación estricta de stock
            await onComplete({
                orderType: 'SALE',
                prescriptionId: selectedRxId,
                clientData: clientForm // Enviamos los datos actualizados del cliente
            });
        } catch (err: any) {
            setError(err.message || 'Error en la operación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[3rem] shadow-huge flex flex-col border border-stone-200 dark:border-stone-800">
                
                {/* Header */}
                <header className="px-8 py-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/50">
                    <div>
                        <h2 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter uppercase italic">Repaso Final y Cierre</h2>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Orden #{order.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-400">
                        <X className="w-6 h-6" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <Receipt className="w-4 h-4" /> Detalle de la Orden (Protocolo Stock)
                        </h3>
                        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-3xl p-6 border border-stone-100 dark:border-stone-800">
                            <div className="space-y-3">
                                {order.items?.map((it: any) => (
                                    <div key={it.id} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 bg-stone-200 dark:bg-stone-700 rounded-lg flex items-center justify-center text-[10px] font-black">{it.quantity}</span>
                                            <div>
                                                <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
                                                    {it.product?.brand || ''} {it.product?.model || it.product?.name || 'Producto'}
                                                </p>
                                                {it.eye && <span className="text-[10px] font-black text-primary uppercase">{it.eye}</span>}
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-stone-900 dark:text-white">${(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString()}</span>
                                    </div>
                                ))}
                                
                                {order.appliedPromoName && (
                                    <div className="pt-3 mt-3 border-t border-dashed border-stone-200 dark:border-stone-700 flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span className="text-xs font-black uppercase tracking-widest">Bonificación Aplicada: {order.appliedPromoName}</span>
                                        </div>
                                        <span className="text-sm font-black">-${(order.discount || 0).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-stone-100 dark:border-stone-800 pt-6">
                                <div>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Subtotal</p>
                                    <p className="text-xl font-black text-stone-800 dark:text-white">${(Number(order.total || 0) + Number(order.discount || 0)).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Bonif. {order.appliedPromoName ? '2x1' : 'Efectivo'}</p>
                                    <p className="text-xl font-black text-emerald-600">-${(financials.totalCard - financials.totalCash).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Pagado Real</p>
                                    <p className="text-xl font-black text-primary">${financials.paidReal.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Saldo Card</p>
                                    <p className="text-xl font-black text-amber-600">${financials.remainingCard.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. SECCION DATOS DEL CLIENTE */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <User className="w-4 h-4" /> Ficha del Cliente
                        </h3>
                        {isEditingClient ? (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-900/50 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top duration-300">
                                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Faltan datos obligatorios para la venta
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-stone-400 uppercase block mb-1">DNI / CUIT</label>
                                        <input 
                                            value={clientForm.dni} 
                                            onChange={e => setClientForm(p => ({...p, dni: e.target.value}))}
                                            className="w-full bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 p-3 rounded-xl text-sm font-bold"
                                            placeholder="Documento"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-stone-400 uppercase block mb-1">Teléfono</label>
                                        <input 
                                            value={clientForm.phone} 
                                            onChange={e => setClientForm(p => ({...p, phone: e.target.value}))}
                                            className="w-full bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 p-3 rounded-xl text-sm font-bold"
                                            placeholder="WhatsApp"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-stone-400 uppercase block mb-1">Dirección</label>
                                        <input 
                                            value={clientForm.address} 
                                            onChange={e => setClientForm(p => ({...p, address: e.target.value}))}
                                            className="w-full bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 p-3 rounded-xl text-sm font-bold"
                                            placeholder="Calle y Nro"
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleUpdateClient}
                                    disabled={loading || !isClientDataComplete}
                                    className="w-full py-3 bg-stone-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                                >
                                    {loading ? 'GUARDANDO...' : 'GUARDAR DATOS CLIENTE'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-100 dark:border-emerald-900/50 rounded-3xl">
                                <div className="flex gap-6">
                                    <div>
                                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">DNI</p>
                                        <p className="text-sm font-bold text-stone-800 dark:text-white">{contact.dni}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Dirección</p>
                                        <p className="text-sm font-bold text-stone-800 dark:text-white">{contact.address}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditingClient(true)} className="text-[10px] font-black text-stone-400 hover:text-stone-900 uppercase tracking-widest">Editar</button>
                            </div>
                        )}
                    </section>

                    {/* 3. SECCION RECETA */}
                    {hasCrystals && (
                        <section className="space-y-4">
                            <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                <Glasses className="w-4 h-4" /> Receta de Laboratorio
                            </h3>
                            {contact.prescriptions?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {contact.prescriptions.map((rx: any) => (
                                        <button 
                                            key={rx.id}
                                            onClick={() => setSelectedRxId(rx.id)}
                                            className={`p-4 rounded-3xl border-2 text-left transition-all ${selectedRxId === rx.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-stone-100 dark:border-stone-800 hover:border-stone-300'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-black text-stone-400 uppercase">{format(new Date(rx.date), 'dd MMM yy', { locale: es })}</span>
                                                {selectedRxId === rx.id && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                            </div>
                                            <p className="text-xs font-bold text-stone-700 dark:text-stone-200">OD: {rx.sphereOD} / {rx.cylinderOD}</p>
                                            <p className="text-xs font-bold text-stone-700 dark:text-stone-200">OI: {rx.sphereOI} / {rx.cylinderOI}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-3xl border-2 border-red-100 flex items-center gap-4">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                    <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Debe cargar una receta para continuar</p>
                                </div>
                            )}

                            {/* Detailed Preview of selected Rx */}
                            {selectedRxId && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <PrescriptionDetails 
                                        prescription={contact.prescriptions?.find((r: any) => r.id === selectedRxId)} 
                                    />
                                </div>
                            )}
                        </section>
                    )}

                        {/* 4. SECCION PAGOS REGISTRADOS */}
                        <section className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                    <Banknote className="w-4 h-4" /> Pagos Registrados
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-stone-400 italic">Mínimo requerido (40%): ${Math.ceil(minRequired).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {order.payments?.length > 0 ? (
                                    order.payments.map((p: any) => (
                                        <div key={p.id} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600">
                                                    <History className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-stone-800 dark:text-white">${p.amount.toLocaleString()}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black uppercase text-stone-400 tracking-widest">{p.method}</span>
                                                        <span className="text-[9px] font-bold text-stone-300 italic">{format(new Date(p.date || p.createdAt), 'dd/MM HH:mm')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {p.receiptUrl && (
                                                <a href={resolveStorageUrl(p.receiptUrl)} target="_blank" className="p-2 hover:bg-white dark:hover:bg-stone-700 rounded-lg transition-all text-primary">
                                                    <ImageIcon className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center bg-stone-50 dark:bg-stone-800/30 rounded-3xl border-2 border-dashed border-stone-100 dark:border-stone-800">
                                        <p className="text-xs font-black text-stone-300 uppercase tracking-widest">No hay pagos registrados aún</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-4 px-1 pt-2">
                                <Receipt className="w-4 h-4 text-stone-300" />
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-stone-400 italic">Cobertura de la Orden</span>
                                        <span className={paid >= minRequired ? 'text-emerald-500' : 'text-amber-500'}>
                                            ${paid.toLocaleString()} / ${Math.ceil(minRequired).toLocaleString()} {paid >= minRequired ? '✓ COMPLETADO' : '⚠️ SEÑA INSUFICIENTE'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                                        <div 
                                            className={`h-full transition-all duration-700 ${paid >= minRequired ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                            style={{ width: `${Math.min((paid / (total || 1)) * 100, 100)}%` }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>
                </main>

                {/* Footer / Actions */}
                <footer className="p-8 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-xs font-black uppercase flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                            onClick={onClose}
                            className="px-8 py-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-black text-xs uppercase tracking-widest"
                        >
                            CANCELAR
                        </button>
                        <button 
                            onClick={handleConfirm}
                            disabled={loading || !canConvert}
                            className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    CONFIRMAR VENTA Y ENVIAR A FÁBRICA <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function LockIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}
