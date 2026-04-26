'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Loader2, AlertCircle, ArrowUpRight, Trash2, ShoppingBag, CheckSquare, Square, X, Pencil, Save, Download, Upload, CheckCircle2, Zap } from "lucide-react";
import { Product } from '@/hooks/useProducts';
import ProductForm from '@/components/inventory/ProductForm';
import LabPriceImporter from '@/components/inventory/LabPriceImporter';
import { useProducts } from '@/hooks/useProducts';
import { autoCorrectLab } from '@/utils/product-controllers';

const PRODUCT_CATEGORIES = [
    { id: 'ALL', label: 'Todos' },
    { id: 'Cristal', label: '🔬 Cristales', subtypes: ['Monofocal', 'Multifocal', 'Bifocal', 'Ocupacional', 'Coquil'] },
    { id: 'Lentes de Sol', label: '🕶️ Lentes de Sol' },
    { id: 'Armazón de Receta', label: '👓 Armazón' },
    { id: 'Lentes de Contacto', label: '👁️ Contacto' },
    { id: 'Lentes Especiales', label: '✨ Especiales' },
];



export default function InventarioPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedSubtype, setSelectedSubtype] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editForm, setEditForm] = useState({ name: '', brand: '', model: '', type: '', stock: 0, cost: 0, price: 0, lensIndex: '', laboratory: '', sphereMin: '' as string, sphereMax: '' as string, cylinderMin: '' as string, cylinderMax: '' as string, additionMin: '' as string, additionMax: '' as string, is2x1: false });
    const [savingEdit, setSavingEdit] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [userRole, setUserRole] = useState('STAFF');
    const [showEditRanges, setShowEditRanges] = useState(false);
    const [showLabImporter, setShowLabImporter] = useState(false);
    const [editingMarkup, setEditingMarkup] = useState<string | null>(null);
    const [editMarkupValue, setEditMarkupValue] = useState('');

    useEffect(() => {
        try {
            const stored = localStorage.getItem('user');
            if (stored) {
                const u = JSON.parse(stored);
                setUserRole(u.role || 'STAFF');
            }
        } catch { }
    }, []);

    const isAdmin = userRole === 'ADMIN';

    // The filter passed to useProducts: if subtype selected use it, otherwise use category
    const activeFilter = selectedSubtype ? `Cristal ${selectedSubtype}` : selectedCategory;

    const activeCategory = PRODUCT_CATEGORIES.find(c => c.id === selectedCategory);

    const { products: rawProducts, loading, error, refresh, deleteProduct, bulkDelete } = useProducts(searchQuery, activeFilter);

    // Extract unique brands and filter by selected brand
    const uniqueBrands = Array.from(new Set(rawProducts.map(p => p.brand).filter(Boolean) as string[])).sort();
    const uniqueLabs = Array.from(new Set(rawProducts.map(p => p.laboratory).filter(Boolean) as string[])).sort();
    const products = selectedBrand ? rawProducts.filter(p => p.brand === selectedBrand) : rawProducts;

    // Helper: detecta cristales (incluye valores legacy LENS/MULTIFOCAL/etc)
    const checkCristal = (p: { category?: string; type?: string | null }) =>
        p.category === 'Cristal'
        || p.type?.startsWith('Cristal')
        || ['MONOFOCAL','MULTIFOCAL','BIFOCAL','OCUPACIONAL'].includes(p.type?.toUpperCase() || '');

    // Excluir cristales del cálculo de stock (se compran bajo demanda)
    const nonCrystalProducts = products.filter(p => !checkCristal(p));
    
    // Helper para armar el nombre completo (Marca + Nombre) evitando duplicados
    const getDisplayName = (p: Product) => {
        let namePart = p.name || '';
        if (p.brand && namePart.toUpperCase().startsWith(p.brand.toUpperCase())) {
            namePart = namePart.substring(p.brand.length).replace(/^[\s\-·]+/, '').trim();
        }
        const parts = [];
        if (p.brand) parts.push(p.brand);
        if (namePart) parts.push(namePart);
        return parts.length > 0 ? parts.join(' · ') : (p.type || 'Sin nombre');
    };
    const stats = {
        totalProducts: products.length,
        totalStock: nonCrystalProducts.reduce((acc, p) => acc + p.stock, 0),
        lowStock: nonCrystalProducts.filter(p => p.stock <= 2 && p.stock > 0).length,
        inventoryValue: nonCrystalProducts.reduce((acc, p) => acc + (p.cost * p.stock), 0)
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`¿Eliminar "${name}"?`)) {
            const result = await deleteProduct(id);
            if (result.success) {
                selectedIds.delete(id);
                setSelectedIds(new Set(selectedIds));
            } else {
                alert(result.error || 'No se pudo eliminar el producto');
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`¿Eliminar ${selectedIds.size} producto(s)?`)) {
            setIsDeleting(true);
            const result = await bulkDelete(Array.from(selectedIds));
            if (result.errors && result.errors.length > 0) {
                alert(`Algunos productos no se pudieron eliminar:\n${result.errors.join('\n')}`);
            }
            setSelectedIds(new Set());
            setIsDeleting(false);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const startEdit = (p: Product) => {
        setEditingProduct(p);
        setEditForm({
            name: p.name || '',
            brand: p.brand || '',
            model: p.model || '',
            type: p.type || '',
            stock: p.stock,
            cost: p.cost,
            price: p.price,
            lensIndex: p.lensIndex || '',
            laboratory: p.laboratory || '',
            sphereMin: p.sphereMin != null ? String(p.sphereMin) : '',
            sphereMax: p.sphereMax != null ? String(p.sphereMax) : '',
            cylinderMin: p.cylinderMin != null ? String(p.cylinderMin) : '',
            cylinderMax: p.cylinderMax != null ? String(p.cylinderMax) : '',
            additionMin: p.additionMin != null ? String(p.additionMin) : '',
            additionMax: p.additionMax != null ? String(p.additionMax) : '',
            is2x1: p.is2x1 === true,
        });
        setShowEditRanges(false);
    };

    const handleSaveEdit = async () => {
        if (!editingProduct) return;
        const isEditCristal = checkCristal(editingProduct);
        // Validar laboratorio e indice obligatorios para cristales
        if (isEditCristal) {
            if (!editForm.laboratory.trim()) {
                alert('El laboratorio es obligatorio para cristales');
                return;
            }
            if (!editForm.lensIndex.trim()) {
                alert('El índice de refracción es obligatorio para cristales');
                return;
            }
        }
        setSavingEdit(true);
        try {
            // Normalizar category/type legacy al guardar
            const normalizedFields: Record<string, string> = {};
            if (isEditCristal) {
                if (editingProduct.category !== 'Cristal') normalizedFields.category = 'Cristal';
                if (editForm.type) {
                    normalizedFields.type = editForm.type;
                } else if (editingProduct.type && !editingProduct.type.startsWith('Cristal')) {
                    const sub = editingProduct.type.charAt(0).toUpperCase() + editingProduct.type.slice(1).toLowerCase();
                    normalizedFields.type = `Cristal ${sub}`;
                }
            }
            const payload = {
                ...editForm,
                ...normalizedFields,
                sphereMin: editForm.sphereMin !== '' ? parseFloat(editForm.sphereMin) : null,
                sphereMax: editForm.sphereMax !== '' ? parseFloat(editForm.sphereMax) : null,
                cylinderMin: editForm.cylinderMin !== '' ? parseFloat(editForm.cylinderMin) : null,
                cylinderMax: editForm.cylinderMax !== '' ? parseFloat(editForm.cylinderMax) : null,
                additionMin: editForm.additionMin !== '' ? parseFloat(editForm.additionMin) : null,
                additionMax: editForm.additionMax !== '' ? parseFloat(editForm.additionMax) : null,
            };
            const res = await fetch(`/api/products/${editingProduct.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setEditingProduct(null);
                refresh();
            } else {
                const data = await res.json();
                alert(data.details || data.error);
            }
        } catch { alert('Error de conexión'); }
        finally { setSavingEdit(false); }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };




    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/products/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                setImportResult({ type: 'success', text: data.message });
                refresh();
            } else {
                setImportResult({ type: 'error', text: data.error || 'Error al importar' });
            }
        } catch {
            setImportResult({ type: 'error', text: 'Error de conexión' });
        }
        setImporting(false);
        e.target.value = '';
        setTimeout(() => setImportResult(null), 6000);
    };

    return (
        <div className="p-4 lg:p-6 max-w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Import Result Toast */}
            {importResult && (
                <div className={`fixed top-4 right-4 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold z-[100] animate-in slide-in-from-right duration-300 shadow-2xl ${importResult.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800'
                    }`}>
                    {importResult.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {importResult.text}
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="w-full lg:w-auto">
                    <h1 className="text-2xl lg:text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                        Stock y <span className="text-primary not-italic border-b-4 border-primary/30">Productos</span>
                    </h1>
                    <p className="text-stone-400 mt-1 font-medium uppercase text-[8px] lg:text-[10px] tracking-[0.2em]">Control de inventario y catálogo</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => setShowLabImporter(true)}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 lg:px-6 py-2.5 lg:py-3 bg-amber-600 text-white rounded-xl text-[9px] lg:text-[10px] font-black shadow-lg hover:scale-105 active:scale-95 transition-all group uppercase tracking-widest whitespace-nowrap"
                            >
                                <Zap className="w-4 h-4 group-hover:rotate-12 transition-transform" strokeWidth={3} />
                                OCR Lab
                            </button>
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 lg:px-6 py-2.5 lg:py-3 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-xl text-[9px] lg:text-[10px] font-black shadow-lg hover:scale-105 active:scale-95 transition-all group uppercase tracking-widest whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                                Cargar
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Stats */}
            <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
                {[
                    { label: 'Artículos', value: stats.totalProducts, icon: ShoppingBag },
                    { label: 'Stock Total', value: stats.totalStock, icon: Package },
                    { label: 'Stock Crítico', value: stats.lowStock, icon: AlertCircle },
                    ...(isAdmin ? [{ label: 'Valorización', value: `$${stats.inventoryValue.toLocaleString()}`, icon: ArrowUpRight }] : []),
                ].map((s, i) => (
                    <div key={i} className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 flex items-center gap-3">
                        <s.icon className="w-5 h-5 text-stone-400 shrink-0" />
                        <div>
                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{s.label}</p>
                            <p className="text-lg font-black text-stone-800 dark:text-white">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search + Mass Delete Bar */}
            <div className="flex gap-3">
                <div className="relative group flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, marca o modelo..."
                        className="w-full pl-14 pr-6 py-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {isAdmin && selectedIds.size > 0 && (
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-6 py-4 bg-red-500 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-red-600 active:scale-95 transition-all uppercase tracking-widest animate-in slide-in-from-right-3"
                    >
                        {isDeleting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando...</>
                        ) : (
                            <><Trash2 className="w-4 h-4" /> Eliminar ({selectedIds.size})</>
                        )}
                    </button>
                )}
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setSelectedCategory(cat.id);
                            setSelectedSubtype('');
                            setSelectedBrand('');
                            setShowAllBrands(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${selectedCategory === cat.id && !selectedSubtype
                            ? 'bg-stone-900 dark:bg-primary border-transparent text-white shadow-md'
                            : 'bg-transparent border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-300'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Subtype filters — only when Cristal is selected */}
            {selectedCategory === 'Cristal' && activeCategory?.subtypes && (
                <div className="flex flex-wrap gap-1.5 items-center animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-[9px] font-black text-stone-300 uppercase tracking-widest mr-1">Tipo:</span>
                    <button
                        onClick={() => setSelectedSubtype('')}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${!selectedSubtype
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-transparent border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                            }`}
                    >
                        Todos
                    </button>
                    {activeCategory.subtypes.map(sub => (
                        <button
                            key={sub}
                            onClick={() => setSelectedSubtype(sub)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${selectedSubtype === sub
                                ? 'bg-primary border-transparent text-white shadow-md'
                                : 'bg-transparent border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                                }`}
                        >
                            {sub}
                        </button>
                    ))}
                </div>
            )}

            {/* Brand filters — compact collapsible */}
            {uniqueBrands.length > 1 && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[9px] font-black text-stone-300 uppercase tracking-widest mr-1">Marca:</span>
                        <button
                            onClick={() => setSelectedBrand('')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${!selectedBrand
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-700 dark:text-amber-400'
                                : 'bg-transparent border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                                }`}
                        >
                            Todas
                        </button>
                        {(showAllBrands ? uniqueBrands : uniqueBrands.slice(0, 10)).map(brand => (
                            <button
                                key={brand}
                                onClick={() => setSelectedBrand(brand)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${selectedBrand === brand
                                    ? 'bg-amber-500 border-transparent text-white shadow-md'
                                    : 'bg-transparent border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300 hover:text-stone-600'
                                    }`}
                            >
                                {brand}
                            </button>
                        ))}
                        {uniqueBrands.length > 10 && (
                            <button
                                onClick={() => setShowAllBrands(!showAllBrands)}
                                className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-primary hover:bg-primary/10 border border-primary/20"
                            >
                                {showAllBrands ? '▲ Menos' : `+${uniqueBrands.length - 10} más ▼`}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Product List */}
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">

                {/* Table view (Desktop only) */}
                <div className="hidden lg:block overflow-x-auto">
                    {/* Table header */}
                    <div className={`grid ${isAdmin ? 'grid-cols-[40px_6fr_1.5fr_1fr_1.5fr_1.2fr_0.8fr_1.2fr_80px]' : 'grid-cols-[40px_6fr_1.5fr_1fr_1.5fr_1.2fr_80px]'} gap-4 px-6 py-3 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800 items-center`}>
                        {/* Select all checkbox */}
                        <div className="flex justify-center">
                            <button
                                onClick={toggleSelectAll}
                                className="text-stone-400 hover:text-primary transition-colors"
                            >
                                {products.length > 0 && selectedIds.size === products.length ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        {(isAdmin ? ['Producto', 'Tipo', 'Índice', 'Stock', 'Costo', 'Markup', 'Precio', ''] : ['Producto', 'Tipo', 'Índice', 'Stock', 'Precio', '']).map((h, i) => {
                            const isNumeric = ['Stock', 'Costo', 'Markup', 'Precio'].includes(h);
                            const isCentered = ['Tipo', 'Índice'].includes(h);
                            return (
                                <div 
                                    key={i} 
                                    className={`text-[9px] font-black text-stone-400 uppercase tracking-widest ${isNumeric ? 'text-right pr-4' : isCentered ? 'text-center' : ''}`}
                                >
                                    {h}
                                </div>
                            );
                        })}
                    </div>

                    <div className="divide-y divide-stone-50 dark:divide-stone-800">
                        {products.map((p) => {
                            const isCristal = checkCristal(p);
                            const isSelected = selectedIds.has(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className={`grid ${isAdmin ? 'grid-cols-[40px_6fr_1.5fr_1fr_1.5fr_1.2fr_0.8fr_1.2fr_80px]' : 'grid-cols-[40px_6fr_1.5fr_1fr_1.5fr_1.2fr_80px]'} gap-4 px-6 py-4 items-center hover:bg-stone-50/70 dark:hover:bg-stone-800/30 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}
                                >
                                    <div className="flex justify-center">
                                        <button onClick={() => toggleSelect(p.id)} className="text-stone-300 hover:text-primary">
                                            {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="min-w-0 py-1">
                                        <p className="font-black text-sm text-stone-800 dark:text-stone-100 italic tracking-tight">
                                            {getDisplayName(p as Product)}
                                        </p>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${isCristal ? 'bg-violet-100 text-violet-600' : 'bg-stone-100 text-stone-400'}`}>
                                            {isCristal ? '🔬 Cristal' : p.category || p.type}
                                        </span>
                                    </div>
                                    <div className="flex justify-center"><span className="text-[9px] font-black uppercase bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg text-stone-600 dark:text-stone-400 whitespace-nowrap">{p.type || '-'}</span></div>
                                    <div className="flex justify-center">{p.lensIndex ? <span className="text-[9px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg">{p.lensIndex}</span> : <span className="text-stone-300">-</span>}</div>
                                    <div className="text-right pr-4 shrink-0 flex items-center justify-end gap-2">
                                        {p.is2x1 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">2x1</span>}
                                        {isCristal ? <span className="text-[9px] font-black text-violet-600 bg-violet-50 dark:bg-violet-950/30 px-2 py-1 rounded-lg inline-block">{p.laboratory || 'Lab'}</span> : <span className={`text-sm font-black ${p.stock <= 2 ? 'text-red-500' : 'text-stone-800 dark:text-stone-200'}`}>{p.stock}</span>}
                                    </div>
                                    {isAdmin && <div className="text-right pr-4"><span className="text-sm font-bold text-stone-400">${p.cost?.toLocaleString()}</span></div>}
                                    {isAdmin && <div className="text-right pr-4">{p.cost > 0 ? (
                                        editingMarkup === p.id ? (
                                            <input
                                                type="text"
                                                value={editMarkupValue}
                                                onChange={e => setEditMarkupValue(e.target.value)}
                                                onKeyDown={async e => {
                                                    if (e.key === 'Enter') {
                                                        const mult = parseFloat(editMarkupValue.replace(',', '.'));
                                                        if (!isNaN(mult) && mult > 0) {
                                                            const newPrice = Math.round(p.cost * mult);
                                                            await fetch(`/api/products/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: newPrice }) });
                                                            refresh();
                                                        }
                                                        setEditingMarkup(null);
                                                    } else if (e.key === 'Escape') setEditingMarkup(null);
                                                }}
                                                onBlur={() => setEditingMarkup(null)}
                                                autoFocus
                                                className="w-16 px-1.5 py-0.5 text-[11px] font-black text-center border-2 border-primary rounded-lg outline-none bg-white dark:bg-stone-900"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => { setEditingMarkup(p.id); setEditMarkupValue((p.price / p.cost).toFixed(2)); }}
                                                className={`text-[11px] font-black px-2 py-0.5 rounded-lg cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${(p.price / p.cost) >= 2.4 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : (p.price / p.cost) >= 1.5 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'}`}
                                                title="Click para editar markup"
                                            >
                                                ×{(p.price / p.cost).toFixed(2)}
                                            </button>
                                        )
                                    ) : <span className="text-stone-300">—</span>}</div>}
                                    <div className="text-right pr-4"><span className="text-sm font-black text-stone-900 dark:text-white">${p.price?.toLocaleString()}</span></div>
                                    {isAdmin && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => startEdit(p)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-primary transition-all"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(p.id, p.brand || p.name !)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Card view (Mobile only) */}
                <div className="lg:hidden flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
                    {loading && products.length === 0 ? (
                        <div className="py-20 flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="text-[10px] font-black uppercase tracking-widest">Cargando...</span></div>
                    ) : products.length > 0 ? (
                        products.map((p) => {
                            const isCristal = checkCristal(p);
                            const isSelected = selectedIds.has(p.id);
                            return (
                                <div key={p.id} className={`p-4 flex gap-4 items-start ${isSelected ? 'bg-primary/5' : ''}`}>
                                    <button onClick={() => toggleSelect(p.id)} className="text-stone-300 mt-1">
                                        {isSelected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="font-black text-sm text-stone-800 dark:text-stone-100 line-clamp-none">
                                                {getDisplayName(p as Product)}
                                            </p>
                                            <p className="text-sm font-black text-stone-900 dark:text-white shrink-0">${p.price?.toLocaleString()}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${isCristal ? 'bg-violet-100 text-violet-600' : 'bg-stone-100 text-stone-400'}`}>
                                                {isCristal ? '🔬 Cristal' : p.category || p.type}
                                            </span>
                                            {p.lensIndex && <span className="text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{p.lensIndex}</span>}
                                            {p.is2x1 && <span className="text-[8px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-1.5 py-0.5 rounded-full">2x1</span>}
                                            <span className="text-[8px] font-black bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded-full">STOCK: {isCristal ? (p.laboratory || 'Lab') : p.stock}</span>
                                        </div>
                                        {isAdmin && (
                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-50 dark:border-stone-800">
                                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Costo: ${p.cost?.toLocaleString()}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => startEdit(p)} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-lg text-stone-600 dark:text-stone-400"><Pencil className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(p.id, p.brand || p.name !)} className="p-2 bg-red-50 dark:bg-red-950 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="py-24 text-center px-4">
                            <Package className="w-12 h-12 text-stone-100 mx-auto mb-4" />
                            <p className="text-stone-400 font-black uppercase tracking-widest text-[10px]">Sin productos</p>
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <ProductForm
                    onClose={() => setShowForm(false)}
                    onSuccess={() => refresh()}
                    isAdmin={isAdmin}
                    uniqueBrands={uniqueBrands}
                    uniqueLabs={uniqueLabs}
                />
            )}

            {/* Edit Modal */}
            {editingProduct && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-[3rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300">
                        <header className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-stone-800 dark:text-white tracking-tighter italic">Editar <span className="text-primary not-italic">{editingProduct.name || editingProduct.type}</span></h2>
                                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">{editingProduct.type || editingProduct.category}</p>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-colors">
                                <X className="w-5 h-5 text-stone-400" />
                            </button>
                        </header>
                        <div className="p-8 space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Nombre</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Marca</label>
                                    <input type="text" value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                </div>
                                {checkCristal(editingProduct) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Tipo de Cristal</label>
                                        <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary cursor-pointer">
                                            <option value="">Seleccionar tipo...</option>
                                            <option value="Cristal Monofocal">Cristal Monofocal</option>
                                            <option value="Cristal Multifocal">Cristal Multifocal</option>
                                            <option value="Cristal Bifocal">Cristal Bifocal</option>
                                            <option value="Cristal Ocupacional">Cristal Ocupacional</option>
                                            <option value="Cristal Coquil">Cristal Coquil</option>
                                        </select>
                                    </div>
                                )}
                                {!checkCristal(editingProduct) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Modelo</label>
                                        <input type="text" value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                    </div>
                                )}
                                {/* Ocultar stock para cristales — se compran bajo demanda */}
                                {!checkCristal(editingProduct) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Stock</label>
                                        <input type="number" min={0} value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                    </div>
                                )}
                                {isAdmin && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Costo ($)</label>
                                    <input type="number" min={0} value={editForm.cost} onChange={e => setEditForm({ ...editForm, cost: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                </div>
                                )}
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-3">Precio Venta ($)</label>
                                    <input type="number" min={0} value={editForm.price} onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-5 bg-primary/5 border-2 border-primary/20 rounded-2xl font-black text-xl outline-none focus:border-primary text-primary" />
                                </div>

                                {/* Laboratorio — obligatorio para cristales */}
                                {checkCristal(editingProduct) && (
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">🏭 Laboratorio <span className="text-red-500">*</span></label>
                                        <input type="text" required placeholder="Ej: OPTOVISION" value={editForm.laboratory} 
                                            onChange={e => setEditForm({ ...editForm, laboratory: e.target.value.toUpperCase() })} 
                                            onBlur={() => setEditForm({ ...editForm, laboratory: autoCorrectLab(editForm.laboratory) })}
                                            className={`w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border rounded-2xl font-bold text-sm outline-none focus:border-primary uppercase ${!editForm.laboratory ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`} 
                                        />
                                        {!editForm.laboratory && <p className="text-[9px] font-bold text-red-400 ml-3">El laboratorio es obligatorio para cristales</p>}
                                    </div>
                                )}

                                {/* Índice de refracción — solo cristales */}
                                {checkCristal(editingProduct) && (
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">🔬 Índice de Refracción <span className="text-red-500">*</span></label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ej: 1.56, 1.67, Foto..."
                                            value={editForm.lensIndex}
                                            onChange={e => setEditForm({ ...editForm, lensIndex: e.target.value })}
                                            className={`w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border rounded-2xl font-bold text-sm outline-none focus:border-primary transition-all ${!editForm.lensIndex ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
                                        />
                                        <div className="flex flex-wrap gap-1.5">
                                            {['1.49', '1.50', '1.53', '1.56', '1.59', '1.60', '1.67', '1.74', 'Foto'].map(idx => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, lensIndex: idx })}
                                                    className={`px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-tight transition-all ${editForm.lensIndex === idx
                                                        ? 'bg-primary border-primary text-white shadow-md'
                                                        : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:border-primary/40 hover:text-primary'
                                                        }`}
                                                >
                                                    {idx}
                                                </button>
                                            ))}
                                            {editForm.lensIndex && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, lensIndex: '' })}
                                                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-400 font-black text-[9px] uppercase tracking-tight hover:bg-red-50 transition-all"
                                                >
                                                    ✕ Limpiar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Rangos de Fabricación — solo cristales */}
                                {checkCristal(editingProduct) && (
                                    <div className="col-span-2 space-y-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">📐 Rangos de Fabricación</span>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <div className={`relative w-8 h-5 rounded-full transition-colors ${showEditRanges ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                                    <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${showEditRanges ? 'translate-x-3' : 'translate-x-0'}`} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={showEditRanges} onChange={e => setShowEditRanges(e.target.checked)} />
                                                <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Desplegar</span>
                                            </label>
                                        </div>
                                        
                                        {showEditRanges && (
                                            <div className="grid gap-3 pt-2">
                                                <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Esfera</span>
                                                    <input type="number" step="0.25" placeholder="Mín" value={editForm.sphereMin} onChange={e => setEditForm({ ...editForm, sphereMin: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                                    <span className="text-[9px] font-black text-stone-300">a</span>
                                                    <input type="number" step="0.25" placeholder="Máx" value={editForm.sphereMax} onChange={e => setEditForm({ ...editForm, sphereMax: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                                </div>
                                                <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Cilindro</span>
                                                    <input type="number" step="0.25" placeholder="Mín" value={editForm.cylinderMin} onChange={e => setEditForm({ ...editForm, cylinderMin: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                                    <span className="text-[9px] font-black text-stone-300">a</span>
                                                    <input type="number" step="0.25" placeholder="Máx" value={editForm.cylinderMax} onChange={e => setEditForm({ ...editForm, cylinderMax: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                                </div>
                                                {editingProduct.type?.includes('Multifocal') && (
                                                    <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Adición</span>
                                                        <input type="number" step="0.25" placeholder="Mín" value={editForm.additionMin} onChange={e => setEditForm({ ...editForm, additionMin: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                                        <span className="text-[9px] font-black text-stone-300">a</span>
                                                        <input type="number" step="0.25" placeholder="Máx" value={editForm.additionMax} onChange={e => setEditForm({ ...editForm, additionMax: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Promo 2x1 (Edit) */}
                                {checkCristal(editingProduct) && (
                                    <div className="col-span-2 pt-4 border-t border-stone-100 dark:border-stone-800">
                                        <label className="flex items-center gap-3 cursor-pointer group w-max">
                                            <div className={`relative w-10 h-6 rounded-full transition-colors ${editForm.is2x1 ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${editForm.is2x1 ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </div>
                                            <input type="checkbox" className="hidden" checked={editForm.is2x1} onChange={e => setEditForm({ ...editForm, is2x1: e.target.checked })} />
                                            <div>
                                                <p className="text-xs font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Activar Promo 2x1</p>
                                                <p className="text-[9px] font-bold text-stone-400">Habilita descuentos automáticos en armazones para este cristal.</p>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors">CANCELAR</button>
                                <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-4 bg-stone-900 dark:bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Save className="w-4 h-4" /> {savingEdit ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lab Price Importer Modal */}
            {showLabImporter && (
                <LabPriceImporter
                    onClose={() => setShowLabImporter(false)}
                    onSuccess={() => refresh()}
                    laboratories={uniqueLabs}
                />
            )}
        </div>
    );
}
