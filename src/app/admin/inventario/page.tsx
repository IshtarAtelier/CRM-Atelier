'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Loader2, AlertCircle, ArrowUpRight, Trash2, ShoppingBag, CheckSquare, Square, X, Pencil, Save, CheckCircle2, Zap, Camera, Clock, Database, Layers } from "lucide-react";
import { Product } from '@/hooks/useProducts';
import ProductForm from '@/components/inventory/ProductForm';
'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Package, Loader2, AlertCircle, ArrowUpRight, Trash2, ShoppingBag, CheckSquare, Square, X, Pencil, Save, CheckCircle2, Zap, Camera, Clock, Database, Layers } from "lucide-react";
import { Product } from '@/hooks/useProducts';
import ProductForm from '@/components/inventory/ProductForm';
import { resolveStorageUrl } from '@/lib/utils/storage';
import LabPriceImporter from '@/components/inventory/LabPriceImporter';
import AIImageUploader from '@/components/inventory/AIImageUploader';
import PhotoStudio from '@/components/inventory/PhotoStudio';
import SettingsModal from '@/components/inventory/SettingsModal';
import { useProducts } from '@/hooks/useProducts';
import { autoCorrectLab } from '@/utils/product-controllers';
import Image from "next/image";

                {/* Subtype filters — only when Cristal or Tratamiento is selected */}
                {(selectedCategory === 'Cristal' || selectedCategory === 'Tratamiento') && activeCategory?.subtypes && (
                    <div className="inline-flex flex-wrap items-center gap-2 bg-stone-100/50 dark:bg-stone-800/50 backdrop-blur-md p-1.5 rounded-full border border-stone-200/50 dark:border-stone-700/50 w-max animate-in fade-in slide-in-from-top-2 duration-300">
                        <button
                            onClick={() => setSelectedSubtype('')}
                            className={`relative px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${!selectedSubtype
                                ? 'text-primary'
                                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                                }`}
                        >
                            {!selectedSubtype && <div className="absolute inset-0 bg-white dark:bg-stone-600 rounded-full shadow-sm -z-10" />}
                            Todos
                        </button>
                        {activeCategory.subtypes.map(sub => {
                            const isActive = selectedSubtype === sub;
                            return (
                                <button
                                    key={sub}
                                    onClick={() => setSelectedSubtype(sub)}
                                    className={`relative px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${isActive
                                        ? 'text-stone-900 dark:text-white'
                                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                                        }`}
                                >
                                    {isActive && <div className="absolute inset-0 bg-white dark:bg-stone-600 rounded-full shadow-sm -z-10" />}
                                    {sub}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Origin filter — only for Cristal */}
                {selectedCategory === 'Cristal' && (
                    <div className="inline-flex flex-wrap items-center gap-2 bg-stone-100/50 dark:bg-stone-800/50 backdrop-blur-md p-1.5 rounded-full border border-stone-200/50 dark:border-stone-700/50 w-max animate-in fade-in slide-in-from-top-2 duration-300">
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest px-2">Origen:</span>
                        {['', 'LABORATORIO', 'STOCK'].map(origin => {
                            const isActive = selectedOrigin === origin;
                            const label = origin === '' ? 'Todos' : origin === 'LABORATORIO' ? 'Laboratorio' : 'Stock y Rango Extendido';
                            return (
                                <button
                                    key={origin}
                                    onClick={() => setSelectedOrigin(origin)}
                                    className={`relative px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${isActive
                                        ? 'text-stone-900 dark:text-white'
                                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                                        }`}
                                >
                                    {isActive && <div className="absolute inset-0 bg-white dark:bg-stone-600 rounded-full shadow-sm -z-10" />}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}

            {/* Advanced Filters: Brand and Lab */}
            <div className="flex flex-wrap gap-3 items-center animate-in fade-in slide-in-from-top-2 duration-300">
                {uniqueBrands.length > 1 && (
                    <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 p-1.5 rounded-2xl border border-stone-200/50 dark:border-stone-700/50">
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest pl-2">Marca:</span>
                        <select 
                            value={selectedBrand} 
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold px-3 py-1.5 rounded-xl outline-none focus:border-primary cursor-pointer text-stone-700 dark:text-stone-300"
                        >
                            <option value="">Todas</option>
                            {uniqueBrands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>
                    </div>
                )}

                {uniqueLabs.length > 1 && (
                    <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 p-1.5 rounded-2xl border border-stone-200/50 dark:border-stone-700/50">
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest pl-2">Laboratorio:</span>
                        <select 
                            value={selectedLab} 
                            onChange={(e) => setSelectedLab(e.target.value)}
                            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-bold px-3 py-1.5 rounded-xl outline-none focus:border-primary cursor-pointer text-stone-700 dark:text-stone-300"
                        >
                            <option value="">Todos</option>
                            {uniqueLabs.map(lab => (
                                <option key={lab} value={lab}>{lab}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            </div>

            {/* Product List or Colors UI */}
            {selectedCategory === 'Tratamiento' && selectedSubtype === 'Colores de Cristal' ? (
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
            ) : (
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
                                    <div className="flex items-center gap-3 min-w-0 py-1">
                                        {(() => {
                                            const imgUrl = resolveStorageUrl(p.imagenesCatalogo?.[0] || p.rawImageUrls?.[0] || null);
                                            if (imgUrl) {
                                                return (
                                                    <Image 
                                                        src={imgUrl} 
                                                        alt={p.name || ''} 
                                                        className="w-10 h-10 object-contain rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 shadow-sm shrink-0" 
                                                    />
                                                );
                                            }
                                            return (
                                                <div className="w-10 h-10 rounded-lg border border-stone-150 dark:border-stone-850 bg-stone-50/50 dark:bg-stone-900/50 flex items-center justify-center shrink-0 text-stone-300 dark:text-stone-750">
                                                    <Package className="w-4 h-4" strokeWidth={1.5} />
                                                </div>
                                            );
                                        })()}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-sm text-stone-800 dark:text-stone-100 italic tracking-tight truncate">
                                                {getDisplayName(p as Product)}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${isCristal ? 'bg-violet-100 text-violet-600' : 'bg-stone-100 text-stone-400'}`}>
                                                    {isCristal ? '🔬 Cristal' : p.category || p.type}
                                                </span>
                                                {p.publishToWeb && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-0.5 inline-block bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 ml-1.5">
                                                        🌐 Web
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-center"><span className="text-[9px] font-black uppercase bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg text-stone-600 dark:text-stone-400 whitespace-nowrap">{p.type || '-'}</span></div>
                                    <div className="flex justify-center">{p.lensIndex ? <span className="text-[9px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg">{p.lensIndex}</span> : <span className="text-stone-300">-</span>}</div>
                                    <div className="text-right pr-4 shrink-0 flex items-center justify-end gap-2">
                                        {p.is2x1 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">2x1</span>}
                                        {isRequestedToLab(p) ? <span className="text-[9px] font-black text-violet-600 bg-violet-50 dark:bg-violet-950/30 px-2 py-1 rounded-lg inline-block">{p.laboratory || 'A Pedido'}</span> : <span className={`text-sm font-black ${p.stock <= 2 ? 'text-red-500' : 'text-stone-800 dark:text-stone-200'}`}>{p.stock}</span>}
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
                                                            try {
                                                                await fetch(`/api/products/${p.id}`, {
                                                                    method: 'PUT',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ price: newPrice })
                                                                });
                                                                refresh();
                                                            } catch (err) { console.error('Error updating price:', err); }
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
                                            <span className="text-[8px] font-black bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded-full">STOCK: {isRequestedToLab(p) ? (p.laboratory || 'A Pedido') : p.stock}</span>
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
            )}

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
                    <div className="bg-white dark:bg-stone-900 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[3rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300">
                        <header className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-stone-800 dark:text-white tracking-tighter italic">Editar <span className="text-primary not-italic">{editingProduct.name || editingProduct.type}</span></h2>
                                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">{editingProduct.type || editingProduct.category}</p>
                            </div>
                            <button onClick={() => setEditingProduct(null)} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-colors">
                                <X className="w-5 h-5 text-stone-400" />
                            </button>
                        </header>
                        <div className="p-6 md:p-8 space-y-5 overflow-y-auto flex-1 no-scrollbar">
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
                                    <>
                                        {/* Origen del Cristal - Solo para Monofocales (SmartLab / Grupo Optico) */}
                                        {editForm.type === 'Cristal Monofocal' && (
                                            <div className="col-span-2 space-y-3 pb-2">
                                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Origen del Cristal</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button type="button" onClick={() => setEditForm({ ...editForm, origin: 'LABORATORIO' })} className={`py-4 px-4 rounded-2xl border-2 font-black text-xs uppercase tracking-tight flex items-center justify-center gap-2 transition-all ${editForm.origin === 'LABORATORIO' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-300'}`}>
                                                    <Database className="w-4 h-4" /> Laboratorio
                                                </button>
                                                <button type="button" onClick={() => setEditForm({ ...editForm, origin: 'STOCK' })} className={`py-4 px-4 rounded-2xl border-2 font-black text-xs uppercase tracking-tight flex items-center justify-center gap-2 transition-all ${editForm.origin === 'STOCK' ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 hover:border-stone-300'}`}>
                                                    <Layers className="w-4 h-4" /> Stock / Rango
                                                </button>
                                            </div>
                                            </div>
                                        )}
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
                                    </>
                                )}
                                {!checkCristal(editingProduct) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Modelo</label>
                                        <input type="text" value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                    </div>
                                )}
                                {/* Ocultar stock para cristales y tratamientos — se piden bajo demanda */}
                                {!isRequestedToLab({ ...editingProduct, origin: editForm.origin } as any) && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Stock</label>
                                        <input type="number" min={0} value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })} className="w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl font-bold text-sm outline-none focus:border-primary" />
                                    </div>
                                )}
                                {isAdmin && (
                                <div className="space-y-1 relative">
                                    <div className="flex items-center justify-between mr-2">
                                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-3">Costo ($)</label>
                                        {checkCristal(editingProduct) && editForm.laboratory && (
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const lab = labsConfig.find(l => l.name === editForm.laboratory);
                                                    const calibrado = lab?.calibrado || 0;
                                                    const iva = lab?.iva || 0;
                                                    const is2x1 = editForm.is2x1 || editForm.name.toLowerCase().includes('2x1');
                                                    const calibradoTotal = is2x1 ? (calibrado * 2) : calibrado;
                                                    const finalCost = Math.round(((parseFloat(String(editForm.cost)) || 0) + calibradoTotal) * (1 + iva / 100));
                                                    setEditForm({ ...editForm, cost: finalCost });
                                                }}
                                                className="text-[9px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                                title="Ingresa el Costo Base pelado y presiona aquí para aplicar la fórmula del Laboratorio (Suma Calibrados + IVA)"
                                            >
                                                <Zap className="w-3 h-3" /> Calcular Final
                                            </button>
                                        )}
                                    </div>
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
                                        
                                        {labsConfig.length > 0 ? (
                                            <select 
                                                value={editForm.laboratory}
                                                onChange={e => setEditForm({ ...editForm, laboratory: e.target.value })}
                                                className={`w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border rounded-2xl font-bold text-sm outline-none focus:border-primary uppercase cursor-pointer ${!editForm.laboratory ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`}
                                            >
                                                <option value="">Seleccionar laboratorio...</option>
                                                {labsConfig.map(l => (
                                                    <option key={l.name} value={l.name}>{l.name}</option>
                                                ))}
                                                <option value="OTRO">OTRO</option>
                                            </select>
                                        ) : (
                                            <input type="text" required placeholder="Ej: OPTOVISION" value={editForm.laboratory} 
                                                onChange={e => setEditForm({ ...editForm, laboratory: e.target.value.toUpperCase() })} 
                                                onBlur={() => setEditForm({ ...editForm, laboratory: autoCorrectLab(editForm.laboratory) || "" })}
                                                className={`w-full px-5 py-4 bg-stone-50 dark:bg-stone-800 border rounded-2xl font-bold text-sm outline-none focus:border-primary uppercase ${!editForm.laboratory ? 'border-red-300 dark:border-red-700' : 'border-stone-200 dark:border-stone-700'}`} 
                                            />
                                        )}
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
                                
                                {/* AI Image Uploader para Armazones/Sol/Especiales */}
                                {!checkCristal(editingProduct) && (
                                    <div className="col-span-2 space-y-4">
                                        <AIImageUploader 
                                            productId={editingProduct.id}
                                            initialStatus={editingProduct.imageProcessingStatus || 'IDLE'}
                                            initialImages={editingProduct.imagenesCatalogo || []}
                                            onSuccess={() => refresh()}
                                        />
                                        
                                        <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
                                            <label className="flex items-center gap-3 cursor-pointer group w-max">
                                                <div className={`relative w-10 h-6 rounded-full transition-colors ${editForm.publishToWeb ? 'bg-violet-500' : 'bg-stone-300 dark:bg-stone-700'}`}>
                                                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${editForm.publishToWeb ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={editForm.publishToWeb} onChange={e => setEditForm({ ...editForm, publishToWeb: e.target.checked })} />
                                                <div>
                                                    <p className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-widest">Publicar en Tienda Web</p>
                                                    <p className="text-[9px] font-bold text-stone-400">Si está activo, el producto aparecerá en el catálogo público online.</p>
                                                </div>
                                            </label>
                                        </div>

                                        {/* Medidas del Armazón */}
                                        <div className="border border-stone-100 dark:border-stone-800 rounded-2xl p-4 space-y-3">
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Medidas del Armazón (mm)</p>
                                            {/* Mini SVG estático */}
                                            <svg viewBox="0 0 200 60" width="100%" className="opacity-40">
                                                <rect x="10" y="10" width="70" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                                                <rect x="120" y="10" width="70" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                                                <path d="M 80 20 C 90 8, 110 8, 120 20" fill="none" stroke="currentColor" strokeWidth="2"/>
                                                <line x1="10" y1="30" x2="0" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                <line x1="190" y1="30" x2="200" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                <text x="45" y="7" textAnchor="middle" fontSize="7" fill="currentColor">{editForm.lensWidth || '□'}mm</text>
                                                <text x="100" y="9" textAnchor="middle" fontSize="6" fill="currentColor">{editForm.bridgeWidth || '□'}</text>
                                                <text x="155" y="7" textAnchor="middle" fontSize="7" fill="currentColor">{editForm.frameHeight || '□'}mm</text>
                                            </svg>
                                            <div className="grid grid-cols-4 gap-2">
                                                {[{field: 'lensWidth', label: 'Lente'},{field: 'bridgeWidth', label: 'Puente'},{field: 'templeLength', label: 'Varilla'},{field: 'frameHeight', label: 'Alto'}].map(({field, label}) => (
                                                    <div key={field} className="space-y-1">
                                                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">{label}</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={(editForm as any)[field]}
                                                                onChange={e => setEditForm({...editForm, [field]: e.target.value})}
                                                                placeholder="—"
                                                                className="w-full bg-stone-100 dark:bg-stone-800 rounded-xl px-3 py-2 text-sm font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/40"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-stone-400 font-bold">mm</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* --- SEO & Google Shopping Form (Edit) --- */}
                            {editForm.publishToWeb && (
                                <div className="mt-6 p-6 bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 rounded-3xl space-y-5">
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
                                            onClick={handleGenerateSEOEdit}
                                            disabled={generatingSEOEdit}
                                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {generatingSEOEdit ? 'Generando...' : '✨ Generar con IA'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Título SEO</label>
                                            <input type="text" placeholder="Ej: Anteojos de Sol Ray-Ban Aviator"
                                                maxLength={70}
                                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                                                value={editForm.seoTitle || ''} onChange={e => setEditForm({ ...editForm, seoTitle: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Slug</label>
                                            <input type="text" placeholder="Ej: ray-ban-aviator-negro"
                                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                                                value={editForm.customSlug || ''} onChange={e => setEditForm({ ...editForm, customSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Descripción SEO (Max 160 char)</label>
                                            <textarea placeholder="Persuasiva, resalta beneficios e inmediatez..."
                                                maxLength={160} rows={2}
                                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all resize-none"
                                                value={editForm.seoDescription || ''} onChange={e => setEditForm({ ...editForm, seoDescription: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Tags</label>
                                            <input type="text" placeholder="Ej: polarizadas, filtro UV, anteojos de sol, vintage"
                                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                                                value={editForm.seoTags || ''} onChange={e => setEditForm({ ...editForm, seoTags: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">MPN</label>
                                            <input type="text" placeholder="Ej: RB3025"
                                                className="w-full px-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                                                value={editForm.mpn || ''} onChange={e => setEditForm({ ...editForm, mpn: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Edad</label>
                                                <select className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                                                    value={editForm.ageGroup || ''} onChange={e => setEditForm({ ...editForm, ageGroup: e.target.value })}>
                                                    <option value="">Sel...</option>
                                                    <option value="Adulto">Adulto</option>
                                                    <option value="Niños">Niños</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Género</label>
                                                <select className="w-full px-3 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                                                    value={editForm.gender || ''} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}>
                                                    <option value="">Sel...</option>
                                                    <option value="Femenino">Femenino</option>
                                                    <option value="Masculino">Masculino</option>
                                                    <option value="Unisex">Unisex</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 pt-4 shrink-0 mt-4">
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

            {/* Photo Studio Modal */}
            {showPhotoStudio && (
                <PhotoStudio
                    onClose={() => setShowPhotoStudio(false)}
                    onSuccess={() => { refresh(); setShowPhotoStudio(false); }}
                    products={rawProducts}
                    isAdmin={isAdmin}
                    uniqueBrands={uniqueBrands}
                />
            )}
            {/* Settings Modal */}
            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                />
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
