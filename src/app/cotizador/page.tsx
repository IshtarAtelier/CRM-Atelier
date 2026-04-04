'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Search, Plus, Minus, Trash2, Copy, MessageCircle,
    Calculator, RotateCcw, Percent, Check, Glasses,
    Layers, Sun, Watch, Eye, ShoppingBag, Sparkles, Pill,
    Pencil, ChevronUp, ChevronDown, X, User, Save,
    UserPlus, Phone, ArrowRight, ExternalLink, Loader2, BookOpen, FileText,
    TrendingUp, Banknote, CreditCard, ArrowRightLeft, Gift, Tag
} from 'lucide-react';

interface Product {
    id: string;
    name: string | null;
    category: string;
    type: string | null;
    brand: string | null;
    model: string | null;
    price: number;
    stock: number;
    lensIndex: string | null;
    laboratory: string | null;
    cost: number;
    unitType: string | null;
}

interface QuoteItem {
    product: Product;
    quantity: number;
    customPrice: number;
    uid: number;
    eye?: 'OD' | 'OI';
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    'Armazón': { label: 'Armazones', icon: Glasses, color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    'Cristal': { label: 'Cristales', icon: Layers, color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    'Lente de sol': { label: 'Sol', icon: Sun, color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
    'Lente de contacto': { label: 'Contacto', icon: Eye, color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' },
    'Accesorio': { label: 'Accesorios', icon: Watch, color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
    'Reloj': { label: 'Relojes', icon: Watch, color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    'Líquido / Solución': { label: 'Líquidos', icon: Pill, color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800' },
    'Joyería': { label: 'Joyería', icon: Sparkles, color: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800' },
};

function getTypeConfig(type: string | null) {
    if (!type) return { label: 'Otros', icon: ShoppingBag, color: 'bg-stone-500/10 text-stone-600 border-stone-200 dark:border-stone-700' };
    return TYPE_CONFIG[type] || { label: type, icon: ShoppingBag, color: 'bg-stone-500/10 text-stone-600 border-stone-200 dark:border-stone-700' };
}

// Map any product sub-type to its parent category key in TYPE_CONFIG
function getCategoryKey(type: string | null): string {
    if (!type) return 'Otros';
    // Direct match
    if (TYPE_CONFIG[type]) return type;
    // Sub-type matching: check if the type starts with or contains a root key
    const t = type.toLowerCase();
    if (t.includes('armazón') || t.includes('armazon')) return 'Armazón';
    if (t.includes('cristal') || t.includes('monofocal') || t.includes('multifocal') || t.includes('bifocal') || t.includes('ocupacional') || t.includes('coquil') || t.includes('progresivo')) return 'Cristal';
    if (t.includes('lente de sol') || t.includes('sol')) return 'Lente de sol';
    if (t.includes('lente de contacto') || t.includes('contacto')) return 'Lente de contacto';
    if (t.includes('accesorio')) return 'Accesorio';
    if (t.includes('reloj')) return 'Reloj';
    if (t.includes('líquido') || t.includes('solución') || t.includes('liquido') || t.includes('solucion')) return 'Líquido / Solución';
    if (t.includes('joyería') || t.includes('joyeria')) return 'Joyería';
    return 'Otros';
}

export default function CotizadorPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState<string | null>('NONE');
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [markup, setMarkup] = useState(0);
    const [discountCash, setDiscountCash] = useState(20);
    const [discountTransfer, setDiscountTransfer] = useState(15);
    const [discountCard, setDiscountCard] = useState(0);
    const [copied, setCopied] = useState(false);
    const [editingPrice, setEditingPrice] = useState<number | null>(null);
    const [cartExpanded, setCartExpanded] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const searchParams = useSearchParams();
    const clientName = searchParams.get('clientName');

    // Register quote state
    const [showRegister, setShowRegister] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [contactResults, setContactResults] = useState<any[]>([]);
    const [contactSearching, setContactSearching] = useState(false);
    const [showNewContact, setShowNewContact] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');
    const [savingQuote, setSavingQuote] = useState(false);
    const [savedContact, setSavedContact] = useState<{ id: string; name: string } | null>(null);
    const [pendingContact, setPendingContact] = useState<{ id: string; name: string; prescriptions?: any[] } | null>(null);
    const [quotePrescriptionId, setQuotePrescriptionId] = useState<string | null>(null);
    const contactSearchRef = useRef<HTMLInputElement>(null);

    // Frame state
    const [frameSource, setFrameSource] = useState<'OPTICA' | 'USUARIO' | null>(null);
    const [userFrameData, setUserFrameData] = useState({ brand: '', model: '', notes: '' });
    const [frameSearch, setFrameSearch] = useState('');

    useEffect(() => {
        fetch('/api/products')
            .then(res => res.json())
            .then(data => setProducts(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!loading && searchRef.current) searchRef.current.focus();
    }, [loading]);

    const availableCategories = useMemo(() => {
        const catSet = new Set<string>();
        products.forEach(p => catSet.add(getCategoryKey(p.type)));
        // Sort with TYPE_CONFIG order first, then alphabetical for the rest
        const configKeys = Object.keys(TYPE_CONFIG);
        return Array.from(catSet).sort((a, b) => {
            const ai = configKeys.indexOf(a);
            const bi = configKeys.indexOf(b);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [products]);

    const isCrystal = useCallback((p: Product) => {
        return p.category === 'LENS' || (p.type || '').includes('Cristal');
    }, []);

    // ── Promotion helpers ──────────────────────────────────────
    const isMultifocalProduct = useCallback((p: Product) => {
        const name = `${p.brand || ''} ${p.name || ''} ${p.model || ''}`.toLowerCase();
        return name.includes('multifocal') || name.includes('progresivo') || (p.type || '').toLowerCase().includes('multifocal');
    }, []);

    const isMiPrimerVarilux = useCallback((p: Product) => {
        return (p.name || '').toLowerCase().includes('mi primer varilux');
    }, []);

    const isAtelierFrame = useCallback((p: Product) => {
        return (p.brand || '').toLowerCase().includes('atelier');
    }, []);

    // Average Atelier frame price for bonification
    const atelierAvgPrice = useMemo(() => {
        const atelierFrames = products.filter(p =>
            (p.type === 'Armazón' || p.category === 'FRAME') &&
            (p.brand || '').toLowerCase().includes('atelier') &&
            p.price > 0
        );
        if (atelierFrames.length === 0) return 0;
        return Math.round(atelierFrames.reduce((sum, f) => sum + f.price, 0) / atelierFrames.length);
    }, [products]);

    // Check if quote has a multifocal that qualifies for frame promo
    const hasMultifocalPromo = useMemo(() => {
        return quoteItems.some(item =>
            isCrystal(item.product) && isMultifocalProduct(item.product) && !isMiPrimerVarilux(item.product)
        );
    }, [quoteItems, isCrystal, isMultifocalProduct, isMiPrimerVarilux]);

    // Check if quote has any multifocal at all (including Mi Primer Varilux)
    const hasAnyMultifocal = useMemo(() => {
        return quoteItems.some(item =>
            isCrystal(item.product) && isMultifocalProduct(item.product)
        );
    }, [quoteItems, isCrystal, isMultifocalProduct]);

    const filtered = useMemo(() => {
        if (activeType === 'NONE' && !search) return [];
        return products.filter(p => {
            // Hide stock-0 products (except crystals)
            if (!isCrystal(p) && p.stock <= 0) return false;
            // Filter by grouped category instead of exact type
            if (activeType && activeType !== 'NONE' && getCategoryKey(p.type) !== activeType) return false;
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                (p.brand?.toLowerCase().includes(q)) ||
                (p.model?.toLowerCase().includes(q)) ||
                (p.name?.toLowerCase().includes(q)) ||
                (p.type?.toLowerCase().includes(q))
            );
        });
    }, [products, search, activeType, isCrystal]);

    // Check if quote has crystals
    const hasCrystals = useMemo(() => {
        return quoteItems.some(item =>
            item.product.type === 'Cristal' || item.product.category === 'LENS'
        );
    }, [quoteItems]);

    // Check if quote already has a frame from optica
    const hasFrameFromOptica = useMemo(() => {
        return quoteItems.some(item =>
            item.product.type === 'Armazón' || item.product.category === 'FRAME'
        );
    }, [quoteItems]);

    // Promo frame discount calculation
    const promoFrameDiscount = useMemo(() => {
        if (!hasMultifocalPromo) return 0;
        const frameItem = quoteItems.find(item =>
            item.product.type === 'Armazón' || item.product.category === 'FRAME'
        );
        if (!frameItem) return 0;
        if (isAtelierFrame(frameItem.product)) {
            // Atelier frame = 100% bonificado
            return frameItem.product.price;
        }
        // Non-Atelier = discount up to Atelier avg price
        return Math.min(atelierAvgPrice, frameItem.product.price);
    }, [hasMultifocalPromo, quoteItems, isAtelierFrame, atelierAvgPrice]);

    // Auto-set frame source
    useEffect(() => {
        if (hasCrystals && hasFrameFromOptica) {
            setFrameSource('OPTICA');
        }
        if (!hasCrystals) {
            setFrameSource(null);
            setUserFrameData({ brand: '', model: '', notes: '' });
        }
    }, [hasCrystals, hasFrameFromOptica]);

    // Frame search results
    const frameResults = useMemo(() => {
        if (!frameSearch) return [];
        const q = frameSearch.toLowerCase();
        return products.filter(p =>
            (p.type === 'Armazón' || p.category === 'FRAME') &&
            p.stock > 0 &&
            ((p.brand?.toLowerCase().includes(q)) ||
                (p.model?.toLowerCase().includes(q)) ||
                (p.name?.toLowerCase().includes(q)))
        ).slice(0, 8);
    }, [products, frameSearch]);

    const addToQuote = useCallback((product: Product, isPromoFrame?: boolean) => {
        if (isCrystal(product)) {
            const halfPrice = Math.round(product.price / 2);
            setQuoteItems(prev => [
                ...prev,
                { product, quantity: 1, customPrice: halfPrice, uid: Date.now(), eye: 'OD' },
                { product, quantity: 1, customPrice: halfPrice, uid: Date.now() + 1, eye: 'OI' }
            ]);
            return;
        }
        setQuoteItems(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                // Don't exceed available stock
                if (existing.quantity >= product.stock) return prev;
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            // If promo frame: Atelier = $0, non-Atelier = price - Atelier avg
            let framePrice = product.price;
            if (isPromoFrame) {
                if (isAtelierFrame(product)) {
                    framePrice = 0;
                } else {
                    framePrice = Math.max(0, product.price - atelierAvgPrice);
                }
            }
            return [...prev, { product, quantity: 1, customPrice: framePrice, uid: Date.now() }];
        });
    }, [isCrystal, isAtelierFrame, atelierAvgPrice]);

    const updateQuantity = useCallback((uid: number, delta: number) => {
        setQuoteItems(prev =>
            prev
                .map(item => {
                    if (item.uid !== uid) return item;
                    let newQty = item.quantity + delta;
                    // Cap at stock for non-crystal products
                    if (!isCrystal(item.product) && newQty > item.product.stock) newQty = item.product.stock;
                    return { ...item, quantity: Math.max(0, newQty) };
                })
                .filter(item => item.quantity > 0)
        );
    }, [isCrystal]);

    const updatePrice = useCallback((uid: number, price: number) => {
        setQuoteItems(prev =>
            prev.map(item => item.uid === uid ? { ...item, customPrice: Math.max(0, price) } : item)
        );
    }, []);

    const removeItem = useCallback((uid: number) => {
        setQuoteItems(prev => prev.filter(item => item.uid !== uid));
    }, []);

    const subtotal = quoteItems.reduce((acc, item) => acc + item.customPrice * item.quantity, 0);
    const markupAmount = subtotal * (markup / 100);
    const priceWithMarkup = subtotal + markupAmount;
    const totalCash = priceWithMarkup * (1 - discountCash / 100);
    const totalTransfer = priceWithMarkup * (1 - discountTransfer / 100);
    const totalCard = priceWithMarkup * (1 - discountCard / 100);
    const total = totalCash; // Total principal = efectivo (mejor precio)
    const itemCount = quoteItems.reduce((acc, item) => acc + item.quantity, 0);

    // Frame item for promo display
    const frameItemInQuote = useMemo(() => {
        return quoteItems.find(item =>
            item.product.type === 'Armazón' || item.product.category === 'FRAME'
        );
    }, [quoteItems]);

    const buildQuoteText = () => {
        const lines = quoteItems.map(item => {
            let label = `• ${item.product.brand || ''} ${item.product.model || item.product.name || ''} x${item.quantity}`;
            // Check if this is a bonified frame
            const isFrame = item.product.type === 'Armazón' || item.product.category === 'FRAME';
            if (isFrame && hasMultifocalPromo && isAtelierFrame(item.product)) {
                label += ` — *BONIFICADO* ✨`;
            } else if (isFrame && hasMultifocalPromo && promoFrameDiscount > 0) {
                label += ` — $${Math.round(item.customPrice * item.quantity * (1 + markup / 100)).toLocaleString()} (Bonif. -$${promoFrameDiscount.toLocaleString()})`;
            } else {
                label += ` — $${Math.round(item.customPrice * item.quantity * (1 + markup / 100)).toLocaleString()}`;
            }
            return label;
        });
        let text = `✨ *PRESUPUESTO — ATELIER ÓPTICA* ✨\n`;
        text += `📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
        text += `🏆 La óptica mejor calificada en Google Business ⭐ 5/5\n`;
        if (clientName) text += `\n👤 *Cliente:* ${clientName}\n`;
        // Promo badge
        if (hasAnyMultifocal) {
            text += `\n🎁 *Promoción Multifocal 2x1*`;
            if (hasMultifocalPromo) text += ` — Incluye armazón Atelier sin cargo`;
            text += `\n`;
        }
        text += `\n`;
        text += lines.join('\n');
        // Frame info
        if (hasCrystals && frameSource) {
            text += `\n\n🕶️ *Armazón:*`;
            if (frameSource === 'OPTICA') {
                const frameItem = quoteItems.find(i => i.product.type === 'Armazón' || i.product.category === 'FRAME');
                if (frameItem) {
                    text += ` ${frameItem.product.brand || ''} ${frameItem.product.model || ''}`;
                    if (hasMultifocalPromo && isAtelierFrame(frameItem.product)) {
                        text += ` ✨ *BONIFICADO*`;
                    } else if (hasMultifocalPromo && promoFrameDiscount > 0) {
                        text += ` (Bonif. Atelier -$${promoFrameDiscount.toLocaleString()})`;
                    } else {
                        text += ` (de la óptica)`;
                    }
                }
            } else {
                text += ` ${userFrameData.brand || ''} ${userFrameData.model || ''} (armazón del cliente)`;
                if (userFrameData.notes) text += `\n   Obs: ${userFrameData.notes}`;
            }
        }
        text += `\n\n———————————————`;
        text += `\n*Precio de Lista (Cuotas): $${Math.round(priceWithMarkup).toLocaleString()}*`;
        text += `\n↳ 3 cuotas s/interés de $${Math.round(priceWithMarkup / 3).toLocaleString()}`;
        text += `\n↳ 6 cuotas s/interés de $${Math.round(priceWithMarkup / 6).toLocaleString()}`;

        if (discountTransfer > 0) text += `\n\n🏦 *Total Transferencia (-${discountTransfer}%): $${Math.round(totalTransfer).toLocaleString()}*`;
        if (discountCash > 0) text += `\n💵 *Total Efectivo (-${discountCash}%): $${Math.round(totalCash).toLocaleString()}*`;
        text += `\n\n_Presupuesto válido por 5 días hábiles._`;
        return text;
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(buildQuoteText());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsApp = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(buildQuoteText())}`, '_blank');
    };

    // ── Register quote with contact ──────────────────
    const searchContacts = useCallback(async (q: string) => {
        if (!q.trim()) { setContactResults([]); return; }
        setContactSearching(true);
        try {
            const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                setContactResults(data.slice(0, 6));
            }
        } catch { }
        setContactSearching(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => searchContacts(contactSearch), 300);
        return () => clearTimeout(t);
    }, [contactSearch, searchContacts]);

    useEffect(() => {
        if (showRegister && contactSearchRef.current) {
            setTimeout(() => contactSearchRef.current?.focus(), 100);
        }
    }, [showRegister]);

    const saveQuoteToContact = async (contactId: string, contactName: string) => {
        setSavingQuote(true);
        try {
            const orderItems = quoteItems.map(item => ({
                productId: item.product.id,
                quantity: item.quantity,
                price: item.customPrice,
                eye: item.eye,
            }));

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: contactId,
                    items: orderItems,
                    discount: discountCash,
                    markup,
                    discountCash,
                    discountTransfer,
                    discountCard,
                    subtotalWithMarkup: priceWithMarkup,
                    total: Math.round(totalCash),
                    frameSource: hasCrystals ? frameSource : null,
                    userFrameBrand: frameSource === 'USUARIO' ? userFrameData.brand : null,
                    userFrameModel: frameSource === 'USUARIO' ? userFrameData.model : null,
                    userFrameNotes: frameSource === 'USUARIO' ? userFrameData.notes : null,
                    prescriptionId: hasCrystals ? quotePrescriptionId : null,
                }),
            });

            if (res.ok) {
                setSavedContact({ id: contactId, name: contactName });
                setPendingContact(null);
            } else {
                const err = await res.json();
                alert(`❌ ${err.error || 'Error al guardar'}`);
            }
        } catch {
            alert('❌ Error de conexión');
        }
        setSavingQuote(false);
    };

    const selectContactForQuote = async (c: any) => {
        setContactSearching(true);
        try {
            const res = await fetch(`/api/contacts/${c.id}`);
            if (res.ok) {
                const data = await res.json();
                setPendingContact(data);
            } else {
                setPendingContact(c);
            }
        } catch {
            setPendingContact(c);
        }
        setContactSearching(false);
    };

    const handleCreateAndSave = async () => {
        if (!newContactName.trim()) return;
        setSavingQuote(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newContactName.trim(),
                    phone: newContactPhone.trim() || undefined,
                    status: 'NEW',
                }),
            });
            if (res.ok) {
                const contact = await res.json();
                await saveQuoteToContact(contact.id, contact.name);
            } else {
                const err = await res.json();
                alert(`❌ ${err.error || 'Error al crear contacto'}`);
                setSavingQuote(false);
            }
        } catch {
            alert('❌ Error de conexión');
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
    };

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
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
                        onClick={() => { setQuoteItems([]); setMarkup(0); setDiscountCash(20); setDiscountTransfer(15); setDiscountCard(0); setFrameSource(null); setUserFrameData({ brand: '', model: '', notes: '' }); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-stone-400 hover:text-red-500 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700 transition-all hover:border-red-200 uppercase tracking-wider"
                    >
                        <RotateCcw className="w-3 h-3" /> Limpiar
                    </button>
                )}
            </header>

