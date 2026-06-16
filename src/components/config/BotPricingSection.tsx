'use client';

import { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, X, Loader2, RefreshCw, Sparkles, CheckCircle2, Search, Check } from 'lucide-react';

interface PricingItem {
    id: string;
    source: 'PRODUCT';
    name: string;
    category: string;
    priceCash: number;
    botRecommended: boolean;
    is2x1?: boolean;
    lensIndex?: string;
    laboratory?: string;
}

export function BotPricingSection() {
    const [items, setItems] = useState<PricingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string>('TODO');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Búsqueda en el catálogo
    const [showAddSection, setShowAddSection] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PricingItem[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        fetchPricing();
    }, []);

    const fetchPricing = async () => {
        setLoading(true);
        try {
            // GET /api/bot/pricing sin 'search' retorna los recomendados (botRecommended = true)
            const res = await fetch('/api/bot/pricing');
            const data = await res.json();
            // Filtrar SYSTEM_INSTRUCTION si existiera
            const filtered = (Array.isArray(data) ? data : []).filter((x: any) => x.id !== 'SYSTEM_INSTRUCTION');
            setItems(filtered);
        } catch (error) {
            console.error('Error fetching pricing:', error);
            setMessage({ type: 'error', text: 'Error al cargar los precios del bot.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            // GET /api/bot/pricing?search=XYZ busca en todo el catálogo (no filtrado por botRecommended)
            const res = await fetch(`/api/bot/pricing?search=${encodeURIComponent(query.trim())}`);
            const data = await res.json();
            const filtered = (Array.isArray(data) ? data : []).filter((x: any) => x.id !== 'SYSTEM_INSTRUCTION');
            setSearchResults(filtered);
        } catch (error) {
            console.error('Error searching products:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleToggleRecommend = async (item: PricingItem) => {
        try {
            const nextState = !item.botRecommended;
            const res = await fetch('/api/bot/pricing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    source: 'PRODUCT',
                    botRecommended: nextState
                })
            });

            if (res.ok) {
                // Actualizar localmente el resultado de búsqueda
                setSearchResults(prev =>
                    prev.map(p => p.id === item.id ? { ...p, botRecommended: nextState } : p)
                );
                setMessage({
                    type: 'success',
                    text: nextState
                        ? `"${item.name}" agregado a los recomendados del bot.`
                        : `"${item.name}" removido de los recomendados del bot.`
                });
                fetchPricing();
            } else {
                setMessage({ type: 'error', text: 'Error al cambiar recomendación.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de red.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro quieres quitar este producto de los recomendados del bot?')) return;
        try {
            const res = await fetch(`/api/bot/pricing?id=${id}&source=PRODUCT`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Removido correctamente.' });
                // Actualizar también la lista de búsqueda por si estuviese abierta
                setSearchResults(prev =>
                    prev.map(p => p.id === id ? { ...p, botRecommended: false } : p)
                );
                fetchPricing();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error al remover.' });
        }
    };

    const categories = ['TODO', 'MONOFOCAL', 'MULTIFOCAL', 'BIFOCAL', 'ARMAZON', 'CONTACTO'];
    const filteredItems = items.filter(item => {
        if (filterCategory === 'TODO') return true;
        // Normalizar categorías para el filtro (ignorar tildes)
        const itemCat = (item.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, "").toUpperCase();
        return itemCat.includes(filterCategory);
    });

    return (
        <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Precios del Bot</h2>
                    <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                        {items.length} recomendados
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchPricing} className="p-2 text-stone-400 hover:text-indigo-500 transition-all" title="Actualizar">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => { setShowAddSection(!showAddSection); setSearchQuery(''); setSearchResults([]); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-105 ${showAddSection
                            ? 'bg-stone-200 dark:bg-stone-600 text-stone-500'
                            : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {showAddSection ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showAddSection ? 'Cerrar' : 'Agregar Recomendado'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`mx-6 mt-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'}`}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {message.text}
                </div>
            )}

            {/* INFO BANNER */}
            <div className="m-6 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-1">Catálogo de Productos para la IA</p>
                        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 leading-relaxed">
                            Aquí se definen qué productos del inventario puede ofrecer el bot al presupuestar por WhatsApp. Los productos marcados aquí se envían como recomendados automáticamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* ADD RECOMMENDATION PANEL */}
            {showAddSection && (
                <div className="mx-6 mb-6 p-6 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 rounded-2xl animate-in slide-in-from-top duration-300">
                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">
                        Buscar Producto para Recomendar
                    </h3>
                    <div className="relative mb-4">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Buscar en el catálogo general (ej: clipon, sygnus, varilux)..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                        <Search className="w-5 h-5 text-stone-400 absolute left-4 top-3.5" />
                        {searching && <Loader2 className="w-5 h-5 text-indigo-500 absolute right-4 top-3.5 animate-spin" />}
                    </div>

                    {searchResults.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto space-y-2 border border-stone-100 dark:border-stone-800 rounded-xl p-3 bg-white dark:bg-stone-950">
                            {searchResults.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 border border-stone-50 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900 rounded-xl transition-all">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{item.name}</span>
                                            <span className="px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 text-[8px] font-black rounded uppercase text-stone-500">
                                                {item.category}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-stone-500 font-bold mt-0.5">
                                            Precio: ${item.priceCash?.toLocaleString('es-AR')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleToggleRecommend(item)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${item.botRecommended
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                            : 'bg-indigo-500 text-white hover:scale-105 shadow-md shadow-indigo-500/10'
                                            }`}
                                    >
                                        {item.botRecommended ? (
                                            <>
                                                <Check className="w-3.5 h-3.5" /> Recomendado
                                            </>
                                        ) : (
                                            'Recomendar'
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : searchQuery.trim() ? (
                        <p className="text-center text-xs font-bold text-stone-400 py-4">No se encontraron productos en el inventario.</p>
                    ) : null}
                </div>
            )}

            {/* LIST */}
            <div className="px-6 pb-4">
                <div className="flex gap-2 overflow-x-auto pb-4 hide-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filterCategory === cat
                                ? 'bg-indigo-500 text-white shadow-md'
                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="relative p-5 border-2 border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 rounded-2xl hover:border-indigo-500/30 transition-all group">
                            
                            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-1.5 bg-stone-100 text-stone-500 rounded-lg hover:text-red-500 transition-all"
                                    title="Quitar recomendación"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600">
                                    {item.category}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600" title="Proviene de Inventario">
                                    SISTEMA
                                </span>
                            </div>
                            
                            <h3 className="font-bold text-sm text-stone-800 dark:text-white leading-tight mb-3 pr-10" title={item.name}>
                                {item.name}
                            </h3>

                            <div className="space-y-1">
                                <p className="text-xs font-medium text-stone-500 flex justify-between">
                                    <span>Contado:</span>
                                    <span className="font-bold text-stone-800 dark:text-emerald-400">
                                        ${item.priceCash?.toLocaleString('es-AR')}
                                    </span>
                                </p>
                            </div>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full py-12 text-center">
                            <Tag className="w-8 h-8 text-stone-200 mx-auto mb-3" />
                            <p className="text-xs font-bold text-stone-400">No hay recomendados en esta categoría.</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
