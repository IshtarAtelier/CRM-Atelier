'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search, X, User, Package, ShoppingCart, Loader2,
    ArrowRight, Command, Stethoscope, Phone, Hash
} from 'lucide-react';

interface SearchContact {
    id: string; name: string; phone: string; status: string; doctor: string | null;
}
interface SearchProduct {
    id: string; name: string; type: string; price: number; stock: number;
}
interface SearchOrder {
    id: string; clientName: string; total: number; orderType: string; date: string;
}

const STATUS_COLORS: Record<string, string> = {
    CONTACT: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    CONFIRMED: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    CLIENT: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
};

const STATUS_LABELS: Record<string, string> = {
    CONTACT: 'Contacto',
    CONFIRMED: 'Confirmado',
    CLIENT: 'Cliente',
};

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [contacts, setContacts] = useState<SearchContact[]>([]);
    const [products, setProducts] = useState<SearchProduct[]>([]);
    const [orders, setOrders] = useState<SearchOrder[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const totalResults = contacts.length + products.length + orders.length;

    // Ctrl+K / Cmd+K handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setContacts([]);
            setProducts([]);
            setOrders([]);
            setSelectedIndex(0);
        }
    }, [open]);

    // Debounced search
    const doSearch = useCallback(async (q: string) => {
        if (q.length < 2) {
            setContacts([]); setProducts([]); setOrders([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setContacts(data.contacts || []);
            setProducts(data.products || []);
            setOrders(data.orders || []);
            setSelectedIndex(0);
        } catch { }
        setLoading(false);
    }, []);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 250);
    };

    // Build flat list for keyboard navigation
    const allItems: Array<{ type: string; id: string; navigate: () => void }> = [
        ...contacts.map(c => ({ type: 'contact', id: c.id, navigate: () => { router.push(`/contactos?id=${c.id}`); setOpen(false); } })),
        ...products.map(p => ({ type: 'product', id: p.id, navigate: () => { router.push('/inventario'); setOpen(false); } })),
        ...orders.map(o => ({ type: 'order', id: o.id, navigate: () => { router.push('/ventas'); setOpen(false); } })),
    ];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && allItems[selectedIndex]) {
            e.preventDefault();
            allItems[selectedIndex].navigate();
        }
    };

    if (!open) return null;

    let flatIdx = -1;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border-2 border-stone-200 dark:border-stone-700 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-200">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-stone-100 dark:border-stone-800">
                    <Search className="w-5 h-5 text-stone-300 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar contactos, productos, ventas..."
                        value={query}
                        onChange={e => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 text-sm font-medium bg-transparent outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600"
                    />
                    {loading && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                    <kbd className="hidden md:flex items-center gap-1 px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-[10px] font-bold text-stone-400 border border-stone-200 dark:border-stone-700">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[55vh] overflow-y-auto">
                    {query.length < 2 ? (
                        <div className="p-8 text-center">
                            <Command className="w-10 h-10 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                            <p className="text-xs font-bold text-stone-300 dark:text-stone-600">
                                Escribí al menos 2 caracteres para buscar
                            </p>
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <span className="text-[10px] text-stone-300 flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[9px] font-bold border border-stone-200 dark:border-stone-700">↑↓</kbd>
                                    navegar
                                </span>
                                <span className="text-[10px] text-stone-300 flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[9px] font-bold border border-stone-200 dark:border-stone-700">Enter</kbd>
                                    abrir
                                </span>
                            </div>
                        </div>
                    ) : totalResults === 0 && !loading ? (
                        <div className="p-8 text-center">
                            <Search className="w-10 h-10 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                            <p className="text-xs font-bold text-stone-300 dark:text-stone-600">
                                Sin resultados para &quot;{query}&quot;
                            </p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {/* Contacts */}
                            {contacts.length > 0 && (
                                <div>
                                    <p className="px-5 py-2 text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" /> Contactos ({contacts.length})
                                    </p>
                                    {contacts.map(c => {
                                        flatIdx++;
                                        const idx = flatIdx;
                                        return (
                                            <button
                                                key={c.id}
                                                onClick={() => { router.push(`/contactos?id=${c.id}`); setOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all ${idx === selectedIndex
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate">{c.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {c.phone && <span className="text-[10px] text-stone-400 flex items-center gap-0.5"><Phone className="w-3 h-3" /> {c.phone}</span>}
                                                        {c.doctor && <span className="text-[10px] text-teal-500 flex items-center gap-0.5"><Stethoscope className="w-3 h-3" /> {c.doctor}</span>}
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${STATUS_COLORS[c.status] || 'bg-stone-100 text-stone-500'}`}>
                                                    {STATUS_LABELS[c.status] || c.status}
                                                </span>
                                                <ArrowRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Products */}
                            {products.length > 0 && (
                                <div>
                                    <p className="px-5 py-2 text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" /> Productos ({products.length})
                                    </p>
                                    {products.map(p => {
                                        flatIdx++;
                                        const idx = flatIdx;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => { router.push('/inventario'); setOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all ${idx === selectedIndex
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center flex-shrink-0">
                                                    <Package className="w-4 h-4 text-violet-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate">{p.name}</p>
                                                    <span className="text-[10px] text-stone-400">{p.type}</span>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-black">${p.price.toLocaleString()}</p>
                                                    <p className={`text-[10px] font-bold ${p.stock > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                        Stock: {p.stock}
                                                    </p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Orders */}
                            {orders.length > 0 && (
                                <div>
                                    <p className="px-5 py-2 text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <ShoppingCart className="w-3.5 h-3.5" /> Ventas ({orders.length})
                                    </p>
                                    {orders.map(o => {
                                        flatIdx++;
                                        const idx = flatIdx;
                                        return (
                                            <button
                                                key={o.id}
                                                onClick={() => { router.push('/ventas'); setOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all ${idx === selectedIndex
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0">
                                                    <ShoppingCart className="w-4 h-4 text-emerald-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate">{o.clientName}</p>
                                                    <span className={`text-[10px] font-bold ${o.orderType === 'SALE' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                        {o.orderType === 'SALE' ? 'Venta' : 'Presupuesto'}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-black flex-shrink-0">${o.total.toLocaleString()}</p>
                                                <ArrowRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t-2 border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-300">
                        {totalResults > 0 ? `${totalResults} resultados` : 'Búsqueda global'}
                    </span>
                    <span className="text-[10px] text-stone-300 flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[9px] font-bold border border-stone-200 dark:border-stone-700">Ctrl</kbd>
                        +
                        <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-[9px] font-bold border border-stone-200 dark:border-stone-700">K</kbd>
                    </span>
                </div>
            </div>
        </div>
    );
}
