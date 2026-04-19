'use client';

import React, { useState } from 'react';
import { 
    FileText, Plus, History, CheckCircle2, X 
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
    const [error, setError] = useState<string | null>(null);
    const [savedRxId, setSavedRxId] = useState<string | null>(null);
    
    // File state
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    const [form, setForm] = useState({
        sphereOD: '', cylinderOD: '', axisOD: '', additionOD: '',
        sphereOI: '', cylinderOI: '', axisOI: '', additionOI: '',
        distanceOD: '', distanceOI: '', heightOD: '', heightOI: '',
        notes: '', imageUrl: '', prescriptionType: 'ADDITION'
    });

    const resetForm = () => {
        setForm({
            sphereOD: '', cylinderOD: '', axisOD: '', additionOD: '',
            sphereOI: '', cylinderOI: '', axisOI: '', additionOI: '',
            distanceOD: '', distanceOI: '', heightOD: '', heightOI: '',
            notes: '', imageUrl: '', prescriptionType: 'ADDITION'
        });
        setReceiptFile(null);
        setReceiptPreview(null);
        setStep('form');
        setError(null);
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
            distanceOD: (rx.distanceOD ?? rx.pd)?.toString() || '',
            distanceOI: (rx.distanceOI ?? rx.pd)?.toString() || '',
            heightOD: rx.heightOD?.toString() || '',
            heightOI: rx.heightOI?.toString() || '',
            notes: rx.notes || '',
            imageUrl: rx.imageUrl || '',
            prescriptionType: rx.prescriptionType || 'ADDITION'
        });
        setReceiptFile(null);
        setReceiptPreview(null);
    };

    const findDuplicate = (finalImageUrl: string) => {
        if (!contact.prescriptions) return null;

        const parse = (v: any) => {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        };

        return contact.prescriptions.find((p: any) => {
            if ((p.imageUrl || '') !== (finalImageUrl || '')) return false;

            const fields = [
                [p.sphereOD, form.sphereOD], [p.cylinderOD, form.cylinderOD], [p.axisOD, form.axisOD],
                [p.sphereOI, form.sphereOI], [p.cylinderOI, form.cylinderOI], [p.axisOI, form.axisOI],
                [p.additionOD ?? p.addition, form.additionOD], [p.additionOI ?? p.addition, form.additionOI],
                [p.distanceOD ?? p.pd, form.distanceOD], [p.distanceOI ?? p.pd, form.distanceOI],
                [p.heightOD, form.heightOD], [p.heightOI, form.heightOI]
            ];

            return fields.every(([valA, valB]) => Math.abs(parse(valA) - parse(valB)) < 0.001);
        });
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

            if (!finalImageUrl) {
                throw new Error("La foto de la receta es obligatoria.");
            }

            const duplicate = findDuplicate(finalImageUrl);
            let rxId = duplicate?.id;

            if (!rxId) {
                const res = await fetch(`/api/contacts/${contact.id}/prescriptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...form,
                        imageUrl: finalImageUrl,
                        sphereOD: parseFloat(form.sphereOD) || 0,
                        cylinderOD: parseFloat(form.cylinderOD) || 0,
                        axisOD: parseInt(form.axisOD) || 0,
                        sphereOI: parseFloat(form.sphereOI) || 0,
                        cylinderOI: parseFloat(form.cylinderOI) || 0,
                        axisOI: parseInt(form.axisOI) || 0,
                        additionOD: parseFloat(form.additionOD) || 0,
                        additionOI: parseFloat(form.additionOI) || 0,
                        distanceOD: parseFloat(form.distanceOD) || 0,
                        distanceOI: parseFloat(form.distanceOI) || 0,
                        heightOD: parseFloat(form.heightOD) || 0,
                        heightOI: parseFloat(form.heightOI) || 0,
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
        
        const rxId = savedRxId || findDuplicate(form.imageUrl)?.id;
        
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
                {conversionOrderId ? 'Cargar Receta para Venta' : 'Nueva Receta'}
            </h3>

            {contact.prescriptions?.length > 0 && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Usar receta anterior</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {contact.prescriptions.map((rx: any) => (
                            <button 
                                key={rx.id}
                                onClick={() => applyPrevious(rx)}
                                className="px-3 py-2 bg-white dark:bg-stone-900 hover:bg-emerald-500 hover:text-white border border-emerald-200 dark:border-stone-700 rounded-xl text-[10px] font-bold transition-all shadow-sm"
                            >
                                {format(new Date(rx.date), 'dd/MM/yy')} - {rx.sphereOD || '0'}/{rx.sphereOI || '0'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Ojo Derecho (OD)</p>
                    <div className="grid grid-cols-4 gap-2">
                        {['sphereOD', 'cylinderOD', 'axisOD', 'additionOD'].map(f => (
                            <div key={f}>
                                <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">{f.replace('OD','').toUpperCase()}</label>
                                <input type="number" step="0.25" value={(form as any)[f]} onChange={e => setForm(p => ({...p, [f]: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-emerald-300" placeholder="0.00" />
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Ojo Izquierdo (OI)</p>
                    <div className="grid grid-cols-4 gap-2">
                        {['sphereOI', 'cylinderOI', 'axisOI', 'additionOI'].map(f => (
                            <div key={f}>
                                <label className="text-[8px] font-black text-stone-400 uppercase block mb-0.5">{f.replace('OI','').toUpperCase()}</label>
                                <input type="number" step="0.25" value={(form as any)[f]} onChange={e => setForm(p => ({...p, [f]: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2.5 rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-300" placeholder="0.00" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-2">DNP</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" step="0.5" value={form.distanceOD} onChange={e => setForm(p => ({...p, distanceOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OD" />
                            <input type="number" step="0.5" value={form.distanceOI} onChange={e => setForm(p => ({...p, distanceOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OI" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">Altura</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="number" step="0.5" value={form.heightOD} onChange={e => setForm(p => ({...p, heightOD: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OD" />
                            <input type="number" step="0.5" value={form.heightOI} onChange={e => setForm(p => ({...p, heightOI: e.target.value}))} className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 p-2.5 rounded-xl text-sm font-bold text-center" placeholder="OI" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-2">Foto de la receta (OBLIGATORIA)</label>
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
                            onFile={(file) => {
                                setReceiptFile(file);
                                setReceiptPreview(URL.createObjectURL(file));
                            }}
                            preview={receiptPreview}
                            onClearPreview={() => {
                                setReceiptFile(null);
                                setReceiptPreview(null);
                            }}
                            label="Subir foto de la receta"
                        />
                    )}
                </div>
            </div>

            {error && <p className="text-red-500 text-[10px] font-black bg-red-50 p-3 rounded-xl mt-4">⚠️ {error}</p>}

            <div className="flex gap-3 mt-6">
                <button onClick={() => { setIsAdding(false); onCloseConversion?.(); resetForm(); }} className="px-6 py-4 bg-stone-100 rounded-2xl font-black text-xs uppercase tracking-widest">CANCELAR</button>
                <button 
                    onClick={handleSave} 
                    disabled={saving || (!form.sphereOD && !form.sphereOI && !form.cylinderOD && !form.cylinderOI && !form.additionOD && !form.additionOI && !receiptFile) || (!form.imageUrl && !receiptFile)}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
                >
                    {saving ? 'GUARDANDO...' : 'GUARDAR RECETA'}
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
                            <div>Esf: {(form as any)[`sphere${eye}`] || '0'}</div>
                            <div>Cil: {(form as any)[`cylinder${eye}`] || '0'}</div>
                            <div>Eje: {(form as any)[`axis${eye}`] || '0'}</div>
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
                {contact.prescriptions?.map((pres: any) => (
                    <div key={pres.id} className="bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all">
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
