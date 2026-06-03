'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, CheckCircle2, AlertCircle, Save, X, Palette, Droplet, Loader2, ArrowRight } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';

export default function TratamientosPage() {
    const [activeTab, setActiveTab] = useState<'tratamientos' | 'colores'>('tratamientos');

    // -- State for Colors --
    const [colors, setColors] = useState<any[]>([]);
    const [loadingColors, setLoadingColors] = useState(false);
    const [colorForm, setColorForm] = useState({ id: '', name: '', category: 'COMPACTO', hexColor: '#000000', sortOrder: 0, active: true });
    const [showColorForm, setShowColorForm] = useState(false);
    const [savingColor, setSavingColor] = useState(false);

    // -- State for Treatments (Products) --
    const { products: rawProducts, loading: loadingProducts, refresh: refreshProducts, deleteProduct } = useProducts('', 'Tratamiento');
    const [treatForm, setTreatForm] = useState({ id: '', name: '', price: 0, cost: 0 });
    const [showTreatForm, setShowTreatForm] = useState(false);
    const [savingTreat, setSavingTreat] = useState(false);

    const loadColors = async () => {
        setLoadingColors(true);
        try {
            const res = await fetch('/api/crystal-colors');
            const data = await res.json();
            if (Array.isArray(data)) setColors(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingColors(false);
        }
    };

    useEffect(() => {
        loadColors();
    }, []);

    const handleSaveColor = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingColor(true);
        try {
            const method = colorForm.id ? 'PATCH' : 'POST';
            const url = colorForm.id ? `/api/crystal-colors/${colorForm.id}` : '/api/crystal-colors';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(colorForm)
            });

            if (res.ok) {
                setShowColorForm(false);
                setColorForm({ id: '', name: '', category: 'COMPACTO', hexColor: '#000000', sortOrder: 0, active: true });
                loadColors();
            } else {
                const data = await res.json();
                alert(data.error || 'Error al guardar el color');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            setSavingColor(false);
        }
    };

    const handleDeleteColor = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el color "${name}"?`)) return;
        try {
            const res = await fetch(`/api/crystal-colors/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadColors();
            } else {
                alert('Error al eliminar');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    const handleSaveTreat = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingTreat(true);
        try {
            const method = treatForm.id ? 'PUT' : 'POST';
            const url = treatForm.id ? `/api/products/${treatForm.id}` : '/api/products';
            
            const payload = {
                name: treatForm.name,
                type: 'Tratamiento',
                category: 'Tratamiento',
                price: treatForm.price,
                cost: treatForm.cost,
                stock: 0,
                unitType: 'PAR'
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setShowTreatForm(false);
                setTreatForm({ id: '', name: '', price: 0, cost: 0 });
                refreshProducts();
            } else {
                const data = await res.json();
                alert(data.error || data.details || 'Error al guardar tratamiento');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            setSavingTreat(false);
        }
    };

    const handleDeleteTreat = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar tratamiento "${name}"?`)) return;
        const result = await deleteProduct(id);
        if (!result.success) alert(result.error);
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
                        Tratamientos y <span className="text-primary border-b-4 border-primary/30 not-italic">Colores</span>
                    </h1>
                    <p className="text-stone-400 mt-1 font-medium uppercase text-[10px] tracking-widest">
                        Gestioná servicios como Antirayas, Teñidos y la paleta de colores.
                    </p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-stone-200 dark:border-stone-800 pb-px">
                <button
                    onClick={() => setActiveTab('tratamientos')}
                    className={`flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all border-b-2 ${activeTab === 'tratamientos' ? 'border-primary text-primary' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    <Droplet className="w-4 h-4" /> Tratamientos
                </button>
                <button
                    onClick={() => setActiveTab('colores')}
                    className={`flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest transition-all border-b-2 ${activeTab === 'colores' ? 'border-primary text-primary' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    <Palette className="w-4 h-4" /> Colores de Cristal
                </button>
            </div>

            {/* Content: Tratamientos */}
            {activeTab === 'tratamientos' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                        <div>
                            <p className="text-sm font-black text-blue-900 dark:text-blue-300">Servicios y Tratamientos</p>
                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Ej: Antirayas, Antireflejo, Teñido. Se pueden agregar al carrito desde el cotizador.</p>
                        </div>
                        <button
                            onClick={() => {
                                setTreatForm({ id: '', name: '', price: 0, cost: 0 });
                                setShowTreatForm(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Nuevo
                        </button>
                    </div>

                    <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-[3fr_1fr_1fr_100px] gap-4 px-6 py-4 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Nombre</div>
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Costo</div>
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Precio</div>
                            <div className="text-center text-[10px] font-black text-stone-400 uppercase tracking-widest">Acciones</div>
                        </div>
                        <div className="divide-y divide-stone-100 dark:divide-stone-800">
                            {loadingProducts ? (
                                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            ) : rawProducts.length === 0 ? (
                                <div className="py-12 text-center text-stone-400 text-xs font-bold uppercase tracking-widest">No hay tratamientos cargados</div>
                            ) : (
                                rawProducts.map(t => (
                                    <div key={t.id} className="grid grid-cols-[3fr_1fr_1fr_100px] gap-4 px-6 py-4 items-center hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                                        <div className="font-bold text-stone-800 dark:text-stone-100">{t.name}</div>
                                        <div className="text-right font-bold text-stone-400">${t.cost?.toLocaleString()}</div>
                                        <div className="text-right font-black text-stone-800 dark:text-stone-100">${t.price?.toLocaleString()}</div>
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => {
                                                setTreatForm({ id: t.id, name: t.name || '', price: t.price || 0, cost: t.cost || 0 });
                                                setShowTreatForm(true);
                                            }} className="p-2 text-stone-400 hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteTreat(t.id, t.name || '')} className="p-2 text-stone-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Content: Colores */}
            {activeTab === 'colores' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                        <div>
                            <p className="text-sm font-black text-emerald-900 dark:text-emerald-300">Paleta de Colores de Cristales</p>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Opciones que el cliente puede elegir al pedir un tratamiento de Teñido.</p>
                        </div>
                        <button
                            onClick={() => {
                                setColorForm({ id: '', name: '', category: 'COMPACTO', hexColor: '#000000', sortOrder: 0, active: true });
                                setShowColorForm(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Nuevo Color
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loadingColors ? (
                            <div className="col-span-full py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
                        ) : colors.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-stone-400 text-xs font-bold uppercase tracking-widest">No hay colores cargados</div>
                        ) : (
                            colors.map(c => (
                                <div key={c.id} className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 flex items-center gap-4 hover:shadow-md transition-all group">
                                    <div className="w-12 h-12 rounded-full border-4 border-stone-50 dark:border-stone-800 shadow-sm shrink-0" style={{ backgroundColor: c.hexColor || '#eee' }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-sm text-stone-800 dark:text-stone-100 truncate">{c.name}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[8px] font-black uppercase tracking-widest bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-0.5 rounded-md">{c.category}</span>
                                            {!c.active && <span className="text-[8px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-md">Inactivo</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setColorForm(c); setShowColorForm(true); }} className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteColor(c.id, c.name)} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showTreatForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 md:p-8 flex justify-between items-center border-b border-stone-100 dark:border-stone-800">
                            <div>
                                <h3 className="text-lg font-black text-stone-800 dark:text-white italic tracking-tight">{treatForm.id ? 'Editar' : 'Nuevo'} <span className="text-primary not-italic">Tratamiento</span></h3>
                            </div>
                            <button onClick={() => setShowTreatForm(false)} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-stone-200 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSaveTreat} className="p-6 md:p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Nombre</label>
                                <input required type="text" value={treatForm.name} onChange={e => setTreatForm({ ...treatForm, name: e.target.value })} placeholder="Ej: Teñido Compacto" className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Costo ($)</label>
                                    <input required type="number" value={treatForm.cost} onChange={e => setTreatForm({ ...treatForm, cost: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-3">Precio Venta ($)</label>
                                    <input required type="number" value={treatForm.price || ''} onChange={e => setTreatForm({ ...treatForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-primary/5 border border-primary/20 rounded-2xl font-black text-lg outline-none focus:border-primary text-primary" />
                                </div>
                            </div>
                            <button disabled={savingTreat} className="w-full py-5 bg-stone-900 text-white dark:bg-primary dark:text-primary-foreground rounded-2xl font-black uppercase tracking-widest hover:opacity-90 flex justify-center items-center gap-2 mt-4">
                                {savingTreat ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar Tratamiento</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showColorForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 md:p-8 flex justify-between items-center border-b border-stone-100 dark:border-stone-800">
                            <div>
                                <h3 className="text-lg font-black text-stone-800 dark:text-white italic tracking-tight">{colorForm.id ? 'Editar' : 'Nuevo'} <span className="text-emerald-600 not-italic">Color</span></h3>
                            </div>
                            <button onClick={() => setShowColorForm(false)} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-stone-200 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <form onSubmit={handleSaveColor} className="p-6 md:p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Nombre del Color</label>
                                <input required type="text" value={colorForm.name} onChange={e => setColorForm({ ...colorForm, name: e.target.value })} placeholder="Ej: Sepia" className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Categoría</label>
                                    <select value={colorForm.category} onChange={e => setColorForm({ ...colorForm, category: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-emerald-500">
                                        <option value="COMPACTO">Compacto</option>
                                        <option value="DEGRADEE">Degradée</option>
                                        <option value="ESPEJADO">Espejado</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Color Hex</label>
                                    <div className="flex items-center gap-2 px-3 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl">
                                        <input type="color" value={colorForm.hexColor || '#000000'} onChange={e => setColorForm({ ...colorForm, hexColor: e.target.value })} className="w-8 h-8 rounded-full border-none p-0 cursor-pointer" />
                                        <input type="text" value={colorForm.hexColor || ''} onChange={e => setColorForm({ ...colorForm, hexColor: e.target.value })} className="flex-1 bg-transparent border-none outline-none font-bold text-xs uppercase" />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group w-max">
                                    <div className={`relative w-10 h-6 rounded-full transition-colors ${colorForm.active ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${colorForm.active ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                    <input type="checkbox" className="hidden" checked={colorForm.active} onChange={e => setColorForm({ ...colorForm, active: e.target.checked })} />
                                    <span className="text-xs font-black text-stone-600 dark:text-stone-300 uppercase tracking-widest">Activo</span>
                                </label>
                            </div>
                            <button disabled={savingColor} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:opacity-90 flex justify-center items-center gap-2 mt-4">
                                {savingColor ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar Color</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
