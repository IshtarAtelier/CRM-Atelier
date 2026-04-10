'use client';

import React from 'react';
import { Ruler, Glasses, Activity, FileText } from 'lucide-react';

interface QuotePrescriptionProps {
    prescription: any;
}

export default function QuotePrescription({
    prescription
}: QuotePrescriptionProps) {
    if (!prescription) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Receta Óptica Detallada
            </h4>
            
            {/* 1. VISIÓN DE LEJOS / DISTANCIA */}
            <div className="bg-stone-50/50 dark:bg-stone-900/30 border border-stone-100 dark:border-stone-800 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="bg-stone-900 dark:bg-stone-950 text-white text-[9px] font-black uppercase tracking-[0.2em] px-6 py-3 italic flex justify-between items-center">
                    <span>Visión de Lejos / Distancia</span>
                    <Glasses className="w-4 h-4 opacity-50" />
                </div>
                
                <div className="grid grid-cols-1 divide-y divide-stone-100 dark:divide-stone-800">
                    {/* OD Row */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 items-center">
                        <div className="px-6 py-4 bg-emerald-500/5 border-r border-stone-100 dark:border-stone-800">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-white text-[10px] font-black">OD</span>
                        </div>
                        {[
                            { label: 'Esfera', val: prescription.sphereOD },
                            { label: 'Cilindro', val: prescription.cylinderOD },
                            { label: 'Eje', val: prescription.axisOD, suffix: '°' },
                            { label: 'Add', val: prescription.additionOD ?? prescription.addition, prefix: '+' },
                            { label: 'DNP', val: prescription.distanceOD ?? prescription.pd },
                            { label: 'Altura', val: prescription.heightOD }
                        ].map((f, i) => (
                            <div key={i} className="px-4 py-4 text-center border-r border-stone-100 dark:border-stone-800 last:border-r-0">
                                <p className="text-[8px] font-black text-stone-400 uppercase mb-1">{f.label}</p>
                                <p className="text-sm font-black text-stone-800 dark:text-stone-100">
                                    {f.val != null ? `${f.prefix || ''}${f.val}${f.suffix || ''}` : '—'}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* OI Row */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 items-center">
                        <div className="px-6 py-4 bg-blue-500/5 border-r border-stone-100 dark:border-stone-800">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500 text-white text-[10px] font-black">OI</span>
                        </div>
                        {[
                            { label: 'Esfera', val: prescription.sphereOI },
                            { label: 'Cilindro', val: prescription.cylinderOI },
                            { label: 'Eje', val: prescription.axisOI, suffix: '°' },
                            { label: 'Add', val: prescription.additionOI ?? prescription.addition, prefix: '+' },
                            { label: 'DNP', val: prescription.distanceOI ?? prescription.pd },
                            { label: 'Altura', val: prescription.heightOI }
                        ].map((f, i) => (
                            <div key={i} className="px-4 py-4 text-center border-r border-stone-100 dark:border-stone-800 last:border-r-0">
                                <p className="text-[8px] font-black text-stone-400 uppercase mb-1">{f.label}</p>
                                <p className="text-sm font-black text-stone-800 dark:text-stone-100">
                                    {f.val != null ? `${f.prefix || ''}${f.val}${f.suffix || ''}` : '—'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. VISIÓN DE CERCA / LECTURA (Only if has specifically near fields or it's a Near Rx) */}
            {(prescription.nearSphereOD != null || (prescription.additionOD || prescription.addition) > 0) && (
                <div className="bg-amber-50/30 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-[2rem] overflow-hidden">
                    <div className="bg-amber-600 text-white text-[9px] font-black uppercase tracking-[0.2em] px-6 py-2 italic flex justify-between items-center">
                        <span>Visión de Cerca / Lectura (Graduación Resultante)</span>
                        <Activity className="w-4 h-4 opacity-50" />
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-stone-900/50 rounded-2xl border border-amber-100/50">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">Ojo Derecho (Cerca)</span>
                            <span className="text-sm font-black text-stone-800 dark:text-stone-200">
                                {prescription.nearSphereOD != null 
                                    ? `ESF ${prescription.nearSphereOD > 0 ? '+' : ''}${prescription.nearSphereOD}`
                                    : (prescription.additionOD || prescription.addition) != null 
                                        ? `ESF ${((prescription.sphereOD || 0) + (prescription.additionOD || prescription.addition || 0)).toFixed(2)}`
                                        : '—'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white/50 dark:bg-stone-900/50 rounded-2xl border border-amber-100/50">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">Ojo Izquierdo (Cerca)</span>
                            <span className="text-sm font-black text-stone-800 dark:text-stone-200">
                                {prescription.nearSphereOI != null 
                                    ? `ESF ${prescription.nearSphereOI > 0 ? '+' : ''}${prescription.nearSphereOI}`
                                    : (prescription.additionOI || prescription.addition) != null 
                                        ? `ESF ${((prescription.sphereOI || 0) + (prescription.additionOI || prescription.addition || 0)).toFixed(2)}`
                                        : '—'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. PRISMAS Y OTROS MEDIDAS */}
            {(prescription.prismOD || prescription.prismOI || prescription.notes) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(prescription.prismOD || prescription.prismOI) && (
                        <div className="p-5 bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Ruler className="w-3.5 h-3.5" /> Prismas
                            </p>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-stone-400">Prisma OD</span>
                                    <span className="text-stone-800 dark:text-stone-200">{prescription.prismOD || 'Sin prisma'}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold shadow-stone-100">
                                    <span className="text-stone-400">Prisma OI</span>
                                    <span className="text-stone-800 dark:text-stone-200">{prescription.prismOI || 'Sin prisma'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {prescription.notes && (
                        <div className="p-5 bg-stone-50 dark:bg-stone-900/50 rounded-[2rem] border border-stone-100 dark:border-stone-800">
                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">Observaciones</p>
                            <p className="text-xs font-medium text-stone-600 dark:text-stone-300 italic">“{prescription.notes}”</p>
                        </div>
                    )}
                </div>
            )}

            {/* Image Attachment */}
            {prescription.imageUrl && (
                <div className="mt-2 flex items-center gap-4 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/50">
                    <img 
                        src={prescription.imageUrl} 
                        alt="Imagen de Receta" 
                        className="w-20 h-20 object-cover rounded-2xl border-2 border-emerald-200 shadow-md hover:scale-110 transition-transform cursor-pointer"
                        onClick={() => window.open(prescription.imageUrl, '_blank')}
                    />
                    <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Documento Adjunto</p>
                        <p className="text-[10px] font-medium text-stone-500">Receta original escaneada / fotografiada</p>
                    </div>
                </div>
            )}
        </div>
    );
}
