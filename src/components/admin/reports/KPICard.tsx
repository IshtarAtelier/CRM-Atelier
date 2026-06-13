import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string | number;
    sub?: string;
    icon: LucideIcon;
    color?: 'stone' | 'red' | 'emerald' | 'blue' | 'purple' | 'amber';
    highlight?: boolean;
}

export function KPICard({ title, value, sub, icon: Icon, color = 'stone', highlight }: KPICardProps) {
    const colorMap: Record<string, { bg: string, iconBg: string, iconText: string, border: string, text: string, glow: string }> = {
        stone: { 
            bg: 'bg-white dark:bg-stone-800/80',
            iconBg: 'bg-stone-100 dark:bg-stone-700/50', 
            iconText: 'text-stone-600 dark:text-stone-300',
            border: 'border-stone-200 dark:border-stone-700',
            text: 'text-stone-800 dark:text-white',
            glow: 'group-hover:shadow-stone-200/50 dark:group-hover:shadow-stone-900/50'
        },
        red: { 
            bg: 'bg-white dark:bg-stone-800/80',
            iconBg: 'bg-red-50 dark:bg-red-950/40', 
            iconText: 'text-red-500',
            border: 'border-red-100 dark:border-red-900/30',
            text: 'text-stone-800 dark:text-white',
            glow: 'group-hover:shadow-red-200/30 dark:group-hover:shadow-red-900/20'
        },
        emerald: { 
            bg: 'bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-stone-800/80',
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', 
            iconText: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-200/60 dark:border-emerald-800/50',
            text: 'text-emerald-700 dark:text-emerald-400',
            glow: 'group-hover:shadow-emerald-200/40 dark:group-hover:shadow-emerald-900/30'
        },
        blue: { 
            bg: 'bg-white dark:bg-stone-800/80',
            iconBg: 'bg-blue-50 dark:bg-blue-950/40', 
            iconText: 'text-blue-500',
            border: 'border-blue-100 dark:border-blue-900/30',
            text: 'text-stone-800 dark:text-white',
            glow: 'group-hover:shadow-blue-200/30 dark:group-hover:shadow-blue-900/20'
        },
        purple: { 
            bg: 'bg-white dark:bg-stone-800/80',
            iconBg: 'bg-purple-50 dark:bg-purple-950/40', 
            iconText: 'text-purple-500',
            border: 'border-purple-100 dark:border-purple-900/30',
            text: 'text-stone-800 dark:text-white',
            glow: 'group-hover:shadow-purple-200/30 dark:group-hover:shadow-purple-900/20'
        },
        amber: { 
            bg: 'bg-white dark:bg-stone-800/80',
            iconBg: 'bg-amber-50 dark:bg-amber-950/40', 
            iconText: 'text-amber-500',
            border: 'border-amber-100 dark:border-amber-900/30',
            text: 'text-stone-800 dark:text-white',
            glow: 'group-hover:shadow-amber-200/30 dark:group-hover:shadow-amber-900/20'
        },
    };

    const theme = colorMap[highlight ? 'emerald' : color];

    return (
        <div className={`
            group relative overflow-hidden rounded-2xl border ${theme.border} ${theme.bg} 
            p-6 backdrop-blur-md transition-all duration-300 ease-out
            hover:-translate-y-1 hover:shadow-xl ${theme.glow}
        `}>
            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${theme.iconBg} ${theme.iconText}`}>
                            <Icon className="w-5 h-5 stroke-[2.5px]" />
                        </div>
                    </div>
                </div>
                
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1">
                        {title}
                    </h3>
                    <p className={`text-2xl md:text-3xl lg:text-4xl font-black tracking-tight ${theme.text}`}>
                        {value}
                    </p>
                    {sub && (
                        <p className="text-[11px] font-bold text-stone-400 mt-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600"></span>
                            {sub}
                        </p>
                    )}
                </div>
            </div>
            
            {/* Ambient background glow for highlight */}
            {highlight && (
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-400/20 transition-all duration-500" />
            )}
        </div>
    );
}
