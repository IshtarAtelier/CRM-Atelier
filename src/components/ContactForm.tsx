'use client';

import { useState, useEffect } from 'react';
import { X, Star, Save, User, Phone, Mail, FileText, MapPin, Building2, ChevronDown, Loader2, Stethoscope } from 'lucide-react';

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
}

interface ContactFormProps {
    onClose: () => void;
    onSubmit: (data: ContactFormData) => Promise<void>;
    initialData?: Partial<ContactFormData>;
}

const PRODUCT_TYPES = [
    "Monofocal",
    "Multifocal",
    "Bifocal",
    "Ocupacional",
    "Solar",
    "Accesorios",
    "Lentes de Contacto",
    "Otros"
];

const CONTACT_SOURCES = [
    "Google Ads",
    "Meta",
    "Calle",
    "Jemima",
    "Ya es Cliente",
    "Tienda nube",
    "Referido",
    "Wave",
    "Salida"
];

interface Doctor {
    id: string;
    name: string;
}

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
    const [doctors, setDoctors] = useState<Doctor[]>([]);

    useEffect(() => {
        fetch('/api/doctors')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setDoctors(data);
            })
            .catch(err => console.error('Error loading doctors:', err));
    }, []);

    const isHighTicket = formData.interest === 'Multifocal';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            alert('El Nombre y el Teléfono son obligatorios.');
            return;
        }
        if (!formData.contactSource) {
            alert('El Origen del Contacto es obligatorio. Indicá de dónde vino.');
            return;
        }
        if (!formData.interest) {
            alert('El Tipo de Producto es obligatorio.');
            return;
        }
        if (isHighTicket && !followUpTask.trim()) {
            alert('Para clientes Multifocal (ticket alto) es obligatorio registrar una tarea de seguimiento.');
            return;
        }

        setSaving(true);
        try {
            const dataToSubmit: ContactFormData = {
                ...formData,
                ...(isHighTicket && followUpTask.trim() ? { followUpTask: followUpTask.trim(), followUpDate } : {})
            };
            await onSubmit(dataToSubmit);
        } catch (error) {
            console.error('Error in form submission:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300">
                <header className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/30">
                    <div>
                        <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                            {initialData ? 'Editar' : 'Nuevo'} <span className="text-primary not-italic">Contacto</span>
                        </h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">Completa los datos esenciales</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-colors">
                        <X className="w-6 h-6 text-stone-400" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {/* Sección: Datos Personales */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">
                                Nombre / Apellido <span className="text-primary">*</span>
                            </label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    required
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="Nombre o Apellido"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">
                                Teléfono / Celular <span className="text-primary">*</span>
                            </label>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    required
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="11 2233 4455"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">DNI (Documento)</label>
                            <div className="relative group">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="Número de documento"
                                    value={formData.dni}
                                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Obra Social</label>
                            <div className="relative group">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="PAMI, OSDE, etc."
                                    value={formData.insurance}
                                    onChange={(e) => setFormData({ ...formData, insurance: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Médico */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Médico</label>
                            <div className="relative group">
                                <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors z-10" />
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                                <select
                                    className="w-full pl-12 pr-10 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm appearance-none cursor-pointer"
                                    value={formData.doctor}
                                    onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                                >
                                    <option value="">— Sin médico —</option>
                                    {doctors.map(doc => (
                                        <option key={doc.id} value={doc.name}>{doc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">Etiqueta <span className="text-primary">*</span></label>
                            <div className="relative group">
                                <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors z-10" />
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                                <select
                                    className={`w-full pl-12 pr-10 py-4 bg-stone-50 dark:bg-stone-800/50 border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm appearance-none cursor-pointer ${!formData.contactSource ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
                                    value={formData.contactSource}
                                    onChange={(e) => setFormData({ ...formData, contactSource: e.target.value })}
                                >
                                    <option value="">Seleccionar origen...</option>
                                    {CONTACT_SOURCES.map(source => (
                                        <option key={source} value={source}>{source}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="email"
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="correo@ejemplo.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 col-span-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Dirección</label>
                            <div className="relative group">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                                    placeholder="Calle, Número, Localidad"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección: Interés */}
                    <div className="p-6 bg-stone-50 dark:bg-stone-800/30 rounded-[2rem] border border-stone-100 dark:border-stone-700">
                        {/* Tipo de Producto (Desplegable) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">Tipo de Producto <span className="text-primary">*</span></label>
                            <div className="relative group">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors z-10" />
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                                <select
                                    required
                                    className={`w-full pl-12 pr-10 py-4 bg-white dark:bg-stone-800 border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm appearance-none cursor-pointer ${!formData.interest ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
                                    value={formData.interest}
                                    onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                                >
                                    <option value="" disabled>— Seleccionar tipo —</option>
                                    {PRODUCT_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Tarea de Seguimiento — Solo Multifocal */}
                    {isHighTicket && (
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] border-2 border-amber-200 dark:border-amber-800 space-y-4 animate-in slide-in-from-top duration-300">
                            <div className="flex items-center gap-2">
                                <span className="text-amber-600 text-lg">⚡</span>
                                <label className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                    Tarea de Seguimiento Obligatoria <span className="text-red-500">*</span>
                                </label>
                            </div>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium -mt-2">
                                Los clientes multifocal son de ticket alto. Registrá una tarea para no perder el seguimiento.
                            </p>
                            <input
                                type="text"
                                placeholder="Ej: Llamar para confirmar presupuesto en 48hs"
                                value={followUpTask}
                                onChange={(e) => setFollowUpTask(e.target.value)}
                                className={`w-full px-4 py-4 bg-white dark:bg-stone-800 border rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-bold text-sm ${!followUpTask.trim() ? 'border-amber-300 dark:border-amber-700' : 'border-stone-200 dark:border-stone-700'}`}
                            />
                            <div className="flex items-center gap-3">
                                <label className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 whitespace-nowrap">Fecha recordatorio:</label>
                                <input
                                    type="date"
                                    value={followUpDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setFollowUpDate(e.target.value)}
                                    className="flex-1 px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Prioridad Estrellas */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 ml-1">Prioridad del Prospecto</label>
                        <div className="flex gap-2 p-4 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl justify-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, priority: star })}
                                    className="transition-transform active:scale-90 hover:scale-110"
                                >
                                    <Star
                                        className={`w-8 h-8 ${star <= formData.priority ? 'fill-primary text-primary' : 'text-stone-300 dark:text-stone-700'}`}
                                        strokeWidth={2.5}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </form>

                <footer className="p-8 bg-stone-50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="w-full py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-sm font-black shadow-xl shadow-stone-400/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                GUARDANDO...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" strokeWidth={3} />
                                GUARDAR CONTACTO
                            </>
                        )}
                    </button>
                </footer>
            </div >
        </div >
    );
}
