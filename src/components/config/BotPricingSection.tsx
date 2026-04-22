'use client';

import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, Save, X, Loader2, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

interface PricingItem {
    id: string;
    source: 'PRODUCT' | 'SERVICE';
    name: string;
    category: string;
    subcategory?: string;
    priceCash: number;
    priceCredit?: number;
    creditMonths?: number;
    notes?: string;
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

    // Formulario de creación/edición de SERVICE
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'MULTIFOCAL',
        subcategory: '',
        priceCash: '',
        priceCredit: '',
        creditMonths: '6',
        notes: ''
    });

    useEffect(() => {
        fetchPricing();
    }, []);

    const fetchPricing = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/bot/pricing?all=1');
            const data = await res.json();
            setItems(data);
        } catch (error) {
            console.error('Error fetching pricing:', error);
            setMessage({ type: 'error', text: 'Error al cargar los precios.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.category || !formData.priceCash) {
            setMessage({ type: 'error', text: 'Nombre, categoría y precio contado son obligatorios.' });
            return;
        }

        try {
            const url = '/api/bot/pricing';
            const method = editingId ? 'PUT' : 'POST';
            const body = {
                ...formData,
                id: editingId,
                priceCash: Number(formData.priceCash),
                priceCredit: Number(formData.priceCredit) || undefined,
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Precio guardado exitosamente' });
                setShowForm(false);
                setEditingId(null);
                setFormData({ name: '', category: 'MULTIFOCAL', subcategory: '', priceCash: '', priceCredit: '', creditMonths: '6', notes: '' });
                fetchPricing();
            } else {
                setMessage({ type: 'error', text: 'Error al guardar precio' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error de red' });
        }
    };

    const handleDelete = async (id: string, source: string) => {
        if (!confirm('¿Seguro quieres desactivar este precio del bot?')) return;
        try {
            const res = await fetch(`/api/bot/pricing?id=${id}&source=${source}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Eliminado correctamente' });
                fetchPricing();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error al eliminar' });
        }
    };

    const categories = ['TODO', 'MONOFOCAL', 'MULTIFOCAL', 'BIFOCAL', 'ARMAZON', 'CONTACTO'];
    const filteredItems = items.filter(item => filterCategory === 'TODO' || item.category === filterCategory);

    return (
        <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Precios del Bot</h2>
                    <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                        {items.length} activos
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchPricing} className="p-2 text-stone-400 hover:text-indigo-500 transition-all" title="Actualizar">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', category: 'MULTIFOCAL', subcategory: '', priceCash: '', priceCredit: '', creditMonths: '6', notes: '' }); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-105 ${showForm
                            ? 'bg-stone-200 dark:bg-stone-600 text-stone-500'
                            : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancelar' : 'Agregar Precio/Promoción'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`mx-6 mt-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    <CheckCircle2 className="w-4 h-4" /> {message.text}
                </div>
            )}

            {/* INFO BANNER */}
            <div className="m-6 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-1">Precios Dinámicos para IA</p>
                        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 leading-relaxed">
                            Aquí se definen qué precios o servicios puede ofrecer el bot al presupuestar por WhatsApp. Los productos físicos marcados como "Recomendado por Bot" en Inventario aparecen aquí con una etiqueta verde.
                        </p>
                    </div>
                </div>
            </div>

            {/* CREATE / EDIT FORM */}
            {showForm && (
                <div className="mx-6 mb-6 p-6 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 rounded-2xl">
                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">
                        {editingId ? 'Editar Servicio / Promoción' : 'Nuevo Servicio / Promoción'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Nombre a mostrar al cliente</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: Varilux Comfort Max + Crizal Sapphire"
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Categoría General</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                            >
                                <option value="MULTIFOCAL">Multifocal</option>
                                <option value="MONOFOCAL">Monofocal</option>
                                <option value="BIFOCAL">Bifocal</option>
                                <option value="CONTACTO">Lentes de Contacto</option>
                                <option value="ARMAZON">Armazón/Marco</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Precio Contado ($)</label>
                            <input
                                type="number"
                                value={formData.priceCash}
                                onChange={e => setFormData({ ...formData, priceCash: e.target.value })}
                                placeholder="350000"
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Precio Financiado ($) (Opcional)</label>
                            <input
                                type="number"
                                value={formData.priceCredit}
                                onChange={e => setFormData({ ...formData, priceCredit: e.target.value })}
                                placeholder="Dejar vacío para cálculo auto"
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-1.5">Notas internas (Opcional - solo para el IA)</label>
                            <input
                                type="text"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Ej: Solo recomendado para esferas de hasta -4.00"
                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button
                            onClick={handleSave}
                            className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {editingId ? 'Guardar Cambios' : 'Crear Precio'}
                        </button>
                    </div>
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
                                {item.source === 'SERVICE' && (
                                    <button
                                        onClick={() => {
                                            setFormData({
                                                name: item.name, category: item.category, subcategory: item.subcategory || '',
                                                priceCash: String(item.priceCash), priceCredit: item.priceCredit ? String(item.priceCredit) : '',
                                                creditMonths: String(item.creditMonths || 6), notes: item.notes || ''
                                            });
                                            setEditingId(item.id);
                                            setShowForm(true);
                                        }}
                                        className="p-1.5 bg-stone-100 text-stone-500 rounded-lg hover:text-indigo-500"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(item.id, item.source)}
                                    className="p-1.5 bg-stone-100 text-stone-500 rounded-lg hover:text-red-500"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600">
                                    {item.category}
                                </span>
                                {item.source === 'PRODUCT' ? (
                                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600" title="Proviene del módulo Inventario">
                                        INV
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-600" title="Servicio manual">
                                        SRV
                                    </span>
                                )}
                            </div>
                            
                            <h3 className="font-bold text-sm text-stone-800 dark:text-white leading-tight mb-3 pr-16" title={item.name}>
                                {item.name}
                            </h3>

                            <div className="space-y-1">
                                <p className="text-xs font-medium text-stone-500 flex justify-between">
                                    <span>Contado:</span>
                                    <span className="font-bold text-stone-800 dark:text-emerald-400">
                                        ${item.priceCash?.toLocaleString('es-AR')}
                                    </span>
                                </p>
                                {item.priceCredit && (
                                    <p className="text-[10px] text-stone-400 flex justify-between">
                                        <span>Financiado ({item.creditMonths}c):</span>
                                        <span className="font-bold">${item.priceCredit.toLocaleString('es-AR')}</span>
                                    </p>
                                )}
                            </div>
                            {item.notes && (
                                <p className="mt-3 text-[10px] text-stone-400 bg-stone-50 dark:bg-stone-900 p-2 rounded-lg italic border border-stone-100">
                                    {item.notes}
                                </p>
                            )}
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full py-12 text-center">
                            <Tag className="w-8 h-8 text-stone-200 mx-auto mb-3" />
                            <p className="text-xs font-bold text-stone-400">No hay precios en esta categoría.</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
