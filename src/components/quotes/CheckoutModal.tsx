'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle2, AlertCircle, Banknote, 
    Glasses, User, Receipt, ArrowRight,
    Loader2, Phone, CreditCard, History, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { safePrice } from '@/lib/promo-utils';

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

    // Payment State
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
    const [isAddingPayment, setIsAddingPayment] = useState(false);

    // Prescription Selection
    const hasCrystals = order.items?.some((it: any) => 
        it.product?.type === 'Cristal' || it.product?.category === 'LENS'
    );
    const [selectedRxId, setSelectedRxId] = useState<string | null>(order.prescriptionId || (contact.prescriptions?.[0]?.id || null));

    const total = order.total || 0;
    const paid = order.paid || 0;
    const balance = Math.max(0, total - paid);
    const minRequired = total * 0.4;
    const canConvert = (paid + paymentAmount) >= minRequired && isClientDataComplete && (!hasCrystals || selectedRxId);

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
            // 1. Add payment if any
            if (paymentAmount > 0) {
                const payRes = await fetch(`/api/orders/${order.id}/payments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: paymentAmount,
                        method: paymentMethod,
                        notes: 'Seña inicial para confirmación de venta'
                    })
                });
                if (!payRes.ok) throw new Error('Error al registrar el pago');
            }

            // 2. Convert to Sale
            await onComplete({
                orderType: 'SALE',
                prescriptionId: selectedRxId
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
                    
                    {/* 1. SECCION REPASO DE ITEMS */}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <Receipt className="w-4 h-4" /> Resumen del Pedido
                        </h3>
                        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-3xl p-6 border border-stone-100 dark:border-stone-800">
                            <div className="space-y-3">
                                {order.items?.map((it: any) => (
                                    <div key={it.id} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 bg-stone-200 dark:bg-stone-700 rounded-lg flex items-center justify-center text-[10px] font-black">{it.quantity}</span>
                                            <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
                                                {it.product?.brand || ''} {it.product?.model || it.product?.name || 'Producto'}
                                            </span>
                                        </div>
                                        <span className="text-sm font-black text-stone-900 dark:text-white">${(it.price * it.quantity).toLocaleString()}</span>
                                    </div>
                                ))}
                                {order.appliedPromoDiscount > 0 && (
                                    <div className="pt-3 mt-3 border-t border-dashed border-stone-200 dark:border-stone-700 flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                                        <span className="text-xs font-black uppercase tracking-widest">✨ Bonificación 2x1: {order.appliedPromoName || 'Armazón'}</span>
                                        <span className="text-sm font-black">-${order.appliedPromoDiscount.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Total a pagar</p>
                                    <p className="text-3xl font-black text-stone-900 dark:text-white">${total.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Saldo Pendiente</p>
                                    <p className="text-lg font-black text-amber-600">${balance.toLocaleString()}</p>
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
                                    <button 
                                        className="p-4 rounded-3xl border-2 border-dashed border-stone-200 dark:border-stone-800 hover:border-emerald-300 flex flex-col items-center justify-center gap-2 group transition-all"
                                    >
                                        <Plus className="w-5 h-5 text-stone-300 group-hover:text-emerald-500" />
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Cargar Nueva Especial</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-3xl border-2 border-red-100 flex items-center gap-4">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                    <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Debe cargar una receta para continuar</p>
                                </div>
                            )}
                        </section>
                    )}

                    {/* 4. SECCION PAGOS */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                <Banknote className="w-4 h-4" /> Registro de Pagos / Señas
                            </h3>
                            <button 
                                onClick={() => setIsAddingPayment(!isAddingPayment)}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                            >
                                {isAddingPayment ? 'Cerrar Formulario' : '+ AGREGAR PAGO'}
                            </button>
                        </div>

                        {paid < minRequired && !isAddingPayment && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 p-6 rounded-3xl border-2 border-amber-200 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                        <LockIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Seña Mínima Requerida (40%)</p>
                                        <p className="text-lg font-black text-amber-600">${Math.ceil(minRequired).toLocaleString()}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsAddingPayment(true)}
                                    className="px-6 py-3 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
                                >
                                    ABONAR AHORA
                                </button>
                            </div>
                        )}

                        {isAddingPayment && (
                            <div className="bg-stone-50 dark:bg-stone-800/50 p-6 border-2 border- stone-200 dark:border-stone-800 rounded-3xl space-y-4 animate-in slide-in-from-bottom duration-300">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-stone-400 uppercase block mb-1">Monto a abonar</label>
                                        <input 
                                            type="number"
                                            value={paymentAmount} 
                                            onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 p-3 rounded-xl text-lg font-black text-emerald-600"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-stone-400 uppercase block mb-1">Método de pago</label>
                                        <select 
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value)}
                                            className="w-full bg-white dark:bg-stone-900 border border-stone-200 p-3 rounded-xl text-sm font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_1rem_center] bg-no-repeat"
                                        >
                                            <optgroup label="Efectivo y Transferencias">
                                                <option value="EFECTIVO">Efectivo 💵</option>
                                                <option value="TRANSFERENCIA_ISHTAR">Transferencia Ishtar (Empresa) 🏦</option>
                                                <option value="TRANSFERENCIA_LUCIA">Transferencia Lucía 🏦</option>
                                                <option value="TRANSFERENCIA_ALTERNATIVA">Transferencia Alternativa 🏦</option>
                                            </optgroup>
                                            <optgroup label="Cuotas y Tarjetas (Pay Way)">
                                                <option value="PAY_WAY_6_ISH">Pay Way 6 Ish 💳</option>
                                                <option value="PAY_WAY_3_ISH">Pay Way 3 Ish 💳</option>
                                                <option value="PAY_WAY_6_YANI">Pay Way 6 Yani 💳</option>
                                                <option value="PAY_WAY_3_YANI">Pay Way 3 Yani 💳</option>
                                            </optgroup>
                                            <optgroup label="Otras Financiaciones">
                                                <option value="GO_CUOTAS">Go Cuotas 📱</option>
                                                <option value="NARANJA_Z_ISH">Naranja Z Ish 🍊</option>
                                                <option value="NARANJA_Z_YANI">Naranja Z Yani 🍊</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                                <div className="text-[9px] font-bold text-stone-400 italic">
                                    * El pago será registrado junto con la confirmación de la venta.
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 px-1">
                            <Receipt className="w-4 h-4 text-stone-300" />
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-stone-400 italic">Cobertura del pedido</span>
                                    <span className={(paid + paymentAmount) >= minRequired ? 'text-emerald-500' : 'text-amber-500'}>
                                        ${(paid + paymentAmount).toLocaleString()} / ${Math.ceil(minRequired).toLocaleString()} {(paid + paymentAmount) >= minRequired ? '✓ OK' : '⚠️ FALTA'}
                                    </span>
                                </div>
                                <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                                    <div 
                                        className={`h-full transition-all duration-700 ${(paid + paymentAmount) >= minRequired ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                        style={{ width: `${Math.min(((paid + paymentAmount) / (total || 1)) * 100, 100)}%` }} 
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
