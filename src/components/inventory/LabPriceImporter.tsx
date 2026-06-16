'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Image as ImageIcon, Loader2, Check, AlertCircle, Zap, ClipboardPaste, ArrowRight, Save, ChevronDown, ChevronUp } from 'lucide-react';
import Image from "next/image";

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
    cantCristales: number;
}

interface MatchResult {
    extracted: ExtractedItem;
    match: { id: string; name: string | null; brand: string | null; type: string | null; lensIndex: string | null; cost: number; price: number; laboratory: string | null; is2x1: boolean } | null;
    score: number;
    costoAnterior: number | null;
    precioAnterior: number | null;
    markupActual: number;
    precioSugerido: number;
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
    const [labConfigs, setLabConfigs] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    
    // Markup states
    const [customMarkups, setCustomMarkups] = useState<Record<string, number>>({});
    const [globalMarkup, setGlobalMarkup] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/api/laboratories')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data.laboratories)) {
                    setLabConfigs(data.laboratories);
                    const initialLab = data.laboratories.find((l: any) => l.name.toUpperCase() === (laboratories[0] || 'OPTOVISION').toUpperCase());
                    if (initialLab) {
                        setCalibrado(initialLab.calibrado);
                        setIva(initialLab.iva);
                    }
                }
            })
            .catch(err => console.error('Error fetching labs:', err));
    }, [laboratories]);

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

    const processImage = async () => {
        if (!imageBase64) return;
        setStep('processing');
        setError(null);
        try {
            const res = await fetch('/api/products/ocr-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64, laboratory, calibrado, iva }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al procesar');
                setStep('config');
                return;
            }
            setMatches(data.matches || []);
            setSummary(data.summary || null);
            
            const matched = new Set<string>();
            const initialMarkups: Record<string, number> = {};
            
            (data.matches || []).forEach((m: MatchResult) => {
                if (m.match) {
                    matched.add(m.match.id);
                    initialMarkups[m.match.id] = m.markupActual;
                }
            });
            
            setSelectedIds(matched);
            setCustomMarkups(initialMarkups);
            setStep('review');
        } catch (err: any) {
            setError(err.message || 'Error de conexión');
            setStep('config');
        }
    };

    const applyGlobalMarkup = () => {
        const val = parseFloat(globalMarkup);
        if (isNaN(val) || val <= 0) return;
        
        const newMarkups = { ...customMarkups };
        selectedIds.forEach(id => {
            newMarkups[id] = val;
        });
        setCustomMarkups(newMarkups);
        setGlobalMarkup('');
    };

    const applyUpdates = async () => {
        const toUpdate = matches.filter(m => m.match && selectedIds.has(m.match.id));
        if (toUpdate.length === 0) return;
        setSaving(true);
        let count = 0;
        
        for (const item of toUpdate) {
            if (!item.match) continue;
            
            const finalMarkup = customMarkups[item.match.id] || item.markupActual;
            const finalPrice = Math.ceil((item.extracted.costoFinal * finalMarkup) / 1000) * 1000;
            
            try {
                const res = await fetch(`/api/products/${item.match.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        cost: item.extracted.costoFinal,
                        price: finalPrice
                    }),
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
            <div className="bg-white dark:bg-stone-900 w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">

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

                <div className="overflow-y-auto flex-1 p-6 space-y-4 bg-stone-50/30 dark:bg-stone-900/50">

                    {step === 'config' && (
                        <>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Laboratorio</label>
                                    <select value={laboratory} onChange={e => {
                                        const newLab = e.target.value;
                                        setLaboratory(newLab);
                                        const config = labConfigs.find(l => l.name.toUpperCase() === newLab.toUpperCase());
                                        if (config) {
                                            setCalibrado(config.calibrado);
                                            setIva(config.iva);
                                        }
                                    }}
                                        className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary uppercase">
                                        {Array.from(new Map([...laboratories, 'OPTOVISION', 'GRUPO OPTICO'].map(l => [l.toUpperCase(), l])).values()).map(l => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Calibrado base ($)</label>
                                    <input type="number" value={calibrado} onChange={e => setCalibrado(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary text-violet-600 dark:text-violet-400" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">IVA (%)</label>
                                    <input type="number" value={iva} onChange={e => setIva(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>

                            <button onClick={() => setShowFormula(!showFormula)}
                                className="flex items-center gap-2 text-[9px] font-black text-amber-600 uppercase tracking-widest hover:text-amber-500 transition-colors">
                                {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                Mostrar reglas de cálculo automáticas
                            </button>
                            {showFormula && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                        <strong>Costo Final</strong> = [ Precio OCR + (Calibrado × Cristales) ] × (1 + IVA/100)
                                    </p>
                                    <ul className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 list-disc pl-4 space-y-1">
                                        <li>Si el producto es <strong>2x1</strong>, se multiplica el calibrado por 2.</li>
                                        <li>El precio sugerido de venta utilizará el <strong>markup actual</strong> de tu producto para mantener tu rentabilidad.</li>
                                    </ul>
                                </div>
                            )}

                            <div
                                ref={dropRef}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group bg-white dark:bg-stone-900
                                    ${imagePreview
                                        ? 'border-primary/40 bg-primary/5'
                                        : 'border-stone-300 dark:border-stone-600 hover:border-primary/40 hover:bg-primary/5'}`}
                            >
                                {imagePreview ? (
                                    <div className="space-y-3">
                                        <Image src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-xl shadow-lg" />
                                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">✓ Imagen cargada — click para cambiar</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 py-8">
                                        <div className="flex justify-center gap-4">
                                            <div className="w-14 h-14 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                <ClipboardPaste className="w-6 h-6 text-stone-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="w-14 h-14 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                <ImageIcon className="w-6 h-6 text-stone-400 group-hover:text-primary transition-colors" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-stone-600 dark:text-stone-300">Pegá la captura del PDF aquí</p>
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

                    {step === 'processing' && (
                        <div className="py-24 flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center shadow-inner">
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center animate-bounce shadow-lg">
                                    <Zap className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-black text-stone-800 dark:text-white tracking-tight">Gemini IA Analizando PDF...</h3>
                                <p className="text-xs font-bold text-stone-400">Extrayendo productos, materiales y precios base</p>
                            </div>
                        </div>
                    )}

                    {step === 'review' && (
                        <>
                            {savedCount > 0 && (
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-in slide-in-from-top duration-300">
                                    <Check className="w-5 h-5 text-emerald-500" />
                                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">✓ {savedCount} productos actualizados correctamente en la base de datos.</span>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-xs font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                                </div>
                            )}

                            {/* Summary Banner */}
                            {summary && (
                                <div className="flex flex-wrap gap-4 p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm">
                                    <div className="flex-1 min-w-[150px]">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Coincidencias</p>
                                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{summary.totalProducts}</p>
                                    </div>
                                    <div className="flex-1 min-w-[150px]">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Aumentan costo</p>
                                        <p className="text-xl font-black text-amber-600 dark:text-amber-500">{summary.withCostIncrease}</p>
                                    </div>
                                    <div className="flex-1 min-w-[150px]">
                                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Suba promedio</p>
                                        <p className="text-xl font-black text-red-500">+{summary.avgCostIncreasePercent}%</p>
                                    </div>
                                    
                                    <div className="w-full h-px bg-stone-100 dark:bg-stone-800 my-1"></div>
                                    
                                    <div className="flex items-center gap-3 w-full">
                                        <label className="text-xs font-bold text-stone-500">Aplicar Markup masivo:</label>
                                        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1">
                                            <span className="pl-3 pr-1 py-1.5 text-stone-400 font-black text-sm">x</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={globalMarkup}
                                                onChange={e => setGlobalMarkup(e.target.value)}
                                                placeholder="2.55"
                                                className="w-20 bg-transparent text-sm font-black text-stone-800 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                            />
                                        </div>
                                        <button 
                                            onClick={applyGlobalMarkup}
                                            className="px-4 py-2 bg-stone-900 dark:bg-stone-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary transition-colors"
                                        >
                                            Aplicar a seleccionados
                                        </button>
                                    </div>
                                </div>
                            )}

                            {matchedItems.length > 0 && (
                                <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-stone-50/50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 text-[9px] font-black text-stone-400 uppercase tracking-widest">
                                                    <th className="p-4 w-8"><Check className="w-3 h-3" /></th>
                                                    <th className="p-4 min-w-[200px]">Producto Identificado</th>
                                                    <th className="p-4">Costo (PDF + Calib + IVA)</th>
                                                    <th className="p-4">Markup (x)</th>
                                                    <th className="p-4">Precio Venta Público</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs">
                                                {matchedItems.map((m, i) => {
                                                    const isSelected = m.match ? selectedIds.has(m.match.id) : false;
                                                    const costDiff = m.costoAnterior ? m.extracted.costoFinal - m.costoAnterior : null;
                                                    const currentMarkup = customMarkups[m.match!.id] || m.markupActual;
                                                    const finalPrice = Math.ceil((m.extracted.costoFinal * currentMarkup) / 1000) * 1000;
                                                    
                                                    return (
                                                        <tr key={i} 
                                                            className={`border-b border-stone-100 dark:border-stone-800/50 transition-colors hover:bg-stone-50/50 dark:hover:bg-stone-800/30 ${isSelected ? '' : 'opacity-50 bg-stone-50 dark:bg-stone-900/50'}`}>
                                                            <td className="p-4" onClick={() => m.match && toggleSelect(m.match.id)}>
                                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-stone-300 dark:border-stone-600'}`}>
                                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <p className="font-black text-stone-800 dark:text-stone-100">{m.match?.brand} · {m.match?.name}</p>
                                                                <p className="text-[10px] text-stone-400 mt-0.5">{m.extracted.linea} — {m.extracted.material}</p>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    {m.costoAnterior != null && (
                                                                        <span className="text-[10px] font-bold text-stone-400 line-through">${m.costoAnterior.toLocaleString()}</span>
                                                                    )}
                                                                    <ArrowRight className="w-3 h-3 text-stone-300" />
                                                                    <span className="font-black text-stone-800 dark:text-white">${m.extracted.costoFinal.toLocaleString()}</span>
                                                                </div>
                                                                {costDiff != null && costDiff !== 0 && (
                                                                    <span className={`text-[9px] font-black ${costDiff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                        {costDiff > 0 ? '↑ Sube $' : '↓ Baja $'}{Math.abs(costDiff).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 rounded-lg p-1.5 border border-transparent focus-within:border-primary/50 transition-colors w-20">
                                                                    <span className="text-stone-400 font-black text-xs pl-1">x</span>
                                                                    <input 
                                                                        type="number" 
                                                                        step="0.01"
                                                                        value={currentMarkup}
                                                                        onChange={e => {
                                                                            const val = parseFloat(e.target.value);
                                                                            if (!isNaN(val) && m.match) {
                                                                                setCustomMarkups(prev => ({...prev, [m.match!.id]: val}));
                                                                            }
                                                                        }}
                                                                        className="w-full bg-transparent font-black text-primary focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    {m.precioAnterior != null && (
                                                                        <span className="text-[10px] font-bold text-stone-400 line-through">${m.precioAnterior.toLocaleString()}</span>
                                                                    )}
                                                                    <ArrowRight className="w-3 h-3 text-stone-300" />
                                                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">${finalPrice.toLocaleString()}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {unmatchedItems.length > 0 && (
                                <div className="space-y-2 pt-4">
                                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                        <AlertCircle className="w-3 h-3" /> Productos descartados / sin coincidencia ({unmatchedItems.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {unmatchedItems.map((m, i) => (
                                            <div key={i} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-stone-100 dark:border-stone-800/50 flex justify-between items-center opacity-60">
                                                <p className="text-[10px] font-bold text-stone-500">
                                                    {m.extracted.linea} — {m.extracted.material}
                                                </p>
                                                <span className="text-[10px] font-black text-stone-400">${m.extracted.costoFinal.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 pt-4 border-t border-stone-100 dark:border-stone-800 shrink-0 bg-white dark:bg-stone-900">
                    {step === 'config' && (
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-4 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={processImage} disabled={!imageBase64}
                                className="flex-1 py-4 bg-stone-900 dark:bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg">
                                <Zap className="w-4 h-4" /> Iniciar Escaneo IA
                            </button>
                        </div>
                    )}
                    {step === 'review' && savedCount === 0 && (
                        <div className="flex gap-3">
                            <button onClick={() => { setStep('config'); setMatches([]); }}
                                className="w-1/3 py-4 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-colors">
                                ← Volver
                            </button>
                            <button onClick={applyUpdates} disabled={saving || selectedIds.size === 0}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30 shadow-lg shadow-emerald-500/20">
                                <Save className="w-4 h-4" />
                                {saving ? 'Guardando...' : `Confirmar Actualización de Costos y Precios (${selectedIds.size})`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
