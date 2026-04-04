'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Search, Plus, Minus, Trash2, Copy, MessageCircle,
    Calculator, RotateCcw, Percent, Check, Glasses,
    Layers, Sun, Watch, Eye, ShoppingBag, Sparkles, Pill,
    Pencil, X, User, Save, Gift
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
}

interface QuoteItem {
    product: Product;
    quantity: number;
    customPrice: number;
    uid: number;
    eye?: 'OD' | 'OI'; // null for non-crystal items
    sphereVal?: number | null;
    cylinderVal?: number | null;
    axisVal?: number | null;
    additionVal?: number | null;
}

interface PrescriptionData {
    sphereOD?: number | null;
    cylinderOD?: number | null;
    axisOD?: number | null;
    sphereOI?: number | null;
    cylinderOI?: number | null;
    axisOI?: number | null;
    addition?: number | null;
    prescriptionType?: string | null;
    nearSphereOD?: number | null;
    nearSphereOI?: number | null;
}

interface CotizadorPopupProps {
    clientName: string;
    clientId: string;
    onClose: () => void;
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

export default function CotizadorPopup({ clientName, clientId, onClose }: CotizadorPopupProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState<string | null>(null);
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [copied, setCopied] = useState(false);
    const [editingPrice, setEditingPrice] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Prescription data
    const [prescription, setPrescription] = useState<PrescriptionData | null>(null);

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
        // Fetch client prescription
        if (clientId) {
            fetch(`/api/contacts/${clientId}/prescriptions`)
                .then(res => res.json())
                .then((data: any[]) => {
                    if (data && data.length > 0) {
                        setPrescription(data[0]); // Latest prescription
                    }
                })
                .catch(() => { });
        }
    }, [clientId]);

    useEffect(() => {
        if (!loading && searchRef.current) searchRef.current.focus();
    }, [loading]);

    const availableTypes = useMemo(() => {
        const types = new Set<string>();
        products.forEach(p => types.add(p.type || 'Otros'));
        return Array.from(types).sort();
    }, [products]);

    const isCrystalProduct = useCallback((p: Product) => {
        return (p.type || '').includes('Cristal') || p.category === 'LENS';
    }, []);

    const filtered = useMemo(() => {
        return products.filter(p => {
            // Hide stock-0 products (except crystals)
            if (!isCrystalProduct(p) && p.stock <= 0) return false;
            if (activeType && (p.type || 'Otros') !== activeType) return false;
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                (p.brand?.toLowerCase().includes(q)) ||
                (p.model?.toLowerCase().includes(q)) ||
                (p.name?.toLowerCase().includes(q)) ||
                (p.type?.toLowerCase().includes(q))
            );
        });
    }, [products, search, activeType, isCrystalProduct]);

    // Check if quote has crystals
    const hasCrystals = useMemo(() => {
        return quoteItems.some(item =>
            (item.product.type || '').includes('Cristal') || item.product.category === 'LENS'
        );
    }, [quoteItems]);

    // Check if quote already has a frame from optica
    const hasFrameFromOptica = useMemo(() => {
        return quoteItems.some(item =>
            item.product.type === 'Armazón' || item.product.category === 'FRAME'
        );
    }, [quoteItems]);

    // Auto-set frame source when user adds a frame from the grid
    useEffect(() => {
        if (hasCrystals && hasFrameFromOptica) {
            setFrameSource('OPTICA');
        }
        if (!hasCrystals) {
            setFrameSource(null);
            setUserFrameData({ brand: '', model: '', notes: '' });
        }
    }, [hasCrystals, hasFrameFromOptica]);

    // Frame search results (only frames/armazones)
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
            isCrystalProduct(item.product) && isMultifocalProduct(item.product) && !isMiPrimerVarilux(item.product)
        );
    }, [quoteItems, isCrystalProduct, isMultifocalProduct, isMiPrimerVarilux]);

    // Check if quote has any multifocal at all
    const hasAnyMultifocal = useMemo(() => {
        return quoteItems.some(item =>
            isCrystalProduct(item.product) && isMultifocalProduct(item.product)
        );
    }, [quoteItems, isCrystalProduct, isMultifocalProduct]);

    // Promo frame discount calculation
    const promoFrameDiscount = useMemo(() => {
        if (!hasMultifocalPromo) return 0;
        const frameItem = quoteItems.find(item =>
            item.product.type === 'Armazón' || item.product.category === 'FRAME'
        );
        if (!frameItem) return 0;
        if (isAtelierFrame(frameItem.product)) return frameItem.product.price;
        return Math.min(atelierAvgPrice, frameItem.product.price);
    }, [hasMultifocalPromo, quoteItems, isAtelierFrame, atelierAvgPrice]);

    // Frame item for promo display
    const frameItemInQuote = useMemo(() => {
        return quoteItems.find(item =>
            item.product.type === 'Armazón' || item.product.category === 'FRAME'
        );
    }, [quoteItems]);

    const addToQuote = useCallback((product: Product, isPromoFrame?: boolean) => {
        if (isCrystalProduct(product)) {
            // Crystals always add as OD + OI pair
            setQuoteItems(prev => {
                const existingOD = prev.find(item => item.product.id === product.id && item.eye === 'OD');
                if (existingOD) {
                    // Already has this crystal — increment quantity on both
                    return prev.map(item =>
                        item.product.id === product.id && (item.eye === 'OD' || item.eye === 'OI')
                            ? { ...item, quantity: item.quantity + 1 }
                            : item
                    );
                }
                const isMulti = isMultifocalProduct(product);
                const pricePerEye = Math.round(product.price / 2);
                const odItem: QuoteItem = {
                    product, quantity: 1, customPrice: pricePerEye, uid: Date.now(),
                    eye: 'OD',
                    sphereVal: prescription?.sphereOD ?? null,
                    cylinderVal: prescription?.cylinderOD ?? null,
                    axisVal: prescription?.axisOD ?? null,
                    additionVal: isMulti ? (prescription?.addition ?? null) : null,
                };
                const oiItem: QuoteItem = {
                    product, quantity: 1, customPrice: pricePerEye, uid: Date.now() + 1,
                    eye: 'OI',
                    sphereVal: prescription?.sphereOI ?? null,
                    cylinderVal: prescription?.cylinderOI ?? null,
                    axisVal: prescription?.axisOI ?? null,
                    additionVal: isMulti ? (prescription?.addition ?? null) : null,
                };
                return [...prev, odItem, oiItem];
            });
        } else {
            // Non-crystal: normal behavior with stock limit
            setQuoteItems(prev => {
                const existing = prev.find(item => item.product.id === product.id && !item.eye);
                if (existing) {
                    if (existing.quantity >= product.stock) return prev;
                    return prev.map(item =>
                        item.product.id === product.id && !item.eye
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
        }
    }, [isCrystalProduct, isMultifocalProduct, prescription, isAtelierFrame, atelierAvgPrice]);

    const updateQuantity = useCallback((uid: number, delta: number) => {
        setQuoteItems(prev =>
            prev
                .map(item => {
                    if (item.uid !== uid) return item;
                    let newQty = item.quantity + delta;
                    if (!isCrystalProduct(item.product) && newQty > item.product.stock) newQty = item.product.stock;
                    return { ...item, quantity: Math.max(0, newQty) };
                })
                .filter(item => item.quantity > 0)
        );
    }, [isCrystalProduct]);

    const updatePrice = useCallback((uid: number, price: number) => {
        setQuoteItems(prev =>
            prev.map(item => item.uid === uid ? { ...item, customPrice: Math.max(0, price) } : item)
        );
    }, []);

    const removeItem = useCallback((uid: number) => {
        setQuoteItems(prev => {
            const item = prev.find(i => i.uid === uid);
            if (item?.eye) {
                // Remove both OD and OI for same product
                return prev.filter(i => !(i.product.id === item.product.id && i.eye));
            }
            return prev.filter(i => i.uid !== uid);
        });
    }, []);

    const updateGraduation = useCallback((uid: number, field: string, value: number | null) => {
        setQuoteItems(prev =>
            prev.map(item => item.uid === uid ? { ...item, [field]: value } : item)
        );
    }, []);

    const subtotal = quoteItems.reduce((acc, item) => acc + item.customPrice * item.quantity, 0);
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal - discountAmount;
    const itemCount = quoteItems.reduce((acc, item) => acc + item.quantity, 0);

    const buildQuoteText = () => {
        const lines = quoteItems.map(item => {
            let label = `• ${item.product.brand || ''} ${item.product.model || item.product.name || ''}`;
            if (item.eye) label += ` (${item.eye})`;
            label += ` x${item.quantity}`;
            // Check if this is a bonified frame
            const isFrame = item.product.type === 'Armazón' || item.product.category === 'FRAME';
            if (isFrame && hasMultifocalPromo && isAtelierFrame(item.product)) {
                label += ` — *BONIFICADO* ✨`;
            } else if (isFrame && hasMultifocalPromo && promoFrameDiscount > 0) {
                label += ` — $${(item.customPrice * item.quantity).toLocaleString()} (Bonif. -$${promoFrameDiscount.toLocaleString()})`;
            } else {
                label += ` — $${(item.customPrice * item.quantity).toLocaleString()}`;
            }
            if (item.eye && item.sphereVal != null) {
                label += `\n   Esf: ${item.sphereVal} | Cil: ${item.cylinderVal ?? '—'} | Eje: ${item.axisVal ?? '—'}`;
                if (item.additionVal != null) label += ` | ADD: ${item.additionVal}`;
            }
            return label;
        });
        let text = `✨ *PRESUPUESTO — ATELIER ÓPTICA* ✨\n`;
        text += `📍 José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba\n`;
        text += `🏆 La óptica mejor calificada en Google Business ⭐ 5/5\n`;
        text += `\n👤 *Cliente:* ${clientName}\n`;
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
        text += `\nSubtotal: $${subtotal.toLocaleString()}`;
        if (discount > 0) text += `\nDescuento (${discount}%): -$${discountAmount.toLocaleString()}`;
        text += `\n*TOTAL: $${total.toLocaleString()}*`;
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

    const handleSaveQuote = async () => {
        if (quoteItems.length === 0) return;
        setSaving(true);
        try {
            await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId,
                    items: quoteItems.map(i => ({
                        productId: i.product.id,
                        quantity: i.quantity,
                        price: i.customPrice,
                        eye: i.eye || null,
                        sphereVal: i.sphereVal ?? null,
                        cylinderVal: i.cylinderVal ?? null,
                        axisVal: i.axisVal != null ? Math.round(i.axisVal) : null,
                        additionVal: i.additionVal ?? null,
                    })),
                    discount,
                    total,
                    frameSource: hasCrystals ? frameSource : null,
                    userFrameBrand: frameSource === 'USUARIO' ? userFrameData.brand : null,
                    userFrameModel: frameSource === 'USUARIO' ? userFrameData.model : null,
                    userFrameNotes: frameSource === 'USUARIO' ? userFrameData.notes : null,
                })
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-lg z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-stone-900 w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">

                {/* Header */}
                <header className="px-8 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center gap-4 flex-shrink-0 bg-stone-50/50 dark:bg-stone-800/20">
                    <div className="w-11 h-11 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Calculator className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-stone-800 dark:text-white uppercase tracking-tighter italic leading-tight">
                            Cotizador
                            <span className="text-primary not-italic ml-2 text-base font-black">— {clientName}</span>
                        </h2>
                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mt-0.5">Presupuesto rápido para el nuevo contacto</p>
                    </div>
                    {quoteItems.length > 0 && (
                        <button
                            onClick={() => { setQuoteItems([]); setDiscount(0); setFrameSource(null); setUserFrameData({ brand: '', model: '', notes: '' }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-stone-400 hover:text-red-500 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700 transition-all hover:border-red-200 uppercase tracking-wider"
                        >
                            <RotateCcw className="w-3 h-3" /> Limpiar
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-3 bg-white dark:bg-stone-800 hover:rotate-90 transition-all rounded-2xl border border-stone-100 dark:border-stone-700 shadow-sm"
                    >
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </header>

                {/* Search + Type Tabs */}
                <div className="px-6 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/10 flex items-center gap-3 flex-shrink-0">
                    <div className="relative w-60 flex-shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 py-2 px-9 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-stone-300"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 text-xs">✕</button>
                        )}
                    </div>
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        <button
                            onClick={() => setActiveType(null)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${activeType === null
                                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-100 dark:border-stone-700 hover:border-primary/30'
                                }`}
                        >
                            Todos ({products.length})
                        </button>
                        {availableTypes.map(type => {
                            const config = getTypeConfig(type);
                            const count = products.filter(p => (p.type || 'Otros') === type).length;
                            const Icon = config.icon;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveType(activeType === type ? null : type)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${activeType === type
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

                {/* Main Content: Products + Cart */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Products Grid */}
                    <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin' }}>
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-stone-300">
                                <Search className="w-6 h-6 mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">Sin resultados</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                                {filtered.map(product => {
                                    const inQuote = quoteItems.find(i => i.product.id === product.id);
                                    const atMaxStock = !isCrystalProduct(product) && inQuote && inQuote.quantity >= product.stock;
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => !atMaxStock && addToQuote(product)}
                                            disabled={!!atMaxStock}
                                            className={`flex items-center justify-between p-3 rounded-xl transition-all group text-left border ${atMaxStock
                                                ? 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-700 opacity-50 cursor-not-allowed'
                                                : inQuote
                                                    ? 'bg-primary/5 border-primary/30 shadow-sm'
                                                    : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-primary/30 hover:shadow-md hover:-translate-y-px active:scale-[0.98]'
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
                                                    {!isCrystalProduct(product) && product.stock <= 3 && (
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
                        )}
                    </div>

                    {/* Cart Sidebar */}
                    <div className="w-80 border-l border-stone-100 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-800/10 flex flex-col flex-shrink-0">
                        <div className="p-4 border-b border-stone-100 dark:border-stone-700">
                            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em] flex items-center gap-2">
                                <ShoppingBag className="w-3.5 h-3.5" /> Presupuesto
                                {itemCount > 0 && (
                                    <span className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded-full ml-auto">
                                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                    </span>
                                )}
                            </h3>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                            {quoteItems.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-center opacity-30 border-2 border-dashed border-stone-200 rounded-2xl">
                                    <ShoppingBag className="w-6 h-6 mb-2" />
                                    <p className="text-[9px] font-black uppercase tracking-widest px-4">Agregá productos</p>
                                </div>
                            ) : (
                                <>
                                    {quoteItems.map(item => (
                                        <div key={item.uid} className={`p-3 rounded-xl border shadow-sm animate-in slide-in-from-right-4 duration-200 ${item.eye ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40' : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700'
                                            }`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        {item.eye && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${item.eye === 'OD' ? 'bg-blue-500 text-white' : 'bg-indigo-500 text-white'
                                                                }`}>{item.eye}</span>
                                                        )}
                                                        <p className="font-black text-[10px] uppercase tracking-tight truncate leading-tight">
                                                            {item.product.brand} {item.product.model || ''}
                                                        </p>
                                                    </div>
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
                                                {editingPrice === item.uid ? (
                                                    <input
                                                        type="number"
                                                        autoFocus
                                                        value={item.customPrice}
                                                        onChange={e => updatePrice(item.uid, Number(e.target.value))}
                                                        onBlur={() => setEditingPrice(null)}
                                                        onKeyDown={e => e.key === 'Enter' && setEditingPrice(null)}
                                                        className="w-20 bg-primary/5 border border-primary/30 rounded-lg px-2 py-1 text-[11px] font-black text-right outline-none focus:ring-2 focus:ring-primary/20"
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingPrice(item.uid)}
                                                        className="flex items-center gap-1 group/price hover:bg-stone-50 dark:hover:bg-stone-900 rounded-lg px-1.5 py-1 transition-colors"
                                                        title="Editar precio"
                                                    >
                                                        <span className="font-black text-[11px] text-stone-800 dark:text-stone-200">
                                                            ${(item.customPrice * item.quantity).toLocaleString()}
                                                        </span>
                                                        <Pencil className="w-2 h-2 text-stone-300 opacity-0 group-hover/price:opacity-100 transition-opacity" />
                                                    </button>
                                                )}
                                            </div>
                                            {/* Graduation fields for crystals */}
                                            {item.eye && (
                                                <div className="mt-2 pt-2 border-t border-blue-200/40 dark:border-blue-800/30">
                                                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                        <Eye className="w-3 h-3" /> Graduación {item.eye}
                                                        {prescription && <span className="text-emerald-500 ml-auto">✓ Receta</span>}
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <div>
                                                            <label className="text-[7px] font-bold text-stone-400 uppercase block">Esf</label>
                                                            <input
                                                                type="number" step="0.25"
                                                                value={item.sphereVal ?? ''}
                                                                onChange={e => updateGraduation(item.uid, 'sphereVal', e.target.value ? Number(e.target.value) : null)}
                                                                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1.5 py-1 text-[10px] font-bold text-center outline-none focus:ring-1 focus:ring-blue-400"
                                                                placeholder="—"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[7px] font-bold text-stone-400 uppercase block">Cil</label>
                                                            <input
                                                                type="number" step="0.25"
                                                                value={item.cylinderVal ?? ''}
                                                                onChange={e => updateGraduation(item.uid, 'cylinderVal', e.target.value ? Number(e.target.value) : null)}
                                                                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1.5 py-1 text-[10px] font-bold text-center outline-none focus:ring-1 focus:ring-blue-400"
                                                                placeholder="—"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[7px] font-bold text-stone-400 uppercase block">Eje</label>
                                                            <input
                                                                type="number" step="1"
                                                                value={item.axisVal ?? ''}
                                                                onChange={e => updateGraduation(item.uid, 'axisVal', e.target.value ? Number(e.target.value) : null)}
                                                                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1.5 py-1 text-[10px] font-bold text-center outline-none focus:ring-1 focus:ring-blue-400"
                                                                placeholder="—"
                                                            />
                                                        </div>
                                                    </div>
                                                    {(item.additionVal != null || isMultifocalProduct(item.product)) && (
                                                        <div className="mt-1">
                                                            <label className="text-[7px] font-bold text-stone-400 uppercase block">ADD (Adición)</label>
                                                            <input
                                                                type="number" step="0.25"
                                                                value={item.additionVal ?? ''}
                                                                onChange={e => updateGraduation(item.uid, 'additionVal', e.target.value ? Number(e.target.value) : null)}
                                                                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-1.5 py-1 text-[10px] font-bold text-center outline-none focus:ring-1 focus:ring-blue-400"
                                                                placeholder="—"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Promo banner */}
                                    {hasAnyMultifocal && (
                                        <div className={`mt-3 p-2.5 rounded-xl border-2 flex items-center gap-2 ${hasMultifocalPromo
                                            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-300 dark:border-emerald-700'
                                            : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                                        }`}>
                                            <Gift className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                                    🎁 Promo 2x1
                                                </p>
                                                <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    {hasMultifocalPromo
                                                        ? `+ Armazón Atelier bonificado`
                                                        : 'Mi Primer Varilux — solo el par'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Frame Section — only when crystals are in quote */}
                                    {hasCrystals && (
                                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-200 dark:border-amber-800 animate-in slide-in-from-right-4 duration-300">
                                            <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <Glasses className="w-3.5 h-3.5" /> Armazón
                                                {hasMultifocalPromo && (
                                                    <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded-full text-[7px] font-black uppercase tracking-wider ml-1 animate-pulse">
                                                        Bonificado
                                                    </span>
                                                )}
                                            </p>

                                            {/* Toggle buttons */}
                                            <div className="flex gap-1.5 mb-3">
                                                <button
                                                    onClick={() => { setFrameSource('OPTICA'); setFrameSearch(''); }}
                                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${frameSource === 'OPTICA'
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                                        : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                                        }`}
                                                >
                                                    De la Óptica
                                                </button>
                                                <button
                                                    onClick={() => setFrameSource('USUARIO')}
                                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${frameSource === 'USUARIO'
                                                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                                                        : 'bg-white dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:border-amber-300'
                                                        }`}
                                                >
                                                    <User className="w-3 h-3 inline mr-1" />Del Usuario
                                                </button>
                                            </div>

                                            {/* Optica frame: search frames */}
                                            {frameSource === 'OPTICA' && !hasFrameFromOptica && (
                                                <div>
                                                    <div className="relative mb-2">
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
                                                        <div className="space-y-1 max-h-32 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                            {frameResults.map(fr => (
                                                                <button
                                                                    key={fr.id}
                                                                    onClick={() => { addToQuote(fr, hasMultifocalPromo); setFrameSearch(''); }}
                                                                    className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-left ${hasMultifocalPromo && isAtelierFrame(fr)
                                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 hover:border-emerald-400'
                                                                        : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 hover:border-amber-300'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[10px] font-black truncate">{fr.brand} {fr.model || ''}</p>
                                                                        {hasMultifocalPromo && isAtelierFrame(fr) ? (
                                                                            <p className="text-[8px] font-black text-emerald-600">✨ BONIFICADO <span className="line-through text-stone-400 font-bold">${fr.price.toLocaleString()}</span></p>
                                                                        ) : hasMultifocalPromo ? (
                                                                            <p className="text-[8px] font-bold text-stone-400">
                                                                                <span className="line-through">${fr.price.toLocaleString()}</span>
                                                                                <span className="text-emerald-600 ml-1 font-black">${Math.max(0, fr.price - atelierAvgPrice).toLocaleString()}</span>
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

                                            {/* Optica frame: already selected */}
                                            {frameSource === 'OPTICA' && hasFrameFromOptica && (
                                                <div>
                                                    {hasMultifocalPromo && frameItemInQuote ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                            {isAtelierFrame(frameItemInQuote.product) ? (
                                                                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                                                                    ✨ {frameItemInQuote.product.brand} {frameItemInQuote.product.model || ''} — BONIFICADO
                                                                </p>
                                                            ) : (
                                                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                                                    {frameItemInQuote.product.brand} {frameItemInQuote.product.model || ''} — Bonif. -${promoFrameDiscount.toLocaleString()}
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

                                            {/* User frame: fields */}
                                            {frameSource === 'USUARIO' && (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Marca del armazón"
                                                        value={userFrameData.brand}
                                                        onChange={e => setUserFrameData(prev => ({ ...prev, brand: e.target.value }))}
                                                        className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-3 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Modelo del armazón"
                                                        value={userFrameData.model}
                                                        onChange={e => setUserFrameData(prev => ({ ...prev, model: e.target.value }))}
                                                        className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-3 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Observaciones (color, estado...)"
                                                        value={userFrameData.notes}
                                                        onChange={e => setUserFrameData(prev => ({ ...prev, notes: e.target.value }))}
                                                        className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 py-1.5 px-3 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-stone-300"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Totals + Actions */}
                        {quoteItems.length > 0 && (
                            <div className="p-4 border-t border-stone-100 dark:border-stone-700 space-y-3 bg-white/50 dark:bg-stone-800/20">
                                {/* Discount */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Percent className="w-3 h-3 text-stone-300" />
                                    <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Dto.</span>
                                    {[5, 10, 15, 20].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDiscount(discount === d ? 0 : d)}
                                            className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${discount === d
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'bg-white dark:bg-stone-800 text-stone-400 border border-stone-100 dark:border-stone-700 hover:border-primary/30'
                                                }`}
                                        >
                                            {d}%
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={discount || ''}
                                        onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                                        placeholder="—"
                                        className="w-10 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-md px-1 py-0.5 text-[10px] font-black text-center outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                {/* Totals */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="font-bold text-stone-400 uppercase tracking-wider">Subtotal</span>
                                        <span className="font-black">${subtotal.toLocaleString()}</span>
                                    </div>
                                    {discount > 0 && (
                                        <div className="flex justify-between text-[10px] text-emerald-600">
                                            <span className="font-bold uppercase tracking-wider">Dto. {discount}%</span>
                                            <span className="font-black">-${discountAmount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end pt-2 border-t border-stone-100 dark:border-stone-700">
                                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Total</span>
                                        <span className="text-xl font-black text-stone-900 dark:text-white tracking-tighter">${total.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Warning if crystals but no frame selected */}
                                {hasCrystals && !frameSource && (
                                    <p className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded-lg text-center animate-pulse">
                                        ⚠️ Seleccioná un armazón para los cristales
                                    </p>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveQuote}
                                        disabled={saving}
                                        className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5"
                                    >
                                        {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                                        {saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                        onClick={handleCopy}
                                        className={`py-2.5 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 border ${copied
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200'
                                            : 'bg-white dark:bg-stone-800 text-stone-500 border-stone-100 dark:border-stone-700 hover:border-primary/40 hover:text-primary'
                                            }`}
                                    >
                                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                    <button
                                        onClick={handleWhatsApp}
                                        className="py-2.5 px-3 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                                    >
                                        <MessageCircle className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
