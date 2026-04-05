'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Search, Plus, Minus, Trash2, Copy, MessageCircle,
    Calculator, RotateCcw, Percent, Check, Glasses,
    Layers, Sun, Watch, Eye, ShoppingBag, Sparkles, Pill,
    Pencil, ChevronUp, ChevronDown, ChevronRight, X, User, Save,
    UserPlus, Phone, ArrowRight, ExternalLink, Loader2, BookOpen, FileText,
    TrendingUp, Banknote, CreditCard, ArrowRightLeft, Gift, Tag, History
} from 'lucide-react';
import CotizadorCart from '@/components/quotes/CotizadorCart';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import { 
    isMultifocal2x1, isAtelierFrame, isCrystal, 
    isMiPrimerVarilux, getCategoryKey, isFrame 
} from '@/lib/promo-utils';

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
    isPromo?: boolean;
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
// Delegated to promo-utils

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
    const [previousQuotes, setPreviousQuotes] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
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

    // ── Promotion helpers (Delegated to promo-utils) ──────────

    // Average Atelier frame price for bonification
    const atelierAvgPrice = useMemo(() => {
        const atelierFrames = products.filter(p => {
            const type = (p.type || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const isFrame = type.includes('armazón') || type.includes('armazon') || 
                            category.includes('armazón') || category.includes('armazon') ||
                            category === 'frame' || type === 'frame';
            return isFrame && (p.brand || '').toLowerCase().includes('atelier') && p.price > 0;
        });
        if (atelierFrames.length === 0) return 0;
        return Math.round(atelierFrames.reduce((sum, f) => sum + f.price, 0) / atelierFrames.length);
    }, [products]);

    // Check if quote has a multifocal that qualifies for frame promo
    const hasMultifocalPromo = useMemo(() => {
        return quoteItems.some(item =>
            isCrystal(item.product) && isMultifocal2x1(item.product) && !isMiPrimerVarilux(item.product)
        );
    }, [quoteItems]);

    // Check if quote has any multifocal at all (including Mi Primer Varilux)
    const hasAnyMultifocal = useMemo(() => {
        return quoteItems.some(item => isMultifocal2x1(item.product));
    }, [quoteItems]);

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
    }, [products, search, activeType]);

    // Check if quote has crystals
    const hasCrystals = useMemo(() => {
        return quoteItems.some(item => isCrystal(item.product));
    }, [quoteItems]);

    // Check if quote already has a frame from optica
    const hasFrameFromOptica = useMemo(() => {
        return quoteItems.some(item => isFrame(item.product));
    }, [quoteItems]);

    // Promo frame discount calculation
    const promoFrameDiscount = useMemo(() => {
        if (!hasMultifocalPromo) return 0;
        const frames = quoteItems.filter(item => isFrame(item.product));
        
        // El segundo es sin cargo (siempre y cuando compre uno)
        if (frames.length < 2) return 0;

        // Ordenamos por precio descendente: pagás el más caro, el segundo (o más barato) tiene el beneficio
        const sortedFrames = [...frames].sort((a, b) => b.product.price - a.product.price);
        const secondFrame = sortedFrames[1];

        if (isAtelierFrame(secondFrame.product)) {
            // Atelier = 100% bonificado
            return secondFrame.product.price;
        }
        // Non-Atelier = discount up to Atelier avg price
        return Math.min(atelierAvgPrice, secondFrame.product.price);
    }, [hasMultifocalPromo, quoteItems, atelierAvgPrice]);

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
        return products.filter(p => {
            return isFrame(p) && (
                (p.brand?.toLowerCase().includes(q)) ||
                (p.model?.toLowerCase().includes(q)) ||
                (p.name?.toLowerCase().includes(q))
            );
        }).slice(0, 8);
    }, [products, frameSearch]);

    const addToQuote = useCallback((product: Product, isPromoFrame?: boolean) => {
        const isMultifocal = isMultifocal2x1(product);
        if (isCrystal(product)) {
            const halfPrice = Math.round(product.price / 2);
            
            if (isMultifocal) {
                // Add 4 items (2 paid pairs, 2 promo pairs)
                setQuoteItems(prev => [
                    ...prev,
                    { product, quantity: 1, customPrice: halfPrice, uid: Date.now(), eye: 'OD' },
                    { product, quantity: 1, customPrice: halfPrice, uid: Date.now() + 1, eye: 'OI' },
                    { product, quantity: 1, customPrice: 0, uid: Date.now() + 2, eye: 'OD', isPromo: true },
                    { product, quantity: 1, customPrice: 0, uid: Date.now() + 3, eye: 'OI', isPromo: true }
                ]);
            } else {
                setQuoteItems(prev => [
                    ...prev,
                    { product, quantity: 1, customPrice: halfPrice, uid: Date.now(), eye: 'OD' },
                    { product, quantity: 1, customPrice: halfPrice, uid: Date.now() + 1, eye: 'OI' }
                ]);
            }
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
    }, [atelierAvgPrice]);

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

    const subtotal = Math.max(0, quoteItems.reduce((acc, item) => acc + item.customPrice * item.quantity, 0) - promoFrameDiscount);
    const markupAmount = subtotal * (markup / 100);
    const priceWithMarkup = subtotal + markupAmount;
    const totalCash = priceWithMarkup * (1 - discountCash / 100);
    const totalTransfer = priceWithMarkup * (1 - discountTransfer / 100);
    const totalCard = priceWithMarkup * (1 - discountCard / 100);
    const total = totalCash; // Total principal = efectivo (mejor precio)
    const itemCount = quoteItems.reduce((acc, item) => acc + item.quantity, 0);

    // Frame item for promo display
    const frameItemInQuote = useMemo(() => {
        return quoteItems.find(item => isFrame(item.product));
    }, [quoteItems]);

    const buildQuoteText = () => {
        // Encontrar cuál es el armazón que recibe el descuento para marcarlo en el texto
        const frames = quoteItems.filter(item => isFrame(item.product));
        const sortedFrames = [...frames].sort((a, b) => b.product.price - a.product.price);
        const secondFrameUid = sortedFrames.length >= 2 ? sortedFrames[1].uid : null;

        const lines = quoteItems.map(item => {
            let label = `• ${item.product.brand || ''} ${item.product.model || item.product.name || ''} x${item.quantity}`;
            if (item.eye) label += ` (${item.eye})`;

            if (item.isPromo) {
                label += ` — *SIN CARGO PROMO 2x1* ✨`;
            } else {
                const isFrameProd = isFrame(item.product);

                if (isFrameProd && item.uid === secondFrameUid && promoFrameDiscount > 0) {
                    if (isAtelierFrame(item.product)) {
                        label += ` — *BONIFICADO* ✨`;
                    } else {
                        label += ` — $${Math.round(item.customPrice * item.quantity * (1 + markup / 100)).toLocaleString()} (Bonif. -$${promoFrameDiscount.toLocaleString()})`;
                    }
                } else {
                    label += ` — $${Math.round(item.customPrice * item.quantity * (1 + markup / 100)).toLocaleString()}`;
                }
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
            if (hasMultifocalPromo) text += ` — Incluye armazón Atelier sin cargo (con la compra del primer armazón, el segundo es sin cargo o con descuento equivalente)`;
            text += `\n`;
        }
        text += `\n`;
        text += lines.join('\n');
        // Frame info
        if (hasCrystals && frameSource) {
            text += `\n\n🕶️ *Armazón:*`;
            if (frameSource === 'OPTICA') {
                const frameItem = quoteItems.find(i => isFrame(i.product));
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

            const url = editingQuoteId ? `/api/orders/${editingQuoteId}` : '/api/orders';
            const method = editingQuoteId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
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
                setEditingQuoteId(null);
                // Redirect to the contact's file
                setTimeout(() => {
                    router.push(`/contactos?clientId=${contactId}`);
                }, 1000);
            } else {
                const err = await res.json();
                alert(`❌ ${err.error || 'Error al guardar'}`);
            }
        } catch {
            alert('❌ Error de conexión');
        }
        setSavingQuote(false);
    };

    const handleEditQuote = (order: any) => {
        // Map database items back to QuoteItem structure
        const mappedItems: QuoteItem[] = (order.items || []).map((it: any, idx: number) => ({
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,
            uid: Date.now() + idx, // Ensure unique UIDs
            eye: it.eye as 'OD' | 'OI' | undefined
        }));

        setQuoteItems(mappedItems);
        setMarkup(order.markup || 0);
        setDiscountCash(order.discountCash ?? (order.discount || 20));
        setDiscountTransfer(order.discountTransfer ?? 15);
        setDiscountCard(order.discountCard ?? 0);
        setFrameSource(order.frameSource);
        setUserFrameData({
            brand: order.userFrameBrand || '',
            model: order.userFrameModel || '',
            notes: order.userFrameNotes || ''
        });
        setQuotePrescriptionId(order.prescriptionId || null);
        
        // Find existing contact in results if possible, or set pendings
        if (order.client) {
            setPendingContact({
                id: order.client.id,
                name: order.client.name,
                prescriptions: order.client.prescriptions || []
            });
        }
        
        setEditingQuoteId(order.id);
        setCartExpanded(true);
        setShowHistory(false);
        // Scroll to top of cart
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingQuoteId(null);
        setQuoteItems([]);
        setMarkup(0);
        setFrameSource(null);
        setUserFrameData({ brand: '', model: '', notes: '' });
        setQuotePrescriptionId(null);
        setPendingContact(null);
    };

    const selectContactForQuote = async (c: any) => {
        setContactSearching(true);
        try {
            const res = await fetch(`/api/contacts/${c.id}`);
            if (res.ok) {
                const data = await res.json();
                setPendingContact(data);
                // Also load previous quotes
                setPreviousQuotes((data.orders || []).filter((o: any) => o.orderType === 'QUOTE' && !o.isDeleted));
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
                                                            {isMultifocal2x1(product) && (
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
                            <div className="border-t border-sidebar-border animate-in slide-in-from-bottom-4 duration-200 p-6 overscroll-contain overflow-y-auto max-h-[calc(100vh-100px)]">
                                <div className="max-w-5xl mx-auto">
                                    <div className="flex gap-6 overflow-hidden">
                                        <div className={`flex-1 transition-all duration-500 ${showHistory ? 'max-w-[70%]' : 'max-w-full'}`}>
                                            {!showRegister ? (
                                                <CotizadorCart
                                                    items={quoteItems.map(it => ({ ...it, price: it.customPrice }))}
                                                    setItems={(updater: any) => {
                                                        if (typeof updater === 'function') {
                                                            setQuoteItems(prev => {
                                                                const mapped = prev.map(it => ({ ...it, price: it.customPrice }));
                                                                const result = updater(mapped);
                                                                return result.map((it: any) => ({ ...it, customPrice: it.price }));
                                                            });
                                                        } else {
                                                            setQuoteItems(updater.map((it: any) => ({ ...it, customPrice: it.price })));
                                                        }
                                                    }}
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
                                                    prescriptionId={quotePrescriptionId}
                                                    setPrescriptionId={setQuotePrescriptionId}
                                                    availableProducts={products}
                                                    prescriptions={pendingContact?.prescriptions || []}
                                                    onSave={async () => {
                                                        if (pendingContact) {
                                                            await saveQuoteToContact(pendingContact.id, pendingContact.name);
                                                        } else {
                                                            setShowRegister(true);
                                                        }
                                                    }}
                                                    isSaving={savingQuote}
                                                    contactName={pendingContact?.name}
                                                    onClose={() => setCartExpanded(false)}
                                                    onWhatsApp={handleWhatsApp}
                                                    onCopy={handleCopy}
                                                    editingQuoteId={editingQuoteId}
                                                    onCancelEdit={handleCancelEdit}
                                                    extraActions={
                                                        previousQuotes.length > 0 && (
                                                            <button
                                                                onClick={() => setShowHistory(!showHistory)}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showHistory 
                                                                    ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-lg' 
                                                                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-stone-200'}`}
                                                            >
                                                                <History className="w-3.5 h-3.5" />
                                                                {showHistory ? 'Cerrar Historial' : `Ver Historial (${previousQuotes.length})`}
                                                            </button>
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <div className="bg-white dark:bg-stone-800 border-2 border-primary/20 rounded-[2.5rem] p-8 shadow-2xl relative">

                                            <button 
                                                onClick={() => setShowRegister(false)}
                                                className="absolute top-8 right-8 text-stone-400 hover:text-stone-800 transition-colors"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                            
                                            {savedContact ? (
                                                <div className="py-12 space-y-6 text-center animate-in zoom-in-95 duration-300">
                                                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                                                        <Check className="w-10 h-10 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">¡Presupuesto Guardado!</h4>
                                                        <p className="text-stone-500 font-bold mt-2">Registrado en la ficha de {savedContact.name}</p>
                                                    </div>
                                                    <div className="flex gap-4 justify-center pt-4">
                                                        <button
                                                            onClick={() => router.push(`/contactos?clientId=${savedContact.id}`)}
                                                            className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                                                        >
                                                            VER FICHA DE CONTACTO
                                                        </button>
                                                        <button
                                                            onClick={() => { resetRegister(); setQuoteItems([]); setMarkup(0); setFrameSource(null); setCartExpanded(false); }}
                                                            className="px-8 py-4 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all"
                                                        >
                                                            NUEVO PRESUPUESTO
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-8">
                                                    <div>
                                                        <h3 className="text-2xl font-black text-stone-800 dark:text-white tracking-tighter">Vincular Contacto</h3>
                                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Seleccioná un cliente para guardar el presupuesto</p>
                                                    </div>

                                                    {!showNewContact ? (
                                                        <div className="space-y-6">
                                                            <div className="flex gap-4">
                                                                <div className="relative flex-1">
                                                                    <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                    <input
                                                                        ref={contactSearchRef}
                                                                        type="text"
                                                                        placeholder="Buscar por nombre..."
                                                                        value={contactSearch}
                                                                        onChange={e => setContactSearch(e.target.value)}
                                                                        className="w-full bg-stone-50 dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 py-4 px-14 rounded-3xl text-sm font-black outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-stone-300"
                                                                    />
                                                                    {contactSearching && <Loader2 className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
                                                                </div>
                                                                <button
                                                                    onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }}
                                                                    className="px-8 py-4 bg-primary/10 text-primary border-2 border-primary/20 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                                                                >
                                                                    <Plus className="w-5 h-5" /> NUEVO
                                                                </button>
                                                            </div>

                                                            {contactResults.length > 0 && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto pr-2 pb-4" style={{ scrollbarWidth: 'thin' }}>
                                                                    {contactResults.map((c: any) => (
                                                                        <button
                                                                            key={c.id}
                                                                            onClick={() => selectContactForQuote(c)}
                                                                            className="flex items-center gap-4 p-5 bg-stone-50 dark:bg-stone-900/50 border-2 border-stone-100 dark:border-stone-800 rounded-[2rem] hover:border-primary/40 hover:shadow-xl hover:scale-[1.02] transition-all group text-left"
                                                                        >
                                                                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-stone-800 shadow-sm flex items-center justify-center border border-stone-100 dark:border-stone-700">
                                                                                <User className="w-6 h-6 text-primary" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm font-black text-stone-800 dark:text-white truncate">{c.name}</p>
                                                                                {c.phone && <p className="text-[10px] font-bold text-stone-400">{c.phone}</p>}
                                                                            </div>
                                                                            <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-primary transition-colors" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="p-8 bg-stone-50 dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 rounded-[2.5rem] space-y-6 animate-in slide-in-from-top-4 duration-300">
                                                            <div className="flex items-center gap-4 mb-2">
                                                                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                                                    <Plus className="w-5 h-5" />
                                                                </div>
                                                                <h4 className="text-lg font-black text-stone-800 dark:text-white tracking-tighter">Nuevo Cliente</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">Nombre Completo *</label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Ej: Juan Pérez"
                                                                        value={newContactName}
                                                                        onChange={e => setNewContactName(e.target.value)}
                                                                        className="w-full bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-4 px-6 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-4">WhatsApp</label>
                                                                    <input
                                                                        type="tel"
                                                                        placeholder="Ej: 3511234567"
                                                                        value={newContactPhone}
                                                                        onChange={e => setNewContactPhone(e.target.value)}
                                                                        className="w-full bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 py-4 px-6 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3 pt-2">
                                                                <button
                                                                    onClick={handleCreateAndSave}
                                                                    disabled={!newContactName.trim() || savingQuote}
                                                                    className="flex-1 py-5 bg-primary text-primary-foreground rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 flex justify-center items-center gap-3 disabled:opacity-50"
                                                                >
                                                                    {savingQuote ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                                                    {savingQuote ? 'CREANDO...' : 'CREAR Y GUARDAR'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowNewContact(false)}
                                                                    className="px-8 py-5 bg-white dark:bg-stone-800 text-stone-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest border-2 border-stone-100 dark:border-stone-700 hover:text-stone-800 transition-all"
                                                                >
                                                                    CANCELAR
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>



                                        {showHistory && (
                                            <div className="w-[30%] border-l border-stone-100 dark:border-stone-800 bg-stone-50/10 dark:bg-stone-900/50 overflow-y-auto p-6 animate-in slide-in-from-right duration-500">
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <History className="w-4 h-4 text-stone-400" />
                                                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Presupuestos Anteriores</h3>
                                                    </div>
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
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div>
    );
}



