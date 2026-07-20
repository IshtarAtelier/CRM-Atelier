import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Order } from '@/types/orders';
import { caseTypeStyle } from '@/lib/constants/postSale';

interface PostSaleCardProps {
    order: Order;
    onRefresh?: () => void;
    onMove: (direction: 'left' | 'right') => void;
    onExpand: () => void;
    onAutoSubmit?: (order: any, pairNum?: number) => void;
    isAutoSubmitting?: boolean;
    userRole?: string;
}

/**
 * Tarjeta compacta del tablero de Post-Venta: muestra SOLO lo esencial
 * (nombre del cliente, venta, tipo de caso, costo y progreso de laboratorio) y
 * es 100% clickeable para abrir la ficha completa a pantalla completa
 * (OrderDetailPanel), donde se trabaja el caso (notas, reproceso, SmartLab, etc.).
 * Las flechas ◄► mueven la tarjeta de etapa sin abrir la ficha.
 */
export function PostSaleCard({
    order,
    onMove,
    onExpand,
}: PostSaleCardProps) {
    const currentStatus = order.postSaleStatus || 'SENT';
    const statusKeys = ['SENT', 'IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'];
    let currentIdx = statusKeys.indexOf(currentStatus);
    if (currentIdx === -1) currentIdx = 0;
    const canMoveLeft = currentIdx > 0;
    const canMoveRight = currentIdx < statusKeys.length - 1;

    const hasCost = order.postSaleCost != null && order.postSaleCost > 0;
    const hasProgress = order.smartLabProgress != null && order.smartLabProgress > 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}
            className="group cursor-pointer bg-white dark:bg-stone-850 rounded-2xl border border-stone-200/70 dark:border-stone-750 p-4 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800/60 transition-all"
            title="Tocá para abrir la ficha completa"
        >
            {/* Nombre (protagonista) */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h4 className="text-sm font-black text-stone-850 dark:text-stone-100 leading-tight truncate">
                        {order.client?.name || 'Cliente'}
                    </h4>
                    <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                        Venta #{order.id.slice(-4).toUpperCase()}
                    </span>
                </div>
                <Eye className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-0.5" />
            </div>

            {/* Chips mínimos (solo si hay dato) */}
            {(order.postSaleCaseType || hasCost) && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {order.postSaleCaseType && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${caseTypeStyle(order.postSaleCaseType)}`}>
                            {order.postSaleCaseType}
                        </span>
                    )}
                    {hasCost && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30">
                            $ {order.postSaleCost!.toLocaleString('es-AR')}
                        </span>
                    )}
                </div>
            )}

            {/* Mini progreso SmartLab */}
            {hasProgress && (
                <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">SmartLab</span>
                        <span className={`text-[10px] font-black ${order.smartLabProgress! >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>
                            {order.smartLabProgress}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-blue-100/70 dark:bg-blue-900/30 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${order.smartLabProgress! >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, order.smartLabProgress!)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Mover de etapa (no abre la ficha) */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800">
                <button
                    onClick={(e) => { e.stopPropagation(); onMove('left'); }}
                    disabled={!canMoveLeft}
                    title="Mover a etapa anterior"
                    className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20 rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest select-none group-hover:text-amber-500 transition-colors">
                    Tocá para abrir
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onMove('right'); }}
                    disabled={!canMoveRight}
                    title="Mover a siguiente etapa"
                    className="p-1 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20 rounded-lg transition-colors"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
