'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Loader2, AlertCircle, ArrowUpRight, Trash2, ShoppingBag, CheckSquare, Square, X, Pencil, Save, Download, Upload, CheckCircle2 } from "lucide-react";
import { Product } from '@/hooks/useProducts';
import ProductForm from '@/components/inventory/ProductForm';
import { useProducts } from '@/hooks/useProducts';

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
    const [editForm, setEditForm] = useState({ name: '', brand: '', model: '', stock: 0, cost: 0, price: 0, lensIndex: '', laboratory: '', sphereMin: '' as string, sphereMax: '' as string, cylinderMin: '' as string, cylinderMax: '' as string, additionMin: '' as string, additionMax: '' as string });
    const [savingEdit, setSavingEdit] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [userRole, setUserRole] = useState('STAFF');

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
    const products = selectedBrand ? rawProducts.filter(p => p.brand === selectedBrand) : rawProducts;

    // Excluir cristales del cálculo de stock (se compran bajo demanda)
    const nonCrystalProducts = products.filter(p => p.category !== 'Cristal' && !p.type?.startsWith('Cristal'));
    const stats = {
        totalProducts: products.length,
        totalStock: nonCrystalProducts.reduce((acc, p) => acc + p.stock, 0),
        lowStock: nonCrystalProducts.filter(p => p.stock <= 2 && p.stock > 0).length,
        inventoryValue: nonCrystalProducts.reduce((acc, p) => acc + (p.cost * p.stock), 0)
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`¿Eliminar "${name}"?`)) {
            await deleteProduct(id);
            selectedIds.delete(id);
            setSelectedIds(new Set(selectedIds));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`¿Eliminar ${selectedIds.size} producto(s)?`)) {
            setIsDeleting(true);
            await bulkDelete(Array.from(selectedIds));
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
        });
    };

    const handleSaveEdit = async () => {
        if (!editingProduct) return;
        setSavingEdit(true);
        try {
            const payload = {
                ...editForm,
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
        <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Import Result Toast */}
            {importResult && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top duration-300 ${importResult.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-800'
                    }`}>
                    {importResult.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {importResult.text}
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                        Stock y <span className="text-primary not-italic border-b-4 border-primary/30">Productos</span>
                    </h1>
                    <p className="text-stone-400 mt-1 font-medium uppercase text-[10px] tracking-[0.2em]">Control de inventario y catálogo</p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <>
                            <a
                                href="/api/products/import?type=cristales"
                                download="plantilla_cristales_atelier.csv"
                                className="flex items-center gap-2 px-4 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-[10px] font-black hover:scale-105 active:scale-95 transition-all uppercase tracking-widest border border-stone-200 dark:border-stone-700 no-underline"
                                title="Descargar plantilla CSV para cargar cristales masivamente"
                            >
                                <Download className="w-4 h-4" />
                                🔬 Cristales
                            </a>
                            <a
                                href="/api/products/import?type=armazones"
                                download="plantilla_armazones_atelier.csv"
                                className="flex items-center gap-2 px-4 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-[10px] font-black hover:scale-105 active:scale-95 transition-all uppercase tracking-widest border border-stone-200 dark:border-stone-700 no-underline"
                                title="Descargar plantilla CSV para cargar armazones masivamente"
                            >
                                <Download className="w-4 h-4" />
                                👓 Armazones
                            </a>
                            <label
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all border hover:scale-105 active:scale-95 ${importing
                                    ? 'bg-stone-200 dark:bg-stone-700 text-stone-400 border-stone-300'
                                    : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                    }`}
                                title="Importar cristales desde un archivo CSV"
                            >
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {importing ? 'Importando...' : 'Importar CSV'}
                                <input type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" disabled={importing} />
                            </label>
                            <button
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-xl text-[10px] font-black shadow-lg hover:scale-105 active:scale-95 transition-all group uppercase tracking-widest"
                            >
                                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                                Cargar Producto
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Artículos', value: stats.totalProducts, icon: ShoppingBag },
                    { label: 'Stock Total', value: stats.totalStock, icon: Package },
                    { label: 'Stock Crítico', value: stats.lowStock, icon: AlertCircle },
                    { label: 'Valorización', value: `$${stats.inventoryValue.toLocaleString()}`, icon: ArrowUpRight },
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
            <div className="flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setSelectedCategory(cat.id);
                            setSelectedSubtype('');
                            setSelectedBrand('');
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCategory === cat.id && !selectedSubtype
                            ? 'bg-stone-900 dark:bg-primary border-transparent text-white shadow-lg'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-300'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Subtype filters — only when Cristal is selected */}
            {selectedCategory === 'Cristal' && activeCategory?.subtypes && (
                <div className="flex flex-wrap gap-2 pl-4 border-l-4 border-primary/30 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button
                        onClick={() => setSelectedSubtype('')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${!selectedSubtype
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                            }`}
                    >
                        Todos los Cristales
                    </button>
                    {activeCategory.subtypes.map(sub => (
                        <button
                            key={sub}
                            onClick={() => setSelectedSubtype(sub)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedSubtype === sub
                                ? 'bg-primary border-transparent text-white shadow-lg'
                                : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                                }`}
                        >
                            {sub}
                        </button>
                    ))}
                </div>
            )}

            {/* Brand filters — show when there are brands to filter */}
            {uniqueBrands.length > 1 && (
                <div className="flex flex-wrap gap-2 pl-4 border-l-4 border-amber-300/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button
                        onClick={() => setSelectedBrand('')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${!selectedBrand
                            ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-400'
                            : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                            }`}
                    >
                        Todas las Marcas
                    </button>
                    {uniqueBrands.map(brand => (
                        <button
                            key={brand}
                            onClick={() => setSelectedBrand(brand)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedBrand === brand
                                ? 'bg-amber-500 border-transparent text-white shadow-lg'
                                : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:border-stone-300'
                                }`}
                        >
                            {brand}
                        </button>
                    ))}
                </div>
            )}

            {/* Product List */}
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">

                {/* Table header */}
                <div className="grid grid-cols-[auto_2fr_1fr_auto_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800 items-center">
                    {/* Select all checkbox */}
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
                    {['Producto', 'Tipo', 'Índice', 'Stock', 'Costo', 'Precio', ''].map((h, i) => (
                        <span key={i} className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{h}</span>
                    ))}
                </div>

                {/* Rows */}
                {loading && products.length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-3 text-stone-300">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cargando inventario...</span>
                    </div>
                ) : error ? (
                    <div className="py-16 text-center">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                        <p className="text-red-500 font-black text-sm uppercase tracking-widest">Error de sincronización</p>
                    </div>
                ) : products.length > 0 ? (
                    <div className="divide-y divide-stone-50 dark:divide-stone-800">
                        {products.map((p) => {
                            const isCristal = p.category === 'Cristal' || p.type?.startsWith('Cristal');
                            const isSelected = selectedIds.has(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className={`grid grid-cols-[auto_2fr_1fr_auto_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-stone-50/70 dark:hover:bg-stone-800/30 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}
                                >
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => toggleSelect(p.id)}
                                        className="text-stone-300 hover:text-primary transition-colors"
                                    >
                                        {isSelected ? (
                                            <CheckSquare className="w-4 h-4 text-primary" />
                                        ) : (
                                            <Square className="w-4 h-4" />
                                        )}
                                    </button>

                                    {/* Nombre + marca */}
                                    <div className="min-w-0">
                                        <p className="font-black text-sm text-stone-800 dark:text-stone-100 truncate">
                                            {(p.brand || p.model) ? [p.brand, p.model].filter(Boolean).join(' · ') : (p.name || p.type || 'Sin nombre')}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${isCristal ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                                                : p.category === 'Lentes de Sol' || p.type === 'Lentes de Sol' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                                    : p.category === 'Armazón de Receta' || p.type === 'Armazón' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                                                        : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                                                }`}>
                                                {isCristal ? '🔬 Cristal' : p.category === 'Lentes de Sol' || p.type === 'Lentes de Sol' ? '🕶️ Sol' : p.category === 'Armazón de Receta' || p.type === 'Armazón' ? '👓 Armazón' : p.category || p.type || ''}
                                            </span>
                                            {p.unitType === 'PAR' && (
                                                <span className="text-[8px] font-black uppercase tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">PAR</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tipo */}
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-widest bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-1 rounded-lg">
                                            {p.type || p.category || '-'}
                                        </span>
                                    </div>

                                    {/* Índice */}
                                    <div>
                                        {p.lensIndex ? (
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-1 rounded-lg">
                                                {p.lensIndex}
                                            </span>
                                        ) : (
                                            <span className="text-stone-200 text-[10px]">—</span>
                                        )}
                                    </div>

                                    {/* Stock */}
                                    <div>
                                        {isCristal ? (
                                            <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400" title={p.laboratory || 'Laboratorio'}>{p.laboratory || 'Lab'}</span>
                                        ) : (
                                            <span className={`text-sm font-black ${p.stock <= 2 ? 'text-red-500' : 'text-stone-700 dark:text-stone-300'}`}>
                                                {p.stock}
                                                {p.stock <= 2 && p.stock > 0 && <span className="text-[9px] ml-1 text-red-400">⚠ bajo</span>}
                                            </span>
                                        )}
                                    </div>

                                    {/* Costo */}
                                    <div>
                                        <span className="text-sm font-bold text-stone-400">
                                            ${p.cost?.toLocaleString() ?? '0'}
                                        </span>
                                    </div>

                                    {/* Precio */}
                                    <div>
                                        <span className="text-sm font-black text-stone-800 dark:text-stone-100">
                                            ${p.price?.toLocaleString() ?? '0'}
                                        </span>
                                    </div>

                                    {/* Acciones — solo admin */}
                                    {isAdmin && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => startEdit(p)}
                                            className="p-2 text-stone-300 hover:text-primary hover:bg-primary/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id, p.name || p.type || 'este producto')}
                                            className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-24 text-center">
                        <Package className="w-12 h-12 text-stone-100 dark:text-stone-800 mx-auto mb-4" />
                        <p className="text-stone-400 font-black uppercase tracking-widest text-xs">Sin productos</p>
                        <p className="text-stone-300 text-[10px] font-bold uppercase mt-1 tracking-widest">
                            {selectedCategory !== 'ALL' || selectedSubtype ? 'Cambiá el filtro o cargá un nuevo artículo' : 'Cargá el primer artículo'}
                        </p>
                    </div>
                )}
            </div>

            {showForm && (
                <ProductForm
                    onClose={() => setShowForm(false)}
                    onSuccess={() => refresh()}
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
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Modelo</label>
                                    <input type="text" value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                </div>
                                {/* Ocultar stock para cristales — se compran bajo demanda */}
                                {!(editingProduct.category === 'Cristal' || editingProduct.type?.startsWith('Cristal')) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Stock</label>
                                        <input type="number" min={0} value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Costo ($)</label>
                                    <input type="number" min={0} value={editForm.cost} onChange={e => setEditForm({ ...editForm, cost: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-3">Precio Venta ($)</label>
                                    <input type="number" min={0} value={editForm.price} onChange={e => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-5 bg-primary/5 border-2 border-primary/20 rounded-2xl font-black text-xl outline-none focus:border-primary text-primary" />
                                </div>

                                {/* Laboratorio — solo cristales */}
                                {(editingProduct.category === 'Cristal' || editingProduct.type?.startsWith('Cristal')) && (
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Laboratorio</label>
                                        <input type="text" placeholder="Ej: OPTOVISION" value={editForm.laboratory} onChange={e => setEditForm({ ...editForm, laboratory: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                    </div>
                                )}

                                {/* Rangos de Fabricación — solo cristales */}
                                {(editingProduct.category === 'Cristal' || editingProduct.type?.startsWith('Cristal')) && (
                                    <div className="col-span-2 space-y-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">📐 Rangos de Fabricación</span>
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
                                        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2">
                                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Adición</span>
                                            <input type="number" step="0.25" placeholder="Mín" value={editForm.additionMin} onChange={e => setEditForm({ ...editForm, additionMin: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                            <span className="text-[9px] font-black text-stone-300">a</span>
                                            <input type="number" step="0.25" placeholder="Máx" value={editForm.additionMax} onChange={e => setEditForm({ ...editForm, additionMax: e.target.value })} className="px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-bold text-xs outline-none focus:border-primary" />
                                        </div>
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
        </div>
    );
}
