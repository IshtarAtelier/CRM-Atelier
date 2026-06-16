'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { 
    Search, 
    Calculator, 
    ShoppingBag, 
    Plus, 
    X, 
    Loader2, 
    History,
    ChevronDown,
    ChevronUp,
    User,
    Check,
    FileText,
    ChevronRight,
    RotateCcw,
    Phone,
    Building2,
    Stethoscope,
    Mail
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
import CotizadorCart from '@/components/quotes/CotizadorCart';
import { resolveStorageUrl } from '@/lib/utils/storage';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import { 
    isCrystal, 
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
import type { Product } from '@/types/orders';
import Image from "next/image";

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

const CONTACT_SOURCES = ["Google Ads", "Meta", "Calle", "Jemima", "Ya es Cliente", "Tienda nube", "Referido", "Wave", "Salida", "Otros"];
const PRODUCT_TYPES = ["Monofocal", "Multifocal", "Bifocal", "Ocupacional", "Solar", "Accesorios", "Lentes de Contacto", "Otros"];

interface QuoteItem {
    product: Product;
    quantity: number;
    customPrice: number;
    eye?: 'OD' | 'OI';
    crystalColor?: string;
    crystalColorType?: string;
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
    const [onlyWeb, setOnlyWeb] = useState(false);
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
    const [newContactDni, setNewContactDni] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');
    const [newContactSource, setNewContactSource] = useState('');
    const [newContactInterest, setNewContactInterest] = useState('');
    const [newContactInsurance, setNewContactInsurance] = useState('');
    const [newContactDoctor, setNewContactDoctor] = useState('');
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [savingQuote, setSavingQuote] = useState(false);
    const [savedContact, setSavedContact] = useState<{ id: string, name: string } | null>(null);
    const [quotePrescriptionId, setQuotePrescriptionId] = useState<string | null>(null);
    const [previousQuotes, setPreviousQuotes] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Editing states
    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(editId);

    // Crystal colors for teñido addon
    const [crystalColors, setCrystalColors] = useState<any[]>([]);

    const searchRef = useRef<HTMLInputElement>(null);
    const contactSearchRef = useRef<HTMLInputElement>(null);

    // Initial load
    // Fetch doctors for the new contact form
    useEffect(() => {
        fetch('/api/doctors').then(res => res.json()).then(data => { if (Array.isArray(data)) setDoctors(data); }).catch((err) => console.error("Error fetching doctors:", err));
        fetch('/api/crystal-colors').then(res => res.json()).then(data => { if (Array.isArray(data)) setCrystalColors(data); }).catch((err) => console.error("Error fetching crystal colors:", err));
    }, []);

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
        const normalizeText = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const words = search ? normalizeText(search).split(/\s+/).filter(Boolean) : [];

        return products.filter(p => {
            const matchesSearch = words.length === 0 || (() => {
                const haystack = normalizeText(`${p.brand || ''} ${p.model || ''} ${p.name || ''} ${p.type || ''} ${p.category || ''} ${p.lensIndex || ''}`);
                return words.every(w => haystack.includes(w));
            })();
            
            const matchesWeb = !onlyWeb || p.publishToWeb === true;
            
            if (activeType === 'NONE') return matchesSearch && matchesWeb;
            if (activeType) return matchesSearch && matchesWeb && getCategoryKey(p.type, p.category) === activeType;
            return matchesSearch && matchesWeb;
        }).sort((a, b) => (a.price || 0) - (b.price || 0));
    }, [products, search, activeType, onlyWeb]);

    const groupedProducts = useMemo(() => {
        const groups: { [key: string]: Product[] } = {};
        filtered.forEach(p => {
            const brand = p.brand?.trim() || 'Otros';
            if (!groups[brand]) {
                groups[brand] = [];
            }
            groups[brand].push(p);
        });
        return groups;
    }, [filtered]);

    const sortedBrands = useMemo(() => {
        return Object.keys(groupedProducts).sort((a, b) => {
            if (a === 'Otros') return 1;
            if (b === 'Otros') return -1;
            return a.localeCompare(b);
        });
    }, [groupedProducts]);

    // Cart logic
    const addToQuote = (p: Product) => {
        const sprice = safePrice(p.price);
        
        // Teñido addon validation: warn if no orgánico blanco in cart
        const isTeñidoAddon = (p.name || '').toLowerCase() === 'teñido' && p.type === 'ADDON';
        if (isTeñidoAddon) {
            const hasOrganicoBlanco = quoteItems.some(item => {
                const name = (item.product.name || '').toLowerCase();
                return isCrystal(item.product) && (name.includes('orgánico blanco') || name.includes('organico blanco'));
            });
            if (!hasOrganicoBlanco) {
                const proceed = window.confirm(
                    '⚠️ ADVERTENCIA\n\nEl Teñido solo se puede aplicar sobre cristales de tipo "Orgánico Blanco".\n\nNo se detectó un cristal orgánico blanco en el presupuesto.\n\n¿Deseas agregarlo de todas formas?'
                );
                if (!proceed) return;
            }
            // Teñido is not a crystal to split OD/OI — it's a flat service addon
            setQuoteItems(prev => [...prev, { product: p, quantity: 1, customPrice: sprice, uid: Date.now() } as any]);
            return;
        }
        
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
        if (savingQuote) return;
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
                        eye: it.eye,
                        crystalColor: it.crystalColor || null,
                        crystalColorType: it.crystalColorType || null,
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
        if (!newContactName.trim() || !newContactPhone.trim() || !newContactSource || !newContactInterest) {
            alert('Por favor completá los campos obligatorios: Nombre, Teléfono, Etiqueta y Tipo de Producto.');
            return;
        }
        if (savingQuote) return;
        setDuplicateError(null);
        setSavingQuote(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newContactName, 
                    phone: newContactPhone,
                    dni: newContactDni || null,
                    email: newContactEmail || null,
                    contactSource: newContactSource,
                    interest: newContactInterest,
                    insurance: newContactInsurance || null,
                    doctor: newContactDoctor || null
                }),
            });
            if (res.ok) {
                setDuplicateError(null);
                const contact = await res.json();
                await saveQuoteToContact(contact.id, contact.name);
            } else {
                const err = await res.json();
                const errorMsg = err.details || err.error || 'Error al crear contacto';
                setDuplicateError(errorMsg);
                setSavingQuote(false);
            }
        } catch (err) {
            console.error(err);
            setDuplicateError('Error de conexión al crear contacto');
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
        setNewContactDni('');
        setNewContactEmail('');
        setNewContactSource('');
        setNewContactInterest('');
        setNewContactInsurance('');
        setNewContactDoctor('');
        setDuplicateError(null);
        setSavedContact(null);
        setPendingContact(null);
        setQuotePrescriptionId(null);
        setEditingQuoteId(null);
        // Clear URL search params
        router.replace('/admin/cotizador');
    };

    const handleWhatsApp = async () => {
        if (!pendingContact?.phone) {
            console.error('El contacto no tiene teléfono');
            return;
        }
        const listPrice = Math.round(totalWithMarkup);
        const inst3 = Math.round(listPrice / 3);
        const inst6 = Math.round(listPrice / 6);
        
        // Build the message
        let msg = `Hola ${pendingContact.name}, te envío el presupuesto solicitado:\n\n`;
        quoteItems.forEach(it => {
            msg += `- ${it.product.brand} · ${it.product.name || ''} ${it.eye ? '['+it.eye+']' : ''}: $${it.customPrice.toLocaleString()}\n`;
        });
        msg += `\n*Precio Lista: $${listPrice.toLocaleString()}*\n`;
        msg += `💰 Efectivo (-${discountCash}%): $${Math.round(totalCash).toLocaleString()}\n`;
        msg += `🏦 Transferencia (-${discountTransfer}%): $${Math.round(totalWithMarkup * (1 - discountTransfer / 100)).toLocaleString()}\n`;
        msg += `💳 Tarjeta (Lista): $${listPrice.toLocaleString()}\n`;
        msg += `   ↳ 3 cuotas sin interés: $${inst3.toLocaleString()} c/u\n`;
        msg += `   ↳ 6 cuotas sin interés: $${inst6.toLocaleString()} c/u\n`;
        msg += `\nAtelier Óptica`;
        
        let phone = pendingContact.phone.replace(/\D/g, '');
        if (phone.length === 10) phone = '549' + phone;

        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: `${phone}@c.us`, message: msg })
            });

            if (res.ok) {
                alert('✅ Presupuesto enviado por WhatsApp');
            } else {
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
            }
        } catch (err) {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    };


    const handleCopy = () => {
        let text = `PRESUPUESTO ATELIER\n\n`;
        quoteItems.forEach(it => {
            text += `• ${it.product.brand} · ${it.product.name || ''} ${it.eye ? '['+it.eye+']' : ''}: $${it.customPrice.toLocaleString()}\n`;
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
        router.replace('/admin/cotizador');
    };

    const clientName = pendingContact?.name;

    return (
        <div className="absolute inset-0 flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <header className="px-4 lg:px-8 py-3 border-b border-sidebar-border bg-sidebar flex items-center gap-4 flex-shrink-0">
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
                        onClick={() => { setQuoteItems([]); setMarkup(0); setFrameSource(null); setEditingQuoteId(null); router.replace('/admin/cotizador'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-stone-400 hover:text-red-500 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700 transition-all hover:border-red-200 uppercase tracking-wider"
                    >
                        <RotateCcw className="w-3 h-3" /> Limpiar
                    </button>
                )}
            </header>

            {/* Search + Categories */}
            <div className="px-4 lg:px-8 py-3.5 border-b border-sidebar-border bg-sidebar/65 flex flex-col md:flex-row md:items-center gap-3 flex-shrink-0">
                <div className="relative w-full md:w-64 flex-shrink-0">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-750 py-2 px-9 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-400 dark:text-stone-100"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs">✕</button>
                    )}
                </div>
                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                        onClick={() => setActiveType(null)}
                        className={`h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border flex items-center justify-center ${activeType === null
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/95'
                            : 'bg-white dark:bg-stone-850 text-stone-500 border-stone-200 dark:border-stone-750 hover:border-primary/30 hover:text-stone-700 dark:hover:text-white'
                            }`}
                    >
                        Todos ({products.length})
                    </button>
                    <button
                        onClick={() => setOnlyWeb(!onlyWeb)}
                        className={`h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${onlyWeb
                            ? 'bg-violet-600 text-white border-violet-600 shadow-sm hover:bg-violet-700'
                            : 'bg-white dark:bg-stone-850 text-violet-650 border-violet-200 hover:border-violet-300 dark:border-violet-900/50 dark:text-violet-400'
                            }`}
                    >
                        🌐 Web
                    </button>
                    {availableCategories.map(cat => {
                        const config = getTypeConfig(cat);
                        const count = products.filter(p => getCategoryKey(p.type, p.category) === cat).length;
                        const Icon = config.icon;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveType(cat)}
                                className={`h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${activeType === cat
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
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
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                {/* Left Column: Product Catalog */}
                <div
                    className="flex-1 overflow-y-auto px-4 lg:px-8 py-4"
                    style={{ scrollbarWidth: 'thin' }}
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
                            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-md bg-white dark:bg-stone-900">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse" style={{ minWidth: 1000 }}>
                                        <thead>
                                            <tr className="bg-stone-50 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 border-b border-stone-200/60 dark:border-stone-800">
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-[100px]">Tipo</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider w-[100px]">Marca</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center w-[70px]">Índice</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Descripción</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right w-[110px]">Lista</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right w-[110px] text-emerald-600 dark:text-emerald-400">Efectivo</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right w-[110px] text-violet-600 dark:text-violet-400">Transf.</th>
                                                <th className="px-3 py-3 w-12 text-center"></th>
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
                                                        className={`cursor-pointer transition-colors border-b border-stone-100 dark:border-stone-800 ${idx % 2 === 0 ? 'bg-white dark:bg-stone-900' : 'bg-stone-50/30 dark:bg-stone-850/20'} hover:bg-primary/5`}
                                                    >
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-[10px] font-bold uppercase text-stone-400">{product.type || 'Cristal'}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-[10px] font-bold uppercase">{product.brand || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="text-[10px] font-bold">{product.lensIndex || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <p className="text-xs font-semibold truncate max-w-xs xl:max-w-sm">{product.name || '—'}</p>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-xs">${Math.round(pTotal).toLocaleString()}</td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-xs text-emerald-650">${Math.round(pCash).toLocaleString()}</td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-xs text-violet-650">${Math.round(pTrans).toLocaleString()}</td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            {inQuote ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <Plus className="w-4 h-4 text-stone-300 group-hover:text-primary mx-auto transition-colors" />}
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
                        <div className="max-w-[1500px] mx-auto flex flex-col gap-6">
                            {sortedBrands.map(brandName => {
                                const brandProducts = groupedProducts[brandName] || [];
                                return (
                                    <div key={brandName} className="space-y-2">
                                        <div className="flex items-center gap-3 py-1">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
                                                {brandName}
                                            </h3>
                                            <div className="h-px flex-1 bg-stone-205 dark:bg-stone-800/50" />
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                                {brandProducts.length} {brandProducts.length === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {brandProducts.map(product => {
                                                const inQuote = quoteItems.find(i => i.product.id === product.id);
                                                const config = getTypeConfig(product.type, product.category);
                                                const TypeIcon = config.icon;
                                                return (
                                                    <button
                                                        key={product.id}
                                                        onClick={() => addToQuote(product)}
                                                        className={`w-full p-3 rounded-xl border transition-all text-left flex items-center justify-between hover:shadow-sm duration-200 group ${inQuote 
                                                            ? 'bg-primary/[0.03] border-primary/30 shadow-sm' 
                                                            : 'bg-white dark:bg-stone-900 border-stone-200/70 dark:border-stone-800'}`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            {(() => {
                                                                 const imgUrl = resolveStorageUrl(product.imagenesCatalogo?.[0] || product.rawImageUrls?.[0] || null);
                                                                 if (imgUrl) {
                                                                     return (
                                                                         <Image 
                                                                             src={imgUrl} 
                                                                             alt={product.name || ''} 
                                                                             className="w-8 h-8 object-contain rounded-lg border border-stone-200 dark:border-stone-850 bg-stone-50 dark:bg-stone-900 shadow-sm shrink-0" 
                                                                         />
                                                                     );
                                                                 }
                                                                 return (
                                                                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${inQuote ? 'bg-primary/10 text-primary' : 'bg-stone-50 dark:bg-stone-850 text-stone-400 dark:text-stone-500 group-hover:bg-primary/5 group-hover:text-primary transition-colors'}`}>
                                                                         <TypeIcon className="w-4 h-4" />
                                                                     </div>
                                                                 );
                                                             })()}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                                                                        {product.type || 'Otros'}
                                                                    </span>
                                                                    {product.stock !== undefined && product.stock <= 2 && (
                                                                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
                                                                            Stock: {product.stock}
                                                                        </span>
                                                                    )}
                                                                    {product.publishToWeb && (
                                                                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/20 text-violet-750 dark:text-violet-400">
                                                                            🌐 Web
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs font-semibold mt-1 text-stone-800 dark:text-stone-200 group-hover:text-stone-900 dark:group-hover:text-white transition-colors truncate">
                                                                    {product.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                                            <p className="text-xs font-bold text-primary">
                                                                ${safePrice(product.price).toLocaleString()}
                                                            </p>
                                                            {inQuote ? (
                                                                <div className="flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-[10px] font-bold shadow-md shadow-primary/20">
                                                                    {inQuote.quantity}
                                                                </div>
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center group-hover:border-primary/45 group-hover:bg-primary/5 transition-all">
                                                                    <Plus className="w-3.5 h-3.5 text-stone-400 group-hover:text-primary transition-colors" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Column: Desktop Cart (Sticky Sidebar) */}
                {quoteItems.length > 0 && (
                    <div className="hidden lg:flex w-[400px] xl:w-[460px] border-l border-sidebar-border bg-white dark:bg-stone-900 relative z-50 shadow-xl flex-col h-full overflow-y-auto flex-shrink-0 animate-in slide-in-from-right duration-300" style={{ scrollbarWidth: 'thin' }}>
                        <div className="flex-1 p-6">
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
                                    isCard={false}
                                    extraActions={
                                        previousQuotes.length > 0 && (
                                            <button
                                                onClick={() => setShowHistory(!showHistory)}
                                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${showHistory 
                                                    ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-md' 
                                                    : 'bg-stone-100 dark:bg-stone-850 text-stone-500 hover:bg-stone-205'}`}
                                            >
                                                <History className="w-3.5 h-3.5" /> {showHistory ? 'Cerrar' : `Historial (${previousQuotes.length})`}
                                            </button>
                                        )
                                    }
                                    crystalColors={crystalColors}
                                />
                            ) : (
                                <div className="bg-white dark:bg-stone-800 border border-primary/20 rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-300">
                                    <button onClick={() => setShowRegister(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-white"><X className="w-4 h-4" /></button>
                                    
                                    {savedContact ? (
                                        <div className="py-6 text-center space-y-6">
                                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                                                <Check className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold tracking-tight">¡Guardado con éxito!</h4>
                                                <p className="text-stone-500 font-semibold text-xs mt-1">Registrado en la ficha de {savedContact.name}</p>
                                            </div>
                                            <div className="flex gap-3 justify-center pt-2">
                                                <button onClick={() => router.push(`/admin/contactos?clientId=${savedContact.id}`)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all shadow-md">Ver Ficha</button>
                                                <button onClick={resetRegister} className="px-4 py-2 bg-stone-100 dark:bg-stone-700 dark:text-stone-200 text-stone-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all">Nuevo</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="text-lg font-bold tracking-tight">Vincular Contacto</h3>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">Busca un cliente o crea uno nuevo</p>
                                            </div>

                                            {pendingContact ? (
                                                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center border border-primary/20"><User className="w-6 h-6 text-primary" /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[9px] font-bold text-primary uppercase tracking-wider">Cliente Seleccionado</p>
                                                            <h4 className="text-base font-bold truncate mt-0.5">{pendingContact.name}</h4>
                                                            {pendingContact.phone && <p className="text-xs text-stone-400 mt-0.5">{pendingContact.phone}</p>}
                                                        </div>
                                                        {!editingQuoteId && <button onClick={() => setPendingContact(null)} className="p-2 text-stone-300 hover:text-red-500"><X className="w-5 h-5" /></button>}
                                                    </div>

                                                    {hasCrystals && pendingContact.prescriptions && pendingContact.prescriptions.length > 0 && (
                                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-250/50 space-y-3">
                                                            <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Vincular Receta Médica</span></div>
                                                            <select 
                                                                value={quotePrescriptionId || ''} 
                                                                onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                className="w-full bg-white dark:bg-stone-800 border border-emerald-200 py-2 px-3 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                                            >
                                                                <option value="">Sin receta vinculada...</option>
                                                                {pendingContact.prescriptions.map((p: any) => (
                                                                    <option key={p.id} value={p.id}>{new Date(p.date).toLocaleDateString('es-AR')} — OD: {p.sphereOD}/${p.sphereOI}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div className="flex gap-3 pt-2">
                                                        <button 
                                                            onClick={() => saveQuoteToContact(pendingContact.id, pendingContact.name)} 
                                                            disabled={savingQuote}
                                                            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-wider shadow-md flex justify-center items-center gap-2"
                                                        >
                                                            {savingQuote ? <Loader2 className="w-4 h-4 animate-spin" /> : editingQuoteId ? 'Actualizar' : 'Guardar'}
                                                        </button>
                                                        {!editingQuoteId && <button onClick={() => { setPendingContact(null); setPreviousQuotes([]); }} className="px-4 py-3 bg-white border border-stone-200 text-stone-400 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-stone-850 transition-all">Cambiar</button>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="flex gap-3">
                                                        <div className="relative flex-1">
                                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                                            <input 
                                                                ref={contactSearchRef} 
                                                                type="text" 
                                                                placeholder="Buscar cliente..." 
                                                                value={contactSearch} 
                                                                onChange={e => setContactSearch(e.target.value)}
                                                                className="w-full bg-stone-50 border border-stone-200 py-2.5 pl-9 pr-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                            />
                                                        </div>
                                                        <button onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }} className="px-4 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nuevo</button>
                                                    </div>
                                                    {contactResults.length > 0 && (
                                                        <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                            {contactResults.map((c: any) => (
                                                                <button key={c.id} onClick={() => selectContactForQuote(c)} className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-primary/40 transition-all group text-left">
                                                                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-stone-800 shadow-sm flex items-center justify-center border border-stone-100 dark:border-stone-700"><User className="w-5 h-5 text-primary" /></div>
                                                                    <div className="flex-1 text-left min-w-0">
                                                                        <p className="text-xs font-bold truncate">{c.name}</p>
                                                                        {c.phone && <p className="text-[10px] text-stone-400">{c.phone}</p>}
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary transition-colors" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {showHistory && (
                            <div className="border-t border-sidebar-border bg-stone-50/50 dark:bg-stone-950/20 p-5 overflow-y-auto max-h-[250px] animate-in slide-in-from-bottom duration-300" style={{ scrollbarWidth: 'thin' }}>
                                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-4">Historial de Consultas</h3>
                                <div className="space-y-4">
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

            {/* Bottom Sticky Cart for Mobile/Tablet */}
            {quoteItems.length > 0 && (
                <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-[50] bg-white dark:bg-stone-900 border-t border-sidebar-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-500 ${cartExpanded ? 'h-[85vh] rounded-t-[2rem]' : 'h-16'}`}>
                    {/* Collapsed Bar */}
                    <button 
                        onClick={() => setCartExpanded(!cartExpanded)}
                        className="h-16 w-full flex items-center justify-between px-6 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-primary" />
                                <span className="text-xs font-bold uppercase tracking-wider">Presupuesto</span>
                                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{itemCount}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-extrabold">${Math.round(totalCash).toLocaleString()} <span className="text-[9px] text-stone-400 font-semibold uppercase ml-0.5">efectivo</span></span>
                            </div>
                        </div>
                        {cartExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>

                    {/* Expanded Content */}
                    {cartExpanded && (
                        <div className="h-[calc(100%-64px)] overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
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
                                        isCard={false}
                                        extraActions={
                                            previousQuotes.length > 0 && (
                                                <button
                                                    onClick={() => setShowHistory(!showHistory)}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${showHistory 
                                                        ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-md' 
                                                        : 'bg-stone-100 dark:bg-stone-850 text-stone-500 hover:bg-stone-205'}`}
                                                >
                                                    <History className="w-3.5 h-3.5" /> {showHistory ? 'Cerrar' : `Historial (${previousQuotes.length})`}
                                                </button>
                                            )
                                        }
                                        crystalColors={crystalColors}
                                    />
                                ) : (
                                    <div className="bg-white dark:bg-stone-800 border border-primary/20 rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-300">
                                        <button onClick={() => setShowRegister(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-805 dark:hover:text-white"><X className="w-4 h-4" /></button>
                                        
                                        {savedContact ? (
                                            <div className="py-6 text-center space-y-6">
                                                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                                                    <Check className="w-8 h-8 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold tracking-tight">¡Guardado con éxito!</h4>
                                                    <p className="text-stone-500 font-semibold text-xs mt-1">Registrado en la ficha de {savedContact.name}</p>
                                                </div>
                                                <div className="flex gap-3 justify-center pt-2">
                                                    <button onClick={() => router.push(`/admin/contactos?clientId=${savedContact.id}`)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all shadow-md">Ver Ficha</button>
                                                    <button onClick={resetRegister} className="px-4 py-2 bg-stone-100 dark:bg-stone-700 dark:text-stone-200 text-stone-605 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all">Nuevo</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-bold tracking-tight">Vincular Contacto</h3>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">Busca un cliente o crea uno nuevo</p>
                                                </div>

                                                {pendingContact ? (
                                                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center border border-primary/20"><User className="w-6 h-6 text-primary" /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[9px] font-bold text-primary uppercase tracking-wider">Cliente Seleccionado</p>
                                                                <h4 className="text-base font-bold truncate mt-0.5">{pendingContact.name}</h4>
                                                                {pendingContact.phone && <p className="text-xs text-stone-400 mt-0.5">{pendingContact.phone}</p>}
                                                            </div>
                                                            {!editingQuoteId && <button onClick={() => setPendingContact(null)} className="p-2 text-stone-300 hover:text-red-500"><X className="w-5 h-5" /></button>}
                                                        </div>

                                                        {hasCrystals && pendingContact.prescriptions && pendingContact.prescriptions.length > 0 && (
                                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-250/50 space-y-3">
                                                                <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Vincular Receta Médica</span></div>
                                                                <select 
                                                                    value={quotePrescriptionId || ''} 
                                                                    onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                    className="w-full bg-white dark:bg-stone-800 border border-emerald-200 py-2 px-3 rounded-xl text-xs font-bold outline-none cursor-pointer"
                                                                >
                                                                    <option value="">Sin receta vinculada...</option>
                                                                    {pendingContact.prescriptions.map((p: any) => (
                                                                        <option key={p.id} value={p.id}>{new Date(p.date).toLocaleDateString('es-AR')} — OD: {p.sphereOD}/${p.sphereOI}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        <div className="flex gap-3 pt-2">
                                                            <button 
                                                                onClick={() => saveQuoteToContact(pendingContact.id, pendingContact.name)} 
                                                                disabled={savingQuote}
                                                                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-wider shadow-md flex justify-center items-center gap-2"
                                                            >
                                                                {savingQuote ? <Loader2 className="w-4 h-4 animate-spin" /> : editingQuoteId ? 'Actualizar' : 'Guardar'}
                                                            </button>
                                                            {!editingQuoteId && <button onClick={() => { setPendingContact(null); setPreviousQuotes([]); }} className="px-4 py-3 bg-white border border-stone-200 text-stone-400 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-stone-850 transition-all">Cambiar</button>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6">
                                                        <div className="flex gap-3">
                                                            <div className="relative flex-1">
                                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                                                                <input 
                                                                    ref={contactSearchRef} 
                                                                    type="text" 
                                                                    placeholder="Buscar cliente..." 
                                                                    value={contactSearch} 
                                                                    onChange={e => setContactSearch(e.target.value)}
                                                                    className="w-full bg-stone-50 border border-stone-200 py-2.5 pl-9 pr-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                                />
                                                            </div>
                                                            <button onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }} className="px-4 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nuevo</button>
                                                        </div>
                                                        {contactResults.length > 0 && (
                                                            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                                {contactResults.map((c: any) => (
                                                                    <button key={c.id} onClick={() => selectContactForQuote(c)} className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-primary/40 transition-all group text-left">
                                                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-stone-800 shadow-sm flex items-center justify-center border border-stone-100 dark:border-stone-700"><User className="w-5 h-5 text-primary" /></div>
                                                                        <div className="flex-1 text-left min-w-0">
                                                                            <p className="text-xs font-bold truncate">{c.name}</p>
                                                                            {c.phone && <p className="text-[10px] text-stone-405">{c.phone}</p>}
                                                                        </div>
                                                                        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-primary transition-colors" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {showHistory && (
                                <div className="border-t border-sidebar-border bg-stone-50/50 dark:bg-stone-950/20 p-5 overflow-y-auto max-h-[220px]" style={{ scrollbarWidth: 'thin' }}>
                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-4">Historial de Consultas</h3>
                                    <div className="space-y-4">
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

            {showNewContact && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-stone-900 rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 sm:p-10 animate-in zoom-in-95 duration-300 relative" style={{ scrollbarWidth: 'thin' }}>
                        <button onClick={() => setShowNewContact(false)} className="absolute top-8 right-8 p-3 hover:bg-stone-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-stone-400" />
                        </button>
                        <h4 className="text-2xl font-black tracking-tighter mb-8">Nuevo Contacto</h4>

                        {duplicateError && (
                            <div className="p-4 mb-6 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 animate-in shake-x duration-300">
                                <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <X className="w-4 h-4 text-white" />
                                </div>
                                <p className="text-xs font-bold text-red-700 leading-relaxed">{duplicateError}</p>
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Nombre + Teléfono */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2 flex items-center gap-1">Nombre / Apellido <span className="text-primary">*</span></label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                        <input type="text" placeholder="Nombre completo" value={newContactName} onChange={e => { setNewContactName(e.target.value); setDuplicateError(null); }} className="w-full pl-11 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2 flex items-center gap-1">Teléfono <span className="text-primary">*</span></label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                        <input type="tel" placeholder="351XXXXXXX" value={newContactPhone} onChange={e => { setNewContactPhone(e.target.value); setDuplicateError(null); }} className="w-full pl-11 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* DNI + Obra Social */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2">DNI</label>
                                    <div className="relative group">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                        <input type="text" placeholder="Número de documento" value={newContactDni} onChange={e => setNewContactDni(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2">Obra Social</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                        <input type="text" placeholder="Apross, OSDE, etc." value={newContactInsurance} onChange={e => setNewContactInsurance(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Médico + Etiqueta */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2">Médico</label>
                                    <div className="relative group">
                                        <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors z-10" />
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" />
                                        <select value={newContactDoctor} onChange={e => setNewContactDoctor(e.target.value)} className="w-full pl-11 pr-9 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold appearance-none cursor-pointer outline-none focus:border-primary transition-all">
                                            <option value="">— Sin médico —</option>
                                            {doctors.map(doc => <option key={doc.id} value={doc.name}>{doc.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2 flex items-center gap-1">Origen / Canal <span className="text-primary">*</span></label>
                                    <div className="relative group">
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-stone-400 pointer-events-none" />
                                        <select value={newContactSource} onChange={e => setNewContactSource(e.target.value)} className="w-full px-5 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold appearance-none cursor-pointer outline-none focus:border-primary transition-all">
                                            <option value="">Seleccionar origen...</option>
                                            {CONTACT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 group-focus-within:text-primary transition-colors" />
                                        <input type="email" placeholder="correo@ejemplo.com" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Tipo de Producto */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-2 flex items-center gap-1">Tipo de Producto <span className="text-primary">*</span></label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRODUCT_TYPES.map(type => (
                                        <button key={type} type="button" onClick={() => setNewContactInterest(type)} className={`px-2 py-2.5 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${newContactInterest === type ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white text-stone-400 border-stone-100 hover:border-primary/30'}`}>{type}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button onClick={handleCreateAndSave} disabled={!newContactName || !newContactPhone || !newContactSource || !newContactInterest || savingQuote} className="flex-1 py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95">{savingQuote ? <><Loader2 className="w-5 h-5 animate-spin" /> Creando...</> : 'Crear y Guardar'}</button>
                                <button onClick={() => { setShowNewContact(false); setDuplicateError(null); }} className="px-8 py-5 bg-stone-100 text-stone-500 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-stone-200 transition-all">Cancelar</button>
                            </div>
                        </div>
                    </div>
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
