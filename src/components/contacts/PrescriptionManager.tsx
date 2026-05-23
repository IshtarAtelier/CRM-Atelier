'use client';

import React, { useState } from 'react';
import { 
    FileText, Plus, History, CheckCircle2, X, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PrescriptionDetails from '../prescriptions/PrescriptionDetails';
import { resolveStorageUrl } from '@/lib/utils/storage';
import FileDropZone from '@/components/FileDropZone';

interface PrescriptionManagerProps {
    contact: any;
    onRefresh: () => void;
    // For Quote -> Sale conversion flow
    conversionOrderId?: string | null;
    onConversionComplete?: (rxId: string) => void;
    onCloseConversion?: () => void;
}

export default function PrescriptionManager({
    contact,
    onRefresh,
    conversionOrderId,
    onConversionComplete,
    onCloseConversion
}: PrescriptionManagerProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [step, setStep] = useState<'form' | 'review'>('form');
    const [saving, setSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedRxId, setSavedRxId] = useState<string | null>(null);
    const [editingRxId, setEditingRxId] = useState<string | null>(null);
    const [showNear, setShowNear] = useState(false);
    
    // File state
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [showOcrVerifyMessage, setShowOcrVerifyMessage] = useState(false);

    const [form, setForm] = useState({
        sphereOD: '', cylinderOD: '', axisOD: '', additionOD: '',
        sphereOI: '', cylinderOI: '', axisOI: '', additionOI: '',
        nearSphereOD: '', nearCylinderOD: '', nearAxisOD: '',
        nearSphereOI: '', nearCylinderOI: '', nearAxisOI: '',
        distanceOD: '', distanceOI: '', heightOD: '', heightOI: '',
        notes: '', imageUrl: '', prescriptionType: 'ADDITION'
    });

    // Track whether addition was manually edited (to avoid overriding manual changes)
    const [additionManualOD, setAdditionManualOD] = useState(false);
    const [additionManualOI, setAdditionManualOI] = useState(false);

    // Normalize input: accept comma as decimal separator (AR locale)
    const handleFieldChange = (field: string, value: string) => {
        const normalized = value.replace(',', '.');
        if (normalized === '' || normalized === '-' || normalized === '.' || /^-?\d*\.?\d*$/.test(normalized)) {
            setForm(p => {
                const next = {...p, [field]: normalized};
                
                // Auto-calculate Addition when Near or Far sphere changes
                if ((field === 'nearSphereOD' || field === 'sphereOD') && !additionManualOD) {
                    const nearS = parseFloat(field === 'nearSphereOD' ? normalized : next.nearSphereOD);
                    const farS = parseFloat(field === 'sphereOD' ? normalized : next.sphereOD);
                    if (!isNaN(nearS) && !isNaN(farS)) {
                        next.additionOD = (nearS - farS).toFixed(2);
                    }
                }
                if ((field === 'nearSphereOI' || field === 'sphereOI') && !additionManualOI) {
                    const nearS = parseFloat(field === 'nearSphereOI' ? normalized : next.nearSphereOI);
                    const farS = parseFloat(field === 'sphereOI' ? normalized : next.sphereOI);
                    if (!isNaN(nearS) && !isNaN(farS)) {
                        next.additionOI = (nearS - farS).toFixed(2);
                    }
                }
                
                // Auto-copy near cylinder/axis from far if near is empty
                if (field === 'nearSphereOD' && normalized && !next.nearCylinderOD && next.cylinderOD) {
                    next.nearCylinderOD = next.cylinderOD;
                    next.nearAxisOD = next.axisOD;
                }
                if (field === 'nearSphereOI' && normalized && !next.nearCylinderOI && next.cylinderOI) {
                    next.nearCylinderOI = next.cylinderOI;
                    next.nearAxisOI = next.axisOI;
                }
                
                // Track manual addition edits
                if (field === 'additionOD') setAdditionManualOD(true);
                if (field === 'additionOI') setAdditionManualOI(true);
                
                // Update prescriptionType based on near fields
                if (field.startsWith('near') && normalized) {
                    next.prescriptionType = 'NEAR';
                }
                
                return next;
            });
        }
    };

    const resetForm = () => {
        setForm({
            sphereOD: '', cylinderOD: '', axisOD: '', additionOD: '',
            sphereOI: '', cylinderOI: '', axisOI: '', additionOI: '',
            nearSphereOD: '', nearCylinderOD: '', nearAxisOD: '',
            nearSphereOI: '', nearCylinderOI: '', nearAxisOI: '',
            distanceOD: '', distanceOI: '', heightOD: '', heightOI: '',
            notes: '', imageUrl: '', prescriptionType: 'ADDITION'
        });
        setAdditionManualOD(false);
        setAdditionManualOI(false);
        setShowNear(false);
        setReceiptFile(null);
        setReceiptPreview(null);
        setShowOcrVerifyMessage(false);
        setStep('form');
        setError(null);
        setEditingRxId(null);
    };

    const applyPrevious = (rx: any) => {
        setForm({
            sphereOD: rx.sphereOD?.toString() || '',
            cylinderOD: rx.cylinderOD?.toString() || '',
            axisOD: rx.axisOD?.toString() || '',
            additionOD: (rx.additionOD ?? rx.addition)?.toString() || '',
            sphereOI: rx.sphereOI?.toString() || '',
            cylinderOI: rx.cylinderOI?.toString() || '',
            axisOI: rx.axisOI?.toString() || '',
            additionOI: (rx.additionOI ?? rx.addition)?.toString() || '',
            nearSphereOD: rx.nearSphereOD?.toString() || '',
            nearCylinderOD: rx.nearCylinderOD?.toString() || '',
            nearAxisOD: rx.nearAxisOD?.toString() || '',
            nearSphereOI: rx.nearSphereOI?.toString() || '',
            nearCylinderOI: rx.nearCylinderOI?.toString() || '',
            nearAxisOI: rx.nearAxisOI?.toString() || '',
            distanceOD: (rx.distanceOD ?? rx.pd)?.toString() || '',
            distanceOI: (rx.distanceOI ?? rx.pd)?.toString() || '',
            heightOD: rx.heightOD?.toString() || '',
            heightOI: rx.heightOI?.toString() || '',
            notes: rx.notes || '',
            imageUrl: rx.imageUrl || '',
            prescriptionType: rx.prescriptionType || 'ADDITION'
        });
        setAdditionManualOD(false);
        setAdditionManualOI(false);
        // Auto-enable near toggle if near values or addition exist
        setShowNear(!!(rx.nearSphereOD || rx.nearSphereOI || rx.nearCylinderOD || rx.nearCylinderOI || rx.additionOD || rx.additionOI || rx.addition));
        setReceiptFile(null);
        setReceiptPreview(null);
    };

    const handleEdit = (rx: any) => {
        setIsAdding(true);
        setEditingRxId(rx.id);
        applyPrevious(rx);
    };

    // Deduplication is now handled exclusively by the backend.
    // The frontend dedup was silently preventing saves when graduation values
    // matched an existing prescription (even intentional re-entries).

    // Helper: parse functions that preserve 0 (0 || null === null, which is the bug)
    const safeFloat = (v: any) => { 
        if (v === undefined || v === null || v === '') return null;
        // Ensure string and handle comma as decimal separator (standard in AR)
        const normalized = v.toString().replace(',', '.');
        const n = parseFloat(normalized); 
        return isNaN(n) ? null : n; 
    };

    const safeInt = (v: any) => { 
        if (v === undefined || v === null || v === '') return null;
        const n = parseInt(v.toString()); 
        return isNaN(n) ? null : n; 
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            let finalImageUrl = form.imageUrl;

            // 1. Subir la imagen si hay que subir una nueva
            if (receiptFile) {
                const formData = new FormData();
                formData.append('file', receiptFile);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) {
                    throw new Error(uploadData.error || 'Error al subir la imagen de la receta. Asegúrate de intentar nuevamente.');
                }
                finalImageUrl = uploadData.url;
            }

            // Remove image obligation
            // if (!finalImageUrl && !editingRxId) {
            //     throw new Error("La foto de la receta es obligatoria.");
            // }

            // Deduplication is handled by the backend — always attempt to save
            let rxId: string | undefined;

            if (editingRxId) {
                // UPDATE existing
                const res = await fetch(`/api/contacts/${contact.id}/prescriptions/${editingRxId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...form,
                        imageUrl: finalImageUrl,
                        sphereOD: safeFloat(form.sphereOD),
                        cylinderOD: safeFloat(form.cylinderOD),
                        axisOD: safeInt(form.axisOD),
                        sphereOI: safeFloat(form.sphereOI),
                        cylinderOI: safeFloat(form.cylinderOI),
                        axisOI: safeInt(form.axisOI),
                        additionOD: safeFloat(form.additionOD),
                        additionOI: safeFloat(form.additionOI),
                        distanceOD: safeFloat(form.distanceOD),
                        distanceOI: safeFloat(form.distanceOI),
                        heightOD: safeFloat(form.heightOD),
                        heightOI: safeFloat(form.heightOI),
                        nearSphereOD: safeFloat(form.nearSphereOD),
                        nearCylinderOD: safeFloat(form.nearCylinderOD),
                        nearAxisOD: safeInt(form.nearAxisOD),
                        nearSphereOI: safeFloat(form.nearSphereOI),
                        nearCylinderOI: safeFloat(form.nearCylinderOI),
                        nearAxisOI: safeInt(form.nearAxisOI),
                        prescriptionType: form.nearSphereOD || form.nearSphereOI ? 'NEAR' : form.prescriptionType,
                    })
                });
                
                const updatedRx = await res.json();
                
                if (!res.ok) {
                    throw new Error(updatedRx.error || updatedRx.details || "Error del servidor al actualizar la receta");
                }
                rxId = updatedRx.id;
            } else if (!rxId) {
                // CREATE new
                const res = await fetch(`/api/contacts/${contact.id}/prescriptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...form,
                        imageUrl: finalImageUrl,
                        sphereOD: safeFloat(form.sphereOD),
                        cylinderOD: safeFloat(form.cylinderOD),
                        axisOD: safeInt(form.axisOD),
                        sphereOI: safeFloat(form.sphereOI),
                        cylinderOI: safeFloat(form.cylinderOI),
                        axisOI: safeInt(form.axisOI),
                        additionOD: safeFloat(form.additionOD),
                        additionOI: safeFloat(form.additionOI),
                        distanceOD: safeFloat(form.distanceOD),
                        distanceOI: safeFloat(form.distanceOI),
                        heightOD: safeFloat(form.heightOD),
                        heightOI: safeFloat(form.heightOI),
                        nearSphereOD: safeFloat(form.nearSphereOD),
                        nearCylinderOD: safeFloat(form.nearCylinderOD),
                        nearAxisOD: safeInt(form.nearAxisOD),
                        nearSphereOI: safeFloat(form.nearSphereOI),
                        nearCylinderOI: safeFloat(form.nearCylinderOI),
                        nearAxisOI: safeInt(form.nearAxisOI),
                        prescriptionType: form.nearSphereOD || form.nearSphereOI ? 'NEAR' : form.prescriptionType,
                    })
                });
                
                const newRx = await res.json();
                
                if (!res.ok) {
                    throw new Error(newRx.error || newRx.details || "Error del servidor al guardar la receta");
                }
                
                rxId = newRx.id;
            }

            if (conversionOrderId && onConversionComplete && rxId) {
                setSavedRxId(rxId);
                setStep('review');
            } else {
                onRefresh();
                setIsAdding(false);
                resetForm();
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al guardar la receta');
        } finally {
            setSaving(false);
        }
    };

    const handleFinalConfirm = async () => {
        if (!conversionOrderId) {
            setError("No hay una orden asociada para convertir.");
            return;
        }
        
        const rxId = savedRxId;
        
        if (!rxId) {
            setError("No se pudo identificar la receta. Por favor, volvé a guardarla.");
            return;
        }

        setSaving(true);
        setError(null);
        
        try {
            const res = await fetch(`/api/orders/${conversionOrderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orderType: 'SALE',
                    prescriptionId: rxId 
                }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || "Error al convertir venta");
            }
            
            onConversionComplete?.(rxId);
            onRefresh();
            resetForm();
        } catch (err: any) {
            console.error('Error en conversión:', err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const renderForm = () => (
        <div className="space-y-6">
            <h3 className="text-xl font-black text-stone-800 dark:text-white tracking-tighter flex items-center gap-2">
                {editingRxId ? 'Editar Receta' : (conversionOrderId ? 'Cargar Receta para Venta' : 'Nueva Receta')}
            </h3>

            {contact.prescriptions?.length > 0 && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Usar receta anterior</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {contact.prescriptions.map((rx: any, idx: number) => (
                            <button 
                                key={rx.id || `rx-${idx}`}
                                onClick={() => applyPrevious(rx)}
                                className="px-3 py-2 bg-white dark:bg-stone-900 hover:bg-emerald-500 hover:text-white border border-emerald-200 dark:border-stone-700 rounded-xl text-[10px] font-bold transition-all shadow-sm"
                            >
                                {format(new Date(rx.date), 'dd/MM/yy')} - {rx.sphereOD ?? '0'}/{rx.sphereOI ?? '0'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {/* ── VISIÓN DE LEJOS ── */}
                <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Ojo Derecho (OD) — Lejos</p>
                    <div className="grid grid-cols-3 gap-2">
                        {['sphereOD', 'cylinderOD', 'axisOD'].map(f => (
                            <div key={f}>
                                <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">{f.replace('OD','').toUpperCase()}</label>
                                <input type="text" inputMode="decimal" value={(form as any)[f]} onChange={e => handleFieldChange(f, e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0.00" />
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Ojo Izquierdo (OI) — Lejos</p>
                    <div className="grid grid-cols-3 gap-2">
                        {['sphereOI', 'cylinderOI', 'axisOI'].map(f => (
                            <div key={f}>
                                <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">{f.replace('OI','').toUpperCase()}</label>
                                <input type="text" inputMode="decimal" value={(form as any)[f]} onChange={e => handleFieldChange(f, e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-300" placeholder="0.00" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── TOGGLE CERCA ── */}
                <div className="pt-3 mt-1 border-t border-dashed border-stone-200 dark:border-stone-700">
                    <button
                        type="button"
                        onClick={() => setShowNear(!showNear)}
                        className={`flex items-center gap-3 w-full p-3 rounded-2xl transition-all duration-300 ${
                            showNear 
                                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' 
                                : 'bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                    >
                        {/* Toggle pill */}
                        <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 flex-shrink-0 ${showNear ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${showNear ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${showNear ? 'text-amber-700 dark:text-amber-400' : 'text-stone-400'}`}>
                            👁️ Tiene Cerca / Lectura
                        </span>
                    </button>
                </div>

                {/* ── SECCIÓN CERCA (colapsable) ── */}
                {showNear && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-300 bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4">
                        {/* OD Cerca */}
                        <div>
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">OD — Cerca</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[['nearSphereOD', 'ESFERA'], ['nearCylinderOD', 'CILINDRO'], ['nearAxisOD', 'EJE']].map(([f, label]) => (
                                    <div key={f}>
                                        <label className="text-[7px] font-black text-stone-400 uppercase block mb-0.5">{label}</label>
                                        <input type="text" inputMode="decimal" value={(form as any)[f]} onChange={e => handleFieldChange(f, e.target.value)} className="w-full bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800/30 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-300" placeholder="0.00" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* OI Cerca */}
                        <div>
                            <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">OI — Cerca</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[['nearSphereOI', 'ESFERA'], ['nearCylinderOI', 'CILINDRO'], ['nearAxisOI', 'EJE']].map(([f, label]) => (
                                    <div key={f}>
                                        <label className="text-[7px] font-black text-stone-400 uppercase block mb-0.5">{label}</label>
                                        <input type="text" inputMode="decimal" value={(form as any)[f]} onChange={e => handleFieldChange(f, e.target.value)} className="w-full bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800/30 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-300" placeholder="0.00" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* ADICIÓN auto-calculada / editable */}
                        <div className="pt-3 border-t border-amber-200/50 dark:border-amber-800/20">
                            <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                ⚡ Adición
                                <span className="text-[7px] font-normal text-stone-400 normal-case tracking-normal">(auto-calculada, editable)</span>
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[7px] font-black text-emerald-500 uppercase block mb-0.5">ADD OD</label>
                                    <input type="text" inputMode="decimal" value={form.additionOD} onChange={e => handleFieldChange('additionOD', e.target.value)} className="w-full bg-amber-100/50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 p-2.5 rounded-xl text-sm font-black text-center outline-none focus:ring-2 focus:ring-amber-400 text-amber-700 dark:text-amber-300" placeholder="auto" />
                                </div>
                                <div>
                                    <label className="text-[7px] font-black text-blue-500 uppercase block mb-0.5">ADD OI</label>
                                    <input type="text" inputMode="decimal" value={form.additionOI} onChange={e => handleFieldChange('additionOI', e.target.value)} className="w-full bg-amber-100/50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 p-2.5 rounded-xl text-sm font-black text-center outline-none focus:ring-2 focus:ring-amber-400 text-amber-700 dark:text-amber-300" placeholder="auto" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-2">DNP</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" inputMode="decimal" value={form.distanceOD} onChange={e => handleFieldChange('distanceOD', e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OD" />
                            <input type="text" inputMode="decimal" value={form.distanceOI} onChange={e => handleFieldChange('distanceOI', e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OI" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">Altura</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="text" inputMode="decimal" value={form.heightOD} onChange={e => handleFieldChange('heightOD', e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OD" />
                            <input type="text" inputMode="decimal" value={form.heightOI} onChange={e => handleFieldChange('heightOI', e.target.value)} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OI" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Foto de la receta (Opcional para guardar)</label>
                    {form.imageUrl && !receiptFile ? (
                        <div className="relative">
                            <img 
                                src={resolveStorageUrl(form.imageUrl)} 
                                alt="Receta" 
                                className="w-full max-h-48 object-contain rounded-xl border-2 border-emerald-500 shadow-md" 
                            />
                            <button onClick={() => setForm(p => ({...p, imageUrl: ''}))} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"><X className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <FileDropZone
                            loading={isAnalyzing}
                            loadingLabel="🤖 Analizando receta..."
                            onFile={async (file) => {
                                setReceiptFile(file);
                                setReceiptPreview(URL.createObjectURL(file));
                                setIsAnalyzing(true);
                                try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('type', 'prescription');
                                    const res = await fetch('/api/ocr', { method: 'POST', body: formData });
                                    if (res.ok) {
                                        const data = await res.json();
                                        setForm(prev => ({
                                            ...prev,
                                            sphereOD: data.sphereOD != null ? data.sphereOD.toString() : prev.sphereOD,
                                            cylinderOD: data.cylinderOD != null ? data.cylinderOD.toString() : prev.cylinderOD,
                                            axisOD: data.axisOD != null ? data.axisOD.toString() : prev.axisOD,
                                            additionOD: data.additionOD != null ? data.additionOD.toString() : prev.additionOD,
                                            distanceOD: data.distanceOD != null ? data.distanceOD.toString() : prev.distanceOD,
                                            heightOD: data.heightOD != null ? data.heightOD.toString() : prev.heightOD,
                                            sphereOI: data.sphereOI != null ? data.sphereOI.toString() : prev.sphereOI,
                                            cylinderOI: data.cylinderOI != null ? data.cylinderOI.toString() : prev.cylinderOI,
                                            axisOI: data.axisOI != null ? data.axisOI.toString() : prev.axisOI,
                                            additionOI: data.additionOI != null ? data.additionOI.toString() : prev.additionOI,
                                            distanceOI: data.distanceOI != null ? data.distanceOI.toString() : prev.distanceOI,
                                            heightOI: data.heightOI != null ? data.heightOI.toString() : prev.heightOI,
                                        }));
                                        // Auto-enable near toggle if OCR detected addition values
                                        if (data.additionOD != null || data.additionOI != null) {
                                            setShowNear(true);
                                        }
                                        setShowOcrVerifyMessage(true);
                                    } else {
                                        console.warn('OCR falló');
                                    }
                                } catch (e) {
                                    console.error('Error OCR', e);
                                } finally {
                                    setIsAnalyzing(false);
                                }
                            }}
                            preview={receiptPreview}
                            onClearPreview={() => {
                                setReceiptFile(null);
                                setReceiptPreview(null);
                                setShowOcrVerifyMessage(false);
                            }}
                            label="Subir foto de la receta"
                        />
                    )}
                </div>
            </div>

            {showOcrVerifyMessage && (
                <div className="flex items-start gap-2.5 p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-xs font-semibold mt-4 animate-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-black text-amber-900 dark:text-amber-200 block mb-1">🤖 DATOS SUGERIDOS</span>
                        Se completaron los campos con datos leídos de la receta. Por favor, **verifica y corrige** cualquier valor antes de guardar.
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 text-[10px] font-black bg-red-50 p-3 rounded-xl mt-4">⚠️ {error}</p>}

            <div className="flex gap-3 mt-6">
                <button onClick={() => { setIsAdding(false); onCloseConversion?.(); resetForm(); }} className="px-6 py-4 bg-stone-100 rounded-2xl font-black text-xs uppercase tracking-widest">CANCELAR</button>
                <button 
                    onClick={handleSave} 
                    disabled={saving || isAnalyzing || (!form.sphereOD && !form.sphereOI && !form.cylinderOD && !form.cylinderOI && !form.additionOD && !form.additionOI && !receiptFile && !form.imageUrl)}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
                >
                    {saving ? 'GUARDANDO...' : (isAnalyzing ? 'ANALIZANDO RECETA...' : 'GUARDAR RECETA')}
                </button>
            </div>
        </div>
    );

    const renderReview = () => (
        <div className="space-y-6">
            <h3 className="text-xl font-black text-stone-800 dark:text-white tracking-tighter flex items-center gap-2">Repaso Final</h3>
            <p className="text-[10px] font-bold text-stone-400">Revisá los datos antes de enviar a fábrica. Una vez confirmado, se convertirá en venta.</p>

            <div className="space-y-4">
                {['OD', 'OI'].map(eye => (
                    <div key={eye} className="flex items-center gap-3">
                        <span className="w-10 text-center font-black bg-stone-900 text-white rounded py-1 text-[10px]">{eye}</span>
                        <div className="flex-1 flex justify-around bg-stone-900 text-white p-3 rounded-2xl font-mono text-sm">
                            <div>Esf: {safeFloat((form as any)[`sphere${eye}`])?.toFixed(2) ?? '0.00'}</div>
                            <div>Cil: {safeFloat((form as any)[`cylinder${eye}`])?.toFixed(2) ?? '0.00'}</div>
                            <div>Eje: {safeInt((form as any)[`axis${eye}`]) ?? '0'}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3 mt-8">
                <button onClick={() => setStep('form')} className="px-6 py-4 bg-stone-100 rounded-2xl font-black text-xs uppercase tracking-widest">VOLVER A EDITAR</button>
                <button onClick={handleFinalConfirm} disabled={saving} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest">CONFIRMAR Y ENVIAR A FÁBRICA</button>
            </div>
        </div>
    );

    if (conversionOrderId || isAdding) {
        return (
            <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-stone-800 w-full max-w-xl rounded-[2.5rem] p-8 shadow-huge max-h-[90vh] overflow-y-auto">
                    {step === 'form' ? renderForm() : renderReview()}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">Registros Clínicos</h3>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white dark:bg-primary rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                    <Plus className="w-4 h-4" /> NUEVA RECETA
                </button>
            </div>

            <div className="grid gap-6">
                {contact.prescriptions?.map((pres: any, idx: number) => (
                    <div key={pres.id || `pres-${idx}`} className="bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-stone-800 dark:text-white uppercase tracking-widest">{format(new Date(pres.date), "dd 'de' MMMM", { locale: es })}</p>
                                    <p className="text-[10px] font-bold text-stone-400 italic">#{pres.id.slice(-4).toUpperCase()}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleEdit(pres)}
                                className="px-3 py-1.5 bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300 rounded-lg text-[10px] font-bold tracking-wider hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors"
                            >
                                EDITAR
                            </button>
                        </div>

                        <div className="mt-4">
                            <PrescriptionDetails prescription={pres} />
                        </div>
                    </div>
                ))}
            </div>

            {error && <p className="text-red-500 text-[10px] font-black bg-red-50 p-3 rounded-xl animate-shake">⚠️ {error}</p>}
        </div>
    );
}
