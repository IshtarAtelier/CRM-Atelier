'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, Check, AlertCircle, Zap, ClipboardPaste, ArrowRight, Save, ChevronDown, ChevronUp } from 'lucide-react';

interface ExtractedItem {
    linea: string;
    material: string;
    tratamiento: string;
    color: string;
    precio: number;
    precioLista: number;
    calibrado: number;
    iva: number;
    costoFinal: number;
}

interface MatchResult {
    extracted: ExtractedItem;
    match: { id: string; name: string | null; brand: string | null; type: string | null; lensIndex: string | null; cost: number; price: number; laboratory: string | null } | null;
    score: number;
    costoAnterior: number | null;
    precioAnterior: number | null;
}

interface Props {
    onClose: () => void;
    onSuccess: () => void;
    laboratories: string[];
}

type Step = 'config' | 'processing' | 'review';

export default function LabPriceImporter({ onClose, onSuccess, laboratories }: Props) {
    const [step, setStep] = useState<Step>('config');
    const [laboratory, setLaboratory] = useState(laboratories[0] || 'OPTOVISION');
    const [calibrado, setCalibrado] = useState(40000);
    const [iva, setIva] = useState(21);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [savedCount, setSavedCount] = useState(0);
    const [showFormula, setShowFormula] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);

    const handleImage = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Solo se aceptan imágenes');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setImagePreview(result);
            setImageBase64(result);
            setError(null);
        };
        reader.readAsDataURL(file);
    }, []);

    // Handle paste from clipboard
    const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
        const items = (e as ClipboardEvent).clipboardData?.items || (e as React.ClipboardEvent).clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) handleImage(file);
                break;
            }
        }
    }, [handleImage]);

    // Handle drag & drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        if (file) handleImage(file);
    }, [handleImage]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Process image through OCR API
    const processImage = async () => {
        if (!imageBase64) return;
        setStep('processing');
        setError(null);
        try {
            const res = await fetch('/api/products/ocr-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
                body: JSON.stringify({ imageBase64, laboratory, calibrado, iva }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al procesar');
                setStep('config');
                return;
            }
            setMatches(data.matches || []);
            // Auto-select all matched items
            const matched = new Set<string>();
            (data.matches || []).forEach((m: MatchResult) => {
                if (m.match) matched.add(m.match.id);
            });
            setSelectedIds(matched);
            setStep('review');
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
            setStep('config');
        }
    };

    // Apply selected cost updates
    const applyUpdates = async () => {
        const toUpdate = matches.filter(m => m.match && selectedIds.has(m.match.id));
        if (toUpdate.length === 0) return;
        setSaving(true);
        let count = 0;
        for (const item of toUpdate) {
            if (!item.match) continue;
            try {
                const res = await fetch(`/api/products/${item.match.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
                    body: JSON.stringify({ cost: item.extracted.costoFinal }),
                });
                if (res.ok) count++;
            } catch { /* skip */ }
        }
        setSavedCount(count);
        setSaving(false);
        if (count > 0) {
            onSuccess();
            setTimeout(() => onClose(), 2000);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const matchedItems = matches.filter(m => m.match);
    const unmatchedItems = matches.filter(m => !m.match);

    return (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onPaste={handlePaste}>
            <div className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[90vh] rounded-[2rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">

                {/* Header */}
                <header className="p-6 pb-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            Carga Inteligente <span className="text-primary">por Imagen</span>
                        </h2>
                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">
                            {step === 'config' ? 'Pegá o subí la lista de precios del laboratorio' :
                                step === 'processing' ? 'Analizando imagen con IA...' :
                                    `${matchedItems.length} productos encontrados`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors">
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </header>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-6 space-y-4">

                    {/* STEP 1: Config + Image Upload */}
                    {step === 'config' && (
                        <>
                            {/* Lab + Formula Config */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Laboratorio</label>
                                    <select value={laboratory} onChange={e => setLaboratory(e.target.value)}
                                        className="w-full px-3 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary uppercase">
                                        {laboratories.map(l => <option key={l} value={l}>{l}</option>)}
                                        <option value="OPTOVISION">OPTOVISION</option>
                                        <option value="DAC">DAC</option>
                                        <option value="IOL">IOL</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Calibrado ($)</label>
                                    <input type="number" value={calibrado} onChange={e => setCalibrado(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">IVA (%)</label>
                                    <input type="number" value={iva} onChange={e => setIva(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                </div>
                            </div>

                            {/* Formula preview */}
                            <button onClick={() => setShowFormula(!showFormula)}
                                className="flex items-center gap-2 text-[9px] font-black text-amber-600 uppercase tracking-widest hover:text-amber-500 transition-colors">
                                {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                Fórmula: (Precio Lista + ${calibrado.toLocaleString()}) × {(1 + iva / 100).toFixed(2)}
                            </button>
                            {showFormula && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                        <strong>Costo Final</strong> = (Precio Lista + Calibrado) × (1 + IVA/100)
                                    </p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                        Ejemplo: ($515.260 + $40.000) × 1.21 = <strong>${Math.round((515260 + calibrado) * (1 + iva / 100)).toLocaleString()}</strong>
                                    </p>
                                </div>
                            )}

                            {/* Image Drop Zone */}
                            <div
                                ref={dropRef}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group
                                    ${imagePreview
                                        ? 'border-primary/40 bg-primary/5'
                                        : 'border-stone-300 dark:border-stone-600 hover:border-primary/40 hover:bg-primary/5'}`}
                            >
                                {imagePreview ? (
                                    <div className="space-y-3">
                                        <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-xl shadow-lg" />
                                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">✓ Imagen cargada — click para cambiar</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex justify-center gap-4">
                                            <div className="w-14 h-14 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                <ClipboardPaste className="w-6 h-6 text-stone-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="w-14 h-14 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                <Upload className="w-6 h-6 text-stone-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="w-14 h-14 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                <ImageIcon className="w-6 h-6 text-stone-400 group-hover:text-primary transition-colors" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-stone-600 dark:text-stone-300">Pegá la captura aquí</p>
                                            <p className="text-[10px] font-bold text-stone-400 mt-1">Ctrl+V para pegar · Arrastrá · O hacé click para subir</p>
                                        </div>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                                    onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-xs font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                                </div>
                            )}
                        </>
                    )}

                    {/* STEP 2: Processing */}
                    {step === 'processing' && (
                        <div className="py-16 flex flex-col items-center gap-4">
                            <div className="relative">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
                                    <Zap className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-stone-700 dark:text-stone-200">Gemini IA analizando imagen...</p>
                                <p className="text-[10px] font-bold text-stone-400 mt-1">Extrayendo productos, materiales y precios</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Review matches */}
                    {step === 'review' && (
                        <>
                            {savedCount > 0 && (
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-in slide-in-from-top duration-300">
                                    <Check className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">✓ {savedCount} costos actualizados correctamente</span>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-xs font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                                </div>
                            )}

                            {/* Matched Products */}
                            {matchedItems.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                        <Check className="w-3 h-3" /> Productos Encontrados ({matchedItems.length})
                                    </h3>
                                    <div className="space-y-1.5">
                                        {matchedItems.map((m, i) => {
                                            const isSelected = m.match ? selectedIds.has(m.match.id) : false;
                                            const costDiff = m.costoAnterior ? m.extracted.costoFinal - m.costoAnterior : null;
                                            return (
                                                <div key={i} onClick={() => m.match && toggleSelect(m.match.id)}
                                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                                                        ? 'bg-primary/5 border-primary/30'
                                                        : 'bg-stone-50 dark:bg-stone-800 border-stone-100 dark:border-stone-700 opacity-50'}`}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-stone-300'}`}>
                                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-stone-800 dark:text-stone-100 truncate">
                                                                    {m.match?.brand} · {m.match?.name}
                                                                </p>
                                                                <p className="text-[9px] text-stone-400 truncate">
                                                                    {m.extracted.linea} — {m.extracted.material} — {m.extracted.tratamiento}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="flex items-center gap-2">
                                                                {m.costoAnterior != null && (
                                                                    <span className="text-[10px] font-bold text-stone-400 line-through">${m.costoAnterior.toLocaleString()}</span>
                                                                )}
                                                                <ArrowRight className="w-3 h-3 text-stone-300" />
                                                                <span className="text-xs font-black text-primary">${m.extracted.costoFinal.toLocaleString()}</span>
                                                            </div>
                                                            {costDiff != null && (
                                                                <span className={`text-[9px] font-black ${costDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {costDiff > 0 ? '+' : ''}{costDiff.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Unmatched Products */}
                            {unmatchedItems.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                        <AlertCircle className="w-3 h-3" /> Sin Coincidencia ({unmatchedItems.length})
                                    </h3>
                                    <div className="space-y-1">
                                        {unmatchedItems.map((m, i) => (
                                            <div key={i} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 opacity-60">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-[10px] font-bold text-stone-500">
                                                        {m.extracted.linea} — {m.extracted.material} — {m.extracted.tratamiento}
                                                    </p>
                                                    <span className="text-[10px] font-black text-stone-400">${m.extracted.costoFinal.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-stone-100 dark:border-stone-800 shrink-0">
                    {step === 'config' && (
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3.5 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={processImage} disabled={!imageBase64}
                                className="flex-1 py-3.5 bg-stone-900 dark:bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
                                <Zap className="w-4 h-4" /> Analizar con IA
                            </button>
                        </div>
                    )}
                    {step === 'review' && savedCount === 0 && (
                        <div className="flex gap-3">
                            <button onClick={() => { setStep('config'); setMatches([]); }}
                                className="flex-1 py-3.5 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors">
                                ← Volver
                            </button>
                            <button onClick={applyUpdates} disabled={saving || selectedIds.size === 0}
                                className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30">
                                <Save className="w-4 h-4" />
                                {saving ? 'Guardando...' : `Actualizar Costos (${selectedIds.size})`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
