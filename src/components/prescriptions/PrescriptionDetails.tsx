'use client';

import React, { useState, useCallback } from 'react';
import { Glasses, Activity, FileText, AlertCircle, Pencil, Save, Loader2, CheckCircle2, X } from 'lucide-react';
import { resolveStorageUrl } from '@/lib/utils/storage';

interface PrescriptionDetailsProps {
    prescription: any;
    showEmpty?: boolean;
    /** Enable inline editing of empty/missing fields */
    editable?: boolean;
    /** Contact ID needed for API calls when editing */
    contactId?: string;
    /** Callback after a field is saved */
    onUpdate?: () => void;
    /** Show near vision editable fields for multifocal */
    isMultifocal?: boolean;
}

export default function PrescriptionDetails({
    prescription,
    showEmpty = true,
    editable = false,
    contactId,
    onUpdate,
    isMultifocal = false
}: PrescriptionDetailsProps) {
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedField, setSavedField] = useState<string | null>(null);

    const handleStartEdit = (fieldKey: string, currentVal: any) => {
        setEditingField(fieldKey);
        setEditValue(currentVal != null && currentVal !== '' ? String(currentVal) : '');
    };

    const handleSave = useCallback(async () => {
        if (!editingField || !prescription?.id || !contactId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/contacts/${contactId}/prescriptions/${prescription.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [editingField]: editValue || null })
            });
            if (res.ok) {
                setSavedField(editingField);
                setEditingField(null);
                setTimeout(() => setSavedField(null), 2000);
                if (onUpdate) onUpdate();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data?.error || 'No se pudo guardar el cambio en la receta.');
            }
        } catch (err) {
            console.error('Error saving rx field:', err);
            alert('No se pudo guardar el cambio en la receta.');
        }
        setSaving(false);
    }, [editingField, editValue, prescription?.id, contactId, onUpdate]);

    const handleCancel = () => {
        setEditingField(null);
        setEditValue('');
    };

    if (!prescription && !showEmpty) return null;

    // Helper to format values with empty state
    const fmt = (val: any, suffix = '', prefix = '') => {
        if (val === undefined || val === null || val === '') return <span className="text-stone-300 dark:text-stone-700 font-bold italic text-[10px]">vacio</span>;
        
        // For sphere/cylinder, ensure 2 decimal places if it's a number
        let displayVal = val;
        if (typeof val === 'number' && !Number.isInteger(val)) {
            displayVal = val.toFixed(2);
        } else if (typeof val === 'string' && !isNaN(parseFloat(val)) && (val.includes('.') || val.includes(','))) {
            displayVal = parseFloat(val.replace(',', '.')).toFixed(2);
        }

        return `${prefix}${displayVal}${suffix}`;
    };

    const hasData = (val: any) => val !== undefined && val !== null && val !== '';

    const renderCell = (label: string, val: any, fieldKey: string, suffix = '', prefix = '') => {
        const isEmpty = !hasData(val);
        const isEditing = editingField === fieldKey;
        const justSaved = savedField === fieldKey;

        return (
            <div className={`px-4 py-4 text-center border-r border-stone-100 dark:border-stone-800 last:border-r-0 relative group ${isEmpty && editable ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
                <p className="text-[7px] font-black text-stone-400 uppercase mb-1 tracking-widest">{label}</p>
                
                {isEditing ? (
                    <div className="flex items-center gap-1 justify-center">
                        <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                            className="w-16 px-1.5 py-1 text-xs font-bold text-center bg-white dark:bg-stone-800 border-2 border-blue-400 rounded-lg outline-none"
                        />
                        <button onClick={handleSave} disabled={saving} className="p-0.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded transition-all">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </button>
                        <button onClick={handleCancel} className="p-0.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-all">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-1">
                        <p className={`text-sm font-black ${hasData(val) ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-800'}`}>
                            {justSaved ? (
                                <span className="text-emerald-500 flex items-center gap-1 justify-center">
                                    <CheckCircle2 className="w-3 h-3" /> Guardado
                                </span>
                            ) : fmt(val, suffix, prefix)}
                        </p>
                        {editable && isEmpty && !justSaved && (
                            <button
                                onClick={() => handleStartEdit(fieldKey, val)}
                                className="p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                                title={`Completar ${label}`}
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                        {editable && hasData(val) && !justSaved && (
                            <button
                                onClick={() => handleStartEdit(fieldKey, val)}
                                className="p-1 text-stone-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title={`Editar ${label}`}
                            >
                                <Pencil className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Editable Banner */}
            {editable && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl animate-in fade-in duration-300">
                    <Pencil className="w-3 h-3 text-blue-500" />
                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                        Hacé click en cualquier campo para editarlo
                    </span>
                </div>
            )}

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
                        {renderCell('Esfera', prescription?.sphereOD, 'sphereOD')}
                        {renderCell('Cilindro', prescription?.cylinderOD, 'cylinderOD')}
                        {renderCell('Eje', prescription?.axisOD, 'axisOD', '°')}
                        {renderCell('Add', prescription?.additionOD ?? prescription?.addition, 'additionOD', '', '+')}
                        {renderCell('DNP', prescription?.distanceOD ?? prescription?.pd, 'distanceOD')}
                        {renderCell('Altura', prescription?.heightOD, 'heightOD')}
                    </div>

                    {/* OI Row */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 items-center bg-white dark:bg-stone-900/5">
                        <div className="px-6 py-4 bg-blue-500/5 border-r border-stone-100 dark:border-stone-800">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500 text-white text-[10px] font-black">OI</span>
                        </div>
                        {renderCell('Esfera', prescription?.sphereOI, 'sphereOI')}
                        {renderCell('Cilindro', prescription?.cylinderOI, 'cylinderOI')}
                        {renderCell('Eje', prescription?.axisOI, 'axisOI', '°')}
                        {renderCell('Add', prescription?.additionOI ?? prescription?.addition, 'additionOI', '', '+')}
                        {renderCell('DNP', prescription?.distanceOI ?? prescription?.pd, 'distanceOI')}
                        {renderCell('Altura', prescription?.heightOI, 'heightOI')}
                    </div>
                </div>
            </div>

            {/* 2. VISIÓN DE CERCA / LECTURA */}
            {isMultifocal ? (
                <div className="bg-amber-50/20 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-[0.2em] px-6 py-3 italic flex justify-between items-center">
                        <span>Graduación: Visión de Cerca / Lectura</span>
                        <Activity className="w-4 h-4 opacity-50" />
                    </div>
                    <div className="grid grid-cols-1 divide-y divide-amber-100 dark:divide-amber-900/30">
                        {/* OD Cerca */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 items-center bg-amber-50/30 dark:bg-amber-950/10">
                            <div className="px-6 py-4 bg-emerald-500/5 border-r border-amber-100 dark:border-amber-900/30">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-white text-[10px] font-black">OD</span>
                            </div>
                            {renderCell('Esfera', prescription?.nearSphereOD, 'nearSphereOD')}
                            {renderCell('Cilindro', prescription?.nearCylinderOD, 'nearCylinderOD')}
                            {renderCell('Eje', prescription?.nearAxisOD, 'nearAxisOD', '°')}
                            {renderCell('DNP', prescription?.nearDistanceOD, 'nearDistanceOD')}
                            {renderCell('Altura', prescription?.heightOD, 'heightOD')}
                        </div>
                        {/* OI Cerca */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 items-center bg-white/50 dark:bg-stone-900/5">
                            <div className="px-6 py-4 bg-blue-500/5 border-r border-amber-100 dark:border-amber-900/30">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-500 text-white text-[10px] font-black">OI</span>
                            </div>
                            {renderCell('Esfera', prescription?.nearSphereOI, 'nearSphereOI')}
                            {renderCell('Cilindro', prescription?.nearCylinderOI, 'nearCylinderOI')}
                            {renderCell('Eje', prescription?.nearAxisOI, 'nearAxisOI', '°')}
                            {renderCell('DNP', prescription?.nearDistanceOI, 'nearDistanceOI')}
                            {renderCell('Altura', prescription?.heightOI, 'heightOI')}
                        </div>
                    </div>
                </div>
            ) : (
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
            )}

            {/* Removed PRISMAS Y OBSERVACIONES */}
            {/* Image Attachment */}
            {prescription?.imageUrl ? (
                <div role="button" tabIndex={0} className="mt-2 flex items-center gap-4 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/50 group cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all" onClick={() => window.open(resolveStorageUrl(prescription.imageUrl), '_blank')}>
                    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200">
                        <img 
                            src={resolveStorageUrl(prescription.imageUrl)} 
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
