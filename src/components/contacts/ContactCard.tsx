import React from 'react';
import { UserPlus, Star, Phone, Tag as TagIcon, ChevronRight, CheckCircle2, UserCheck, Building2, Heart, FileText } from "lucide-react";
import { Contact } from '@/types/contacts';

interface ContactCardProps {
    contact: Contact;
    onStatusChange: (id: string, status: string) => void;
    onPriorityChange: (id: string, priority: number) => void;
    onToggleFavorite: (id: string) => void;
    onClick: (id: string) => void;
    onQuote: (id: string, name: string) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
    contact,
    onStatusChange,
    onPriorityChange,
    onToggleFavorite,
    onClick,
    onQuote
}) => {
    return (
        <div
            className="bg-white dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-6 hover:shadow-xl hover:border-primary/20 transition-all group flex flex-col md:flex-row items-center justify-between gap-6 select-none"
        >
            <div className="flex items-center gap-6 flex-1 w-full">
                <div className="relative">
                    <div className="w-14 h-14 bg-stone-100 dark:bg-stone-700 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                        {contact.status === 'CONTACT' && <UserPlus className="w-7 h-7" />}
                        {contact.status === 'CONFIRMED' && <CheckCircle2 className="w-7 h-7" />}
                        {contact.status === 'CLIENT' && <UserCheck className="w-7 h-7" />}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(contact.id);
                        }}
                        className={`absolute -top-2 -right-2 p-1.5 rounded-full shadow-lg border transition-all ${contact.isFavorite
                            ? 'bg-red-500 text-white border-red-400 scale-110'
                            : 'bg-white dark:bg-stone-800 text-stone-300 border-stone-200 dark:border-stone-700 hover:text-red-400'
                            }`}
                    >
                        <Heart className={`w-3 h-3 ${contact.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                </div>

                <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <h3
                                onClick={() => onClick(contact.id)}
                                className="text-lg font-black text-stone-800 dark:text-stone-100 tracking-tight truncate max-w-[200px] cursor-pointer hover:text-primary transition-colors"
                            >{contact.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${contact.status === 'CONTACT' ? 'bg-stone-100 text-stone-500' :
                                contact.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-600' :
                                    'bg-indigo-100 text-indigo-600'
                                }`}>
                                {contact.status === 'CONTACT' ? 'Contacto' :
                                    contact.status === 'CONFIRMED' ? 'Confirmado' :
                                        'Cerrado'}
                            </span>
                        </div>
                        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPriorityChange(contact.id, star);
                                    }}
                                    className="p-0.5 transition-transform hover:scale-125 group/star"
                                >
                                    <Star
                                        className={`w-3.5 h-3.5 transition-colors ${star <= (contact.priority || 0)
                                            ? 'fill-primary text-primary'
                                            : 'text-stone-200 dark:text-stone-700 group-hover/star:text-primary/40'}`}
                                        strokeWidth={2.5}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-1.5 text-stone-500 font-bold text-[11px] uppercase tracking-wider">
                            <Phone className="w-3.5 h-3.5 text-primary/60" />
                            {contact.phone || 'Sin número'}
                        </div>
                        {contact.insurance && (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                                <Building2 className="w-3 h-3" />
                                {contact.insurance}
                            </div>
                        )}
                        {contact.interest && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400 uppercase italic">
                                <TagIcon className="w-3 h-3 text-stone-300" />
                                {contact.interest}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto px-4 py-3 md:py-0 border-t md:border-t-0 border-stone-100 dark:border-stone-700 justify-between">
                <div className="text-right min-w-[100px]">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Ticket Promedio</p>
                    <p className={`text-xl font-black tracking-tighter ${(contact.avgTicket || 0) > 0 ? 'text-stone-800 dark:text-stone-200' : 'text-stone-300 dark:text-stone-600'}`}>{(contact.avgTicket || 0) > 0 ? `$${contact.avgTicket?.toLocaleString()}` : '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuote(contact.id, contact.name);
                        }}
                        className="px-4 py-3 bg-primary/10 text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all border border-primary/20 hover:border-primary flex items-center gap-2 shadow-sm hover:shadow-lg hover:shadow-primary/20"
                    >
                        <FileText className="w-4 h-4" />
                        Nuevo Presupuesto
                    </button>
                    {contact.status === 'CONTACT' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(contact.id, 'CONFIRMED');
                            }}
                            className="px-4 py-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirmar
                        </button>
                    )}
                    {contact.status === 'CONFIRMED' && (
                        <div className="flex items-center gap-2">
                            <span className="px-4 py-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-2 cursor-default" title="Abrí el detalle para cerrar la venta">
                                <UserCheck className="w-4 h-4" />
                                En Proceso
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('¿Volver este pedido a estado Contacto?')) {
                                        onStatusChange(contact.id, 'CONTACT');
                                    }
                                }}
                                className="px-3 py-3 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors border border-amber-200 dark:border-amber-800/50 flex items-center gap-1.5"
                                title="Retroceder a Contacto"
                            >
                                ← Retroceder
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => onClick(contact.id)}
                        className="p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl hover:bg-primary hover:text-white transition-all shadow-inner border border-stone-100 dark:border-stone-700"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};
