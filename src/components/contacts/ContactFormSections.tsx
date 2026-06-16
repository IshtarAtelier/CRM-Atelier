'use client';

import React from 'react';
import { User, Phone, FileText, Building2, Stethoscope, ChevronDown, Mail, MapPin } from 'lucide-react';

interface ContactFormSectionsProps {
    formData: any;
    setFormData: (val: any) => void;
    doctors: any[];
    sources: string[];
    hasOrdersInFactory?: boolean;
}

export function PersonalDataSection({ formData, setFormData, doctors, sources, hasOrdersInFactory }: ContactFormSectionsProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">Nombre / Apellido <span className="text-xsrimary">*</span></label>
                    <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors" />
                        <input required type="text" className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm outline-none focus:border-primary" placeholder="Nombre completo" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">Teléfono <span className="text-xsrimary">*</span></label>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors" />
                        <input required type="text" className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm outline-none focus:border-primary" placeholder="11 2233 4455" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1">DNI</label>
                    <div className="relative group">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors" />
                        <input type="text" className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm outline-none focus:border-primary" placeholder="Número de documento" value={formData.dni} onChange={(e) => setFormData({ ...formData, dni: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1">Obra Social</label>
                    <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors" />
                        <input type="text" className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm outline-none focus:border-primary" placeholder="Jerárquicos, OSDE, etc." value={formData.insurance} onChange={(e) => setFormData({ ...formData, insurance: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1">Médico</label>
                    <div className="relative group">
                        <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors z-10" />
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                        <select 
                            className="w-full pl-12 pr-10 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm appearance-none cursor-pointer outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed" 
                            value={formData.doctor} 
                            onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                            disabled={hasOrdersInFactory}
                            title={hasOrdersInFactory ? "No se puede cambiar el médico de un cliente con pedidos ya enviados a fábrica" : undefined}
                        >
                            <option value="">— Sin médico —</option>
                            {doctors.map((doc, idx) => <option key={doc.id || `doc-${idx}`} value={doc.name}>{doc.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">Origen / Canal <span className="text-xsrimary">*</span></label>
                    <div className="relative group">
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                        <select className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm appearance-none cursor-pointer outline-none focus:border-primary" value={formData.contactSource} onChange={(e) => setFormData({ ...formData, contactSource: e.target.value })}>
                            <option value="">Seleccionar origen...</option>
                            {sources.map((s, idx) => <option key={s || `source-${idx}`} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1">Email</label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors" />
                        <input type="email" className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm outline-none focus:border-primary" placeholder="correo@ejemplo.com" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1">Dirección / Localidad</label>
                    <div className="relative group">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-xsrimary transition-colors" />
                        <input type="text" className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border-2 rounded-2xl font-bold text-sm outline-none focus:border-primary" placeholder="Calle, Número, Localidad" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function InterestSection({ formData, setFormData, productTypes }: { formData: any; setFormData: (val: any) => void; productTypes: string[] }) {
    return (
        <div className="p-6 bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] border-2 border-stone-100 dark:border-stone-800">
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-stone-500 ml-1 flex items-center gap-1">Tipo de Producto <span className="text-xsrimary">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {productTypes.map(type => (
                        <button key={type} type="button" onClick={() => setFormData({ ...formData, interest: type })} className={`px-3 py-3 rounded-xl border-2 text-xs font-black uppercase transition-all ${formData.interest === type ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-500 border-stone-100 dark:border-stone-700 hover:border-primary/30'}`}>{type}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}
