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
            onClick={() => onClick(contact.id)}
            className="bg-white dark:bg-stone-800/40 border border-stone-200/60 dark:border-stone-700/60 rounded-3xl p-4 lg:p-6 hover:shadow-xl hover:border-primary/20 transition-all group flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-6 select-none cursor-pointer"
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

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto px-1 lg:px-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-stone-100 dark:border-stone-700 justify-between">
                <div className="text-left min-w-[100px] w-full sm:w-auto">
                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Ticket Promedio</p>
                    <p className={`text-lg lg:text-xl font-black tracking-tighter ${(contact.avgTicket || 0) > 0 ? 'text-stone-800 dark:text-stone-200' : 'text-stone-300 dark:text-stone-600'}`}>{(contact.avgTicket || 0) > 0 ? `$${contact.avgTicket?.toLocaleString()}` : '—'}</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuote(contact.id, contact.name);
                        }}
                        className="flex-1 sm:flex-none px-3 lg:px-4 py-2.5 lg:py-3 bg-primary/10 text-primary rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all border border-primary/20 flex items-center justify-center gap-2"
                    >
                        <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                        <span className="hidden sm:inline">Presupuesto</span>
                        <span className="sm:hidden">Cotizar</span>
                    </button>
                    {contact.status === 'CONTACT' && !contact.hasSales && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(contact.id, 'CONFIRMED');
                            }}
                            className="flex-1 sm:flex-none px-3 lg:px-4 py-2.5 lg:py-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                            Confirmar
                        </button>
                    )}
                    {contact.status === 'CONFIRMED' && !contact.hasSales && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(contact.id, 'CONTACT');
                            }}
                            className="flex-1 sm:flex-none px-3 lg:px-4 py-2.5 lg:py-3 bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest border border-stone-200 dark:border-stone-700 flex items-center justify-center gap-2 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                            title="Deshacer confirmación"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 lg:w-4 lg:h-4"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                            Deshacer
                        </button>
                    )}
                    <button
                        onClick={() => onClick(contact.id)}
                        className="p-2.5 lg:p-3 bg-stone-50 dark:bg-stone-800 rounded-xl lg:rounded-2xl hover:bg-primary hover:text-white transition-all border border-stone-100 dark:border-stone-700"
                    >
                        <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};
