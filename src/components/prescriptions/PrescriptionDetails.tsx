'use client';

import React from 'react';
import { Ruler, Glasses, Activity, FileText, AlertCircle } from 'lucide-react';

interface PrescriptionDetailsProps {
    prescription: any;
    showEmpty?: boolean;
}

export default function PrescriptionDetails({
    prescription,
    showEmpty = true
}: PrescriptionDetailsProps) {
    if (!prescription && !showEmpty) return null;

    // Helper to format values with empty state
    const fmt = (val: any, suffix = '', prefix = '') => {
        if (val == null || val === '') return <span className="text-stone-300 dark:text-stone-700 font-bold italic text-[10px]">vacio</span>;
        return `${prefix}${val}${suffix}`;
    };

    const hasData = (val: any) => val != null && val !== '';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. VISIÓN DE LEJOS / DISTANCIA */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="bg-stone-900 dark:bg-stone-950 text-white text-[9px] font-black uppercase tracking-[0.2em] px-6 py-3 italic flex justify-between items-center">
                    <span>Graduación: Visión de Lejos / Distancia</span>
                    <Glasses className="w-4 h-4 opacity-50" />
                </div>
                
                <div className="grid grid-cols-1 divide-y divide-stone-100 dark:divide-stone-800">
                    {/* OD Row */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 items-center bg-stone-50/30 dark:bg-stone-900/10">
                        <div className="px-6 py-4 bg-emerald-500/5 border-r border-stone-100 dark:border-stone-800">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-white text-[10px] font-black">OD</span>
                        </div>
                        {[
                            { label: 'Esfera', val: prescription?.sphereOD },
                            { label: 'Cilindro', val: prescription?.cylinderOD },
                            { label: 'Eje', val: prescription?.axisOD, suffix: '°' },
                            { label: 'Add', val: prescription?.additionOD ?? prescription?.addition, prefix: '+' },
                            { label: 'DNP', val: prescription?.distanceOD ?? prescription?.pd },
                            { label: 'Altura', val: prescription?.heightOD }
                        ].map((f, i) => (
                            <div key={i} className="px-4 py-4 text-center border-r border-stone-100 dark:border-stone-800 last:border-r-0">
                                <p className="text-[7px] font-black text-stone-400 uppercase mb-1 tracking-widest">{f.label}</p>
                                <p className={`text-sm font-black ${hasData(f.val) ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-800'}`}>
                                    {fmt(f.val, f.suffix, f.prefix)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* OI Row */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 items-center bg-white dark:bg-stone-900/5">
                        <div className="px-6 py-4 bg-blue-500/5 border-r border-stone-100 dark:border-stone-800">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500 text-white text-[10px] font-black">OI</span>
                        </div>
                        {[
                            { label: 'Esfera', val: prescription?.sphereOI },
                            { label: 'Cilindro', val: prescription?.cylinderOI },
                            { label: 'Eje', val: prescription?.axisOI, suffix: '°' },
                            { label: 'Add', val: prescription?.additionOI ?? prescription?.addition, prefix: '+' },
                            { label: 'DNP', val: prescription?.distanceOI ?? prescription?.pd },
                            { label: 'Altura', val: prescription?.heightOI }
                        ].map((f, i) => (
                            <div key={i} className="px-4 py-4 text-center border-r border-stone-100 dark:border-stone-800 last:border-r-0">
                                <p className="text-[7px] font-black text-stone-400 uppercase mb-1 tracking-widest">{f.label}</p>
                                <p className={`text-sm font-black ${hasData(f.val) ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-800'}`}>
                                    {fmt(f.val, f.suffix, f.prefix)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. VISIÓN DE CERCA / LECTURA */}
            <div className="bg-amber-50/20 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-[2rem] overflow-hidden">
                <div className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-[0.2em] px-6 py-2 italic flex justify-between items-center">
                    <span>Visión de Cerca / Lectura (Graduación Resultante)</span>
                    <Activity className="w-4 h-4 opacity-50" />
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-stone-900/50 rounded-2xl border border-amber-100/50">
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase">OD (Cerca)</span>
                        <span className="text-sm font-black text-stone-800 dark:text-stone-200">
                            {prescription?.nearSphereOD != null 
                                ? `ESF ${prescription.nearSphereOD > 0 ? '+' : ''}${prescription.nearSphereOD}`
                                : (prescription?.additionOD || prescription?.addition) > 0
                                    ? `ESF ${((prescription.sphereOD || 0) + (prescription.additionOD || prescription.addition || 0)).toFixed(2)}`
                                    : <span className="text-stone-300 italic text-[10px]">vacio</span>}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-stone-900/50 rounded-2xl border border-amber-100/50">
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase">OI (Cerca)</span>
                        <span className="text-sm font-black text-stone-800 dark:text-stone-200">
                            {prescription?.nearSphereOI != null 
                                ? `ESF ${prescription.nearSphereOI > 0 ? '+' : ''}${prescription.nearSphereOI}`
                                : (prescription?.additionOI || prescription?.addition) > 0
                                    ? `ESF ${((prescription.sphereOI || 0) + (prescription.additionOI || prescription.addition || 0)).toFixed(2)}`
                                    : <span className="text-stone-300 italic text-[10px]">vacio</span>}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. PRISMAS Y OBSERVACIONES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Ruler className="w-3.5 h-3.5" /> Prismas
                    </p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-stone-100 dark:border-stone-800/50">
                            <span className="text-[10px] font-bold text-stone-400 uppercase">Ojo Derecho</span>
                            <span className={`text-xs font-black ${prescription?.prismOD ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-800 italic'}`}>
                                {prescription?.prismOD || 'vacio'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-stone-400 uppercase">Ojo Izquierdo</span>
                            <span className={`text-xs font-black ${prescription?.prismOI ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-800 italic'}`}>
                                {prescription?.prismOI || 'vacio'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">Observaciones</p>
                    {prescription?.notes ? (
                        <p className="text-xs font-medium text-stone-600 dark:text-stone-300 italic">“{prescription.notes}”</p>
                    ) : (
                        <p className="text-[10px] text-stone-300 italic font-bold">Sin observaciones adicionales</p>
                    )}
                </div>
            </div>

            {/* Image Attachment */}
            {prescription?.imageUrl ? (
                <div className="mt-2 flex items-center gap-4 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 group cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all" onClick={() => window.open(prescription.imageUrl, '_blank')}>
                    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200">
                        <img 
                            src={prescription.imageUrl} 
                            alt="Imagen de Receta" 
                            className="w-16 h-16 object-cover transition-transform group-hover:scale-110"
                        />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Foto Adjunta
                        </p>
                        <p className="text-[10px] font-medium text-stone-500">Haz clic para ver la receta original</p>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 p-4 bg-stone-50/50 dark:bg-stone-900/20 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
                    <AlertCircle className="w-4 h-4 text-stone-300" />
                    <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">No hay imagen adjunta</span>
                </div>
            )}
        </div>
    );
}
