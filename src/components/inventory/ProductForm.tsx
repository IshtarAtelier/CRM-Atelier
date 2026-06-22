'use client';

import { useState, useEffect } from 'react';
import { X, Save, Package, Layers, DollarSign, Plus, Upload, Database, ChevronDown, CheckCircle2, ArrowRight, ChevronRight, Info } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '@/lib/constants';

import { autoCorrectLab } from '@/utils/product-controllers';

interface ProductFormProps {
    onClose: () => void;
    onSuccess: () => void;
    isAdmin?: boolean;
    uniqueBrands?: string[];
    uniqueLabs?: string[];
}

interface BulkItem {
    id: string;
    brand: string;
    name: string;
    laboratory: string;
    lensIndex: string;
    price: string | number;
    wholesalePrice: string | number;
    cost: string | number;
    stock: string | number;
    model: string;
    sphereMin: string | number;
    sphereMax: string | number;
    cylinderMin: string | number;
    cylinderMax: string | number;
    diameterMin: string | number;
    diameterMax: string | number;
}

const LENS_INDICES = ['1.49', '1.50', '1.53', '1.56', '1.59', '1.60', '1.67', '1.74', 'Foto'];



export default function ProductForm({ onClose, onSuccess, isAdmin = false, uniqueBrands = [], uniqueLabs = [] }: ProductFormProps) {
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    // Steps: 1 = tipo, 2 = detalles (single) | 1 = tipo, 2 = CSV (bulk)
    const [step, setStep] = useState<1 | 2>(1);
    const [saving, setSaving] = useState(false);

    // Step 1 — type selection (shared for single & bulk)
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubtype, setSelectedSubtype] = useState('');

    // Step 2 — single product details
    const [formData, setFormData] = useState({ 
        name: '', brand: '', model: '', stock: 0, price: 0, wholesalePrice: 0, cost: 0, 
        lensIndex: '', laboratory: '', sphereMin: '', sphereMax: '', 
        cylinderMin: '', cylinderMax: '', additionMin: '', additionMax: '',
        diameterMin: '', diameterMax: '',
        is2x1: false, publishToWeb: true, origin: 'LABORATORIO',
        seoTitle: '', seoDescription: '', seoTags: '', customSlug: '',
        mpn: '', gender: '', ageGroup: ''
    });

    // Step 2 — bulk CSV -> Dynamic Grid
    const [bulkItems, setBulkItems] = useState<BulkItem[]>([{
        id: Math.random().toString(36).substring(2, 9),
        brand: '', name: '', laboratory: '', lensIndex: '',
        price: '', wholesalePrice: '', cost: '', stock: '', model: '',
        sphereMin: '', sphereMax: '', cylinderMin: '', cylinderMax: '',
        diameterMin: '', diameterMax: ''
    }]);
    const [showRanges, setShowRanges] = useState(false);
    const [labConfigs, setLabConfigs] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/laboratories')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data.laboratories)) setLabConfigs(data.laboratories);
            })
            .catch(err => console.error('Error fetching labs:', err));
    }, []);

    const getFinalCost = (listCost: number, labName: string) => {
        const config = labConfigs.find(l => l.name.toUpperCase() === (labName || '').toUpperCase());
        if (config) {
            const calibradoAmount = selectedCategory === 'Tratamiento' ? 0 : config.calibrado;
            return Math.round((listCost + calibradoAmount) * (1 + config.iva / 100));
        }
        return listCost;
    };

    const activeCategory = PRODUCT_CATEGORIES.find(c => c.id === selectedCategory);
    const hasSubtypes = !!(activeCategory?.subtypes?.length);
    const isCristal = selectedCategory === 'Cristal';
    const isRequestedToLab = (selectedCategory === 'Cristal' && formData.origin === 'LABORATORIO') || selectedCategory === 'Tratamiento';
    const finalType = hasSubtypes && selectedSubtype
        ? `${selectedCategory} ${selectedSubtype}`
        : selectedCategory;
    const canContinue = selectedCategory && (!hasSubtypes || selectedSubtype);

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isCristal) {
            if (!formData.laboratory.trim()) {
                alert('El laboratorio es obligatorio para cristales');
                return;
            }
            if (!formData.lensIndex.trim()) {
                alert('El índice de refracción es obligatorio para cristales');
                return;
            }
        }
        setSaving(true);
        try {
            const payload = {
                name: formData.name || finalType,
                brand: formData.brand,
                model: formData.model,
                type: finalType,
                category: selectedCategory,
                price: formData.price,
                wholesalePrice: formData.wholesalePrice,
                cost: isCristal ? getFinalCost(formData.cost, formData.laboratory) : formData.cost,
                stock: isRequestedToLab ? 0 : formData.stock,
                lensIndex: isCristal ? formData.lensIndex : null,
                unitType: isCristal ? 'PAR' : 'UNIDAD',
                laboratory: isCristal && formData.laboratory ? formData.laboratory : null,
                sphereMin: isCristal && formData.sphereMin !== '' ? parseFloat(formData.sphereMin as string) : null,
                sphereMax: isCristal && formData.sphereMax !== '' ? parseFloat(formData.sphereMax as string) : null,
                cylinderMin: isCristal && formData.cylinderMin !== '' ? parseFloat(formData.cylinderMin as string) : null,
                cylinderMax: isCristal && formData.cylinderMax !== '' ? parseFloat(formData.cylinderMax as string) : null,
                additionMin: isCristal && formData.additionMin !== '' ? parseFloat(formData.additionMin as string) : null,
                additionMax: isCristal && formData.additionMax !== '' ? parseFloat(formData.additionMax as string) : null,
                diameterMin: isCristal && formData.diameterMin !== '' ? parseFloat(formData.diameterMin as string) : null,
                diameterMax: isCristal && formData.diameterMax !== '' ? parseFloat(formData.diameterMax as string) : null,
                is2x1: formData.is2x1,
                publishToWeb: formData.publishToWeb,
                ...(formData.publishToWeb ? {
                    seoTitle: formData.seoTitle || null,
                    seoDescription: formData.seoDescription || null,
                    seoTags: formData.seoTags || null,
                    customSlug: formData.customSlug || null,
                    mpn: formData.mpn || null,
                    gender: formData.gender || null,
                    ageGroup: formData.ageGroup || null,
                } : {}),
                origin: isCristal ? formData.origin : null,
            };
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) { onSuccess(); onClose(); }
            else {
                const data = await res.json();
                alert(`Error: ${data.details || data.error}`);
            }
        } catch { alert('Error al conectar con el servidor'); }
        finally { setSaving(false); }
    };
    
    const [generatingSEO, setGeneratingSEO] = useState(false);

    const handleGenerateSEO = async () => {
        if (!formData.name && !finalType) {
            alert('Por favor ingresá un nombre o seleccioná un tipo de producto primero.');
            return;
        }
        setGeneratingSEO(true);
        try {
            const res = await fetch('/api/seo/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    brand: formData.brand,
                    model: formData.model,
                    category: selectedCategory,
                    type: finalType
                })
            });
            if (res.ok) {
                const data = await res.json();
                setFormData(prev => ({
                    ...prev,
                    seoTitle: data.seoTitle || prev.seoTitle,
                    seoDescription: data.seoDescription || prev.seoDescription,
                    seoTags: data.seoTags || prev.seoTags,
                    customSlug: data.customSlug || prev.customSlug,
                }));
            } else {
                alert('Error al generar SEO.');
            }
        } catch (e) {
            alert('Error de conexión al generar SEO.');
        } finally {
            setGeneratingSEO(false);
        }
    };

    const handleBulkSubmit = async () => {
        // Filter out completely empty rows
        const validItems = bulkItems.filter(item => {
            if (isCristal) return item.brand || item.name || item.laboratory || item.lensIndex || item.price;
            return item.name || item.brand || item.model || item.price || item.stock;
        });

        if (validItems.length === 0) {
            alert('No hay productos para cargar en la tabla');
            return;
        }

        // Validate mandatory fields
        for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            if (isCristal) {
                if (!item.brand || !item.name || !item.laboratory || !item.lensIndex || item.price === '') {
                    alert(`Faltan campos obligatorios en la fila ${i + 1} (Marca, Nombre, Laboratorio, Índice, Precio)`);
                    return;
                }
            } else {
                if (!item.name || item.price === '' || (!isRequestedToLab && item.stock === '')) {
                    alert(`Faltan campos obligatorios en la fila ${i + 1} (Nombre, Stock, Precio)`);
                    return;
                }
            }
        }

        const items = validItems.map(item => {
            if (isCristal) {
                return {
                    brand: item.brand,
                    name: item.name || finalType,
                    model: '',
                    type: finalType,
                    category: selectedCategory,
                    lensIndex: item.lensIndex,
                    price: Number(item.price) || 0,
                    wholesalePrice: Number(item.wholesalePrice) || 0,
                    cost: isAdmin ? (isCristal ? getFinalCost(Number(item.cost) || 0, item.laboratory) : Number(item.cost) || 0) : 0,
                    stock: 0,
                    unitType: 'PAR',
                    laboratory: item.laboratory,
                    sphereMin: item.sphereMin !== '' ? Number(item.sphereMin) : null,
                    sphereMax: item.sphereMax !== '' ? Number(item.sphereMax) : null,
                    cylinderMin: item.cylinderMin !== '' ? Number(item.cylinderMin) : null,
                    cylinderMax: item.cylinderMax !== '' ? Number(item.cylinderMax) : null,
                    additionMin: null,
                    additionMax: null,
                    diameterMin: item.diameterMin !== '' ? Number(item.diameterMin) : null,
                    diameterMax: item.diameterMax !== '' ? Number(item.diameterMax) : null,
                    origin: 'LABORATORIO',
                };
            }
            return {
                name: item.name || finalType,
                brand: item.brand,
                model: item.model,
                type: finalType,
                category: selectedCategory,
                price: Number(item.price) || 0,
                wholesalePrice: Number(item.wholesalePrice) || 0,
                cost: isAdmin ? Number(item.cost) || 0 : 0,
                stock: isRequestedToLab ? 0 : (Number(item.stock) || 0),
                unitType: 'UNIDAD',
            };
        });

        setSaving(true);
        try {
            const res = await fetch('/api/products/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
            if (res.ok) { onSuccess(); onClose(); }
            else alert('Error al procesar carga masiva');
        } catch { alert('Error de conexión'); }
        finally { setSaving(false); }
    };

    // ── STEP 1: Type selection (same for both modes) ─────────────────────────
    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1 italic">
                    {mode === 'bulk' ? 'Seleccioná el tipo de artículo a cargar' : 'Seleccioná la categoría'}
                </label>
                <div className="grid grid-cols-1 gap-2">
                    {PRODUCT_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => { setSelectedCategory(cat.id); setSelectedSubtype(''); }}
                            className={`w-full text-left px-6 py-4 rounded-2xl border-2 font-black text-sm flex items-center justify-between gap-4 transition-all ${selectedCategory === cat.id
                                ? 'bg-primary/5 border-primary text-primary shadow-lg'
                                : 'bg-stone-50 dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-600 hover:border-stone-300'
                                }`}
                        >
                            <span className="flex items-center gap-3">
                                <span className="text-xl">{cat.icon}</span>
                                <span className="uppercase tracking-tight">{cat.label}</span>
                                {cat.noStock && (
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                        Pedido a Lab
                                    </span>
                                )}
                            </span>
                            {cat.subtypes ? (
                                <ChevronRight className={`w-4 h-4 transition-transform ${selectedCategory === cat.id ? 'rotate-90 text-primary' : 'text-stone-300'}`} />
                            ) : selectedCategory === cat.id ? (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>

            {/* Subtipos de Cristal */}
            {selectedCategory && hasSubtypes && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1 italic">
                        ¿Qué tipo de {selectedCategory}?
                    </label>
                    <div className="grid grid-cols-2 gap-2 pl-2 border-l-4 border-primary/30">
                        {activeCategory!.subtypes!.map(sub => (
                            <button
                                key={sub}
                                type="button"
                                onClick={() => setSelectedSubtype(sub)}
                                className={`px-5 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-tight transition-all flex items-center gap-2 ${selectedSubtype === sub
                                    ? 'bg-primary border-primary text-white shadow-lg scale-[1.02]'
                                    : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-500 hover:border-stone-300'
                                    }`}
                            >
                                {selectedSubtype === sub && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {sub}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep(2)}
                className="w-full py-6 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30"
            >
                CONTINUAR <ArrowRight className="w-5 h-5" />
            </button>
        </div>
    );

    // ── STEP 2 SINGLE: Product details ────────────────────────────────────────
    const renderStep2Single = () => (
        <form onSubmit={handleSingleSubmit}>
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Badge tipo */}
                <div className="flex items-center gap-3 p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-xs font-black text-primary uppercase tracking-widest">{finalType}</span>
                    {isCristal && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full ml-auto">PAR</span>
                    )}
                </div>

                {/* Aviso cristales sin stock */}
                {isCristal && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl">
                        <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                            Los cristales se cargan como <strong>PAR</strong> (2 unidades, uno por ojo). El precio es por el par completo.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    {isCristal ? (
                        <>


                            {/* Marca */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Marca *</label>
                                <SmartInput
                                    value={formData.brand}
                                    onChange={(v: string) => setFormData({ ...formData, brand: v })}
                                    options={uniqueBrands}
                                    placeholder="Ej: Zeiss"
                                    required
                                />
                            </div>

                            {/* Nombre */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Nombre *</label>
                                <input required type="text" placeholder={`Ej: ${finalType} Premium AR`}
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Laboratorio — obligatorio */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">🏭 Laboratorio <span className="text-red-500">*</span></label>
                                <SmartInput
                                    value={formData.laboratory}
                                    onChange={(v: string) => setFormData({ ...formData, laboratory: v.toUpperCase() })}
                                    onBlur={() => setFormData({ ...formData, laboratory: autoCorrectLab(formData.laboratory) || '' })}
                                    options={uniqueLabs}
                                    placeholder="Ej: OPTOVISION, GRUPO OPTICO"
                                    required
                                    hasError={!formData.laboratory}
                                />
                                {!formData.laboratory && <p className="text-[9px] font-bold text-red-400 ml-4">El laboratorio es obligatorio para cristales</p>}
                            </div>

                            {/* Origen (Solo Monofocales de GRUPO OPTICO) */}
                            {finalType === 'Cristal Monofocal' && formData.laboratory === 'GRUPO OPTICO' && (
                                <div className="space-y-3 col-span-2 pb-2 mt-4">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Origen del Cristal (Solo SmartLab)</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" onClick={() => setFormData({ ...formData, origin: 'LABORATORIO' })} className={`py-4 px-4 rounded-2xl border-2 font-black text-xs uppercase tracking-tight flex items-center justify-center gap-2 transition-all ${formData.origin === 'LABORATORIO' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-300'}`}>
                                            <Database className="w-4 h-4" /> Laboratorio (Bajo Pedido)
                                        </button>
                                        <button type="button" onClick={() => setFormData({ ...formData, origin: 'STOCK' })} className={`py-4 px-4 rounded-2xl border-2 font-black text-xs uppercase tracking-tight flex items-center justify-center gap-2 transition-all ${formData.origin === 'STOCK' ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-300'}`}>
                                            <Layers className="w-4 h-4" /> Stock / Rango Extendido
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Índice de refracción */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">🔬 Índice de Refracción <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: 1.56, 1.67, Foto..."
                                    value={formData.lensIndex}
                                    onChange={e => setFormData({ ...formData, lensIndex: e.target.value })}
                                    className={`w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all ${!formData.lensIndex ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {LENS_INDICES.map(idx => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, lensIndex: idx })}
                                            className={`px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-tight transition-all ${formData.lensIndex === idx
                                                ? 'bg-primary border-primary text-white shadow-md'
                                                : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:border-primary/40 hover:text-primary'
                                                }`}
                                        >
                                            {idx}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Precio Venta */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-4">Precio Venta (Minorista) ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-14 pr-6 py-5 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 rounded-[2rem] font-black text-xl focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all text-primary placeholder:text-primary/30"
                                        value={formData.price || ''}
                                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Precio Mayorista */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-4">Precio Mayorista ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
                                    <input required type="number" min={0} placeholder="0.00"
                                        className="w-full pl-14 pr-6 py-5 bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-850 rounded-[2rem] font-black text-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-600 transition-all text-blue-600 dark:text-blue-400 placeholder:text-blue-300"
                                        value={formData.wholesalePrice || ''}
                                        onChange={e => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Costo — solo admin */}
                            {isAdmin && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">
                                    {isCristal ? 'Costo de Lista ($) *' : 'Costo ($) *'}
                                </label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input required type="number" min={0} placeholder="0.00"
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.cost || ''}
                                        onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                {isCristal && formData.cost > 0 && formData.laboratory && labConfigs.some(l => l.name.toUpperCase() === formData.laboratory.toUpperCase()) && (
                                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-4 animate-in fade-in">
                                        Costo Final: ${getFinalCost(formData.cost, formData.laboratory).toLocaleString()} (incluye calibrado e IVA)
                                    </p>
                                )}
                            </div>
                            )}



                            {/* ── Rangos de Fabricación ── */}
                            <div className="col-span-2 space-y-4 pt-2">
                                <div className="flex items-center gap-3 pb-2 border-b border-stone-100 dark:border-stone-800">
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">📐 Rangos de Fabricación</span>
                                    <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">Opcional</span>
                                </div>

                                {/* Esfera */}
                                <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Esfera</span>
                                    <input type="number" step="0.25" placeholder="Mín (ej: -12)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.sphereMin}
                                        onChange={e => setFormData({ ...formData, sphereMin: e.target.value })}
                                    />
                                    <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                    <input type="number" step="0.25" placeholder="Máx (ej: +8)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.sphereMax}
                                        onChange={e => setFormData({ ...formData, sphereMax: e.target.value })}
                                    />
                                </div>

                                {/* Cilindro */}
                                <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Cilindro</span>
                                    <input type="number" step="0.25" placeholder="Mín (ej: -6)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.cylinderMin}
                                        onChange={e => setFormData({ ...formData, cylinderMin: e.target.value })}
                                    />
                                    <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                    <input type="number" step="0.25" placeholder="Máx (ej: 0)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.cylinderMax}
                                        onChange={e => setFormData({ ...formData, cylinderMax: e.target.value })}
                                    />
                                </div>

                                {/* Adición — solo multifocales */}
                                {selectedSubtype === 'Multifocal' && (
                                    <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Adición</span>
                                        <input type="number" step="0.25" placeholder="Mín (ej: 0.75)"
                                            className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                            value={formData.additionMin}
                                            onChange={e => setFormData({ ...formData, additionMin: e.target.value })}
                                        />
                                        <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                        <input type="number" step="0.25" placeholder="Máx (ej: 3.50)"
                                            className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                            value={formData.additionMax}
                                            onChange={e => setFormData({ ...formData, additionMax: e.target.value })}
                                        />
                                    </div>
                                )}

                                {/* Diámetro */}
                                {(selectedSubtype === 'Multifocal' || formData.laboratory?.toUpperCase() === 'GRUPO OPTICO') && (
                                    <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Diámetro</span>
                                        <input type="number" placeholder="Mín (ej: 65)"
                                            className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                            value={formData.diameterMin}
                                            onChange={e => setFormData({ ...formData, diameterMin: e.target.value })}
                                        />
                                        <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                        <input type="number" placeholder="Máx (ej: 75)"
                                            className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                            value={formData.diameterMax}
                                            onChange={e => setFormData({ ...formData, diameterMax: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Promo 2x1 */}
                            <div className="col-span-2 pt-4 border-t border-stone-100 dark:border-stone-800">
                                <label className="flex items-center gap-3 cursor-pointer group w-max">
                                    <div className={`relative w-10 h-6 rounded-full transition-colors ${formData.is2x1 ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is2x1 ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                    <input type="checkbox" className="hidden" checked={formData.is2x1} onChange={e => setFormData({ ...formData, is2x1: e.target.checked })} />
                                    <div>
                                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Activar Promo 2x1</p>
                                        <p className="text-[9px] font-bold text-stone-400">Habilita descuentos automáticos en armazones para este cristal.</p>
                                    </div>
                                </label>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* OTROS PRODUCTOS: Nombre → Marca → Modelo → Stock → Costo → Precio */}

                            {/* Nombre */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Nombre del Producto *</label>
                                <div className="relative group">
                                    <Plus className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input autoFocus required type="text"
                                        placeholder={`Ej: ${finalType} Premium`}
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Marca */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Marca</label>
                                <SmartInput
                                    value={formData.brand}
                                    onChange={(v: string) => setFormData({ ...formData, brand: v })}
                                    options={uniqueBrands}
                                    placeholder="Ej: Ray-Ban"
                                />
                            </div>

                            {/* Modelo */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Modelo / Color</label>
                                <input type="text" placeholder="Ej: DuraVision"
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                    value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })}
                                />
                            </div>

                            {/* Stock */}
                            {!isRequestedToLab && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Stock Inicial</label>
                                <div className="relative group">
                                    <Layers className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input type="number" min={0}
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.stock}
                                        onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            )}

                            {/* Costo — solo admin */}
                            {isAdmin && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Costo ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.cost || ''}
                                        onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            )}

                            {/* Promoción 2x1 (Otros) */}
                            <div className="col-span-2">
                                <label className="flex items-center gap-4 p-5 bg-emerald-50/50 dark:bg-emerald-900/10 border-2 border-emerald-100 dark:border-emerald-800/30 rounded-[2rem] cursor-pointer hover:border-emerald-300 transition-all select-none">
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.is2x1 ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-emerald-200'}`}>
                                        {formData.is2x1 && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={formData.is2x1} onChange={e => setFormData({ ...formData, is2x1: e.target.checked })} />
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">🎁 Promoción 2x1</p>
                                        <p className="text-[10px] font-bold text-emerald-600/70">Este producto habilita el segundo armazón sin cargo</p>
                                    </div>
                                </label>
                            </div>

                            {/* Publicar en la Web (Otros) */}
                            <div className="col-span-2 pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group w-max">
                                    <div className={`relative w-10 h-6 rounded-full transition-colors ${formData.publishToWeb ? 'bg-primary' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.publishToWeb ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                    <input type="checkbox" className="hidden" checked={formData.publishToWeb} onChange={e => setFormData({ ...formData, publishToWeb: e.target.checked })} />
                                    <div>
                                        <p className={`text-xs font-black uppercase tracking-widest ${formData.publishToWeb ? 'text-primary' : 'text-stone-500'}`}>
                                            🌐 Publicar en Tienda Online
                                        </p>
                                        <p className="text-[9px] font-bold text-stone-400">El producto aparecerá visible en la web pública.</p>
                                    </div>
                                </label>
                            </div>

                            {/* Precio Venta */}
                            <div className="space-y-2 col-span-1">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-4">Precio Minorista ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-14 pr-6 py-5 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 rounded-[2rem] font-black text-xl focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all text-primary placeholder:text-primary/30"
                                        value={formData.price || ''}
                                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Precio Mayorista */}
                            <div className="space-y-2 col-span-1">
                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-4">Precio Mayorista ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
                                    <input required type="number" min={0} placeholder="0.00"
                                        className="w-full pl-14 pr-6 py-5 bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-850 rounded-[2rem] font-black text-xl focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-600 transition-all text-blue-600 dark:text-blue-400 placeholder:text-blue-300"
                                        value={formData.wholesalePrice || ''}
                                        onChange={e => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- SEO & Google Shopping Form --- */}
                {formData.publishToWeb && (
                    <div className="mt-6 mb-6 p-6 bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 rounded-3xl space-y-5 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-[12px] font-black text-stone-800 dark:text-stone-200 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    Instagram y Google Shopping
                                </h3>
                                <p className="text-[10px] text-stone-500 mt-1">Metadatos para destacar tu producto en vidrieras virtuales.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerateSEO}
                                disabled={generatingSEO}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                            >
                                {generatingSEO ? 'Generando...' : '✨ Generar con IA'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Título SEO (Max 70 char)</label>
                                <input type="text" placeholder="Ej: Anteojos de Sol Ray-Ban Aviator"
                                    maxLength={70}
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                    value={formData.seoTitle || ''} onChange={e => setFormData({ ...formData, seoTitle: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">URL del producto (Slug)</label>
                                <input type="text" placeholder="Ej: ray-ban-aviator-negro"
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all font-mono"
                                    value={formData.customSlug || ''} onChange={e => setFormData({ ...formData, customSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Descripción SEO (Max 160 char)</label>
                                <textarea placeholder="Persuasiva, resalta beneficios e inmediatez..."
                                    maxLength={160} rows={2}
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all resize-none"
                                    value={formData.seoDescription || ''} onChange={e => setFormData({ ...formData, seoDescription: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Tags (Palabras Clave)</label>
                                <input type="text" placeholder="Ej: polarizadas, filtro UV, anteojos de sol, vintage"
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                    value={formData.seoTags || ''} onChange={e => setFormData({ ...formData, seoTags: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">MPN (Código Fab.)</label>
                                <input type="text" placeholder="Ej: RB3025"
                                    className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                    value={formData.mpn || ''} onChange={e => setFormData({ ...formData, mpn: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Rango Edad</label>
                                    <select className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.ageGroup || ''} onChange={e => setFormData({ ...formData, ageGroup: e.target.value })}>
                                        <option value="">Seleccionar</option>
                                        <option value="Adulto">Adulto</option>
                                        <option value="Niños">Niños</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Género</label>
                                    <select className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all"
                                        value={formData.gender || ''} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                        <option value="">Seleccionar</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Unisex">Unisex</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <button type="submit" disabled={saving}
                    className="w-full py-6 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                    <Save className="w-5 h-5" /> {saving ? 'Guardando...' : isCristal ? 'GUARDAR CRISTAL (PAR)' : 'GUARDAR PRODUCTO'}
                </button>
            </div>
        </form>
    );

    // ── STEP 2 BULK: Dynamic Grid ───────────────────────────────────────────────
    const renderStep2Bulk = () => {
        const updateBulkItem = (id: string, field: keyof BulkItem, value: string | number) => {
            setBulkItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
        };
        const addBulkRow = () => {
            setBulkItems(prev => [...prev, {
                id: Math.random().toString(36).substring(2, 9),
                brand: '', name: '', laboratory: '', lensIndex: '',
                price: '', wholesalePrice: '', cost: '', stock: '', model: '',
                sphereMin: '', sphereMax: '', cylinderMin: '', cylinderMax: '',
                diameterMin: '', diameterMax: ''
            }]);
        };
        const removeBulkRow = (id: string) => {
            if (bulkItems.length > 1) {
                setBulkItems(prev => prev.filter(item => item.id !== id));
            }
        };

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-xs font-black text-primary uppercase tracking-widest">{finalType}</span>
                        {isCristal && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">PAR</span>
                        )}
                    </div>
                    {isCristal && (
                        <label className="flex items-center gap-2 cursor-pointer select-none bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-primary/50 transition-colors">
                            <input type="checkbox" checked={showRanges} onChange={e => setShowRanges(e.target.checked)} className="rounded border-stone-300 text-primary focus:ring-primary w-4 h-4" />
                            <span className="text-[10px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-widest">Añadir Rangos</span>
                        </label>
                    )}
                </div>

                <div className="overflow-x-auto rounded-[1.5rem] border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 shadow-inner">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/80">
                                {isCristal ? (
                                    <>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Marca *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Nombre *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Laboratorio *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Índice *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-primary">Venta $ *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500">Mayorista $</th>
                                        {isAdmin && <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">{isCristal ? 'Lista $' : 'Costo $'}</th>}
                                        {showRanges && (
                                            <>
                                                <th className="p-3 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 border-l border-stone-200 dark:border-stone-700 bg-amber-50/50 dark:bg-amber-900/10">Esf Mín</th>
                                                <th className="p-3 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-amber-900/10">Esf Máx</th>
                                                <th className="p-3 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-amber-900/10">Cil Mín</th>
                                                <th className="p-3 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-amber-900/10">Cil Máx</th>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Nombre *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Marca</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Modelo</th>
                                        {!isRequestedToLab && <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">Stock *</th>}
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-primary">Venta $ *</th>
                                        <th className="p-3 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500">Mayorista $</th>
                                        {isAdmin && <th className="p-3 text-[9px] font-black uppercase tracking-widest text-stone-500">{isCristal ? 'Lista $' : 'Costo $'}</th>}
                                    </>
                                )}
                                <th className="p-3 text-center w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                            {bulkItems.map((item) => (
                                <tr key={item.id} className="hover:bg-white dark:hover:bg-stone-800/50 transition-colors group">
                                    {isCristal ? (
                                        <>
                                            <td className="p-2"><input type="text" list="brands-list" className="w-full min-w-[100px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.brand} onChange={e => updateBulkItem(item.id, 'brand', e.target.value)} placeholder="Ej: Zeiss" /></td>
                                            <td className="p-2"><input type="text" className="w-full min-w-[120px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.name} onChange={e => updateBulkItem(item.id, 'name', e.target.value)} placeholder="Ej: Antireflejo" /></td>
                                            <td className="p-2"><input type="text" list="labs-list" className="w-full min-w-[120px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase transition-all" value={item.laboratory} onChange={e => updateBulkItem(item.id, 'laboratory', e.target.value.toUpperCase())} onBlur={() => updateBulkItem(item.id, 'laboratory', autoCorrectLab(item.laboratory) || '')} placeholder="Laboratorio" /></td>
                                            <td className="p-2"><input type="text" className="w-full min-w-[70px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.lensIndex} onChange={e => updateBulkItem(item.id, 'lensIndex', e.target.value)} placeholder="Ej: 1.56" /></td>
                                            <td className="p-2"><input type="number" min="0" className="w-full min-w-[90px] px-3 py-2.5 bg-primary/5 border border-transparent focus:border-primary focus:bg-primary/10 rounded-lg text-[11px] font-black text-primary focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.price} onChange={e => updateBulkItem(item.id, 'price', e.target.value)} placeholder="0.00" /></td>
                                            <td className="p-2"><input type="number" min="0" className="w-full min-w-[90px] px-3 py-2.5 bg-blue-50/50 border border-transparent focus:border-blue-500 focus:bg-blue-100/50 rounded-lg text-[11px] font-black text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={item.wholesalePrice} onChange={e => updateBulkItem(item.id, 'wholesalePrice', e.target.value)} placeholder="0.00" /></td>
                                            {isAdmin && <td className="p-2"><input type="number" min="0" className="w-full min-w-[80px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.cost} onChange={e => updateBulkItem(item.id, 'cost', e.target.value)} placeholder="0.00" /></td>}
                                            {showRanges && (
                                                <>
                                                    <td className="p-2 border-l border-stone-100 dark:border-stone-800 bg-amber-50/30 dark:bg-amber-900/5"><input type="number" step="0.25" className="w-full min-w-[60px] px-2 py-2.5 bg-transparent border border-transparent focus:border-amber-300 dark:focus:border-amber-700 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.sphereMin} onChange={e => updateBulkItem(item.id, 'sphereMin', e.target.value)} placeholder="-12" /></td>
                                                    <td className="p-2 bg-amber-50/30 dark:bg-amber-900/5"><input type="number" step="0.25" className="w-full min-w-[60px] px-2 py-2.5 bg-transparent border border-transparent focus:border-amber-300 dark:focus:border-amber-700 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.sphereMax} onChange={e => updateBulkItem(item.id, 'sphereMax', e.target.value)} placeholder="+8" /></td>
                                                    <td className="p-2 bg-amber-50/30 dark:bg-amber-900/5"><input type="number" step="0.25" className="w-full min-w-[60px] px-2 py-2.5 bg-transparent border border-transparent focus:border-amber-300 dark:focus:border-amber-700 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.cylinderMin} onChange={e => updateBulkItem(item.id, 'cylinderMin', e.target.value)} placeholder="-6" /></td>
                                                    <td className="p-2 bg-amber-50/30 dark:bg-amber-900/5"><input type="number" step="0.25" className="w-full min-w-[60px] px-2 py-2.5 bg-transparent border border-transparent focus:border-amber-300 dark:focus:border-amber-700 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.cylinderMax} onChange={e => updateBulkItem(item.id, 'cylinderMax', e.target.value)} placeholder="0" /></td>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-2"><input type="text" className="w-full min-w-[150px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.name} onChange={e => updateBulkItem(item.id, 'name', e.target.value)} placeholder="Ej: Armazón Titanio" /></td>
                                            <td className="p-2"><input type="text" list="brands-list" className="w-full min-w-[100px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.brand} onChange={e => updateBulkItem(item.id, 'brand', e.target.value)} placeholder="Marca" /></td>
                                            <td className="p-2"><input type="text" className="w-full min-w-[100px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.model} onChange={e => updateBulkItem(item.id, 'model', e.target.value)} placeholder="Modelo/Color" /></td>
                                            {!isRequestedToLab && <td className="p-2"><input type="number" min="0" className="w-full min-w-[70px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.stock} onChange={e => updateBulkItem(item.id, 'stock', e.target.value)} placeholder="0" /></td>}
                                            <td className="p-2"><input type="number" min="0" className="w-full min-w-[90px] px-3 py-2.5 bg-primary/5 border border-transparent focus:border-primary focus:bg-primary/10 rounded-lg text-[11px] font-black text-primary focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.price} onChange={e => updateBulkItem(item.id, 'price', e.target.value)} placeholder="0.00" /></td>
                                            <td className="p-2"><input type="number" min="0" className="w-full min-w-[90px] px-3 py-2.5 bg-blue-50/50 border border-transparent focus:border-blue-500 focus:bg-blue-100/50 rounded-lg text-[11px] font-black text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" value={item.wholesalePrice} onChange={e => updateBulkItem(item.id, 'wholesalePrice', e.target.value)} placeholder="0.00" /></td>
                                            {isAdmin && <td className="p-2"><input type="number" min="0" className="w-full min-w-[80px] px-3 py-2.5 bg-transparent border border-transparent focus:border-stone-300 dark:focus:border-stone-600 focus:bg-white dark:focus:bg-stone-800 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all" value={item.cost} onChange={e => updateBulkItem(item.id, 'cost', e.target.value)} placeholder="0.00" /></td>}
                                        </>
                                    )}
                                    <td className="p-2 text-center">
                                        <button type="button" onClick={() => removeBulkRow(item.id)} disabled={bulkItems.length === 1} className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-center">
                    <button type="button" onClick={addBulkRow} className="px-6 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-stone-200 dark:hover:bg-stone-700 hover:scale-105 active:scale-95 transition-all shadow-sm">
                        <Plus className="w-4 h-4" /> Agregar Nueva Fila
                    </button>
                </div>

                <button onClick={handleBulkSubmit} disabled={saving || bulkItems.length === 0}
                    className="w-full py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" /> {saving ? 'Cargando...' : `PROCESAR ${bulkItems.length} FILA${bulkItems.length !== 1 ? 'S' : ''}`}
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Datalists for bulk mode autocomplete */}
            <datalist id="brands-list">
                {uniqueBrands.map(b => <option key={b} value={b} />)}
            </datalist>
            <datalist id="labs-list">
                {uniqueLabs.map(l => <option key={l} value={l} />)}
            </datalist>

            <div className={`bg-white dark:bg-stone-900 w-full ${mode === 'bulk' && step === 2 ? 'max-w-[95vw] lg:max-w-[1400px]' : 'max-w-2xl'} rounded-[3rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col transition-all`}>

                {/* Header */}
                <header className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/20 shrink-0">
                    <div className="flex items-center gap-4">
                        {step === 2 && (
                            <button onClick={() => { setStep(1); setSelectedSubtype(''); }}
                                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
                            >
                                <ChevronDown className="w-5 h-5 rotate-90 text-stone-400" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-2xl font-black text-stone-800 dark:text-white uppercase tracking-tighter italic">
                                Gestión de <span className="text-primary not-italic">Stock</span>
                            </h2>
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic mt-1">
                                Paso {step} de 2: {step === 1 ? 'Tipo de Producto' : mode === 'single' ? 'Detalles del Artículo' : 'Datos de Carga Masiva'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-white dark:bg-stone-800 hover:rotate-90 transition-all rounded-2xl border border-stone-100 dark:border-stone-700">
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </header>

                {/* Body */}
                <div className="p-8 overflow-y-auto">
                    {/* Mode switch — only on step 1 */}
                    {step === 1 && (
                        <div className="flex p-1.5 bg-stone-100 dark:bg-stone-800/50 rounded-[2rem] gap-2 mb-8 border border-stone-200/50 shadow-inner">
                            <button onClick={() => setMode('single')}
                                className={`flex-1 py-3 px-6 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${mode === 'single' ? 'bg-white dark:bg-stone-700 text-primary shadow-lg' : 'text-stone-400'}`}
                            >
                                <Package className="w-4 h-4" /> Artículo Unitario
                            </button>
                            <button onClick={() => setMode('bulk')}
                                className={`flex-1 py-3 px-6 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${mode === 'bulk' ? 'bg-white dark:bg-stone-700 text-primary shadow-lg' : 'text-stone-400'}`}
                            >
                                <Database className="w-4 h-4" /> Carga Masiva
                            </button>
                        </div>
                    )}

                    {step === 1 && renderStep1()}
                    {step === 2 && mode === 'single' && renderStep2Single()}
                    {step === 2 && mode === 'bulk' && renderStep2Bulk()}
                </div>
            </div>
        </div>
    );
}

// Helper component for Smart Input with Autocomplete
function SmartInput({ value, onChange, onBlur, options, placeholder, required, hasError }: any) {
    const [isOpen, setIsOpen] = useState(false);
    
    const filtered = options.filter((o: string) => o.toLowerCase().includes((value || '').toLowerCase()));
    const isExactMatch = options.some((o: string) => o.toLowerCase() === (value || '').toLowerCase());
    const showCreate = value && !isExactMatch;

    return (
        <div className="relative group">
            <input 
                required={required}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => { onChange(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => { setTimeout(() => setIsOpen(false), 200); if (onBlur) onBlur(); }}
                className={`w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border rounded-[1.5rem] font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-primary transition-all ${hasError ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
            />
            {isOpen && (filtered.length > 0 || showCreate) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto p-2">
                    {filtered.map((opt: string) => (
                        <button key={opt} type="button" onMouseDown={() => { onChange(opt); setIsOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-xl text-sm font-bold transition-colors">
                            {opt}
                        </button>
                    ))}
                    {showCreate && (
                        <button type="button" onMouseDown={() => setIsOpen(false)} className="w-full text-left px-4 py-3 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-sm font-black transition-colors flex items-center gap-2 mt-1">
                            <Plus className="w-4 h-4" /> Crear nuevo: <span className="uppercase">{value}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
