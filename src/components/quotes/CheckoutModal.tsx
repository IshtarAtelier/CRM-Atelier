'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle2, AlertCircle, Banknote, 
    Glasses, User, Receipt, ArrowRight,
    Loader2, History,
    Image as ImageIcon,
    FlaskConical
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PrescriptionDetails from '../prescriptions/PrescriptionDetails';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { PricingService } from '@/services/PricingService';

interface CheckoutModalProps {
    order: any;
    contact: any;
    onClose: () => void;
    onComplete: (data: any) => Promise<void>;
    onRefreshContact: () => Promise<void>;
    onRequestPrescription?: () => void;
}

export default function CheckoutModal({
    order,
    contact,
    onClose,
    onComplete,
    onRefreshContact,
    onRequestPrescription
}: CheckoutModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authorizedByAdmin, setAuthorizedByAdmin] = useState(order.authorizedByAdmin || false);
    const [userRole, setUserRole] = useState('STAFF');
    
    useEffect(() => {
        const loadUserRole = async () => {
            try {
                const stored = localStorage.getItem('user');
                if (stored) {
                    const u = JSON.parse(stored);
                    setUserRole(u.role || 'STAFF');
                    return;
                }
            } catch { }
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const u = await res.json();
                    setUserRole(u.role || 'STAFF');
                    localStorage.setItem('user', JSON.stringify(u));
                }
            } catch { }
        };
        loadUserRole();
    }, []);

    const isAdmin = userRole === 'ADMIN';
    
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
    const total = financials.totalCash; // Cambiado a totalCash como base para la seña del 50%
    const paid = financials.paidReal;
    const minRequired = total * 0.5;
    
    // Prescription Selection
    const hasCrystals = order.items?.some((it: any) => {
        const str = `${it.product?.type || ''} ${it.product?.category || ''} ${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
        return str.includes('cristal') || str.includes('monofocal') || str.includes('multifocal') || str.includes('bifocal') || str.includes('progresivo') || str.includes('ocupacional') || str.includes('lente');
    });

    const isMultifocal = order.items?.some((it: any) => {
        const str = `${it.product?.type || ''} ${it.product?.category || ''} ${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
        return str.includes('multifocal') || str.includes('progresivo') || str.includes('ocupacional');
    });

    const hasTinting = order.items?.some((it: any) => {
        const str = `${it.product?.type || ''} ${it.product?.category || ''} ${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
        return str.includes('teñido') || str.includes('tenido') || str.includes('coloracion');
    });

    const isOrganicoBlanco = order.items?.some((it: any) => {
        const str = `${it.product?.type || ''} ${it.product?.category || ''} ${it.product?.name || ''} ${it.productNameSnapshot || ''}`.toLowerCase();
        return (str.includes('cristal') || str.includes('monofocal') || str.includes('multifocal')) && str.includes('organico') && str.includes('blanco');
    });
    const [selectedRxId, setSelectedRxId] = useState<string | null>(order.prescriptionId || (contact.prescriptions?.[0]?.id || null));

    // Effect to ensure we pick a prescription if it becomes available or if one was just added
    useEffect(() => {
        if (!selectedRxId && contact.prescriptions?.length > 0) {
            setSelectedRxId(contact.prescriptions[0].id);
        }
    }, [contact.prescriptions, selectedRxId]);

    // SmartLab Frame Selection
    const [frameShape, setFrameShape] = useState<string>('');
    const [frameDetails, setFrameDetails] = useState<string>('');
    const [labNotes, setLabNotes] = useState<string>('');
    const [tintType, setTintType] = useState<string>('');
    const [tintColor, setTintColor] = useState<string>('');
    const [tintIntensity, setTintIntensity] = useState<string>('');

    const [frameMeasurePte, setFrameMeasurePte] = useState<string>('');
    const [frameMeasureA, setFrameMeasureA] = useState<string>('');
    const [frameMeasureB, setFrameMeasureB] = useState<string>('');
    const [frameMeasureEd, setFrameMeasureEd] = useState<string>('');

    const isFrameDataComplete = !hasCrystals || (
        frameDetails.trim() !== '' &&
        frameMeasurePte.trim() !== '' &&
        frameMeasureA.trim() !== '' &&
        frameMeasureB.trim() !== '' &&
        frameMeasureEd.trim() !== ''
    );

    const canConvert = (Number(paid) >= Number(minRequired) || authorizedByAdmin) && 
                       isClientDataComplete && 
                       (!hasCrystals || (selectedRxId && isFrameDataComplete));

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
        } catch {
            setError('Error al actualizar cliente');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (loading) return;
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
            let finalLabColor = undefined;
            if (hasTinting && (tintType || tintColor)) {
                finalLabColor = `${tintType} ${tintColor}`.trim();
                if (tintIntensity) finalLabColor += ` (Grado: ${tintIntensity})`;
            }

            await onComplete({
                orderType: 'SALE',
                prescriptionId: selectedRxId,
                clientData: clientForm,
                labFrameShape: frameShape || undefined,
                labFrameDetails: frameDetails || undefined,
                labNotes: labNotes || undefined,
                labColor: finalLabColor,
                labMeasurePte: frameMeasurePte || undefined,
                labMeasureA: frameMeasureA || undefined,
                labMeasureB: frameMeasureB || undefined,
                labMeasureEd: frameMeasureEd || undefined,
                authorizedByAdmin: authorizedByAdmin
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
                                                    {it.product?.brand || ''} · {it.product?.name || 'Producto'}
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
                                        <p className="text-sm font-bold text-stone-800 dark:text-white">{contact.dni || 'No registrado'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Dirección</p>
                                        <p className="text-sm font-bold text-stone-800 dark:text-white">{contact.address || 'No registrada'}</p>
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
                                <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-3xl border-2 border-red-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <AlertCircle className="w-6 h-6 text-red-500" />
                                        <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Debe cargar una receta para continuar</p>
                                    </div>
                                    {onRequestPrescription && (
                                        <button
                                            onClick={() => {
                                                onClose();
                                                onRequestPrescription();
                                            }}
                                            className="px-6 py-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                                        >
                                            CARGAR RECETA
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Detailed Preview of selected Rx */}
                            {selectedRxId && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <PrescriptionDetails 
                                        prescription={contact.prescriptions?.find((r: any) => r.id === selectedRxId)}
                                        editable={true}
                                        contactId={contact.id}
                                        onUpdate={onRefreshContact}
                                    />
                                </div>
                            )}
                        </section>
                    )}

                    {/* 3.5 SECCION SMARTLAB FORMA DE ARMAZON */}
                    {hasCrystals && (
                        <section className="space-y-4">
                            <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <FlaskConical className="w-4 h-4" /> Laboratorio SmartLab
                            </h3>
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-100 dark:border-blue-900/50 rounded-3xl p-6">

                                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-4">Forma de Armazón (Opcional)</label>
                                        <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-8 max-w-sm mx-auto">
                                            {[
                                                { id: 'ovalado', label: 'Ovalado', svg: <ellipse cx="12" cy="12" rx="10" ry="6" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'redondo', label: 'Redondo', svg: <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'rectangular', label: 'Rect', svg: <rect x="2" y="7" width="20" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'cuadrado', label: 'Cuadrado', svg: <rect x="4" y="4" width="16" height="16" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'pantos', label: 'Panto', svg: <path d="M5 10a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0v-2zm12 0a5 5 0 0 1 10 0v2a5 5 0 0 1-10 0v-2zM15 10H17M5 10C5 6 8 3 12 3s7 3 7 7" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'cateye', label: 'Cat-Eye', svg: <><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/></> },
                                                { id: 'aviador', label: 'Aviador', svg: <path d="M4 10c-1.1 0-2 .9-2 2v2c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4v-2c0-1.1-.9-2-2-2H4zm10 0c-1.1 0-2 .9-2 2v2c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4v-2c0-1.1-.9-2-2-2h-2zM12 10V8c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" fill="none" stroke="currentColor" strokeWidth="2"/> },
                                                { id: 'geometrico', label: 'Geométrico', svg: <polygon points="12 3 21 8.5 21 15.5 12 21 3 15.5 3 8.5 12 3" fill="none" stroke="currentColor" strokeWidth="2"/> }
                                            ].map(shape => {
                                                const isSel = frameShape === shape.id;
                                                return (
                                                    <button
                                                        key={shape.id}
                                                        onClick={() => setFrameShape(shape.id)}
                                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all group ${
                                                            isSel ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                                                            : 'border-transparent hover:border-blue-200 bg-white dark:bg-stone-800 text-stone-400 hover:text-blue-500'
                                                        }`}
                                                    >
                                                        <svg viewBox="0 0 24 24" className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform">
                                                            {shape.svg}
                                                        </svg>
                                                        <span className="text-[7px] font-black uppercase tracking-wider">{shape.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mb-4">
                                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-4">Medidas del Armazón</label>
                                            <div className="flex flex-col sm:flex-row gap-6 items-center bg-white/50 dark:bg-stone-900/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                                                <div className="w-full sm:w-1/3 flex justify-center">
                                                    <svg width="120" height="70" viewBox="0 0 120 70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
                                                        <path d="M10 35 C10 15, 45 15, 55 35 C45 65, 10 55, 10 35 Z" />
                                                        <path d="M65 35 C65 15, 100 15, 110 35 C100 65, 65 55, 65 35 Z" />
                                                        <path d="M55 25 Q60 20 65 25" />
                                                        
                                                        {/* A (Ancho) */}
                                                        <line x1="12" y1="35" x2="53" y2="35" strokeDasharray="2,2" />
                                                        <text x="32" y="32" fontSize="6" fill="currentColor" stroke="none">A</text>
                                                        
                                                        {/* B (Alto) */}
                                                        <line x1="32" y1="18" x2="32" y2="52" strokeDasharray="2,2" />
                                                        <text x="35" y="48" fontSize="6" fill="currentColor" stroke="none">B</text>

                                                        {/* ED (Diagonal) */}
                                                        <line x1="15" y1="20" x2="50" y2="50" strokeDasharray="2,2" />
                                                        <text x="20" y="45" fontSize="6" fill="currentColor" stroke="none">ED</text>

                                                        {/* Puente */}
                                                        <line x1="55" y1="20" x2="65" y2="20" strokeDasharray="2,2" />
                                                        <text x="56" y="18" fontSize="6" fill="currentColor" stroke="none">Pte</text>
                                                    </svg>
                                                </div>
                                                <div className="w-full sm:w-2/3 grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-stone-500 uppercase">Puente {hasCrystals && <span className="text-red-500">*</span>}</label>
                                                        <input type="number" required={hasCrystals} value={frameMeasurePte} onChange={e => setFrameMeasurePte(e.target.value)} className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none" placeholder="Ej: 16" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-stone-500 uppercase">Ancho (A) {hasCrystals && <span className="text-red-500">*</span>}</label>
                                                        <input type="number" required={hasCrystals} value={frameMeasureA} onChange={e => setFrameMeasureA(e.target.value)} className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none" placeholder="Ej: 56" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-stone-500 uppercase">Alto (B) {hasCrystals && <span className="text-red-500">*</span>}</label>
                                                        <input type="number" required={hasCrystals} value={frameMeasureB} onChange={e => setFrameMeasureB(e.target.value)} className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none" placeholder="Ej: 42" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-stone-500 uppercase">Diagonal (ED) {hasCrystals && <span className="text-red-500">*</span>}</label>
                                                        <input type="number" required={hasCrystals} value={frameMeasureEd} onChange={e => setFrameMeasureEd(e.target.value)} className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none" placeholder="Ej: 54" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    

                                <div className="space-y-2 mb-4">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Detalles del Armazón {hasCrystals && <span className="text-red-500">*</span>}</label>
                                    <input 
                                        type="text" 
                                        required={hasCrystals}
                                        value={frameDetails}
                                        onChange={e => setFrameDetails(e.target.value)}
                                        placeholder="Ej: Metálico ranurado medio marco, Plaquetas de silicona..." 
                                        className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-4 py-3 rounded-xl text-xs font-medium focus:border-blue-500 outline-none"
                                    />
                                </div>

                                {hasTinting && (
                                    <div className="mb-4 p-4 bg-white/50 dark:bg-stone-900/50 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                        <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Opciones de Teñido</h4>
                                        {!isOrganicoBlanco && (
                                            <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[9px] font-bold rounded-lg border border-amber-200 dark:border-amber-800/50">
                                                ⚠️ Atención: Se recomienda aplicar teñidos únicamente sobre cristales "Orgánico Blanco".
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold text-stone-500 uppercase">Tipo</label>
                                                <select 
                                                    value={tintType} 
                                                    onChange={e => setTintType(e.target.value)}
                                                    className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Compacto">Compacto (Pleno)</option>
                                                    <option value="Degradé">Degradé</option>
                                                    <option value="Según Muestra">Según Muestra</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold text-stone-500 uppercase">Color</label>
                                                <select 
                                                    value={tintColor} 
                                                    onChange={e => setTintColor(e.target.value)}
                                                    className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="Gris">Gris</option>
                                                    <option value="Marrón">Marrón</option>
                                                    <option value="Verde G15">Verde G15</option>
                                                    <option value="Rosa">Rosa</option>
                                                    <option value="Amarillo">Amarillo</option>
                                                    <option value="Naranja">Naranja</option>
                                                    <option value="Rojo">Rojo</option>
                                                    <option value="Otro">Otro (Aclarar en notas)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold text-stone-500 uppercase">Intensidad</label>
                                                <input 
                                                    type="text"
                                                    value={tintIntensity} 
                                                    onChange={e => setTintIntensity(e.target.value)}
                                                    placeholder="Ej: 10%, Medio..."
                                                    className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-3 py-2 rounded-xl text-xs font-medium focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Observaciones Adicionales (Opcional)</label>
                                    <textarea 
                                        value={labNotes}
                                        onChange={e => setLabNotes(e.target.value)}
                                        placeholder="Cualquier nota adicional sobre el cristal o armazón..." 
                                        rows={2}
                                        className="w-full bg-white dark:bg-stone-900 border border-blue-200 dark:border-blue-800/50 px-4 py-3 rounded-xl text-xs font-medium focus:border-blue-500 outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                        {/* 4. SECCION PAGOS REGISTRADOS */}
                        <section className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                    <Banknote className="w-4 h-4" /> Pagos Registrados
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-stone-400 italic">Mínimo requerido (50%): ${Math.ceil(minRequired).toLocaleString()}</span>
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
                                                <a href={resolveStorageUrl(p.receiptUrl)} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white dark:hover:bg-stone-700 rounded-lg transition-all text-primary">
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
                                        <span className={(paid >= minRequired || authorizedByAdmin) ? 'text-emerald-500' : 'text-amber-500'}>
                                            ${paid.toLocaleString()} / ${Math.ceil(minRequired).toLocaleString()} {paid >= minRequired ? '✓ COMPLETADO' : (authorizedByAdmin ? '✓ AUTORIZADO (SEÑA MENOR)' : '⚠️ SEÑA INSUFICIENTE')}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                                        <div 
                                            className={`h-full transition-all duration-700 ${(paid >= minRequired || authorizedByAdmin) ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                            style={{ width: `${Math.min((paid / (total || 1)) * 100, 100)}%` }} 
                                        />
                                    </div>
                                    
                                    {isAdmin && paid < minRequired && (
                                        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-3 animate-in slide-in-from-top-1">
                                            <input 
                                                type="checkbox" 
                                                id="auth-check-checkout"
                                                checked={authorizedByAdmin}
                                                onChange={(e) => setAuthorizedByAdmin(e.target.checked)}
                                                className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                                            />
                                            <label htmlFor="auth-check-checkout" className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest cursor-pointer select-none">
                                                Autorizar venta con seña menor al 50%
                                            </label>
                                        </div>
                                    )}

                                    {!isAdmin && paid < minRequired && !authorizedByAdmin && (
                                        <div className="p-3 bg-amber-500/15 border border-amber-500/20 rounded-xl mt-3 flex items-start gap-2 animate-in slide-in-from-top-1">
                                            <span className="text-xs">⚠️</span>
                                            <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider leading-relaxed">
                                                Requiere que el administrador autorice la venta con seña menor al 50% para poder continuar.
                                            </p>
                                        </div>
                                    )}
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