            {/* Search + Type Tabs */}
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
                        onClick={() => setActiveType(activeType === null ? 'NONE' : null)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${activeType === null
                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                            : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-100 dark:border-stone-700 hover:border-primary/30'
                            }`}
                    >
                        Todos ({products.length})
                    </button>
                    {availableCategories.map(cat => {
                        const config = getTypeConfig(cat);
                        const count = products.filter(p => getCategoryKey(p.type) === cat).length;
                        const Icon = config.icon;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveType(activeType === cat ? 'NONE' : cat)}
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

            {/* Products Grid / Table — centered, full width */}
            <div
                className="flex-1 overflow-y-auto px-6 py-4"
                style={{ scrollbarWidth: 'thin', paddingBottom: quoteItems.length > 0 ? (cartExpanded ? '420px' : '80px') : '16px' }}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-stone-300">
                        <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-stone-400" />
                        </div>
                        <p className="text-[12px] font-black uppercase tracking-widest text-stone-400 mb-2">
                            {activeType === 'NONE' && !search ? 'Cotizador Listo' : 'Sin resultados'}
                        </p>
                        <p className="text-[10px] font-bold text-stone-500 max-w-[250px] text-center">
                            {activeType === 'NONE' && !search ? 'Seleccione una categoría arriba o busque un producto para comenzar a cotizar.' : 'Intente con otros términos de búsqueda o cambie de categoría.'}
                        </p>
                    </div>
                ) : activeType?.startsWith('Cristal') ? (
                    /* ── Crystal Table View ── */
                    <div className="max-w-[1500px] mx-auto">
                        <div className="rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden shadow-xl bg-white dark:bg-stone-900">
                            <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', maxHeight: 'calc(100vh - 240px)' }}>
                                <table className="w-full text-left border-collapse" style={{ minWidth: 1000 }}>
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900">
                                            <th className="px-3 py-3 text-[8px] font-black text-stone-300 uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 w-[90px]">Tipo</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-white uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 w-[80px]">Marca</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-white uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 text-center w-[55px]">Índice</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-white uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50">Descripción</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-white uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 text-right w-[95px]">
                                                <span className="block">💰 Lista</span>
                                                {markup > 0 && <span className="text-blue-300 text-[7px] font-bold">+{markup}% MU</span>}
                                            </th>
                                            <th className="px-3 py-3 text-[8px] font-black text-emerald-300 uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 text-right w-[95px]">
                                                <span className="block">💵 Efectivo</span>
                                                {discountCash > 0 && <span className="text-emerald-400 text-[7px] font-bold">-{discountCash}%</span>}
                                            </th>
                                            <th className="px-3 py-3 text-[8px] font-black text-violet-300 uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 text-right w-[95px]">
                                                <span className="block">🏦 Transf</span>
                                                {discountTransfer > 0 && <span className="text-violet-400 text-[7px] font-bold">-{discountTransfer}%</span>}
                                            </th>
                                            <th className="px-3 py-3 text-[8px] font-black text-orange-300 uppercase tracking-[0.15em] whitespace-nowrap border-r border-stone-700/50 text-right w-[80px]">
                                                <span className="block">3 cuotas</span>
                                                <span className="text-orange-400 text-[7px] font-bold">s/interés</span>
                                            </th>
                                            <th className="px-3 py-3 text-[8px] font-black text-orange-200 uppercase tracking-[0.15em] whitespace-nowrap text-right w-[80px]">
                                                <span className="block">6 cuotas</span>
                                                <span className="text-orange-300 text-[7px] font-bold">s/interés</span>
                                            </th>
                                            <th className="px-1 py-3 w-10 bg-stone-900"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((product, idx) => {
                                            const inQuote = quoteItems.find(i => i.product.id === product.id);
                                            const rowTotal = product.price * (1 + markup / 100);
                                            const rowEfectivo = rowTotal * (1 - discountCash / 100);
                                            const rowTransfer = rowTotal * (1 - discountTransfer / 100);
                                            const rowCuota3 = rowTotal / 3;
                                            const rowCuota6 = rowTotal / 6;
                                            const subtypes = ['Multifocal', 'Monofocal', 'Bifocal', 'Ocupacional', 'Coquil'];
                                            const detectedSubtype = subtypes.find(s => product.name?.toLowerCase().includes(s.toLowerCase())) || product.type || '—';
                                            return (
                                                <tr
                                                    key={product.id}
                                                    onClick={() => addToQuote(product)}
                                                    className={`cursor-pointer transition-all group border-b border-stone-100/80 dark:border-stone-800/80 ${inQuote
                                                        ? 'bg-emerald-50/80 dark:bg-emerald-900/20 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800'
                                                        : idx % 2 === 0
                                                            ? 'bg-white dark:bg-stone-900 hover:bg-amber-50/50 dark:hover:bg-stone-800/60'
                                                            : 'bg-stone-50/60 dark:bg-stone-850/40 hover:bg-amber-50/50 dark:hover:bg-stone-800/60'
                                                        }`}
                                                >
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${detectedSubtype === 'Multifocal' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                            : detectedSubtype === 'Monofocal' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                : detectedSubtype === 'Bifocal' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700'
                                                                    : detectedSubtype === 'Ocupacional' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700'
                                                                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                                                            }`}>
                                                            {detectedSubtype.length > 10 ? detectedSubtype.slice(0, 8) + '..' : detectedSubtype}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800">
                                                        <span className="text-[9px] font-black text-stone-600 dark:text-stone-300 uppercase">
                                                            {product.brand || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-stone-100 dark:border-stone-800 text-center">
                                                        {product.lensIndex ? (
                                                            <span className="inline-block px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[9px] font-black text-stone-600 dark:text-stone-300">
                                                                {product.lensIndex}
                                                            </span>
                                                        ) : <span className="text-[9px] text-stone-300">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[9px] font-bold text-stone-700 dark:text-stone-200 leading-tight max-w-[280px] truncate" title={product.name || ''}>
                                                                {product.name || `${product.brand || ''} ${product.model || ''}`}
                                                            </p>
                                                            {isMultifocalProduct(product) && (
                                                                <span className={`flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${
                                                                    isMiPrimerVarilux(product)
                                                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                                                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                }`}>
                                                                    🎁 {isMiPrimerVarilux(product) ? '2x1' : '2x1 + Armazón'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800 text-right tabular-nums">
                                                        <span className="text-[10px] font-black text-stone-800 dark:text-white">
                                                            ${Math.round(rowTotal).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800 text-right tabular-nums">
                                                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                                                            ${Math.round(rowEfectivo).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800 text-right tabular-nums">
                                                        <span className="text-[10px] font-black text-violet-700 dark:text-violet-400">
                                                            ${Math.round(rowTransfer).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 border-r border-stone-100 dark:border-stone-800 text-right tabular-nums">
                                                        <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                                            ${Math.round(rowCuota3).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums">
                                                        <span className="text-[10px] font-bold text-orange-500 dark:text-orange-300">
                                                            ${Math.round(rowCuota6).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-1 py-2 text-center">
                                                        {inQuote ? (
                                                            <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black mx-auto shadow-lg shadow-emerald-500/30">
                                                                {inQuote.quantity}
                                                            </span>
                                                        ) : (
                                                            <span className="w-6 h-6 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-stone-300 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/20 transition-all mx-auto">
                                                                <Plus className="w-3 h-3" />
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {/* Table footer */}
                            <div className="px-4 py-2.5 bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-800/50 dark:to-stone-800/80 border-t border-stone-200 dark:border-stone-700 flex items-center justify-between">
                                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">
                                    🔬 {filtered.length} cristales
                                </span>
                                <span className="text-[9px] font-bold text-stone-400 flex items-center gap-1.5">
                                    <span className="w-4 h-4 bg-stone-200 dark:bg-stone-700 rounded-full flex items-center justify-center"><Plus className="w-2 h-2" /></span>
                                    Click en una fila para agregar
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Standard Card Grid ── */
                    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                        {filtered.map(product => {
                            const inQuote = quoteItems.find(i => i.product.id === product.id);
                            const atMaxStock = !isCrystal(product) && inQuote && inQuote.quantity >= product.stock;
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => !atMaxStock && addToQuote(product)}
                                    disabled={!!atMaxStock}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all group text-left border ${atMaxStock
                                        ? 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-700 opacity-50 cursor-not-allowed'
                                        : inQuote
                                            ? 'bg-primary/5 border-primary/30 shadow-sm'
                                            : 'bg-sidebar border-sidebar-border hover:border-primary/30 hover:shadow-md hover:-translate-y-px active:scale-[0.98]'
                                        }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-stone-800 dark:text-white uppercase tracking-tight text-[11px] truncate leading-tight">
                                            {product.brand} {product.model || ''}
                                        </p>
                                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest truncate">
                                            {product.name || product.type || '—'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="font-black text-primary text-xs">${product.price.toLocaleString()}</p>
                                            {!isCrystal(product) && product.stock <= 3 && (
                                                <span className="text-[8px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                                                    {product.stock === 1 ? 'Último!' : `${product.stock} disp.`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {atMaxStock ? (
                                        <span className="w-6 h-6 bg-stone-300 dark:bg-stone-600 text-white rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ml-2" title="Stock máximo alcanzado">
                                            {inQuote.quantity}
                                        </span>
                                    ) : inQuote ? (
                                        <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ml-2">
                                            {inQuote.quantity}
                                        </span>
                                    ) : (
                                        <span className="w-6 h-6 bg-stone-50 dark:bg-stone-900 rounded-full flex items-center justify-center text-stone-300 group-hover:bg-primary group-hover:text-white transition-all flex-shrink-0 ml-2">
                                            <Plus className="w-3 h-3" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )
                }
            </div >

            {/* Sticky Bottom Cart Bar */}
            {
                quoteItems.length > 0 && (
                    <div
                        className={`fixed bottom-0 left-64 right-0 bg-sidebar border-t border-sidebar-border shadow-[0_-8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 z-50 ${cartExpanded ? 'max-h-[600px]' : 'max-h-[72px]'
                            }`}
                    >
                        {/* Collapsed bar — always visible */}
                        <button
                            onClick={() => setCartExpanded(!cartExpanded)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-stone-300">
                                        Presupuesto
                                    </span>
                                    <span className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded-full">
                                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                    </span>
                                </div>
                                {!cartExpanded && markup > 0 && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                        +{markup}% markup
                                    </span>
                                )}
                                {!cartExpanded && discountCash > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                        -{discountCash}% efvo
                                    </span>
                                )}
                                {!cartExpanded && hasCrystals && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${frameSource ? 'text-amber-700 bg-amber-50' : 'text-red-600 bg-red-50 animate-pulse'}`}>
                                        🕶️ {frameSource ? (frameSource === 'OPTICA' ? 'Armazón óptica' : 'Armazón usuario') : 'Sin armazón'}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-stone-900 dark:text-white tracking-tighter">
                                    ${Math.round(totalCash).toLocaleString()}
                                </span>
                                {cartExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-stone-400" />
                                ) : (
                                    <ChevronUp className="w-5 h-5 text-stone-400" />
                                )}
                            </div>
                        </button>

                        {/* Expanded panel */}
                        {cartExpanded && (
                            <div className="border-t border-sidebar-border animate-in slide-in-from-bottom-4 duration-200">
                                <div className="max-w-5xl mx-auto px-6 py-4">
                                    {/* Items row */}
                                    <div className="flex gap-3 overflow-x-auto pb-3 mb-3" style={{ scrollbarWidth: 'thin' }}>
                                        {quoteItems.map(item => (
                                            <div
                                                key={item.uid}
                                                className="flex-shrink-0 w-56 p-3 bg-white dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                                                        {item.eye && (
                                                            <span className={`self-start px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest italic leading-none ${item.eye === 'OD' ? 'bg-stone-900 text-white dark:bg-stone-700' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>
                                                                {item.eye}
                                                            </span>
                                                        )}
                                                        <p className="font-black text-[10px] uppercase tracking-tight truncate leading-tight">
                                                            {item.product.brand} {item.product.model || ''}
                                                        </p>
                                                        <p className="text-[8px] font-bold text-stone-400 tracking-widest uppercase truncate">
                                                            {item.product.name || item.product.type || '—'}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => removeItem(item.uid)} className="p-0.5 text-stone-200 hover:text-red-500 transition-colors">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1 bg-stone-50 dark:bg-stone-900 rounded-lg p-0.5 border border-stone-100 dark:border-stone-700">
                                                        <button onClick={() => updateQuantity(item.uid, -1)} className="w-6 h-6 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center transition-colors">
                                                            <Minus className="w-2.5 h-2.5" />
                                                        </button>
                                                        <span className="font-black text-[11px] w-5 text-center">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item.uid, 1)} className="w-6 h-6 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center transition-colors">
                                                            <Plus className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-1 px-1.5 py-1">
                                                        <span className="font-black text-[11px] text-stone-500 cursor-not-allowed select-none">
                                                            ${(item.customPrice * item.quantity * (1 + markup / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Promo banner */}
                                    {hasAnyMultifocal && (
                                        <div className={`mb-3 p-3 rounded-xl border-2 flex items-center gap-3 ${hasMultifocalPromo
                                            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-300 dark:border-emerald-700'
                                            : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                        }`}>
                                            <Gift className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                                    🎁 Promoción Multifocal 2x1
                                                </p>
                                                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    {hasMultifocalPromo
                                                        ? `Incluye armazón Atelier sin cargo${atelierAvgPrice > 0 ? ` (valor bonif. ~$${atelierAvgPrice.toLocaleString()})` : ''}`
                                                        : 'Mi Primer Varilux — solo incluye el par de cristales'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Frame section — when crystals are present */}
                                    {hasCrystals && (
                                        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-200 dark:border-amber-800 flex items-start gap-4">
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Glasses className="w-4 h-4 text-amber-600" />
                                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Armazón</span>
                                                {hasMultifocalPromo && (
                                                    <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[7px] font-black uppercase tracking-wider animate-pulse">
                                                        Bonificado
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => { setFrameSource('OPTICA'); setFrameSearch(''); }}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${frameSource === 'OPTICA'
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                                        : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                                        }`}
                                                >
                                                    De la Óptica
                                                </button>
                                                <button
                                                    onClick={() => setFrameSource('USUARIO')}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border flex items-center gap-1 ${frameSource === 'USUARIO'
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                                        : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                                        }`}
                                                >
                                                    <User className="w-3 h-3" /> Del Usuario
                                                </button>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {frameSource === 'OPTICA' && !hasFrameFromOptica && (
                                                    <div>
                                                        <div className="relative mb-1.5">
                                                            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-300" />
                                                            <input
                                                                type="text"
                                                                placeholder="Buscar armazón..."
                                                                value={frameSearch}
                                                                onChange={e => setFrameSearch(e.target.value)}
                                                                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 pl-7 pr-3 rounded-lg text-[10px] font-semibold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                            />
                                                        </div>
                                                        {frameResults.length > 0 && (
                                                            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                                                                {frameResults.map(fr => (
                                                                    <button
                                                                        key={fr.id}
                                                                        onClick={() => { addToQuote(fr, hasMultifocalPromo); setFrameSearch(''); }}
                                                                        className={`flex-shrink-0 flex items-center gap-2 p-2 rounded-lg border transition-all ${hasMultifocalPromo && isAtelierFrame(fr)
                                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 hover:border-emerald-400 ring-1 ring-emerald-300/50'
                                                                            : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-amber-300'
                                                                        }`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <p className="text-[10px] font-black truncate">{fr.brand} {fr.model || ''}</p>
                                                                            {hasMultifocalPromo && isAtelierFrame(fr) ? (
                                                                                <p className="text-[8px] font-black text-emerald-600">✨ BONIFICADO <span className="line-through text-stone-400 font-bold">${fr.price.toLocaleString()}</span></p>
                                                                            ) : hasMultifocalPromo ? (
                                                                                <p className="text-[8px] font-bold text-stone-400">
                                                                                    <span className="line-through">${fr.price.toLocaleString()}</span>
                                                                                    <span className="text-emerald-600 ml-1 font-black">${Math.max(0, fr.price - atelierAvgPrice).toLocaleString()}</span>
                                                                                    <span className="text-emerald-500 ml-0.5">(-${Math.min(atelierAvgPrice, fr.price).toLocaleString()})</span>
                                                                                </p>
                                                                            ) : (
                                                                                <p className="text-[8px] text-stone-400 font-bold">${fr.price.toLocaleString()}</p>
                                                                            )}
                                                                        </div>
                                                                        {hasMultifocalPromo && isAtelierFrame(fr) ? (
                                                                            <Gift className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                                                        ) : (
                                                                            <Plus className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {frameSource === 'OPTICA' && hasFrameFromOptica && (
                                                    <div className="py-1">
                                                        {hasMultifocalPromo && frameItemInQuote ? (
                                                            <div className="flex items-center gap-2">
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                {isAtelierFrame(frameItemInQuote.product) ? (
                                                                    <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                                                                        ✨ {frameItemInQuote.product.brand} {frameItemInQuote.product.model || ''} — BONIFICADO
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                                                        {frameItemInQuote.product.brand} {frameItemInQuote.product.model || ''} — Bonif. Atelier -${promoFrameDiscount.toLocaleString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                                <Check className="w-3 h-3" /> Armazón incluido en el presupuesto
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {frameSource === 'USUARIO' && (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Marca"
                                                            value={userFrameData.brand}
                                                            onChange={e => setUserFrameData(prev => ({ ...prev, brand: e.target.value }))}
                                                            className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-3 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Modelo"
                                                            value={userFrameData.model}
                                                            onChange={e => setUserFrameData(prev => ({ ...prev, model: e.target.value }))}
                                                            className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-3 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Observaciones"
                                                            value={userFrameData.notes}
                                                            onChange={e => setUserFrameData(prev => ({ ...prev, notes: e.target.value }))}
                                                            className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-3 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                        />
                                                    </div>
                                                )}
                                                {!frameSource && (
                                                    <p className="text-[9px] font-black text-amber-600 animate-pulse py-1">⚠️ Seleccioná un armazón para los cristales</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom row: markup + discounts + totals + actions */}
                                    <div className="pt-3 border-t border-stone-100 dark:border-stone-700 space-y-3">
                                        {/* Markup + Discounts Row */}
                                        <div className="flex items-start gap-6 flex-wrap">
                                            {/* Markup */}
                                            <div className="flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Markup</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={markup || ''}
                                                    onChange={e => setMarkup(Math.abs(Number(e.target.value)))}
                                                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                    placeholder="0"
                                                    className="w-16 bg-white dark:bg-stone-800 border border-blue-200 dark:border-stone-700 rounded-md px-2 py-1 text-[10px] font-black text-center outline-none focus:ring-2 focus:ring-blue-200"
                                                />
                                                <span className="text-[9px] font-bold text-stone-400">%</span>
                                                {markup > 0 && <span className="text-[10px] font-bold text-blue-500">+${Math.round(markupAmount).toLocaleString()}</span>}
                                            </div>

                                            <div className="w-px h-8 bg-stone-200 dark:bg-stone-700" />

                                            {/* Dto Efectivo */}
                                            <div className="flex items-center gap-1.5">
                                                <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Efvo</span>
                                                <select
                                                    value={discountCash}
                                                    onChange={e => setDiscountCash(Number(e.target.value))}
                                                    className="w-16 bg-white dark:bg-stone-800 border border-emerald-200 dark:border-stone-700 rounded-md px-1 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-emerald-200"
                                                >
                                                    {Array.from({ length: 5 }, (_, i) => i * 5).map(val => (
                                                        <option key={val} value={val}>{val === 0 ? '0%' : `-${val}%`}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Dto Transferencia */}
                                            <div className="flex items-center gap-1.5">
                                                <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />
                                                <span className="text-[9px] font-black text-violet-600 uppercase tracking-widest">Transf</span>
                                                <select
                                                    value={discountTransfer}
                                                    onChange={e => setDiscountTransfer(Number(e.target.value))}
                                                    className="w-16 bg-white dark:bg-stone-800 border border-violet-200 dark:border-stone-700 rounded-md px-1 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-violet-200"
                                                >
                                                    {Array.from({ length: 4 }, (_, i) => i * 5).map(val => (
                                                        <option key={val} value={val}>{val === 0 ? '0%' : `-${val}%`}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Dto Cuotas */}
                                            <div className="flex items-center gap-1.5">
                                                <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                                                <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Cuotas</span>
                                                <select
                                                    value={discountCard}
                                                    onChange={e => setDiscountCard(Number(e.target.value))}
                                                    className="w-16 bg-white dark:bg-stone-800 border border-orange-200 dark:border-stone-700 rounded-md px-1 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-orange-200"
                                                >
                                                    {[0].map(val => (
                                                        <option key={val} value={val}>{val === 0 ? '0%' : `-${val}%`}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Totals + Actions Row */}
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Totals */}
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">Subtotal</div>
                                                    <div className="text-[11px] font-black">${subtotal.toLocaleString()}</div>
                                                </div>
                                                {markup > 0 && (
                                                    <div className="text-right">
                                                        <div className="text-[8px] font-bold text-blue-500 uppercase tracking-wider">+{markup}%</div>
                                                        <div className="text-[11px] font-black text-blue-600">+${Math.round(markupAmount).toLocaleString()}</div>
                                                    </div>
                                                )}
                                                <div className="text-right pl-3 border-l border-stone-200 dark:border-stone-700">
                                                    <div className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Lista</div>
                                                    <div className="text-sm font-black text-stone-600 dark:text-stone-300 tracking-tighter">${Math.round(priceWithMarkup).toLocaleString()}</div>
                                                </div>
                                                <div className="flex gap-3 pl-3 border-l border-stone-200 dark:border-stone-700">
                                                    <div className="text-right">
                                                        <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-0.5 justify-end"><Banknote className="w-2.5 h-2.5" /> Efvo</div>
                                                        <div className="text-lg font-black text-emerald-600 tracking-tighter">${Math.round(totalCash).toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[8px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-0.5 justify-end"><ArrowRightLeft className="w-2.5 h-2.5" /> Transf</div>
                                                        <div className="text-sm font-black text-violet-600 tracking-tighter">${Math.round(totalTransfer).toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[8px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-0.5 justify-end"><CreditCard className="w-2.5 h-2.5" /> Cuotas</div>
                                                        <div className="text-sm font-black text-orange-500 tracking-tighter">${Math.round(totalCard).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={handleCopy}
                                                    className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-1.5 border ${copied
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200'
                                                        : 'bg-white dark:bg-stone-800 text-stone-500 border-stone-100 dark:border-stone-700 hover:border-primary/40 hover:text-primary'
                                                        }`}
                                                >
                                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    {copied ? 'Copiado!' : 'Copiar'}
                                                </button>
                                                <button
                                                    onClick={handleWhatsApp}
                                                    className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                                                >
                                                    <MessageCircle className="w-3 h-3" /> WhatsApp
                                                </button>
                                                <button
                                                    onClick={() => { setShowRegister(!showRegister); setSavedContact(null); }}
                                                    className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95 ${showRegister
                                                        ? 'bg-stone-800 text-white shadow-stone-800/20'
                                                        : 'bg-primary text-primary-foreground shadow-primary/20 animate-pulse hover:animate-none'
                                                        }`}
                                                >
                                                    <BookOpen className="w-3 h-3" /> {showRegister ? 'Cerrar' : 'Registrar'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Register Quote Panel ─────────────────────── */}
                                    {showRegister && (
                                        <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-700 animate-in slide-in-from-bottom-2 duration-200">
                                            {savedContact ? (
                                                /* ── Success ── */
                                                <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl">
                                                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-6 h-6 text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                                                            ¡Presupuesto registrado!
                                                        </p>
                                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                            Guardado en la ficha de <strong>{savedContact.name}</strong>
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => router.push(`/contactos?open=${savedContact.id}`)}
                                                            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-1.5"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> Ver Ficha
                                                        </button>
                                                        <button
                                                            onClick={() => { resetRegister(); setQuoteItems([]); setMarkup(0); setDiscountCash(20); setDiscountTransfer(15); setDiscountCard(0); setFrameSource(null); setCartExpanded(false); }}
                                                            className="px-4 py-2 bg-white dark:bg-stone-800 text-stone-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-stone-200 dark:border-stone-700 hover:scale-105 transition-all flex items-center gap-1.5"
                                                        >
                                                            <RotateCcw className="w-3 h-3" /> Nuevo
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : pendingContact ? (
                                                /* ── Selected Contact & Prescription Step ── */
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <Save className="w-4 h-4 text-primary" />
                                                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                                            Guardar en {pendingContact.name}
                                                        </span>
                                                    </div>

                                                    {/* Prescription Section if Crystals are present */}
                                                    {hasCrystals && (
                                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800">
                                                            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                                <FileText className="w-4 h-4" /> Receta para los cristales
                                                            </p>
                                                            {pendingContact.prescriptions && pendingContact.prescriptions.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    <select
                                                                        value={quotePrescriptionId || ''}
                                                                        onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                        className="w-full bg-white dark:bg-stone-800 border border-emerald-200 dark:border-emerald-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-300"
                                                                    >
                                                                        <option value="">Seleccionar receta guardada...</option>
                                                                        {pendingContact.prescriptions.map((p: any) => (
                                                                            <option key={p.id} value={p.id}>
                                                                                {new Date(p.date).toLocaleDateString('es-AR')} — OD: {p.sphereOD > 0 ? '+' : ''}{p.sphereOD || 0} / OI: {p.sphereOI > 0 ? '+' : ''}{p.sphereOI || 0}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    {!quotePrescriptionId && (
                                                                        <p className="text-[9px] font-black text-emerald-600 animate-pulse">⚠️ Seleccioná una receta para el presupuesto</p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                                    Este contacto no tiene recetas guardadas. Podés guardar el presupuesto y agregar la receta más tarde desde su ficha.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => saveQuoteToContact(pendingContact.id, pendingContact.name)}
                                                            disabled={savingQuote}
                                                            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
                                                        >
                                                            {savingQuote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                            Confirmar Guardado
                                                        </button>
                                                        <button
                                                            onClick={() => { setPendingContact(null); setQuotePrescriptionId(null); }}
                                                            className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                                                        >
                                                            Atrás
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ── Search / Create Contact ── */
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <Save className="w-4 h-4 text-primary" />
                                                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Registrar presupuesto en un contacto</span>
                                                    </div>

                                                    {!showNewContact ? (
                                                        /* Search existing contact */
                                                        <div>
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                    <input
                                                                        ref={contactSearchRef}
                                                                        type="text"
                                                                        placeholder="Buscar contacto por nombre..."
                                                                        value={contactSearch}
                                                                        onChange={e => setContactSearch(e.target.value)}
                                                                        className="w-full bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-2.5 px-9 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-300"
                                                                    />
                                                                    {contactSearching && <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
                                                                </div>
                                                                <button
                                                                    onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }}
                                                                    className="px-4 py-2.5 bg-primary/10 text-primary border-2 border-primary/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-1.5 whitespace-nowrap"
                                                                >
                                                                    <UserPlus className="w-3.5 h-3.5" /> Nuevo
                                                                </button>
                                                            </div>

                                                            {/* Contact Results */}
                                                            {contactResults.length > 0 && (
                                                                <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                                                                    {contactResults.map((c: any) => (
                                                                        <button
                                                                            key={c.id}
                                                                            onClick={() => selectContactForQuote(c)}
                                                                            disabled={savingQuote}
                                                                            className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-xl hover:border-primary/40 hover:shadow-md transition-all group disabled:opacity-50"
                                                                        >
                                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                                <User className="w-3.5 h-3.5 text-primary" />
                                                                            </div>
                                                                            <div className="text-left">
                                                                                <p className="text-[11px] font-black text-stone-800 dark:text-white truncate max-w-[120px]">{c.name}</p>
                                                                                {c.phone && <p className="text-[9px] font-bold text-stone-400">{c.phone}</p>}
                                                                            </div>
                                                                            <ArrowRight className="w-3 h-3 text-stone-300 group-hover:text-primary transition-colors ml-1" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {contactSearch && contactResults.length === 0 && !contactSearching && (
                                                                <p className="mt-2 text-[10px] font-bold text-stone-400 italic">No se encontraron contactos. <button onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }} className="text-primary hover:underline font-black">Crear uno nuevo →</button></p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        /* Create new contact */
                                                        <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-2xl space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                <UserPlus className="w-4 h-4 text-primary" />
                                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Nuevo contacto</span>
                                                                <button onClick={() => setShowNewContact(false)} className="ml-auto text-stone-400 hover:text-stone-600 transition-colors">
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <div className="relative flex-1">
                                                                    <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Nombre del cliente *"
                                                                        value={newContactName}
                                                                        onChange={e => setNewContactName(e.target.value)}
                                                                        autoFocus
                                                                        className="w-full bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 py-2.5 px-9 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-300"
                                                                    />
                                                                </div>
                                                                <div className="relative flex-1">
                                                                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                    <input
                                                                        type="tel"
                                                                        placeholder="Teléfono (opcional)"
                                                                        value={newContactPhone}
                                                                        onChange={e => setNewContactPhone(e.target.value)}
                                                                        className="w-full bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 py-2.5 px-9 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-300"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={handleCreateAndSave}
                                                                    disabled={!newContactName.trim() || savingQuote}
                                                                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap"
                                                                >
                                                                    {savingQuote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                                    {savingQuote ? 'Guardando...' : 'Crear y Guardar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}
