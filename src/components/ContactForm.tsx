'use client';

import { useState, useEffect } from 'react';
import { X, Star, Save, Loader2, Calculator } from 'lucide-react';
import { PersonalDataSection, InterestSection } from './ContactFormSections';

export interface ContactFormData {
    name: string;
    email: string;
    phone: string;
    dni: string;
    contactSource: string;
    interest: string;
    expectedValue: number;
    priority: number;
    address: string;
    insurance: string;
    doctor: string;
    followUpTask?: string;
    followUpDate?: string;
    startQuote?: boolean;
    forceCreate?: boolean;
    visitedStore?: boolean;
}

interface ContactFormProps {
    onClose: () => void;
    onSubmit: (data: ContactFormData) => Promise<void>;
    onUnify?: (existingId: string, data: ContactFormData) => Promise<void>;
    onGoToOriginal?: (existingId: string) => void;
    initialData?: Partial<ContactFormData>;
}

const PRODUCT_TYPES = ["Monofocal", "Multifocal", "Bifocal", "Ocupacional", "Solar", "Accesorios", "Lentes de Contacto", "Otros"];
const CONTACT_SOURCES = ["Google Ads", "Meta", "Calle", "Jemima", "Ya es Cliente", "Tienda nube", "Referido", "Wave", "Salida", "Otros"];

