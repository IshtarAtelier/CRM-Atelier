'use client';

import { useState } from 'react';
import { X, Save, Package, Layers, DollarSign, Plus, Upload, Database, ChevronDown, CheckCircle2, AlertCircle, ArrowRight, ChevronRight, Info } from 'lucide-react';

interface ProductFormProps {
    onClose: () => void;
    onSuccess: () => void;
    isAdmin?: boolean;
}

const LENS_INDICES = ['1.49', '1.50', '1.53', '1.56', '1.59', '1.60', '1.67', '1.74', 'Foto'];

const PRODUCT_CATEGORIES: { id: string; label: string; icon: string; noStock?: boolean; subtypes?: string[] }[] = [
    {
        id: 'Cristal',
        label: 'Cristal',
        icon: '🔬',
        noStock: true, // Se pide al laboratorio, no hay stock propio
        subtypes: ['Monofocal', 'Multifocal', 'Bifocal', 'Ocupacional', 'Coquil']
    },
    { id: 'Lentes de Sol', label: 'Lentes de Sol', icon: '🕶️' },
    { id: 'Armazón de Receta', label: 'Armazón de Receta', icon: '👓' },
    { id: 'Lentes de Contacto', label: 'Lentes de Contacto', icon: '👁️' },
    { id: 'Lentes Especiales', label: 'Lentes Especiales', icon: '✨' },
];

