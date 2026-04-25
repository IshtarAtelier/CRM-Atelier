'use client';

import React from 'react';
import { 
    User, Heart, Pencil, Calculator, Star, X, 
    Phone, Mail, FileText, MapPin, Building2, Share2, Tag,
    History, CheckCircle2, Receipt, MessageCircle, Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ContactHeaderProps {
    contact: any;
    currentUserRole: string;
    setCurrentUserRole: React.Dispatch<React.SetStateAction<string>>;
    activeSection: string;
    setActiveSection: (section: any) => void;
    onClose: () => void;
    onEdit: (contact: any) => void;
    onToggleFavorite: (id: string) => void;
    onUpdatePriority: (id: string, priority: number) => void;
    onRevertStatus: () => void;
    onDeleteContact?: (id: string) => void;
}

export default function ContactHeader({
    contact,
    currentUserRole,
    setCurrentUserRole,
    activeSection,
    setActiveSection,
    onClose,
    onEdit,
    onToggleFavorite,
    onUpdatePriority,
    onRevertStatus,
    onDeleteContact
}: ContactHeaderProps) {
    const router = useRouter();

    const safePrice = (price: any): number => {
        if (price === null || price === undefined || isNaN(Number(price))) return 0;
        return Number(price);
    };

    return (
        <header className="p-5 pb-0 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 shrink-0">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border-2 border-primary/20 shrink-0">
                        <User className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 
                                className="text-2xl font-black text-stone-800 dark:text-stone-100 tracking-tighter cursor-pointer hover:text-primary transition-colors"
                                onClick={() => onEdit(contact)}
                            >
                                {contact.name}
                            </h2>
                            <div className="flex gap-0.5">
                                <button
                                    onClick={() => onToggleFavorite(contact.id)}
                                    className={`p-1.5 rounded-lg transition-all ${contact.isFavorite ? 'bg-red-50 text-red-500 shadow-sm border border-red-100' : 'text-stone-300 hover:text-red-400 border border-transparent'}`}
                                >
                                    <Heart className={`w-5 h-5 ${contact.isFavorite ? 'fill-current' : ''}`} />
                                </button>

                                <button
                                    onClick={() => onEdit(contact)}
                                    className="p-1.5 rounded-lg text-stone-300 hover:text-primary hover:bg-stone-50 transition-all"
                                    title="Editar datos"
                                >
                                    <Pencil className="w-5 h-5" />
                                </button>

                                <button
                                    onClick={() => {
                                        onClose();
                                        router.push(`/cotizador?clientName=${encodeURIComponent(contact.name)}`);
                                    }}
                                    className="p-1.5 rounded-lg text-stone-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all"
                                    title="Crear cotización"
                                >
                                    <Calculator className="w-5 h-5" />
                                </button>
                                
                                {contact.phone && (
                                    <button
                                        onClick={() => {
                                            onClose();
                                            router.push(`/whatsapp?phone=${encodeURIComponent(contact.phone)}`);
                                        }}
                                        className="p-1.5 rounded-lg text-stone-300 hover:text-green-500 hover:bg-green-50 transition-all"
                                        title="Hablar por WhatsApp"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </button>
                                )}

                                <div className={`flex items-center px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest ${contact.status === 'CONTACT' ? 'bg-stone-100 text-stone-500 border-stone-200' :
                                    contact.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                                        'bg-indigo-100 text-indigo-600 border-indigo-200'
                                    }`}>
                                    {contact.status}
                                </div>

                                <button
                                    onClick={() => setCurrentUserRole(prev => prev === 'ADMIN' ? 'STAFF' : 'ADMIN')}
                                    className={`flex items-center px-3 py-1 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${currentUserRole === 'ADMIN' ? 'bg-purple-100 text-purple-600 border-purple-200' : 'bg-stone-50 text-stone-400 border-stone-100'
                                        }`}
                                >
                                    Rol: {currentUserRole}
                                </button>

                                {contact.status === 'CONFIRMED' && 
                                    (!contact.orders || !contact.orders.some((o: any) => o.orderType === 'SALE' && o.isDeleted !== true)) && (
                                    <button
                                        onClick={onRevertStatus}
                                        className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-amber-100 flex items-center gap-1.5 transition-all"
                                        title="Volver a estado Contacto"
                                    >
                                        <History className="w-3 h-3" />
                                        Retroceder
                                    </button>
                                )}
                                
                                {currentUserRole === 'ADMIN' && onDeleteContact && 
                                    contact.status !== 'CLIENT' && 
                                    (!contact.orders || !contact.orders.some((o: any) => o.orderType === 'SALE' && o.isDeleted !== true)) && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('¿Estás seguro que quieres eliminar este contacto?')) {
                                                onDeleteContact(contact.id);
                                            }
                                        }}
                                        className="p-1.5 ml-1 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent"
                                        title="Eliminar contacto"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button 
                                onClick={() => onEdit(contact)}
                                className="flex items-center gap-1.5 text-primary font-black text-xs uppercase tracking-widest hover:underline"
                            >
                                <Phone className="w-4 h-4" /> {contact.phone || 'Sin número'}
                            </button>
                            {contact.email && (
                                <button 
                                    onClick={() => onEdit(contact)}
                                    className="flex items-center gap-1.5 text-stone-500 font-bold text-xs lowercase tracking-tight hover:text-primary"
                                >
                                    <Mail className="w-4 h-4" /> {contact.email}
                                </button>
                            )}
                            {contact.dni && (
                                <button 
                                    onClick={() => onEdit(contact)}
                                    className="flex items-center gap-1.5 text-stone-400 font-black text-[10px] uppercase tracking-widest hover:text-primary"
                                >
                                    <FileText className="w-3.5 h-3.5" /> DNI: {contact.dni}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-white dark:bg-stone-900 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm font-bold text-[10px] uppercase tracking-widest text-stone-400">
                        <div className="mr-1.5 border-r border-stone-200 dark:border-stone-700 pr-1.5">Prioridad</div>
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                onClick={() => onUpdatePriority(contact.id, star)}
                                className="transition-transform hover:scale-125 focus:outline-none"
                            >
                                <Star className={`w-4 h-4 ${star <= contact.priority ? 'fill-primary text-primary' : 'text-stone-200 dark:text-stone-800'}`} />
                            </button>
                        ))}
                    </div>
                    <button onClick={onClose} className="p-3 bg-white dark:bg-stone-900 hover:bg-stone-50 rounded-xl transition-all border border-stone-200 dark:border-stone-700 shadow-sm group">
                        <X className="w-5 h-5 text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-100" />
                    </button>
                </div>
            </div>

            {/* Quick Info Grid - Improved UX: All items clickable to edit */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 mt-1">
                {[
                    { label: 'DNI / Documento', icon: FileText, value: contact.dni || 'No registrado' },
                    { label: 'Dirección', icon: MapPin, value: contact.address || 'No registrada' },
                    { label: 'Obra Social', icon: Building2, value: contact.insurance || 'Sin Obra Social' },
                    { label: 'Origen', icon: Share2, value: contact.contactSource || 'No especificado' },
                    { label: 'Interés', icon: Tag, value: contact.interest || 'General' },
                    { label: 'Presupuesto Est.', icon: Calculator, value: `$${safePrice(contact.expectedValue).toLocaleString()}` }
                ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                        <button 
                            key={idx}
                            onClick={() => onEdit(contact)}
                            className="bg-white dark:bg-stone-900/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm text-left hover:border-primary/50 transition-all group"
                        >
                            <span className="text-[8px] font-black text-stone-400 uppercase tracking-[0.2em] block mb-0.5 group-hover:text-primary transition-colors">{item.label}</span>
                            <div className="flex items-center gap-1.5">
                                <Icon className="w-3 h-3 text-primary" />
                                <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">{item.value}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Navigation Tabs */}
            <nav className="flex gap-2 pb-3 overflow-x-auto no-scrollbar">
                {[
                    { id: 'history', label: 'Historial', icon: History },
                    { id: 'tasks', label: 'Tareas', icon: CheckCircle2 },
                    { id: 'prescription', label: 'Receta / Clínica', icon: FileText },
                    { id: 'budget', label: 'Presupuestos', icon: Calculator },
                    { id: 'sales', label: 'Ventas', icon: Receipt }
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeSection === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id as any)}
                            className={`flex items-center shrink-0 gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive
                                ? 'bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground shadow-lg'
                                : 'bg-white dark:bg-stone-800 text-stone-400 hover:text-stone-600 border border-stone-200 dark:border-stone-700'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </header>
    );
}