export default function ContactForm({ onClose, onSubmit, onUnify, onGoToOriginal, initialData }: ContactFormProps) {
    const [formData, setFormData] = useState<ContactFormData>({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        dni: initialData?.dni || '',
        contactSource: initialData?.contactSource || '',
        interest: initialData?.interest || 'Otros',
        expectedValue: initialData?.expectedValue || 0,
        priority: initialData?.priority || 0,
        address: initialData?.address || '',
        insurance: initialData?.insurance || '',
        doctor: initialData?.doctor || ''
    });

    const [saving, setSaving] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
    const [submitAction, setSubmitAction] = useState<'save' | 'quote'>('save');
    const [followUpTask, setFollowUpTask] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [visitedStore, setVisitedStore] = useState(false);
    const [doctors, setDoctors] = useState<any[]>([]);
    const hasOrdersInFactory = (initialData as any)?.orders?.some(
        (o: any) => !o.isDeleted && ['SENT', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(o.labStatus || '')
    ) || false;

    useEffect(() => {
        fetch('/api/doctors').then(res => res.json()).then(data => { if (Array.isArray(data)) setDoctors(data); });
    }, []);

    const isHighTicket = formData.interest === 'Multifocal';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone || !formData.contactSource || !formData.interest) {
            alert('Por favor completa los campos obligatorios (*)');
            return;
        }
        if (isHighTicket && !followUpTask.trim()) {
            alert('Para clientes Multifocal es obligatorio registrar una tarea de seguimiento.');
            return;
        }

        setSaving(true);
        try {
            const dataToSubmit: ContactFormData = {
                ...formData,
                ...(isHighTicket && followUpTask.trim() ? { followUpTask: followUpTask.trim(), followUpDate } : {}),
                startQuote: submitAction === 'quote',
                visitedStore,
                forceCreate: duplicateWarning ? true : undefined
            };
            await onSubmit(dataToSubmit);
        } catch (error: any) {
            if (error.isDuplicate) {
                setDuplicateWarning(error);
            } else if (error.isBlocked) {
                alert(error.details || error.error || 'Error: Número de celular inválido.');
            } else {
                alert('Ocurrió un error al guardar: ' + (error.message || 'Desconocido'));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                <header className="p-8 border-b flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/30">
                    <div>
                        <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">{initialData ? 'Editar' : 'Nuevo'} <span className="text-primary not-italic">Contacto</span></h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">Completa los datos esenciales</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl"><X className="w-6 h-6 text-stone-400" /></button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <PersonalDataSection formData={formData} setFormData={setFormData} doctors={doctors} sources={CONTACT_SOURCES} hasOrdersInFactory={hasOrdersInFactory} />
                    
                    <InterestSection formData={formData} setFormData={setFormData} productTypes={PRODUCT_TYPES} />

                    {isHighTicket && (
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] border-2 border-amber-200 dark:border-amber-800 space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-amber-700">⚡ Seguimiento Obligatorio (Multifocal)</label>
                            <input type="text" placeholder="Ej: Llamar en 48hs" value={followUpTask} onChange={(e) => setFollowUpTask(e.target.value)} className="w-full px-4 py-4 bg-white dark:bg-stone-800 border-2 dark:border-stone-700 dark:text-stone-100 rounded-2xl font-bold text-sm outline-none focus:border-amber-500" />
                            <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 dark:border-stone-700 dark:text-stone-100 rounded-2xl text-sm font-bold outline-none" />
                        </div>
                    )}

                    <div className="p-5 bg-stone-50 dark:bg-stone-800/30 rounded-[2rem] border border-stone-100 dark:border-stone-800 flex items-center justify-between cursor-pointer transition-all hover:bg-stone-100 dark:hover:bg-stone-800/50" onClick={() => setVisitedStore(!visitedStore)}>
                        <div>
                            <p className="text-sm font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest">📍 Visita al Local</p>
                            <p className="text-xs text-stone-500 font-bold mt-1">El cliente está o estuvo presencialmente en el local hoy.</p>
                        </div>
                        <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${visitedStore ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${visitedStore ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Prioridad</label>
                        <div className="flex gap-4 p-5 bg-stone-50 dark:bg-stone-800/50 border-2 rounded-2xl justify-center">
                            {[1, 2, 3, 4, 5].map(s => <button key={s} type="button" onClick={() => setFormData({ ...formData, priority: s })} className="transition-transform hover:scale-125"><Star className={`w-8 h-8 ${s <= formData.priority ? 'fill-primary text-primary' : 'text-stone-300'}`} strokeWidth={3} /></button>)}
                        </div>
                    </div>

                    <footer className="p-8 bg-stone-50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row gap-4">
                        <button
                            type="submit"
                            name="save_only"
                            disabled={saving}
                            onClick={() => setSubmitAction('save')}
                            className="flex-1 py-5 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 rounded-2xl text-xs font-black shadow-sm hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                        >
                            {saving && submitAction === 'save' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            SOLO GUARDAR
                        </button>
                        
                        <button
                            type="submit"
                            name="save_and_quote"
                            disabled={saving}
                            onClick={() => setSubmitAction('quote')}
                            className="flex-[1.5] py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-sm font-black shadow-xl shadow-stone-400/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-primary/50"
                        >
                            {saving && submitAction === 'quote' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    PROCESANDO...
                                </>
                            ) : (
                                <>
                                    <Calculator className="w-5 h-5" strokeWidth={3} />
                                    GUARDAR Y COTIZAR
                                </>
                            )}
                        </button>
                    </footer>
                </form>

                {/* Duplicate Warning Overlay */}
                {duplicateWarning && (
                    <div className="absolute inset-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
                            <Star className="w-8 h-8 fill-current" />
                        </div>
                        <h3 className="text-2xl font-black text-stone-900 dark:text-white mb-2">
                            Cliente Existente Detectado
                        </h3>
                        <p className="text-stone-500 mb-6 max-w-md">
                            {duplicateWarning.details}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                            {onGoToOriginal && (
                                <button
                                    autoFocus
                                    onClick={() => onGoToOriginal(duplicateWarning.existingClient.id)}
                                    className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-primary/50"
                                >
                                    IR A LA FICHA ORIGINAL
                                </button>
                            )}
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-4 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 transition-all"
                            >
                                CREAR DUPLICADO IGUAL
                            </button>
                        </div>
                        <button 
                            onClick={() => setDuplicateWarning(null)}
                            className="mt-6 text-sm text-stone-400 hover:text-stone-600 font-bold underline decoration-stone-300 underline-offset-4"
                        >
                            Cancelar y volver a editar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
