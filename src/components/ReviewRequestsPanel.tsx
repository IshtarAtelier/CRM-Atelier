'use client';

import { Star, X, User, ChevronRight, Clock, MessageCircle } from 'lucide-react';
import Link from 'next/link';

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg 
            viewBox="0 0 24 24" 
            className={className}
            fill="currentColor"
        >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

interface ReviewRequestsPanelProps {
    requests: any[];
    onClose: () => void;
}

export default function ReviewRequestsPanel({ requests, onClose }: ReviewRequestsPanelProps) {
    return (
        <div className="fixed top-16 right-4 bottom-20 w-[calc(100vw-2rem)] max-w-[28rem] md:top-24 md:right-8 md:bottom-24 md:max-w-[34rem] bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl z-[100] rounded-[3rem] shadow-huge border border-stone-200/50 dark:border-stone-800/50 flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
            <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-yellow-50/50 dark:bg-yellow-900/10">
                <div className="flex items-center gap-3 text-yellow-500">
                    <Star className="w-6 h-6 fill-yellow-500 animate-pulse" />
                    <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-tighter italic text-xl">
                        Reseñas Pendientes
                    </h3>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all hover:rotate-90">
                    <X className="w-5 h-5 text-stone-400" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 custom-scrollbar">
                {requests.length > 0 ? (
                    requests.map(task => (
                        <div key={task.id} className="relative group">
                            <Link
                                href={`/admin/contactos?clientId=${task.clientId}`}
                                onClick={onClose}
                                className="w-full flex items-center gap-4 p-4 md:p-5 bg-white dark:bg-stone-800 rounded-[2rem] md:rounded-[2.5rem] border border-stone-100 dark:border-stone-700 hover:border-yellow-500/30 dark:hover:border-yellow-500/20 hover:shadow-xl transition-all text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500/20 group-hover:bg-yellow-500 transition-colors" />

                                <div className="w-10 h-10 md:w-12 md:h-12 bg-stone-50 dark:bg-stone-900 rounded-xl md:rounded-2xl flex items-center justify-center text-stone-400 group-hover:text-yellow-500 group-hover:bg-yellow-500/5 transition-all shrink-0">
                                    <User className="w-5 h-5 md:w-6 md:h-6" />
                                </div>

                                <div className="flex-1 min-w-0 pr-16 md:pr-20">
                                    <p className="font-black text-stone-800 dark:text-stone-200 text-sm tracking-tight uppercase mb-1">
                                        {task.client?.name || 'Cliente'}
                                        {task.client?.phone && (
                                            <span 
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                className="text-xs font-bold text-stone-400 dark:text-stone-500 normal-case ml-2 select-all cursor-text"
                                                title="Hacé click para seleccionar y copiar"
                                            >
                                                ({task.client.phone})
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400 line-clamp-2 leading-tight lowercase">
                                        {task.description}
                                    </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-stone-200 group-hover:text-yellow-500 transition-all group-hover:translate-x-1" />
                            </Link>

                            {/* WhatsApp Action */}
                            {task.client?.phone && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const message = `Hola ${task.client.name.split(' ')[0]}! Te escribimos para pedirte un favor enorme 🙏\n\n¿Nos dejarías una reseña en Google? Nos ayudaría muchísimo si podés mencionar por qué somos la mejor óptica en Córdoba para vos y cómo fue tu experiencia.\n\nSi podés, contá en la reseña qué anteojos o cristales te hiciste (por ejemplo: multifocales, lentes de sol, cristales Crizal, etc.), ¡nos ayuda un montón! 🙌\n\n👉 https://g.page/r/CcVls8v7ic_NEBM/review\n\n¡Nos suma muchísimo para seguir creciendo!\nEspero tu comentario 🤍✨🫶`;
                                        let phone = task.client.phone.replace(/\D/g, '');
                                        if (phone.length === 10) phone = '549' + phone;
                                        
                                        // Copiar mensaje al portapapeles y redirigir al agente activo de WhatsApp en el CRM
                                        navigator.clipboard.writeText(message).catch(() => {});
                                        window.location.href = `/admin/whatsapp?phone=${phone}`;
                                    }}
                                    className="absolute right-12 md:right-16 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl md:rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                                    title="Ir al chat de WhatsApp en el CRM (Copia mensaje al portapapeles)"
                                >
                                    <WhatsAppIcon className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-10 py-20 bg-stone-50/50 dark:bg-stone-800/20 rounded-[3rem] border-2 border-dashed border-stone-100 dark:border-stone-800">
                        <div className="w-20 h-20 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-xl mb-6">
                            <Star className="w-10 h-10 text-stone-200" />
                        </div>
                        <p className="text-sm font-black text-stone-400 uppercase tracking-widest leading-relaxed">No hay solicitudes pendientes</p>
                    </div>
                )}
            </div>

            <footer className="p-6 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 space-y-4">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] text-center">Optica CRM v2.0</p>
            </footer>
        </div>
    );
}
