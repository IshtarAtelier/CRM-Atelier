import React from 'react';

interface CostRowProps {
    label: string;
    value: number;
    total: number;
    color: string;
    tooltip?: string;
}

export function CostRow({ label, value, total, color, tooltip }: CostRowProps) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    
    // Convert Tailwind color classes into hex for inline style or use exact classes.
    // The previous implementation used bg-color-500. We pass the class in `color` like 'bg-red-500'.
    
    return (
        <div className="group relative" title={tooltip}>
            <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-md shadow-sm ${color}`} />
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 tracking-wide">{label}</span>
                    {tooltip && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                            {tooltip}
                        </span>
                    )}
                </div>
                <div className="flex items-baseline gap-3">
                    <span className="text-sm font-black tracking-tight text-stone-900 dark:text-white">
                        ${value.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-stone-400 w-12 text-right">
                        {pct.toFixed(1)}%
                    </span>
                </div>
            </div>
            <div className="w-full bg-stone-100/80 dark:bg-stone-800/80 h-2.5 rounded-full overflow-hidden backdrop-blur-sm shadow-inner">
                <div 
                    className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`} 
                    style={{ width: `${Math.min(pct, 100)}%` }} 
                />
            </div>
        </div>
    );
}