export default function ProductForm({ onClose, onSuccess, isAdmin = false }: ProductFormProps) {
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    // Steps: 1 = tipo, 2 = detalles (single) | 1 = tipo, 2 = CSV (bulk)
    const [step, setStep] = useState<1 | 2>(1);
    const [saving, setSaving] = useState(false);

    // Step 1 — type selection (shared for single & bulk)
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubtype, setSelectedSubtype] = useState('');

    // Step 2 — single product details
    const [formData, setFormData] = useState({ 
        name: '', brand: '', model: '', stock: 0, price: 0, cost: 0, 
        lensIndex: '', laboratory: '', sphereMin: '', sphereMax: '', 
        cylinderMin: '', cylinderMax: '', additionMin: '', additionMax: '',
        is2x1: false 
    });

    // Step 2 — bulk CSV
    const [bulkText, setBulkText] = useState('');

    const activeCategory = PRODUCT_CATEGORIES.find(c => c.id === selectedCategory);
    const hasSubtypes = !!(activeCategory?.subtypes?.length);
    const isCristal = selectedCategory === 'Cristal';
    const finalType = hasSubtypes && selectedSubtype
        ? `${selectedCategory} ${selectedSubtype}`
        : selectedCategory;
    const canContinue = selectedCategory && (!hasSubtypes || selectedSubtype);

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Laboratorio obligatorio para cristales
        if (isCristal && !formData.laboratory.trim()) {
            alert('El laboratorio es obligatorio para cristales');
            return;
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
                cost: formData.cost,
                stock: isCristal ? 0 : formData.stock,
                lensIndex: isCristal ? formData.lensIndex : null,
                unitType: isCristal ? 'PAR' : 'UNIDAD',
                laboratory: isCristal && formData.laboratory ? formData.laboratory : null,
                sphereMin: isCristal && formData.sphereMin !== '' ? parseFloat(formData.sphereMin) : null,
                sphereMax: isCristal && formData.sphereMax !== '' ? parseFloat(formData.sphereMax) : null,
                cylinderMin: isCristal && formData.cylinderMin !== '' ? parseFloat(formData.cylinderMin) : null,
                cylinderMax: isCristal && formData.cylinderMax !== '' ? parseFloat(formData.cylinderMax) : null,
                additionMin: isCristal && formData.additionMin !== '' ? parseFloat(formData.additionMin) : null,
                additionMax: isCristal && formData.additionMax !== '' ? parseFloat(formData.additionMax) : null,
                is2x1: formData.is2x1
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

    const handleBulkSubmit = async () => {
        const lines = bulkText.split('\n').filter(l => l.trim() !== '');
        const items = lines.map(line => {
            const parts = line.split(',').map(p => p.trim());
            if (isCristal) {
                // Formato cristales: MARCA, NOMBRE, ÍNDICE, PRECIO, COSTO, LABORATORIO, ESF_MIN, ESF_MAX, CIL_MIN, CIL_MAX, ADIC_MIN, ADIC_MAX
                return {
                    brand: parts[0] || '',
                    name: parts[1] || finalType,
                    model: '',
                    type: finalType,
                    category: selectedCategory,
                    lensIndex: parts[2] || '',
                    price: parseFloat(parts[3]) || 0,
                    cost: parseFloat(parts[4]) || 0,
                    stock: 0,
                    unitType: 'PAR',
                    laboratory: parts[5] || '',
                    sphereMin: parts[6] ? parseFloat(parts[6]) : null,
                    sphereMax: parts[7] ? parseFloat(parts[7]) : null,
                    cylinderMin: parts[8] ? parseFloat(parts[8]) : null,
                    cylinderMax: parts[9] ? parseFloat(parts[9]) : null,
                    additionMin: parts[10] ? parseFloat(parts[10]) : null,
                    additionMax: parts[11] ? parseFloat(parts[11]) : null,
                };
            }
            // Otros productos: NOMBRE, MARCA, MODELO, PRECIO, COSTO, STOCK
            return {
                name: parts[0] || finalType,
                brand: parts[1] || '',
                model: parts[2] || '',
                type: finalType,
                category: selectedCategory,
                price: parseFloat(parts[3]) || 0,
                cost: parseFloat(parts[4]) || 0,
                stock: parseInt(parts[5]) || 0,
                unitType: 'UNIDAD',
            };
        });
        if (items.length === 0) return;
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
                            {/* CRISTALES: Marca → Nombre → Laboratorio → Índice → Precio → Costo */}

                            {/* Marca */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Marca *</label>
                                <input autoFocus required type="text" placeholder="Ej: Zeiss"
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                    value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                />
                            </div>

                            {/* Nombre */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Nombre *</label>
                                <input required type="text" placeholder={`Ej: ${finalType} Premium AR`}
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Laboratorio — obligatorio */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">🏭 Laboratorio <span className="text-red-500">*</span></label>
                                <input required type="text" placeholder="Ej: OPTOVISION, GRUPO OPTICO"
                                    className={`w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all uppercase ${!formData.laboratory ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
                                    value={formData.laboratory} onChange={e => setFormData({ ...formData, laboratory: e.target.value.toUpperCase() })}
                                />
                                {!formData.laboratory && <p className="text-[9px] font-bold text-red-400 ml-4">El laboratorio es obligatorio para cristales</p>}
                            </div>

                            {/* Índice de refracción */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">🔬 Índice de Refracción</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 1.56, 1.67, Foto..."
                                    value={formData.lensIndex}
                                    onChange={e => setFormData({ ...formData, lensIndex: e.target.value })}
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
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
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-4">Precio Venta ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-14 pr-6 py-5 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 rounded-[2rem] font-black text-xl outline-none focus:border-primary transition-all text-primary placeholder:text-primary/30"
                                        value={formData.price || ''}
                                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Costo — solo admin */}
                            {isAdmin && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Costo ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                        value={formData.cost || ''}
                                        onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
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
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary transition-all"
                                        value={formData.sphereMin}
                                        onChange={e => setFormData({ ...formData, sphereMin: e.target.value })}
                                    />
                                    <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                    <input type="number" step="0.25" placeholder="Máx (ej: +8)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary transition-all"
                                        value={formData.sphereMax}
                                        onChange={e => setFormData({ ...formData, sphereMax: e.target.value })}
                                    />
                                </div>

                                {/* Cilindro */}
                                <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Cilindro</span>
                                    <input type="number" step="0.25" placeholder="Mín (ej: -6)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary transition-all"
                                        value={formData.cylinderMin}
                                        onChange={e => setFormData({ ...formData, cylinderMin: e.target.value })}
                                    />
                                    <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                    <input type="number" step="0.25" placeholder="Máx (ej: 0)"
                                        className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary transition-all"
                                        value={formData.cylinderMax}
                                        onChange={e => setFormData({ ...formData, cylinderMax: e.target.value })}
                                    />
                                </div>

                                {/* Adición — solo multifocales */}
                                {selectedSubtype === 'Multifocal' && (
                                    <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Adición</span>
                                        <input type="number" step="0.25" placeholder="Mín (ej: 0.75)"
                                            className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary transition-all"
                                            value={formData.additionMin}
                                            onChange={e => setFormData({ ...formData, additionMin: e.target.value })}
                                        />
                                        <span className="text-[9px] font-black text-stone-300 uppercase">a</span>
                                        <input type="number" step="0.25" placeholder="Máx (ej: 3.50)"
                                            className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary transition-all"
                                            value={formData.additionMax}
                                            onChange={e => setFormData({ ...formData, additionMax: e.target.value })}
                                        />
                                    </div>
                                )}
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
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Marca */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Marca</label>
                                <input type="text" placeholder="Ej: Ray-Ban"
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                    value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                />
                            </div>

                            {/* Modelo */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Modelo / Color</label>
                                <input type="text" placeholder="Ej: DuraVision"
                                    className="w-full px-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                    value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })}
                                />
                            </div>

                            {/* Stock */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Stock Inicial</label>
                                <div className="relative group">
                                    <Layers className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input type="number" min={0}
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
                                        value={formData.stock}
                                        onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Costo — solo admin */}
                            {isAdmin && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Costo ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-12 pr-6 py-4 bg-stone-50/50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700 rounded-[1.5rem] font-bold text-sm outline-none focus:border-primary transition-all"
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

                            {/* Precio Venta */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-4">Precio Venta ($) *</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                                    <input required type="number" min={1} placeholder="0.00"
                                        className="w-full pl-14 pr-6 py-5 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 rounded-[2rem] font-black text-xl outline-none focus:border-primary transition-all text-primary placeholder:text-primary/30"
                                        value={formData.price || ''}
                                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button type="submit" disabled={saving}
                    className="w-full py-6 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                    <Save className="w-5 h-5" /> {saving ? 'Guardando...' : isCristal ? 'GUARDAR CRISTAL (PAR)' : 'GUARDAR PRODUCTO'}
                </button>
            </div>
        </form>
    );

    // ── STEP 2 BULK: CSV upload ───────────────────────────────────────────────
    const renderStep2Bulk = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Badge tipo */}
            <div className="flex items-center gap-3 p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                <span className="text-xs font-black text-primary uppercase tracking-widest">{finalType}</span>
            </div>

            <div className="p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-1">Formato por línea</p>
                    <p className="text-[10px] font-bold text-amber-600/80 leading-relaxed">
                        {isCristal
                            ? <><span className="font-black text-amber-700 dark:text-amber-300">MARCA, NOMBRE, ÍNDICE, PRECIO{isAdmin ? ', COSTO' : ''}, LABORATORIO</span> <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black ml-1">PAR automático</span><br /><span className="text-[8px] text-amber-500">Opcional al final: ESF_MIN, ESF_MAX, CIL_MIN, CIL_MAX, ADIC_MIN, ADIC_MAX</span></>
                            : <><span className="font-black text-amber-700 dark:text-amber-300">NOMBRE, MARCA, MODELO, PRECIO{isAdmin ? ', COSTO' : ''}, STOCK</span></>
                        }
                    </p>
                </div>
            </div>

            <textarea autoFocus
                className="w-full h-52 p-6 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-[2rem] font-mono text-[10px] outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                placeholder={isCristal
                    ? `Zeiss, Antireflejo Total, 1.5, 25000, 12000, OPTOVISION\nHoya, Transitions Foto, Foto, 35000, 18000, GRUPO OPTICO\nEssilor, Varilux Comfort, 1.67, 45000, 22000, OPTOVISION`
                    : `Armazón Titanio, Ray-Ban, RB3025, 15000, 7000, 5\nArmazón Acetato, Oakley, OX8046, 12000, 5500, 8`
                }
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
            />

            <button onClick={handleBulkSubmit} disabled={saving || !bulkText.trim()}
                className="w-full py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
                <Upload className="w-4 h-4" /> {saving ? 'Cargando...' : 'PROCESAR CARGA MASIVA'}
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-[3rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

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
                                <Database className="w-4 h-4" /> Carga Masiva (CSV)
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
