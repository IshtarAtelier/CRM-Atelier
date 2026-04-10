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
}

interface ContactFormProps {
    onClose: () => void;
    onSubmit: (data: ContactFormData) => Promise<void>;
    initialData?: Partial<ContactFormData>;
}

const PRODUCT_TYPES = ["Monofocal", "Multifocal", "Bifocal", "Ocupacional", "Solar", "Accesorios", "Lentes de Contacto", "Otros"];
const CONTACT_SOURCES = ["Google Ads", "Meta", "Calle", "Jemima", "Ya es Cliente", "Tienda nube", "Referido", "Wave", "Salida"];

export default function ContactForm({ onClose, onSubmit, initialData }: ContactFormProps) {
    const [formData, setFormData] = useState<ContactFormData>({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        dni: initialData?.dni || '',
        contactSource: initialData?.contactSource || '',
        interest: initialData?.interest || '',
        expectedValue: initialData?.expectedValue || 0,
        priority: initialData?.priority || 0,
        address: initialData?.address || '',
        insurance: initialData?.insurance || '',
        doctor: initialData?.doctor || ''
    });

    const [saving, setSaving] = useState(false);
    const [followUpTask, setFollowUpTask] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [doctors, setDoctors] = useState<any[]>([]);

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
                startQuote: (e.nativeEvent as any).submitter?.name === 'save_and_quote'
            };
            await onSubmit(dataToSubmit);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                <header className="p-8 border-b flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/30">
                    <div>
                        <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">{initialData ? 'Editar' : 'Nuevo'} <span className="text-primary not-italic">Contacto</span></h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">Completa los datos esenciales</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl"><X className="w-6 h-6 text-stone-400" /></button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <PersonalDataSection formData={formData} setFormData={setFormData} doctors={doctors} sources={CONTACT_SOURCES} />
                    
                    <InterestSection formData={formData} setFormData={setFormData} productTypes={PRODUCT_TYPES} />

                    {isHighTicket && (
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] border-2 border-amber-200 dark:border-amber-800 space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-amber-700">⚡ Seguimiento Obligatorio (Multifocal)</label>
                            <input type="text" placeholder="Ej: Llamar en 48hs" value={followUpTask} onChange={(e) => setFollowUpTask(e.target.value)} className="w-full px-4 py-4 bg-white border-2 rounded-2xl font-bold text-sm outline-none focus:border-amber-500" />
                            <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-4 py-3 bg-white border-2 rounded-2xl text-sm font-bold outline-none" />
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Prioridad</label>
                        <div className="flex gap-4 p-5 bg-stone-50 dark:bg-stone-800/50 border-2 rounded-2xl justify-center">
                            {[1, 2, 3, 4, 5].map(s => <button key={s} type="button" onClick={() => setFormData({ ...formData, priority: s })} className="transition-transform hover:scale-125"><Star className={`w-8 h-8 ${s <= formData.priority ? 'fill-primary text-primary' : 'text-stone-300'}`} strokeWidth={3} /></button>)}
                        </div>
                    </div>
                </form>

                <footer className="p-8 bg-stone-50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row gap-4">
                    <button
                        type="submit"
                        name="save_only"
                        disabled={saving}
                        className="flex-1 py-5 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 rounded-2xl text-xs font-black shadow-sm hover:bg-stone-200 dark:hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        SOLO GUARDAR
                    </button>
                    
                    <button
                        type="submit"
                        name="save_and_quote"
                        disabled={saving}
                        className="flex-[1.5] py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-sm font-black shadow-xl shadow-stone-400/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-primary/50"
                    >
                        {saving ? (
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
            </div>
        </div>
    );
}
