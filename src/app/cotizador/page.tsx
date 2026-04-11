'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { 
    Search, 
    Calculator, 
    ShoppingBag, 
    Plus, 
    X, 
    Save, 
    Loader2, 
    History,
    ChevronDown,
    ChevronUp,
    User,
    Check,
    FileText,
    ChevronRight,
    RotateCcw,
    Copy,
    MessageCircle
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
import CotizadorCart from '@/components/quotes/CotizadorCart';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import { 
    isCrystal, 
    isMiPrimerVarilux, 
    getCategoryKey,
    isMultifocal2x1,
    safePrice,
    calculateQuoteTotals
} from '@/lib/promo-utils';
import { 
    Glasses, 
    Sun, 
    Eye, 
    Activity, 
    Box, 
    Watch, 
    Droplets, 
    Gem 
} from 'lucide-react';

const getTypeConfig = (type: string | null, category?: string | null) => {
    const key = getCategoryKey(type, category);
    switch (key) {
        case 'Armazón': return { icon: Glasses, label: 'Armazones', color: 'bg-amber-50 text-amber-600 border-amber-200' };
        case 'Cristal': return { icon: Eye, label: 'Cristales', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
        case 'Lente de sol': return { icon: Sun, label: 'Sol', color: 'bg-orange-50 text-orange-600 border-orange-200' };
        case 'Lente de contacto': return { icon: Activity, label: 'Contactología', color: 'bg-cyan-50 text-cyan-600 border-cyan-200' };
        case 'Accesorio': return { icon: Box, label: 'Accesorios', color: 'bg-stone-50 text-stone-600 border-stone-200' };
        case 'Reloj': return { icon: Watch, label: 'Relojería', color: 'bg-blue-50 text-blue-600 border-blue-200' };
        case 'Líquido / Solución': return { icon: Droplets, label: 'Líquidos', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' };
        case 'Joyería': return { icon: Gem, label: 'Joyería', color: 'bg-rose-50 text-rose-600 border-rose-200' };
        default: return { icon: Box, label: 'Otros', color: 'bg-stone-50 text-stone-400 border-stone-200' };
    }
};

interface Product {
    id: string;
    name: string | null;
    brand: string | null;
    model: string | null;
    type: string | null;
    price: number;
    stock: number;
    lensIndex?: string | null;
    description?: string | null;
    category?: string | null;
}

interface QuoteItem {
    product: Product;
    quantity: number;
    customPrice: number;
    eye?: 'OD' | 'OI';
}

function CotizadorPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('editId');

    // States
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState<string | null>(null);
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [markup, setMarkup] = useState(0);
    const [discountCash, setDiscountCash] = useState(20);
    const [discountTransfer, setDiscountTransfer] = useState(15);
    const [discountCard, setDiscountCard] = useState(0);
    const [cartExpanded, setCartExpanded] = useState(false);
    const [frameSource, setFrameSource] = useState<'OPTICA' | 'USUARIO' | null>(null);
    const [userFrameData, setUserFrameData] = useState({ brand: '', model: '', notes: '' });
    
    // Register flow
    const [showRegister, setShowRegister] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactSearching, setContactSearching] = useState(false);
    const [contactResults, setContactResults] = useState<any[]>([]);
    const [pendingContact, setPendingContact] = useState<{ id: string, name: string, phone?: string, prescriptions?: any[] } | null>(null);
    const [showNewContact, setShowNewContact] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');
    const [savingQuote, setSavingQuote] = useState(false);
    const [savedContact, setSavedContact] = useState<{ id: string, name: string } | null>(null);
    const [quotePrescriptionId, setQuotePrescriptionId] = useState<string | null>(null);
    const [previousQuotes, setPreviousQuotes] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Editing states
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(editId);

    const searchRef = useRef<HTMLInputElement>(null);
    const contactSearchRef = useRef<HTMLInputElement>(null);

    // Initial load
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/products');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setProducts(data);
                } else {
                    console.error('Error loading products:', data);
                    setProducts([]);
                }
                
                // If editing, load the quote
                if (editId) {
                    const quoteRes = await fetch(`/api/orders/${editId}`);
                    if (quoteRes.ok) {
                        const quote = await quoteRes.json();
                        setEditingQuoteId(editId);
                        
                        // Map items — API returns `price`, CotizadorCart expects `customPrice`
                        const mappedItems = quote.items.map((it: any, idx: number) => ({
                            product: it.product,
                            quantity: it.quantity,
                            customPrice: it.price,
                            eye: it.eye,
                            uid: Date.now() + idx
                        }));
                        setQuoteItems(mappedItems);
                        
                        // Restore pricing settings — fields are directly on the order object
                        setMarkup(quote.markup || 0);
                        setDiscountCash(quote.discountCash ?? 20);
                        setDiscountTransfer(quote.discountTransfer ?? 15);
                        setDiscountCard(quote.discountCard ?? 0);
                        
                        // Set frame source — API returns individual fields, not an object
                        if (quote.frameSource) setFrameSource(quote.frameSource);
                        setUserFrameData({
                            brand: quote.userFrameBrand || '',
                            model: quote.userFrameModel || '',
                            notes: quote.userFrameNotes || '',
                        });
                        
                        // Set contact
                        if (quote.contact) {
                            setPendingContact({
                                id: quote.contact.id,
                                name: quote.contact.name,
                                phone: quote.contact.phone,
                                prescriptions: quote.contact.prescriptions
                            });
                        }
                        
                        setCartExpanded(true);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [editId]);

    // Handle contact search
    useEffect(() => {
        if (!contactSearch.trim() || contactSearch.length < 2) {
            setContactResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setContactSearching(true);
            try {
                const res = await fetch(`/api/contacts?search=${encodeURIComponent(contactSearch)}`);
                const data = await res.json();
                setContactResults(data);
            } catch (err) {
                console.error(err);
            } finally {
                setContactSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [contactSearch]);

    // Filter logic
    const availableCategories = useMemo(() => {
        const types = new Set(products.map(p => getCategoryKey(p.type, p.category)));
        return Array.from(types).sort() as string[];
    }, [products]);

    const filtered = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !search || 
                p.name?.toLowerCase().includes(search.toLowerCase()) ||
                p.brand?.toLowerCase().includes(search.toLowerCase()) ||
                p.model?.toLowerCase().includes(search.toLowerCase()) ||
                p.type?.toLowerCase().includes(search.toLowerCase());
            
            if (activeType === 'NONE') return matchesSearch;
            if (activeType) return matchesSearch && getCategoryKey(p.type, p.category) === activeType;
            return matchesSearch;
        });
    }, [products, search, activeType]);

    // Cart logic
    const addToQuote = (p: Product) => {
        const sprice = safePrice(p.price);
        if (isCrystal(p)) {
            // Split crystal into OD/OI automatically
            setQuoteItems(prev => {
                const is2x1 = isMultifocal2x1(p);
                const existingPairs = prev.filter(i => i.product.id === p.id && i.eye === 'OD').length;

                // Lógica de precio: El primer par se cobra, el segundo es gratis ($0), el tercero se cobra, etc.
                const isFree = is2x1 && existingPairs % 2 !== 0;
                const currentPrice = isFree ? 0 : Math.round(sprice / 2);

                const ts = Date.now();
                return [
                    ...prev,
                    { product: p, quantity: 1, customPrice: currentPrice, eye: 'OD', isPromo: isFree, uid: ts },
                    { product: p, quantity: 1, customPrice: currentPrice, eye: 'OI', isPromo: isFree, uid: ts + 1 }
                ];
            });
        } else {
            setQuoteItems(prev => {
                const existing = prev.find(i => i.product.id === p.id);
                if (existing) {
                    if (existing.quantity >= p.stock) return prev;
                    return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
                }
                return [...prev, { product: p, quantity: 1, customPrice: sprice }];
            });
        }
    };

    // Calculate totals including 2x1 promo frame discount
    const quoteTotals = calculateQuoteTotals(quoteItems, markup, discountCash, products);
    const totalWithMarkup = quoteTotals.subtotalWithMarkup;
    const totalCash = quoteTotals.totalCash;
    const totalList = quoteTotals.subtotal;
    const itemCount = quoteItems.reduce((acc, it) => acc + it.quantity, 0);
    // Use centralized isCrystal from promo-utils (handles legacy types like MULTIFOCAL, LENS, etc.)
    const hasCrystals = quoteItems.some(i => isCrystal(i.product));

    const selectContactForQuote = (contact: any) => {
        setPendingContact(contact);
        setContactSearch('');
        setContactResults([]);
        // Fetch history
        fetch(`/api/orders?contactId=${contact.id}&status=QUOTE`)
            .then(res => res.json())
            .then(data => setPreviousQuotes(data))
            .catch(err => console.error(err));
    };

    const saveQuoteToContact = async (contactId: string, contactName: string) => {
        setSavingQuote(true);
        try {
            const method = editingQuoteId ? 'PATCH' : 'POST';
            const url = editingQuoteId ? `/api/orders/${editingQuoteId}` : '/api/orders';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: contactId,
                    items: quoteItems.map(it => ({
                        productId: it.product.id,
                        quantity: it.quantity,
                        price: it.customPrice,
                        eye: it.eye
                    })),
                    markup,
                    discount: discountCash,
                    discountCash,
                    discountTransfer,
                    discountCard,
                    total: Math.round(totalCash),
                    subtotalWithMarkup: Math.round(totalWithMarkup),
                    frameSource,
                    userFrameBrand: frameSource === 'USUARIO' ? userFrameData.brand : null,
                    userFrameModel: frameSource === 'USUARIO' ? userFrameData.model : null,
                    userFrameNotes: frameSource === 'USUARIO' ? userFrameData.notes : null,
                    prescriptionId: quotePrescriptionId,
                })
            });

            if (res.ok) {
                setSavedContact({ id: contactId, name: contactName });
                setShowRegister(true);
                console.log('Presupuesto actualizado/guardado');
            } else {
                const err = await res.json();
                alert(`❌ Error al guardar: ${err.error || 'Error desconocido'}`);
                console.error('Error al guardar presupuesto', err);
            }
        } catch (err) {
            console.error(err);
            alert('❌ Error de conexión al guardar');
        } finally {
            setSavingQuote(false);
        }
    };

    const handleCreateAndSave = async () => {
        if (!newContactName.trim()) return;
        setSavingQuote(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newContactName, 
                    phone: newContactPhone,
                    source: 'COTIZADOR'
                }),
            });
            if (res.ok) {
                const contact = await res.json();
                await saveQuoteToContact(contact.id, contact.name);
            } else {
                const err = await res.json();
                console.error('Error al crear contacto');
                setSavingQuote(false);
            }
        } catch (err) {
            console.error(err);
            console.error('Error de conexión');
            setSavingQuote(false);
        }
    };

    const resetRegister = () => {
        setShowRegister(false);
        setContactSearch('');
        setContactResults([]);
        setShowNewContact(false);
        setNewContactName('');
        setNewContactPhone('');
        setSavedContact(null);
        setPendingContact(null);
        setQuotePrescriptionId(null);
        setEditingQuoteId(null);
        // Clear URL search params
        router.replace('/cotizador');
    };

    const handleWhatsApp = () => {
        if (!pendingContact?.phone) {
            console.error('El contacto no tiene teléfono');
            return;
        }
        // Build the message
        let msg = `Hola ${pendingContact.name}, te envío el presupuesto solicitado:\n\n`;
        quoteItems.forEach(it => {
            msg += `- ${it.product.brand} ${it.product.model || ''} (${it.product.name}) ${it.eye ? '['+it.eye+']' : ''}: $${it.customPrice.toLocaleString()}\n`;
        });
        msg += `\nTotal Lista: $${Math.round(totalWithMarkup).toLocaleString()}\n`;
        msg += `💰 Promo Efectivo (-${discountCash}%): $${Math.round(totalCash).toLocaleString()}\n`;
        msg += `💳 Promos con Tarjeta: Consultar cuotas sin interés.\n\nAtelier Óptica`;
        
        const url = `https://wa.me/${pendingContact.phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    const handleCopy = () => {
        let text = `PRESUPUESTO ATELIER\n\n`;
        quoteItems.forEach(it => {
            text += `• ${it.product.brand} ${it.product.model || ''} (${it.product.name}) ${it.eye ? '['+it.eye+']' : ''}: $${it.customPrice.toLocaleString()}\n`;
        });
        text += `\nTotal Lista: $${Math.round(totalWithMarkup).toLocaleString()}\n`;
        text += `Promo Efectivo: $${Math.round(totalCash).toLocaleString()}\n`;
        
        navigator.clipboard.writeText(text);
        console.log('Copiado al portapapeles');
    };

    const handleEditQuote = (quote: any) => {
        // Map items — API returns `price`, CotizadorCart expects `customPrice`
        const mappedItems = quote.items.map((it: any, idx: number) => ({
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,
            eye: it.eye,
            uid: Date.now() + idx
        }));
        setQuoteItems(mappedItems);
        
        // Restore all pricing settings — fields are on the order object directly (not in metadata)
        setMarkup(quote.markup || 0);
        setDiscountCash(quote.discountCash ?? 20);
        setDiscountTransfer(quote.discountTransfer ?? 15);
        setDiscountCard(quote.discountCard ?? 0);
        
        if (quote.frameSource) setFrameSource(quote.frameSource);
        setUserFrameData({
            brand: quote.userFrameBrand || '',
            model: quote.userFrameModel || '',
            notes: quote.userFrameNotes || ''
        });
        setEditingQuoteId(quote.id);
        setShowHistory(false);
    };

    const handleCancelEdit = () => {
        setEditingQuoteId(null);
        setQuoteItems([]);
        setPendingContact(null);
        router.replace('/cotizador');
    };

    const clientName = pendingContact?.name;

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden relative">
            {/* Header */}
            <header className="px-6 py-3 border-b border-sidebar-border bg-sidebar flex items-center gap-4 flex-shrink-0">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Calculator className="w-4 h-4 text-primary" />
                </div>
                <h1 className="text-lg font-black text-stone-800 dark:text-white uppercase tracking-tighter italic leading-tight flex-1">
                    Cotizador
                    {clientName && (
                        <span className="text-primary not-italic ml-2 text-sm font-black">— {clientName}</span>
                    )}
                </h1>
                {quoteItems.length > 0 && (
                    <button
                        onClick={() => { setQuoteItems([]); setMarkup(0); setFrameSource(null); setEditingQuoteId(null); router.replace('/cotizador'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-stone-400 hover:text-red-500 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700 transition-all hover:border-red-200 uppercase tracking-wider"
                    >
                        <RotateCcw className="w-3 h-3" /> Limpiar
                    </button>
                )}
            </header>

            {/* Search + Categories */}
            <div className="px-6 py-3 border-b border-sidebar-border bg-sidebar/60 flex items-center gap-3 flex-shrink-0">
                <div className="relative w-64 flex-shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 py-2 px-9 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-300"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 text-xs">✕</button>
                    )}
                </div>
                <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                    <button
                        onClick={() => setActiveType(null)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${activeType === null
                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                            : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-100 dark:border-stone-700 hover:border-primary/30'
                            }`}
                    >
                        Todos ({products.length})
                    </button>
                    {availableCategories.map(cat => {
                        const config = getTypeConfig(cat);
                        const count = products.filter(p => getCategoryKey(p.type, p.category) === cat).length;
                        const Icon = config.icon;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveType(cat)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${activeType === cat
                                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                    : `${config.color} hover:shadow-sm`
                                    }`}
                            >
                                <Icon className="w-3 h-3" />
                                {config.label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div
                className="flex-1 overflow-y-auto px-6 py-4"
                style={{ scrollbarWidth: 'thin', paddingBottom: quoteItems.length > 0 ? (cartExpanded ? '460px' : '100px') : '16px' }}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-stone-300">
                        <Search className="w-16 h-16 text-stone-200 mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest text-stone-400">Sin resultados</p>
                    </div>
                ) : activeType?.startsWith('Cristal') ? (
                    <div className="max-w-[1500px] mx-auto">
                        <div className="rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden shadow-xl bg-white dark:bg-stone-900">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse" style={{ minWidth: 1000 }}>
                                    <thead>
                                        <tr className="bg-stone-900 text-white">
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest border-r border-stone-700 w-[100px]">Tipo</th>
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest border-r border-stone-700 w-[100px]">Marca</th>
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest border-r border-stone-700 text-center w-[60px]">Índice</th>
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest border-r border-stone-700">Descripción</th>
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-right w-[110px]">Lista</th>
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-right w-[110px] text-emerald-400">Efectivo</th>
                                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-right w-[110px] text-violet-400">Transf.</th>
                                            <th className="px-1 py-3 w-10 bg-stone-800"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((product, idx) => {
                                            const inQuote = quoteItems.find(i => i.product.id === product.id);
                                            const sprice = safePrice(product.price);
                                            const pTotal = sprice * (1 + markup / 100);
                                            const pCash = pTotal * (1 - discountCash / 100);
                                            const pTrans = pTotal * (1 - discountTransfer / 100);
                                            return (
                                                <tr
                                                    key={product.id}
                                                    onClick={() => addToQuote(product)}
                                                    className={`cursor-pointer transition-colors border-b border-stone-100 dark:border-stone-800 ${idx % 2 === 0 ? 'bg-white dark:bg-stone-900' : 'bg-stone-50/50 dark:bg-stone-800/30'} hover:bg-primary/5`}
                                                >
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800">
                                                        <span className="text-[10px] font-black uppercase text-stone-400">{product.type || 'Cristal'}</span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800">
                                                        <span className="text-[10px] font-black uppercase">{product.brand || '—'}</span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800 text-center">
                                                        <span className="text-[10px] font-bold">{product.lensIndex || '—'}</span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800">
                                                        <p className="text-[11px] font-bold truncate max-w-sm">{product.name || product.model || '—'}</p>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-black text-xs">${Math.round(pTotal).toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-right font-black text-xs text-emerald-600">${Math.round(pCash).toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-right font-black text-xs text-violet-600">${Math.round(pTrans).toLocaleString()}</td>
                                                    <td className="px-1 py-2 text-center">
                                                        {inQuote ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <Plus className="w-4 h-4 text-stone-200 mx-auto" />}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {filtered.map(product => {
                            const inQuote = quoteItems.find(i => i.product.id === product.id);
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addToQuote(product)}
                                    className={`p-3 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-32 ${inQuote 
                                        ? 'bg-primary/5 border-primary/30 shadow-lg' 
                                        : 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800'}`}
                                >
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-stone-400 truncate">{product.brand}</p>
                                        <p className="text-[11px] font-black leading-tight mt-0.5 line-clamp-2">{product.model || product.name}</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto">
                                        <p className="text-sm font-black text-primary">${safePrice(product.price).toLocaleString()}</p>
                                        {inQuote && (
                                            <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-black">
                                                {inQuote.quantity}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Sticky Cart */}
            {quoteItems.length > 0 && (
                <div className={`fixed bottom-0 left-64 right-0 z-50 bg-white dark:bg-stone-900 border-t border-sidebar-border shadow-2xl transition-all duration-500 ${cartExpanded ? 'h-[600px]' : 'h-16'}`}>
                    {/* Collapsed Bar */}
                    <button 
                        onClick={() => setCartExpanded(!cartExpanded)}
                        className="h-16 w-full flex items-center justify-between px-8 border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-primary" />
                                <span className="text-xs font-black uppercase tracking-[0.2em]">Presupuesto</span>
                                <span className="bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 rounded-full">{itemCount}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xl font-black">${Math.round(totalCash).toLocaleString()} <span className="text-[10px] text-stone-400 font-black uppercase ml-1">en efectivo</span></span>
                                {markup > 0 && <span className="text-[10px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">+{markup}% MU</span>}
                            </div>
                        </div>
                        {cartExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>

                    {/* Expanded Content */}
                    {cartExpanded && (
                        <div className="h-[calc(100%-64px)] overflow-hidden flex">
                            <div className={`flex-1 transition-all duration-500 p-8 overflow-y-auto ${showHistory ? 'max-w-[70%]' : 'max-w-full'}`} style={{ scrollbarWidth: 'thin' }}>
                                {!showRegister ? (
                                    <CotizadorCart 
                                        items={quoteItems}
                                        setItems={setQuoteItems}
                                        markup={markup}
                                        setMarkup={setMarkup}
                                        discountCash={discountCash}
                                        setDiscountCash={setDiscountCash}
                                        discountTransfer={discountTransfer}
                                        setDiscountTransfer={setDiscountTransfer}
                                        discountCard={discountCard}
                                        setDiscountCard={setDiscountCard}
                                        frameSource={frameSource}
                                        setFrameSource={setFrameSource}
                                        userFrameData={userFrameData}
                                        setUserFrameData={setUserFrameData}
                                        availableProducts={products}
                                        contactName={pendingContact?.name}
                                        onWhatsApp={handleWhatsApp}
                                        onCopy={handleCopy}
                                        onSave={async () => {
                                            if (pendingContact) await saveQuoteToContact(pendingContact.id, pendingContact.name);
                                            else setShowRegister(true);
                                        }}
                                        isSaving={savingQuote}
                                        editingQuoteId={editingQuoteId}
                                        onCancelEdit={handleCancelEdit}
                                        prescriptions={pendingContact?.prescriptions || []}
                                        prescriptionId={quotePrescriptionId}
                                        setPrescriptionId={setQuotePrescriptionId}
                                        extraActions={
                                            previousQuotes.length > 0 && (
                                                <button
                                                    onClick={() => setShowHistory(!showHistory)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showHistory 
                                                        ? 'bg-stone-900 text-white' 
                                                        : 'bg-stone-100 text-stone-500'}`}
                                                >
                                                    <History className="w-3.5 h-3.5" /> {showHistory ? 'Cerrar Historial' : `Historial (${previousQuotes.length})`}
                                                </button>
                                            )
                                        }
                                    />
                                ) : (
                                    <div className="bg-white dark:bg-stone-800 border-2 border-primary/20 rounded-[2.5rem] p-12 shadow-2xl relative max-w-4xl mx-auto animate-in zoom-in-95 duration-500">
                                        <button onClick={() => setShowRegister(false)} className="absolute top-8 right-8 text-stone-300 hover:text-stone-800"><X className="w-6 h-6" /></button>
                                        
                                        {savedContact ? (
                                            <div className="py-12 text-center space-y-8">
                                                <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                                                    <Check className="w-12 h-12 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-3xl font-black tracking-tighter">¡Guardado con éxito!</h4>
                                                    <p className="text-stone-500 font-bold mt-2">Registrado en la ficha de {savedContact.name}</p>
                                                </div>
                                                <div className="flex gap-4 justify-center pt-8">
                                                    <button onClick={() => router.push(`/contactos?clientId=${savedContact.id}`)} className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-lg">Ver Ficha</button>
                                                    <button onClick={resetRegister} className="px-8 py-4 bg-stone-100 text-stone-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all">Nuevo Presupuesto</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-10">
                                                <div>
                                                    <h3 className="text-3xl font-black tracking-tighter">Vincular Contacto</h3>
                                                    <p className="text-[11px] font-black text-stone-400 uppercase tracking-[0.3em] mt-1">Busca un cliente o crea uno nuevo</p>
                                                </div>

                                                {pendingContact ? (
                                                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                                                        <div className="p-8 bg-primary/5 border-2 border-primary/20 rounded-[2rem] flex items-center gap-6">
                                                            <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center border border-primary/20"><User className="w-10 h-10 text-primary" /></div>
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Cliente Seleccionado</p>
                                                                <h4 className="text-2xl font-black tracking-tighter mt-1">{pendingContact.name}</h4>
                                                                {pendingContact.phone && <p className="text-sm font-bold text-stone-400 mt-1">{pendingContact.phone}</p>}
                                                            </div>
                                                            {!editingQuoteId && <button onClick={() => setPendingContact(null)} className="p-4 text-stone-300 hover:text-red-500"><X className="w-7 h-7" /></button>}
                                                        </div>

                                                        {hasCrystals && pendingContact.prescriptions && pendingContact.prescriptions.length > 0 && (
                                                            <div className="p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-[2rem] border-2 border-emerald-200/50 space-y-4">
                                                                <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-600" /><span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Vincular Receta Médica</span></div>
                                                                <select 
                                                                    value={quotePrescriptionId || ''} 
                                                                    onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                    className="w-full bg-white dark:bg-stone-800 border-2 border-emerald-100 py-4 px-6 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                                                                >
                                                                    <option value="">Sin receta vinculada...</option>
                                                                    {pendingContact.prescriptions.map((p: any) => (
                                                                        <option key={p.id} value={p.id}>{new Date(p.date).toLocaleDateString('es-AR')} — OD: {p.sphereOD}/${p.sphereOI}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        <div className="flex gap-4 pt-4">
                                                            <button 
                                                                onClick={() => saveQuoteToContact(pendingContact.id, pendingContact.name)} 
                                                                disabled={savingQuote}
                                                                className="flex-1 py-6 bg-primary text-primary-foreground rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex justify-center items-center gap-3"
                                                            >
                                                                {savingQuote ? <Loader2 className="w-6 h-6 animate-spin" /> : editingQuoteId ? 'Actualizar Presupuesto' : 'Guardar Presupuesto'}
                                                            </button>
                                                            {!editingQuoteId && <button onClick={() => { setPendingContact(null); setPreviousQuotes([]); }} className="px-8 py-6 bg-white border-2 border-stone-100 text-stone-400 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:text-stone-800 transition-all">Cambiar</button>}
                                                        </div>
                                                    </div>
                                                ) : !showNewContact ? (
                                                    <div className="space-y-8">
                                                        <div className="flex gap-4">
                                                            <div className="relative flex-1">
                                                                <Search className="w-5 h-5 absolute left-6 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                <input 
                                                                    ref={contactSearchRef} 
                                                                    type="text" 
                                                                    placeholder="Busca por nombre..." 
                                                                    value={contactSearch} 
                                                                    onChange={e => setContactSearch(e.target.value)}
                                                                    className="w-full bg-stone-50 border-2 border-stone-100 py-6 px-16 rounded-[2rem] text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                                                />
                                                            </div>
                                                            <button onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }} className="px-8 bg-primary/10 text-primary border-2 border-primary/20 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all flex items-center gap-2"><Plus className="w-5 h-5" /> Nuevo</button>
                                                        </div>
                                                        {contactResults.length > 0 && (
                                                            <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-4" style={{ scrollbarWidth: 'thin' }}>
                                                                {contactResults.map((c: any) => (
                                                                    <button key={c.id} onClick={() => selectContactForQuote(c)} className="flex items-center gap-4 p-6 bg-stone-50 border-2 border-stone-100 rounded-[2rem] hover:border-primary/40 transition-all group">
                                                                        <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-stone-100"><User className="w-7 h-7 text-primary" /></div>
                                                                        <div className="flex-1 text-left">
                                                                            <p className="text-sm font-black truncate">{c.name}</p>
                                                                            {c.phone && <p className="text-[10px] font-bold text-stone-400">{c.phone}</p>}
                                                                        </div>
                                                                        <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-primary" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-10 bg-stone-50 border-2 border-stone-100 rounded-[3rem] space-y-8 animate-in slide-in-from-top-4 duration-500">
                                                        <h4 className="text-2xl font-black tracking-tighter">Nuevo Contacto</h4>
                                                        <div className="grid grid-cols-2 gap-6">
                                                            <div className="space-y-2"><label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Nombre Completo *</label><input type="text" placeholder="Ej: Juan Pérez" value={newContactName} onChange={e => setNewContactName(e.target.value)} className="w-full bg-white border-2 border-stone-100 py-5 px-8 rounded-2xl text-xs font-bold" /></div>
                                                            <div className="space-y-2"><label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">WhatsApp</label><input type="tel" placeholder="351XXXXXXX" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} className="w-full bg-white border-2 border-stone-100 py-5 px-8 rounded-2xl text-xs font-bold" /></div>
                                                        </div>
                                                        <div className="flex gap-4 pt-4">
                                                            <button onClick={handleCreateAndSave} disabled={!newContactName || savingQuote} className="flex-1 py-6 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl">Crear y Guardar</button>
                                                            <button onClick={() => setShowNewContact(false)} className="px-10 py-6 bg-white border-2 border-stone-100 text-stone-400 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:text-stone-800 transition-all">Cancelar</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {showHistory && (
                                <div className="w-[30%] border-l border-sidebar-border bg-stone-50/50 dark:bg-stone-900/50 p-8 overflow-y-auto animate-in slide-in-from-right duration-500">
                                    <h3 className="text-[11px] font-black text-stone-400 uppercase tracking-[0.3em] mb-8">Historial de Consultas</h3>
                                    <div className="space-y-6">
                                        {previousQuotes.map(quote => (
                                            <QuoteSummary 
                                                key={quote.id} 
                                                order={quote} 
                                                contact={{ id: pendingContact?.id || '', name: pendingContact?.name || '' }} 
                                                compact={true}
                                                onEdit={handleEditQuote}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function CotizadorPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        }>
            <CotizadorPageContent />
        </Suspense>
    );
}
