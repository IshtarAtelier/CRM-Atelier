'use client';

import React from 'react';

interface QuotePrescriptionProps {
    prescription: any;
}

export default function QuotePrescription({
    prescription
}: QuotePrescriptionProps) {
    if (!prescription) return null;

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                📋 Receta Óptica
            </h4>
            <div className="bg-stone-50/50 dark:bg-stone-900/30 border border-stone-100 dark:border-stone-800 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-8 bg-stone-900 dark:bg-stone-950 text-white text-[8px] font-black uppercase tracking-widest">
                    <div className="px-3 py-2.5 text-center border-r border-stone-700"></div>
                    <div className="px-3 py-2.5 text-center border-r border-stone-700">ESF</div>
                    <div className="px-3 py-2.5 text-center border-r border-stone-700">CIL</div>
                    <div className="px-3 py-2.5 text-center border-r border-stone-700">EJE</div>
                    <div className="px-3 py-2.5 text-center border-r border-stone-700">ADD</div>
                    <div className="px-3 py-2.5 text-center border-r border-stone-700">DNP</div>
                    <div className="px-3 py-2.5 text-center border-r border-stone-700">ALTURA</div>
                    <div className="px-3 py-2.5 text-center">PRISMA</div>
                </div>
                {/* OD Row */}
                <div className="grid grid-cols-8 border-b border-stone-100 dark:border-stone-800">
                    <div className="px-3 py-3 text-center border-r border-stone-100 dark:border-stone-800">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black">OD</span>
                    </div>
                    {[
                        prescription.sphereOD != null ? (prescription.sphereOD > 0 ? `+${prescription.sphereOD.toFixed(2)}` : prescription.sphereOD.toFixed(2)) : '—',
                        prescription.cylinderOD != null ? prescription.cylinderOD.toFixed(2) : '—',
                        prescription.axisOD != null ? `${prescription.axisOD}°` : '—',
                        (prescription.additionOD ?? prescription.addition) != null ? `+${(prescription.additionOD ?? prescription.addition)?.toFixed(2)}` : '—',
                        (prescription.distanceOD ?? prescription.pd) != null ? (prescription.distanceOD ?? prescription.pd) : '—',
                        prescription.heightOD != null ? prescription.heightOD : '—',
                        '—'
                    ].map((val, idx) => (
                        <div key={idx} className="px-3 py-3 text-center text-sm font-bold text-stone-800 dark:text-stone-200 border-r border-stone-100 dark:border-stone-800 last:border-r-0">
                            {val}
                        </div>
                    ))}
                </div>
                {/* OI Row */}
                <div className="grid grid-cols-8">
                    <div className="px-3 py-3 text-center border-r border-stone-100 dark:border-stone-800">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-[9px] font-black">OI</span>
                    </div>
                    {[
                        prescription.sphereOI != null ? (prescription.sphereOI > 0 ? `+${prescription.sphereOI.toFixed(2)}` : prescription.sphereOI.toFixed(2)) : '—',
                        prescription.cylinderOI != null ? prescription.cylinderOI.toFixed(2) : '—',
                        prescription.axisOI != null ? `${prescription.axisOI}°` : '—',
                        (prescription.additionOI ?? prescription.addition) != null ? `+${(prescription.additionOI ?? prescription.addition)?.toFixed(2)}` : '—',
                        (prescription.distanceOI ?? prescription.pd) != null ? (prescription.distanceOI ?? prescription.pd) : '—',
                        prescription.heightOI != null ? prescription.heightOI : '—',
                        '—'
                    ].map((val, idx) => (
                        <div key={idx} className="px-3 py-3 text-center text-sm font-bold text-stone-800 dark:text-stone-200 border-r border-stone-100 dark:border-stone-800 last:border-r-0">
                            {val}
                        </div>
                    ))}
                </div>
            </div>

            {prescription.notes && (
                <p className="mt-2 text-[10px] font-bold text-stone-400 italic px-2">📝 {prescription.notes}</p>
            )}

            {prescription.imageUrl && (
                <div className="mt-3 flex items-center gap-3 px-2">
                    <img 
                        src={prescription.imageUrl} 
                        alt="Receta" 
                        className="w-16 h-16 object-cover rounded-xl border-2 border-emerald-200 cursor-pointer hover:scale-110 transition-transform shadow-md"
                        onClick={() => window.open(prescription.imageUrl, '_blank')}
                    />
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">✅ Imagen de receta adjunta</span>
                </div>
            )}
        </div>
    );
}
