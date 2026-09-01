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
    Mail,
    SlidersHorizontal,
    PackageSearch
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import CotizadorCart from '@/components/quotes/CotizadorCart';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { CONTACT_SOURCES_SELECCIONABLES } from '@/lib/contact-source';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import FrameRecapReadOnly from '@/components/orders/FrameRecapReadOnly';
import {
    isCrystal,
    getCategoryKey,
    safePrice,
    recalculateCrystalPrices,
    applyTeñidoPromoDiscount,
    armarParesDeCristal
} from '@/lib/promo-utils';
import { calculateQuoteTotals, PricingService } from '@/services/PricingService';
// Las 12 se dicen "cuotas fijas", sin la leyenda del % (decisión de Ishtar,
// 31/8 noche). La redacción única vive en promo-cuotas.ts: acá nunca se
// escribe el texto a mano. Los labels de MÉTODO DE PAGO tipo "MP 12c Ish
// (+10%)" son otra cosa: documentan un cobro y conservan su recargo.
import { ETIQUETA_MP_CUOTAS_LARGAS, textoCuotas12 } from '@/lib/promo-cuotas';
import { RECARGO_MP_CUOTAS_LARGAS } from '@/lib/constants/descuentos';
import {
    Glasses,
    Sun,
    Eye,
    Activity,
    Box,
    Watch,
    Droplets,
    Gem,
    FlaskConical
} from 'lucide-react';
import type { Product } from '@/types/orders';
import { normalizeLensOrigin, lensOriginSuffix, lensOriginFromItem } from '@/lib/lens-origin';
import { formatLensRange } from '@/lib/lens-range';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import Image from "next/image";

// Recibe la CLAVE ya resuelta (p.ej. 'Cristal', 'Tratamiento') — no la vuelve a
// derivar. `getTypeConfig(cat)` reinvocaba getCategoryKey tratando la clave como
// si fuera un `type` crudo; funcionaba de casualidad para claves que también
// matchean por substring de tipo (Cristal, Armazón, Sol...) pero rompía para
// 'Tratamiento', que solo se detecta por `category`, no por texto de `type`.
// Un solo tratamiento visual para todos los chips de categoría (antes cada
// una tenía su propio color pastel, sin sistema). El color ahora lo da SOLO
// el estado (activo/inactivo), acá solo queda el ícono + etiqueta.
const getTypeConfigByKey = (key: string) => {
    switch (key) {
        case 'Armazón': return { icon: Glasses, label: 'Armazones' };
        case 'Cristal': return { icon: Eye, label: 'Cristales' };
        case 'Lente de sol': return { icon: Sun, label: 'Sol' };
        case 'Lente de contacto': return { icon: Activity, label: 'Contactología' };
        case 'Accesorio': return { icon: Box, label: 'Accesorios' };
        case 'Reloj': return { icon: Watch, label: 'Relojería' };
        case 'Líquido / Solución': return { icon: Droplets, label: 'Líquidos' };
        case 'Joyería': return { icon: Gem, label: 'Joyería' };
        case 'Tratamiento': return { icon: FlaskConical, label: 'Tratamientos' };
        default: return { icon: Box, label: 'Otros' };
    }
};

// Chips de la barra de filtros. Estaban con la clase copiada cuatro veces, y con
// `border-sidebar-border` — un tono que NO existe: sin color declarado el borde cae a
// `currentColor` y cada chip terminaba con el borde del color de su texto. El
// alto es 40px (min-h-10) por la convención de accesibilidad de la casa (misma
// que `whatsapp/ChatList/ChatFilters.tsx`) y el foco se ve, que antes no.
const chipBase =
    'min-h-10 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const chipActivo = 'bg-primary text-primary-foreground border-primary';
// El hover ACLARA el borde (stone-500 sobre stone-700). Antes iba a stone-600,
// más oscuro que el borde en reposo: pasar el mouse apagaba el chip.
const chipInactivo = 'bg-sidebar text-foreground/55 border-sidebar-border hover:border-stone-500 hover:text-foreground/90';

// "Cristal Multifocal" → "Cristal · Multifocal": el tipo y el subtipo en una
// sola línea, sin que se corte en dos renglones dentro de la columna angosta.
const tipoConSeparador = (type?: string | null) => (type || '').replace(' ', ' · ') || '—';

const getTypeConfig = (type: string | null, category?: string | null) => getTypeConfigByKey(getCategoryKey(type, category));

const PRODUCT_TYPES = ["Monofocal", "Multifocal", "Bifocal", "Ocupacional", "Solar", "Accesorios", "Lentes de Contacto", "Otros"];

interface QuoteItem {
    id?: string;
    product: Product;
    quantity: number;
    customPrice: number;
    /** Renglón bonificado por el 2x1 (el par gratis de cristales). */
    isPromo?: boolean;
    eye?: 'OD' | 'OI';
    crystalColor?: string;
    crystalColorType?: string;
    crystalColorNote?: string;
    /** A qué armazón (1º/2º) corresponde este ítem — teñidos Y armazones. */
    framePosition?: number | null;
    productBrandSnapshot?: string | null;
    productNameSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    laboratorySnapshot?: string | null;
    productCostSnapshot?: number | null;
    productTypeSnapshot?: string | null;
    productLensIndexSnapshot?: string | null;
    productUnitTypeSnapshot?: string | null;
    uid?: number;
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
    const [selectedSubtype, setSelectedSubtype] = useState('');
    const [selectedOrigin, setSelectedOrigin] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('');
    const [selectedLab, setSelectedLab] = useState('');
    const [selectedIndex, setSelectedIndex] = useState('');
    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
    const [markup, setMarkup] = useState(0);
    const [discountCash, setDiscountCash] = useState(20);
    const [discountTransfer, setDiscountTransfer] = useState(15);
    const [discountCard, setDiscountCard] = useState(0);
    const [specialDiscount, setSpecialDiscount] = useState(0);
    // El descuento especial solo lo puede dar el admin; el resto ni ve el campo.
    const [userRole, setUserRole] = useState('STAFF');
    const [cartExpanded, setCartExpanded] = useState(false);
    // Filtros secundarios (subtipo/origen/marca/laboratorio): colapsados por
    // defecto en un popover, para no ocupar media pantalla antes de ver un
    // producto. Se abren solos si el usuario ya tenía uno activo (ej. viene de
    // un link con laboratorio preseleccionado).
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const moreFiltersRef = useRef<HTMLDivElement>(null);
    const [frameSource, setFrameSource] = useState<'OPTICA' | 'USUARIO' | null>(null);
    const [userFrameData, setUserFrameData] = useState({ brand: '', model: '', notes: '' });
    
    // Register flow
    const [showRegister, setShowRegister] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
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
    // El pedido CRUDO que se está editando, con sus armazones (frames, fotos,
    // medidas). Antes se descartaba tras mapear los items: editar un
    // presupuesto no mostraba NADA de los armazones — "es imposible saber cuál
    // es cuál" (Ishtar, 25/8).
    const [editingOrderData, setEditingOrderData] = useState<any | null>(null);
    // Vuelve a leer el pedido en edición (después de guardar foto/medidas
    // inline en el carrito), para que el repaso muestre lo recién cargado.
    const refrescarOrdenEnEdicion = async () => {
        if (!editingQuoteId) return;
        try {
            const r = await fetch(`/api/orders/${editingQuoteId}`);
            if (r.ok) setEditingOrderData(await r.json());
        } catch { /* la copia en memoria sigue sirviendo */ }
    };
    // Ya es una venta (aunque esté reabierta): no repricear cristales contra
    // el catálogo en vivo — el server la protege, esto evita mostrar/mandar
    // un número inflado antes de guardar.
    const [editingIsSale, setEditingIsSale] = useState(false);

    // Crystal colors for teñido addon
    const [crystalColors, setCrystalColors] = useState<any[]>([]);
    // Precio por estilo de teñido (Compacto/Muestra/Degradé), cargado en Stock → Paleta de Colores
    const [tintStylePrices, setTintStylePrices] = useState<Record<string, number>>({});

    const searchRef = useRef<HTMLInputElement>(null);
    const contactSearchRef = useRef<HTMLInputElement>(null);

    // Initial load
    // Rol del usuario: habilita el descuento especial (solo admin)
    useEffect(() => {
        (async () => {
            try {
                const cached = localStorage.getItem('user');
                if (cached) { setUserRole(JSON.parse(cached).role || 'STAFF'); return; }
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const user = await res.json();
                    localStorage.setItem('user', JSON.stringify(user));
                    setUserRole(user.role || 'STAFF');
                }
            } catch { }
        })();
    }, []);

    // Fetch doctors for the new contact form
    useEffect(() => {
        fetch('/api/doctors').then(res => res.json()).then(data => { if (Array.isArray(data)) setDoctors(data); }).catch((err) => console.error("Error fetching doctors:", err));
        fetch('/api/crystal-colors').then(res => res.json()).then(data => { if (Array.isArray(data)) setCrystalColors(data); }).catch((err) => console.error("Error fetching crystal colors:", err));
        fetch('/api/tint-style-prices').then(res => res.json()).then(data => {
            if (Array.isArray(data)) setTintStylePrices(Object.fromEntries(data.map((t: any) => [t.category, t.price])));
        }).catch((err) => console.error("Error fetching tint style prices:", err));
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
                        setEditingIsSale(quote.orderType === 'SALE');
                        
                        // Map items — API returns `price`, CotizadorCart expects `customPrice`
                        const mappedItems = quote.items.map((it: any, idx: number) => ({
                            id: it.id,
                            product: it.product,
                            quantity: it.quantity,
                            customPrice: it.price,
                            eye: it.eye,
                            crystalColor: it.crystalColor,
                            crystalColorType: it.crystalColorType,
                            crystalColorNote: it.crystalColorNote,
                            framePosition: it.framePosition ?? null,
                            uid: Date.now() + idx,
                            productNameSnapshot: it.productNameSnapshot,
                            productBrandSnapshot: it.productBrandSnapshot,
                            productCategorySnapshot: it.productCategorySnapshot,
                            laboratorySnapshot: it.laboratorySnapshot,
                            productCostSnapshot: it.productCostSnapshot,
                            productTypeSnapshot: it.productTypeSnapshot,
                            productLensIndexSnapshot: it.productLensIndexSnapshot,
                            productUnitTypeSnapshot: it.productUnitTypeSnapshot,
                        }));
                        setQuoteItems(mappedItems);
                        
                        // Restore pricing settings — fields are directly on the order object
                        setMarkup(quote.markup || 0);
                        setDiscountCash(quote.discountCash ?? 20);
                        setDiscountTransfer(quote.discountTransfer ?? 15);
                        setDiscountCard(quote.discountCard ?? 0);
                        setSpecialDiscount(quote.specialDiscount ?? 0);
                        setEditingOrderData(quote);

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
            try {
                const res = await fetch(`/api/contacts?search=${encodeURIComponent(contactSearch)}`);
                const data = await res.json();
                setContactResults(data);
            } catch (err) {
                console.error(err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [contactSearch]);

    // Clear sub-filters when activeType changes
    useEffect(() => {
        setSelectedSubtype('');
        setSelectedOrigin('');
        setSelectedBrand('');
        setSelectedLab('');
    }, [activeType]);

    // Recalculate crystal prices dynamically when quoteItems change to prevent promo price evasion.
    // Una VENTA (aunque esté reabierta) no se toca: ver CLAUDE.md / commit del
    // 24/8/26 — no puede quedar a merced de un aumento de precios posterior.
    useEffect(() => {
        if (editingIsSale) return;
        const crystalsChanged = recalculateCrystalPrices(quoteItems);
        const teñidoChanged = applyTeñidoPromoDiscount(quoteItems, tintStylePrices);
        if (crystalsChanged || teñidoChanged) {
            setQuoteItems([...quoteItems]);
        }
    }, [quoteItems, tintStylePrices, editingIsSale]);

    // Filter logic
    const availableCategories = useMemo(() => {
        const types = new Set(products.map(p => getCategoryKey(p.type, p.category)));
        return Array.from(types).sort() as string[];
    }, [products]);

    const baseFilteredForBrandsAndLabs = useMemo(() => {
        return products.filter(p => {
            const matchesWeb = !onlyWeb || p.publishToWeb === true;
            if (!matchesWeb) return false;
            
            if (activeType === 'NONE') return true;
            if (activeType) {
                if (getCategoryKey(p.type, p.category) !== activeType) return false;
            }
            
            if (activeType === 'Cristal' && selectedSubtype) {
                const type = p.type?.toLowerCase() || '';
                const qSubtype = selectedSubtype.toLowerCase();
                if (type !== `cristal ${qSubtype}` && !type.includes(qSubtype) && type !== qSubtype) return false;
            }
            
            if (activeType === 'Cristal' && selectedOrigin) {
                if (normalizeLensOrigin(p.origin) !== selectedOrigin) return false;
            }
            
            return true;
        });
    }, [products, activeType, onlyWeb, selectedSubtype, selectedOrigin]);

    const uniqueBrands = useMemo(() => {
        const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const brands = Array.from(new Map(
            baseFilteredForBrandsAndLabs.map(p => p.brand).filter(Boolean).map(b => [normalizeStr(b!), b])
        ).values()) as string[];
        return brands.sort((a, b) => a.localeCompare(b));
    }, [baseFilteredForBrandsAndLabs]);

    const uniqueLabs = useMemo(() => {
        const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const labs = Array.from(new Map(
            baseFilteredForBrandsAndLabs.map(p => p.laboratory).filter(Boolean).map(l => [normalizeStr(l!), l])
        ).values()) as string[];
        return labs.sort((a, b) => a.localeCompare(b));
    }, [baseFilteredForBrandsAndLabs]);

    // Los índices que hay a la vista, ordenados como número y no como texto
    // ("1.5" tiene que ir antes que "1.67", y alfabéticamente iría al revés).
    const uniqueIndexes = useMemo(() => {
        const idx = Array.from(new Set(
            baseFilteredForBrandsAndLabs.map(p => String(p.lensIndex || '').trim()).filter(Boolean)
        ));
        return idx.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
    }, [baseFilteredForBrandsAndLabs]);

    // Cierra el popover de "más filtros" al clickear afuera.
    useEffect(() => {
        if (!showMoreFilters) return;
        const onClickOutside = (e: MouseEvent) => {
            if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target as Node)) {
                setShowMoreFilters(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [showMoreFilters]);

    const hasSecondaryFilters = activeType === 'Cristal' || uniqueBrands.length > 1 || uniqueLabs.length > 1;

    // Filtros secundarios activos, como tags removibles junto a los chips.
    const activeFilterTags = useMemo(() => {
        const tags: { key: string; label: string; clear: () => void }[] = [];
        if (selectedSubtype) tags.push({ key: 'subtype', label: selectedSubtype, clear: () => setSelectedSubtype('') });
        if (selectedOrigin) tags.push({ key: 'origin', label: selectedOrigin === 'STOCK' ? 'Stock' : 'Laboratorio', clear: () => setSelectedOrigin('') });
        if (selectedBrand) tags.push({ key: 'brand', label: selectedBrand, clear: () => setSelectedBrand('') });
        if (selectedIndex) tags.push({ key: 'index', label: `Índice ${selectedIndex}`, clear: () => setSelectedIndex('') });
        if (selectedLab) tags.push({ key: 'lab', label: selectedLab, clear: () => setSelectedLab('') });
        return tags;
    }, [selectedSubtype, selectedOrigin, selectedBrand, selectedLab, selectedIndex]);

    const clearAllFilters = () => {
        setSearch('');
        setActiveType(null);
        setOnlyWeb(false);
        setSelectedSubtype('');
        setSelectedOrigin('');
        setSelectedBrand('');
        setSelectedLab('');
        setSelectedIndex('');
    };

    const filtered = useMemo(() => {
        const normalizeText = (str: string) => {
            let text = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            text = text.replace(/\barmazones\b/g, 'armazon');
            text = text.replace(/\bcristales\b/g, 'cristal');
            text = text.replace(/\blentes\b/g, 'lente');
            text = text.replace(/\bmarcos\b/g, 'marco');
            text = text.replace(/\blapiceros\b/g, 'lapicero');
            text = text.replace(/\bestuches\b/g, 'estuche');
            text = text.replace(/\bliquidos\b/g, 'liquido');
            return text;
        };
        const words = search ? normalizeText(search).split(/\s+/).filter(Boolean) : [];

        return products.filter(p => {
            const matchesSearch = words.length === 0 || (() => {
                const haystack = normalizeText(`${p.brand || ''} ${p.model || ''} ${p.name || ''} ${p.type || ''} ${p.category || ''} ${p.lensIndex || ''}`);
                return words.every(w => haystack.includes(w));
            })();
            
            const matchesWeb = !onlyWeb || p.publishToWeb === true;
            
            if (activeType === 'NONE') return matchesSearch && matchesWeb;
            if (activeType) {
                if (getCategoryKey(p.type, p.category) !== activeType) return false;
            }

            if (activeType === 'Cristal' && selectedSubtype) {
                const type = p.type?.toLowerCase() || '';
                const qSubtype = selectedSubtype.toLowerCase();
                if (type !== `cristal ${qSubtype}` && !type.includes(qSubtype) && type !== qSubtype) return false;
            }

            if (activeType === 'Cristal' && selectedOrigin) {
                if (normalizeLensOrigin(p.origin) !== selectedOrigin) return false;
            }

            if (selectedBrand) {
                if (p.brand?.toLowerCase() !== selectedBrand.toLowerCase()) return false;
            }

            if (selectedIndex) {
                if (String(p.lensIndex || '') !== selectedIndex) return false;
            }
            if (selectedLab) {
                if (p.laboratory?.toLowerCase() !== selectedLab.toLowerCase()) return false;
            }
            
            return matchesSearch && matchesWeb;
        }).sort((a, b) => (a.price || 0) - (b.price || 0));
    }, [products, search, activeType, onlyWeb, selectedSubtype, selectedOrigin, selectedBrand, selectedLab, selectedIndex]);

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
                const name = (item.product?.name || '').toLowerCase();
                return !!item.product && isCrystal(item.product) && (name.includes('orgánico blanco') || name.includes('organico blanco'));
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
            // El par OD/OI (y el segundo par gratis si es 2x1) se arma en
            // promo-utils — mismo helper que el carrito de la ficha.
            setQuoteItems(prev => [...prev, ...(armarParesDeCristal(p, prev) as any[])]);
        } else {
            setQuoteItems(prev => {
                const existing = prev.find(i => i.product?.id === p.id);
                if (existing) {
                    if (existing.quantity >= p.stock) return prev;
                    return prev.map(i => i.product?.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
                }
                return [...prev, { product: p, quantity: 1, customPrice: sprice }];
            });
        }
    };

    // Re-precio de cristales en cada cambio del carrito, con la MISMA función
    // que usa el server al guardar: mezclas de variantes 2x1 y borrados del par
    // gratis siempre cobran el par más caro. Devuelve false si no cambió nada.
    // Una VENTA (aunque esté reabierta) no se toca — mismo motivo que el efecto
    // de arriba.
    useEffect(() => {
        if (editingIsSale) return;
        const copia = quoteItems.map(it => ({ ...it }));
        if (recalculateCrystalPrices(copia)) setQuoteItems(copia);
    }, [quoteItems, editingIsSale]);

    // Calculate totals including 2x1 promo frame discount
    const quoteTotals = calculateQuoteTotals(quoteItems, markup, discountCash, products, specialDiscount);
    const totalWithMarkup = quoteTotals.subtotalWithMarkup;
    const totalCash = quoteTotals.totalCash;
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
                        id: it.id,
                        productId: it.product?.id || null,
                        quantity: it.quantity,
                        price: it.customPrice,
                        eye: it.eye,
                        crystalColor: it.crystalColor || null,
                        crystalColorType: it.crystalColorType || null,
                        crystalColorNote: it.crystalColorNote || null,
                        framePosition: it.framePosition ?? null,
                        productBrandSnapshot: it.productBrandSnapshot || it.product?.brand || null,
                        productNameSnapshot: it.productNameSnapshot || it.product?.name || it.product?.model || null,
                        productCategorySnapshot: it.productCategorySnapshot || it.product?.category || null,
                        laboratorySnapshot: it.laboratorySnapshot ?? it.product?.laboratory ?? null,
                        productCostSnapshot: it.productCostSnapshot ?? it.product?.cost ?? null,
                        productTypeSnapshot: it.productTypeSnapshot ?? it.product?.type ?? null,
                        productLensIndexSnapshot: it.productLensIndexSnapshot ?? it.product?.lensIndex ?? null,
                        productUnitTypeSnapshot: it.productUnitTypeSnapshot ?? it.product?.unitType ?? null,
                    })),
                    markup,
                    discount: discountCash,
                    discountCash,
                    discountTransfer,
                    discountCard,
                    total: Math.round(totalCash),
                    subtotalWithMarkup: Math.round(totalWithMarkup),
                    specialDiscount: quoteTotals.specialDiscountAmount,
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
        // MP 12: costo financiero fijo del 10% sobre lista, ADENTRO del importe.
        // El cálculo vive en PricingService (regla: cálculo de plata SOLO ahí);
        // al cliente se le dice "cuotas fijas", sin la leyenda del % (31/8 noche).
        const { installment12: inst12 } = PricingService.cuotasMpLargas(listPrice);
        
        // Build the message
        let msg = `Hola ${pendingContact.name}, te envío el presupuesto solicitado:\n\n`;
        quoteItems.forEach(it => {
            const origin = lensOriginSuffix(lensOriginFromItem(it));
            // El par gratis del 2x1 se dice con todas las letras, no "$0".
            const precioLinea = it.isPromo && it.customPrice === 0 ? 'SIN CARGO (2x1)' : `$${it.customPrice.toLocaleString()}`;
            msg += `- ${it.product?.brand || it.productBrandSnapshot || ''} · ${it.product?.name || it.productNameSnapshot || ''}${origin} ${it.eye ? '['+it.eye+']' : ''}: ${precioLinea}\n`;
        });
        // El descuento del armazón bonificado, explícito: sin este renglón los
        // ítems no cierran contra el total y el cliente hace la resta a mano.
        if (quoteTotals.promoFrameDiscount > 0) {
            msg += `🎁 ${quoteTotals.appliedPromoName || 'Promo 2x1'}: -$${Math.round(quoteTotals.promoFrameDiscount).toLocaleString()}\n`;
        }
        msg += `\n*Precio Lista: $${listPrice.toLocaleString()}*\n`;
        msg += `💰 Efectivo (-${discountCash}%): $${Math.round(totalCash).toLocaleString()}\n`;
        msg += `🏦 Transferencia (-${discountTransfer}%): $${Math.round(totalWithMarkup * (1 - discountTransfer / 100)).toLocaleString()}\n`;
        msg += `💳 Tarjeta (Lista): $${listPrice.toLocaleString()}\n`;
        msg += `   ↳ 3 cuotas sin interés: $${inst3.toLocaleString()} c/u\n`;
        msg += `   ↳ 6 cuotas sin interés: $${inst6.toLocaleString()} c/u\n`;
        msg += `   ↳ 12 cuotas fijas: $${inst12.toLocaleString()} c/u\n`;
        msg += `\nAtelier Óptica`;
        
        const phone = formatPhoneForWhatsApp(pendingContact.phone);

        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: `${phone}@c.us`,
                    message: msg,
                    // API oficial, fuera de la ventana de 24 h: plantilla "presupuesto" (A14).
                    template: { name: 'presupuesto', bodyParams: [pendingContact.name.split(' ')[0], `$ ${listPrice.toLocaleString('es-AR')}`, `$ ${Math.round(totalWithMarkup * (1 - discountTransfer / 100)).toLocaleString('es-AR')}`, `$ ${Math.round(totalCash).toLocaleString('es-AR')}`] },
                })
            });

            if (res.ok) {
                alert('✅ Presupuesto enviado por WhatsApp');
            } else {
                // 18/8/2026: se sacó el fallback a wa.me (abría el WhatsApp del
                // celular del vendedor, por fuera del buzón y del número de la
                // óptica). Si no salió, se dice por qué y se reintenta desde el CRM.
                const errData = await res.json().catch(() => ({}));
                alert(`❌ No se pudo enviar el presupuesto: ${errData?.error || 'error desconocido'}`);
            }
        } catch (err: any) {
            alert(`❌ No se pudo enviar el presupuesto: ${err?.message || 'error de red'}`);
        }
    };


    const handleCopy = () => {
        let text = `PRESUPUESTO ATELIER\n\n`;
        quoteItems.forEach(it => {
            const origin = lensOriginSuffix(lensOriginFromItem(it));
            text += `• ${it.product?.brand || it.productBrandSnapshot || ''} · ${it.product?.name || it.productNameSnapshot || ''}${origin} ${it.eye ? '['+it.eye+']' : ''}: $${it.customPrice.toLocaleString()}\n`;
        });
        text += `\nTotal Lista: $${Math.round(totalWithMarkup).toLocaleString()}\n`;
        text += `Promo Efectivo: $${Math.round(totalCash).toLocaleString()}\n`;
        
        navigator.clipboard.writeText(text);
        console.log('Copiado al portapapeles');
    };

    const handleEditQuote = (quote: any) => {
        const mappedItems = quote.items.map((it: any, idx: number) => ({
            id: it.id,
            product: it.product,
            quantity: it.quantity,
            customPrice: it.price,
            eye: it.eye,
            crystalColor: it.crystalColor,
            crystalColorType: it.crystalColorType,
            crystalColorNote: it.crystalColorNote,
            framePosition: it.framePosition ?? null,
            uid: Date.now() + idx,
            productBrandSnapshot: it.productBrandSnapshot,
            productNameSnapshot: it.productNameSnapshot,
            productCategorySnapshot: it.productCategorySnapshot,
            laboratorySnapshot: it.laboratorySnapshot,
            productCostSnapshot: it.productCostSnapshot,
            productTypeSnapshot: it.productTypeSnapshot,
            productLensIndexSnapshot: it.productLensIndexSnapshot,
            productUnitTypeSnapshot: it.productUnitTypeSnapshot,
            productOriginSnapshot: it.productOriginSnapshot,
        }));
        setQuoteItems(mappedItems);
        
        // Restore all pricing settings — fields are on the order object directly (not in metadata)
        setMarkup(quote.markup || 0);
        setDiscountCash(quote.discountCash ?? 20);
        setDiscountTransfer(quote.discountTransfer ?? 15);
        setDiscountCard(quote.discountCard ?? 0);
        setSpecialDiscount(quote.specialDiscount ?? 0);
        setEditingOrderData(quote);

        if (quote.frameSource) setFrameSource(quote.frameSource);
        setUserFrameData({
            brand: quote.userFrameBrand || '',
            model: quote.userFrameModel || '',
            notes: quote.userFrameNotes || ''
        });
        setEditingQuoteId(quote.id);
        setEditingIsSale(quote.orderType === 'SALE');
        setShowHistory(false);
    };

    const handleCancelEdit = () => {
        setEditingQuoteId(null);
        setEditingIsSale(false);
        setQuoteItems([]);
        setSpecialDiscount(0);
        setPendingContact(null);
        router.replace('/admin/cotizador');
    };

    const clientName = pendingContact?.name;

    return (
        <div className="absolute inset-0 flex flex-col bg-background text-foreground overflow-hidden">
            {/* Header: título + subtítulo con el estado actual (cantidad, laboratorio) + acciones */}
            <header className="px-4 lg:px-8 py-3.5 border-b border-sidebar-border bg-sidebar flex items-center gap-4 flex-shrink-0">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calculator className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-black uppercase tracking-tight leading-tight flex items-center gap-2 flex-wrap">
                        Cotizador
                        {clientName && <span className="text-primary text-sm font-black">— {clientName}</span>}
                    </h1>
                    <p className="text-[10px] font-semibold text-foreground/55 uppercase tracking-wider mt-0.5 truncate">
                        {loading ? 'Cargando catálogo…' : `${filtered.length.toLocaleString('es-AR')} producto${filtered.length === 1 ? '' : 's'}`}
                        {selectedLab && ` · Laboratorio ${selectedLab}`}
                        {!selectedLab && activeType && ` · ${getTypeConfigByKey(activeType).label}`}
                    </p>
                </div>
                {/* Claro u oscuro es del que mira, no de la pantalla: el cotizador
                    se usa a toda hora y con distinta luz en el mostrador. */}
                <ThemeToggle />
                {quoteItems.length > 0 && (
                    <button
                        onClick={() => { setQuoteItems([]); setMarkup(0); setSpecialDiscount(0); setFrameSource(null); setEditingQuoteId(null); setEditingIsSale(false); router.replace('/admin/cotizador'); }}
                        className="flex items-center gap-1.5 px-3 min-h-10 py-1.5 text-[10px] font-bold text-foreground/55 hover:text-red-400 bg-foreground/[0.06] rounded-lg border border-sidebar-border transition-all hover:border-red-400/30 uppercase tracking-wider flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <RotateCcw className="w-3 h-3" /> Limpiar
                    </button>
                )}
            </header>

            {/* Barra de filtros: una sola fila. Los secundarios (subtipo, origen,
                marca, laboratorio) viven en un popover aparte, con lo elegido
                mostrado como tags removibles al lado. */}
            <div className="px-4 lg:px-8 py-3 border-b border-sidebar-border bg-sidebar/65 flex flex-col gap-2 flex-shrink-0">
                <div className="flex flex-col md:flex-row md:items-center gap-2.5">
                    <div className="relative w-full md:w-60 flex-shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/55" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-sidebar/80 border border-sidebar-border py-3 pl-9 pr-11 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all placeholder:text-foreground/55 text-foreground"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Borrar búsqueda"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-foreground/55 hover:text-foreground text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >✕</button>
                        )}
                    </div>

                    {/* MARCA e ÍNDICE, pegados al buscador y FUERA de la fila que
                        scrollea. Son los dos filtros que más se piden en el
                        mostrador ("mostrame todos los 1.67", "los Varilux");
                        puestos entre los chips quedaban corridos fuera de
                        pantalla, que es lo mismo que no tenerlos. */}
                    {(uniqueBrands.length > 1 || uniqueIndexes.length > 1) && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {uniqueBrands.length > 1 && (
                                <select
                                    value={selectedBrand}
                                    onChange={(e) => setSelectedBrand(e.target.value)}
                                    aria-label="Filtrar por marca"
                                    className={`${chipBase} px-2 max-w-[130px] ${selectedBrand ? chipActivo : chipInactivo} cursor-pointer`}
                                >
                                    <option value="">Marca</option>
                                    {uniqueBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                                </select>
                            )}
                            {uniqueIndexes.length > 1 && (
                                <select
                                    value={selectedIndex}
                                    onChange={(e) => setSelectedIndex(e.target.value)}
                                    aria-label="Filtrar por índice"
                                    className={`${chipBase} px-2 ${selectedIndex ? chipActivo : chipInactivo} cursor-pointer`}
                                >
                                    <option value="">Índice</option>
                                    {uniqueIndexes.map((i) => <option key={i} value={i}>{i}</option>)}
                                </select>
                            )}
                        </div>
                    )}

                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {/* Chips de categoría: un solo tratamiento visual — neutro en
                            reposo, dorado/oscuro el activo, contador en badge aparte. */}
                        <button
                            onClick={() => setActiveType(null)}
                            aria-pressed={activeType === null}
                            className={`${chipBase} pl-3 pr-2 ${activeType === null ? chipActivo : chipInactivo}`}
                        >
                            Todos
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${activeType === null ? 'bg-black/15' : 'bg-sidebar/[0.06]'}`}>{products.length}</span>
                        </button>
                        <button
                            onClick={() => setOnlyWeb(!onlyWeb)}
                            aria-pressed={onlyWeb}
                            className={`${chipBase} px-3 ${onlyWeb ? chipActivo : chipInactivo}`}
                        >
                            Web
                        </button>
                        {availableCategories.map(cat => {
                            const config = getTypeConfigByKey(cat);
                            const count = products.filter(p => getCategoryKey(p.type, p.category) === cat).length;
                            const Icon = config.icon;
                            const active = activeType === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setActiveType(cat)}
                                    aria-pressed={active}
                                    className={`${chipBase} pl-2.5 pr-2 ${active ? chipActivo : chipInactivo}`}
                                >
                                    <Icon className="w-3 h-3" />
                                    {config.label}
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${active ? 'bg-black/15' : 'bg-sidebar/[0.06]'}`}>{count}</span>
                                </button>
                            );
                        })}

                        {/* Filtros secundarios: colapsados en un popover propio. */}
                        {hasSecondaryFilters && (
                            <div className="relative ml-1" ref={moreFiltersRef}>
                                <button
                                    onClick={() => setShowMoreFilters(v => !v)}
                                    aria-expanded={showMoreFilters}
                                    className={`${chipBase} px-2.5 ${showMoreFilters || activeFilterTags.length > 0
                                        ? 'bg-foreground/[0.06] text-foreground border-stone-400'
                                        : chipInactivo}`}
                                >
                                    <SlidersHorizontal className="w-3 h-3" /> Filtros
                                    {activeFilterTags.length > 0 && (
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{activeFilterTags.length}</span>
                                    )}
                                </button>

                                {showMoreFilters && (
                                    <div className="absolute z-20 top-[calc(100%+6px)] left-0 w-[min(90vw,340px)] bg-sidebar border border-sidebar-border rounded-xl shadow-2xl shadow-black/40 p-3.5 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                                        {activeType === 'Cristal' && (
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-black text-foreground/55 uppercase tracking-widest">Subtipo</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {['', 'Monofocal', 'Multifocal', 'Bifocal', 'Ocupacional', 'Coquil'].map((sub) => (
                                                        <button
                                                            key={sub || 'todos'}
                                                            onClick={() => setSelectedSubtype(sub)}
                                                            aria-pressed={selectedSubtype === sub}
                                                            className={`px-2.5 min-h-10 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedSubtype === sub
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-foreground/[0.06] text-foreground/55 hover:text-foreground/90'
                                                                }`}
                                                        >
                                                            {sub || 'Todos'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {activeType === 'Cristal' && (
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-black text-foreground/55 uppercase tracking-widest">Tipo de confección</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {[
                                                        { val: '', label: 'Todos' },
                                                        { val: 'LABORATORIO', label: 'Laboratorio' },
                                                        { val: 'STOCK', label: 'Stock y rango extendido' }
                                                    ].map((orig) => (
                                                        <button
                                                            key={orig.val || 'todos'}
                                                            onClick={() => setSelectedOrigin(orig.val)}
                                                            aria-pressed={selectedOrigin === orig.val}
                                                            className={`px-2.5 min-h-10 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedOrigin === orig.val
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-foreground/[0.06] text-foreground/55 hover:text-foreground/90'
                                                                }`}
                                                        >
                                                            {orig.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {uniqueBrands.length > 1 && (
                                            <label className="space-y-1.5 block">
                                                <span className="text-[9px] font-black text-foreground/55 uppercase tracking-widest">Marca</span>
                                                <select
                                                    value={selectedBrand}
                                                    onChange={(e) => setSelectedBrand(e.target.value)}
                                                    className="w-full bg-foreground/[0.06] border border-sidebar-border text-[11px] font-bold px-2.5 py-1.5 rounded-md outline-none focus:border-primary cursor-pointer text-foreground/90"
                                                >
                                                    <option value="">Todas</option>
                                                    {uniqueBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                                                </select>
                                            </label>
                                        )}

                                        {uniqueIndexes.length > 1 && (
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-black text-foreground/55 uppercase tracking-widest">Índice</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {['', ...uniqueIndexes].map((idx) => (
                                                        <button
                                                            key={idx || 'todos'}
                                                            onClick={() => setSelectedIndex(idx)}
                                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${selectedIndex === idx
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-foreground/[0.06] text-foreground/55 hover:text-foreground/90'
                                                                }`}
                                                        >
                                                            {idx || 'Todos'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {uniqueLabs.length > 1 && (
                                            <label className="space-y-1.5 block">
                                                <span className="text-[9px] font-black text-foreground/55 uppercase tracking-widest">Laboratorio</span>
                                                <select
                                                    value={selectedLab}
                                                    onChange={(e) => setSelectedLab(e.target.value)}
                                                    className="w-full bg-foreground/[0.06] border border-sidebar-border text-[11px] font-bold px-2.5 py-1.5 rounded-md outline-none focus:border-primary cursor-pointer text-foreground/90"
                                                >
                                                    <option value="">Todos</option>
                                                    {uniqueLabs.map((lab) => <option key={lab} value={lab}>{lab}</option>)}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tags de filtros activos: removibles con un click, sin abrir el popover */}
                {activeFilterTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
                        {activeFilterTags.map(tag => (
                            <button
                                key={tag.key}
                                onClick={tag.clear}
                                aria-label={`Quitar filtro ${tag.label}`}
                                className="flex items-center gap-1 pl-2 pr-1.5 min-h-10 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {tag.label}
                                <X className="w-2.5 h-2.5" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                {/* Left Column: Product Catalog */}
                <div
                    className="flex-1 overflow-y-auto px-4 lg:px-8 py-4"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {loading ? (
                        <div className="max-w-[1500px] mx-auto rounded-xl border border-sidebar-border overflow-hidden">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-sidebar-border last:border-b-0 animate-pulse">
                                    <div className="h-2.5 w-16 bg-foreground/[0.06] rounded" />
                                    <div className="h-2.5 w-20 bg-foreground/[0.06] rounded" />
                                    <div className="h-2.5 flex-1 bg-foreground/[0.06] rounded max-w-xs" />
                                    <div className="h-2.5 w-20 bg-foreground/[0.06] rounded ml-auto" />
                                    <div className="h-2.5 w-16 bg-foreground/[0.06] rounded" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-foreground/55 gap-4">
                            <PackageSearch className="w-12 h-12 text-foreground/55" />
                            <div className="text-center">
                                <p className="text-sm font-bold uppercase tracking-widest text-foreground/55">Sin resultados</p>
                                <p className="text-xs text-foreground/55 mt-1">Probá con otra búsqueda o quitá algún filtro</p>
                            </div>
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1.5 px-4 min-h-10 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-foreground/[0.06] text-foreground/90 hover:bg-foreground/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Limpiar filtros
                            </button>
                        </div>
                    ) : activeType?.startsWith('Cristal') ? (
                        <div className="max-w-[1500px] mx-auto">
                            {/* Desktop / tablet: tabla densa y jerarquizada */}
                            <div className="hidden md:block rounded-xl border border-sidebar-border overflow-hidden bg-sidebar">
                                <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                                    <table className="w-full text-left border-collapse table-fixed" style={{ minWidth: 980 }}>
                                        <thead>
                                            <tr className="bg-sidebar text-foreground/55 border-b border-sidebar-border">
                                                <th className="pl-4 pr-1 py-2.5 text-[9px] font-bold uppercase tracking-wider w-[104px]">Tipo · Marca</th>
                                                <th className="px-1 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center w-[44px]">Índice</th>
                                                <th className="px-1.5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center w-[86px]">Confección</th>
                                                <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider">Descripción</th>
                                                <th className="px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider text-center w-[150px]">Rango</th>
                                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[90px]">Lista</th>
                                                <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[110px] text-primary">Efectivo</th>
                                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[90px]">Transf.</th>
                                                {/* El 10% se aclara siempre. Acá no entra la etiqueta completa
                                                    (columna de 100px), así que va abreviada y la frase canónica
                                                    queda al pie de la tabla. */}
                                                <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-right w-[100px]" title={ETIQUETA_MP_CUOTAS_LARGAS}>
                                                    12 Cuotas +{RECARGO_MP_CUOTAS_LARGAS}%
                                                </th>
                                                <th className="px-2 py-2.5 w-10 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((product) => {
                                                const inQuote = quoteItems.find(i => i.product?.id === product.id);
                                                const sprice = safePrice(product.price);
                                                const pTotal = sprice * (1 + markup / 100);
                                                const pCash = pTotal * (1 - discountCash / 100);
                                                const pTrans = pTotal * (1 - discountTransfer / 100);
                                                const { installment12: pCuota12 } = PricingService.cuotasMpLargas(pTotal);
                                                const origin = normalizeLensOrigin(product.origin);
                                                return (
                                                    <tr
                                                        key={product.id}
                                                        onClick={() => addToQuote(product)}
                                                        className="group cursor-pointer transition-colors border-b border-sidebar-border last:border-b-0 hover:bg-primary/[0.06]"
                                                    >
                                                        <td className="px-4 py-2 align-top">
                                                            <p className="text-[10px] font-bold uppercase text-foreground/55 whitespace-nowrap">{tipoConSeparador(product.type)}</p>
                                                            <p className="text-[10px] font-semibold uppercase text-foreground/55 mt-0.5 truncate max-w-[120px]">{product.brand || '—'}</p>
                                                        </td>
                                                        <td className="px-3 py-2 text-center align-top">
                                                            <span className="text-[10px] font-bold text-foreground/55">{product.lensIndex || '—'}</span>
                                                        </td>
                                                        <td className="px-1.5 py-2 text-center align-top">
                                                            {origin ? (
                                                                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${origin === 'STOCK' ? 'border-emerald-800 text-emerald-500' : 'border-sky-800 text-sky-500'}`}>
                                                                    {origin === 'STOCK' ? 'Stock' : 'Laboratorio'}
                                                                </span>
                                                            ) : <span className="text-[10px] text-foreground/55">—</span>}
                                                        </td>
                                                        <td className="px-4 py-2 align-top">
                                                            <div className="flex items-start gap-2">
                                                                {/* El 2x1 es la promo que más se vende: tiene que verse de lejos. */}
                                                                {product.is2x1 && (
                                                                    <span className="shrink-0 mt-px px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide bg-primary text-primary-foreground shadow-sm">
                                                                        2x1
                                                                    </span>
                                                                )}
                                                                <p className="text-[13px] font-semibold leading-snug">{product.name || '—'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center align-top">
                                                            <span className="text-[10px] font-medium text-foreground/55 leading-tight block">{formatLensRange(product) || '—'}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right align-top">
                                                            <span className="text-xs font-semibold text-foreground/55 tabular-nums">${Math.round(pTotal).toLocaleString('es-AR')}</span>
                                                        </td>
                                                        <td className="px-4 py-2 text-right align-top">
                                                            <span className="text-sm font-black text-primary tabular-nums">${Math.round(pCash).toLocaleString('es-AR')}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right align-top">
                                                            <span className="text-xs font-semibold text-foreground/55 tabular-nums">${Math.round(pTrans).toLocaleString('es-AR')}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right align-top">
                                                            <span className="text-xs font-semibold text-foreground/55 tabular-nums">${pCuota12.toLocaleString('es-AR')}</span>
                                                        </td>
                                                        <td className="px-2 py-2 text-center align-top">
                                                            {inQuote ? (
                                                                <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
                                                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full border border-sidebar-border flex items-center justify-center mx-auto opacity-60 group-hover:opacity-100 group-hover:border-primary group-hover:bg-primary/10 transition-all">
                                                                    <Plus className="w-3.5 h-3.5 text-foreground/55 group-hover:text-primary transition-colors" />
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-foreground/55 border-t border-sidebar-border">
                                    {ETIQUETA_MP_CUOTAS_LARGAS} · Mercado Pago
                                </p>
                            </div>

                            {/* Mobile: cards con la misma jerarquía */}
                            <div className="md:hidden flex flex-col gap-2">
                                {filtered.map(product => {
                                    const inQuote = quoteItems.find(i => i.product?.id === product.id);
                                    const sprice = safePrice(product.price);
                                    const pTotal = sprice * (1 + markup / 100);
                                    const pCash = pTotal * (1 - discountCash / 100);
                                    const { installment12: pCuota12 } = PricingService.cuotasMpLargas(pTotal);
                                    const origin = normalizeLensOrigin(product.origin);
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addToQuote(product)}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${inQuote ? 'bg-primary/[0.06] border-primary/30' : 'bg-sidebar border-sidebar-border'}`}
                                        >
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="text-[9px] font-bold uppercase text-foreground/55">{tipoConSeparador(product.type)}</span>
                                                {product.brand && <span className="text-[9px] font-bold uppercase text-foreground/55">· {product.brand}</span>}
                                                {product.lensIndex && <span className="text-[9px] font-bold text-foreground/55">· idx {product.lensIndex}</span>}
                                                {origin && (
                                                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${origin === 'STOCK' ? 'border-emerald-800 text-emerald-500' : 'border-sky-800 text-sky-500'}`}>
                                                        {origin === 'STOCK' ? 'Stock' : 'Laboratorio'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-foreground leading-snug">{product.name || '—'}</p>
                                            {formatLensRange(product) && (
                                                <p className="text-[10px] font-medium text-foreground/55 mt-1">{formatLensRange(product)}</p>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-black text-primary tabular-nums">${Math.round(pCash).toLocaleString('es-AR')}</span>
                                                    <span className="text-[10px] font-semibold text-foreground/55 tabular-nums">{textoCuotas12(pCuota12)}</span>
                                                </div>
                                                {inQuote ? (
                                                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                    </div>
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
                                                        <Plus className="w-4 h-4 text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : activeType === 'Tratamiento' ? (
                        <div className="max-w-[1500px] mx-auto">
                            <div className="rounded-2xl border border-sidebar-border overflow-hidden shadow-md bg-sidebar">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse" style={{ minWidth: 700 }}>
                                        <thead>
                                            <tr className="bg-background text-foreground/55 border-b border-sidebar-border">
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Producto</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center w-[120px]">Tipo</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center w-[80px]">Índice</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center w-[120px]">Stock</th>
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right w-[120px]">P. Minorista</th>
                                                {/* Igual que en cristales: abreviado por ancho de columna, con la
                                                    frase canónica completa al pie de la tabla. */}
                                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right w-[110px]" title={ETIQUETA_MP_CUOTAS_LARGAS}>
                                                    12 Cuotas +{RECARGO_MP_CUOTAS_LARGAS}%
                                                </th>
                                                {userRole === 'ADMIN' && (
                                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right w-[120px] text-blue-600">P. Mayorista</th>
                                                )}
                                                <th className="px-3 py-3 w-12 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((product, idx) => {
                                                const inQuote = quoteItems.find(i => i.product?.id === product.id);
                                                const { installment12: tCuota12 } = PricingService.cuotasMpLargas(safePrice(product.price));
                                                return (
                                                    <tr
                                                        key={product.id}
                                                        onClick={() => addToQuote(product)}
                                                        className={`cursor-pointer transition-colors border-b border-sidebar-border ${idx % 2 === 0 ? 'bg-sidebar' : 'bg-background'} hover:bg-primary/5`}
                                                    >
                                                        <td className="px-4 py-2.5">
                                                            <p className="text-xs font-semibold whitespace-normal break-words">{product.name || '—'}</p>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="text-[10px] font-bold uppercase text-foreground/55">{product.type || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="text-[10px] font-bold">{product.lensIndex || '—'}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="text-[10px] font-bold uppercase text-amber-600">{product.laboratory || 'A Pedido'}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-xs">${safePrice(product.price).toLocaleString()}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-xs text-foreground/55">${tCuota12.toLocaleString()}</td>
                                                        {userRole === 'ADMIN' && (
                                                            <td className="px-4 py-2.5 text-right font-bold text-xs text-blue-600">${safePrice(product.wholesalePrice).toLocaleString()}</td>
                                                        )}
                                                        <td className="px-3 py-2.5 text-center">
                                                            {inQuote ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <Plus className="w-4 h-4 text-foreground/40 group-hover:text-primary mx-auto transition-colors" />}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/55 border-t border-sidebar-border">
                                    {ETIQUETA_MP_CUOTAS_LARGAS} · Mercado Pago
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-[1500px] mx-auto flex flex-col gap-6">
                            {sortedBrands.map(brandName => {
                                const brandProducts = groupedProducts[brandName] || [];
                                return (
                                    <div key={brandName} className="space-y-2">
                                        <div className="flex items-center gap-3 py-1">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/55">
                                                {brandName}
                                            </h3>
                                            <div className="h-px flex-1 bg-foreground/10/50" />
                                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/55">
                                                {brandProducts.length} {brandProducts.length === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {brandProducts.map(product => {
                                                const inQuote = quoteItems.find(i => i.product?.id === product.id);
                                                const config = getTypeConfig(product.type, product.category);
                                                const TypeIcon = config.icon;
                                                // Las CUATRO formas de pago, resueltas: el vendedor no calcula nada.
                                                const bLista = safePrice(product.price) * (1 + markup / 100);
                                                const bEfectivo = bLista * (1 - discountCash / 100);
                                                const bTransf = bLista * (1 - discountTransfer / 100);
                                                const { installment12: bCuota12 } = PricingService.cuotasMpLargas(bLista);
                                                return (
                                                    <button
                                                        key={product.id}
                                                        onClick={() => addToQuote(product)}
                                                        className={`w-full p-3 rounded-xl border transition-all text-left flex items-center justify-between hover:shadow-sm duration-200 group ${inQuote 
                                                            ? 'bg-primary/[0.03] border-primary/30 shadow-sm' 
                                                            : 'bg-sidebar border-sidebar-border'}`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            {(() => {
                                                                 const imgUrl = resolveStorageUrl(product.imagenesCatalogo?.[0] || product.rawImageUrls?.[0] || null);
                                                                 if (imgUrl) {
                                                                     return (
                                                                         <Image unoptimized
                                                                             width={32}
                                                                             height={32}
                                                                             src={imgUrl}
                                                                             alt={product.name || ''} 
                                                                             className="w-8 h-8 object-contain rounded-lg border border-sidebar-border bg-background shadow-sm shrink-0"
                                                                         />
                                                                     );
                                                                 }
                                                                 return (
                                                                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${inQuote ? 'bg-primary/10 text-primary' : 'bg-background text-foreground/55 group-hover:bg-primary/5 group-hover:text-primary transition-colors'}`}>
                                                                         <TypeIcon className="w-4 h-4" />
                                                                     </div>
                                                                 );
                                                             })()}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/55">
                                                                        {product.type || 'Otros'}
                                                                    </span>
                                                                    {product.stock !== undefined && product.stock <= 2 && (
                                                                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                                                                            Stock: {product.stock}
                                                                        </span>
                                                                    )}
                                                                    {product.publishToWeb && (
                                                                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                                                                            🌐 Web
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs font-semibold mt-1 text-foreground/90 group-hover:text-foreground transition-colors truncate">
                                                                    {product.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                                            <div className="text-right tabular-nums leading-tight">
                                                                <p className="text-sm font-black text-primary">
                                                                    ${Math.round(bEfectivo).toLocaleString('es-AR')}
                                                                    <span className="text-[8px] font-bold text-foreground/55 uppercase ml-1">efectivo</span>
                                                                </p>
                                                                <p className="text-[9px] font-semibold text-foreground/55">
                                                                    Lista ${Math.round(bLista).toLocaleString('es-AR')}
                                                                    <span className="text-foreground/40"> · </span>
                                                                    Transf. ${Math.round(bTransf).toLocaleString('es-AR')}
                                                                </p>
                                                                <p className="text-[9px] font-semibold text-foreground/55" title={textoCuotas12(bCuota12)}>
                                                                    12 cuotas de <span className="text-foreground/40">${bCuota12.toLocaleString('es-AR')}</span>
                                                                </p>
                                                            </div>
                                                            {inQuote ? (
                                                                <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground rounded-full text-[10px] font-bold shadow-md shadow-primary/20">
                                                                    {inQuote.quantity}
                                                                </div>
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full border border-sidebar-border flex items-center justify-center group-hover:border-primary/45 group-hover:bg-primary/5 transition-all">
                                                                    <Plus className="w-3.5 h-3.5 text-foreground/55 group-hover:text-primary transition-colors" />
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
                    <div className="hidden lg:flex w-[400px] xl:w-[460px] border-l border-sidebar-border bg-sidebar relative z-50 shadow-xl flex-col h-full overflow-y-auto flex-shrink-0 animate-in slide-in-from-right duration-300" style={{ scrollbarWidth: 'thin' }}>
                        <div className="flex-1 p-6 pb-28">
                            {!showRegister ? (
                                <CotizadorCart 
                                    items={quoteItems}
                                    setItems={setQuoteItems}
                                    editingOrderData={editingOrderData}
                                    onRefreshOrderData={refrescarOrdenEnEdicion}
                                    markup={markup}
                                    setMarkup={setMarkup}
                                    discountCash={discountCash}
                                    setDiscountCash={setDiscountCash}
                                    discountTransfer={discountTransfer}
                                    setDiscountTransfer={setDiscountTransfer}
                                    discountCard={discountCard}
                                    setDiscountCard={setDiscountCard}
                                    specialDiscount={specialDiscount}
                                    setSpecialDiscount={setSpecialDiscount}
                                    currentUserRole={userRole}
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
                                    isSale={editingIsSale}
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
                                                    ? 'bg-sidebar text-white shadow-md' 
                                                    : 'bg-foreground/[0.06] text-foreground/55 hover:bg-foreground/10'}`}
                                            >
                                                <History className="w-3.5 h-3.5" /> {showHistory ? 'Cerrar' : `Historial (${previousQuotes.length})`}
                                            </button>
                                        )
                                    }
                                    crystalColors={crystalColors}
                                    tintStylePrices={tintStylePrices}
                                />
                            ) : (
                                <div className="bg-sidebar border border-primary/20 rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-300">
                                    <button onClick={() => setShowRegister(false)} className="absolute top-4 right-4 text-foreground/55 hover:text-foreground/90"><X className="w-4 h-4" /></button>
                                    
                                    {savedContact ? (
                                        <div className="py-6 text-center space-y-6">
                                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                                                <Check className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold tracking-tight">¡Guardado con éxito!</h4>
                                                <p className="text-foreground/55 font-semibold text-xs mt-1">Registrado en la ficha de {savedContact.name}</p>
                                            </div>
                                            <div className="flex gap-3 justify-center pt-2">
                                                <button onClick={() => router.push(`/admin/contactos?clientId=${savedContact.id}`)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all shadow-md">Ver Ficha</button>
                                                <button onClick={resetRegister} className="px-4 py-2 bg-foreground/[0.06] text-foreground/40 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all">Nuevo</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="text-lg font-bold tracking-tight">Vincular Contacto</h3>
                                                <p className="text-[10px] font-bold text-foreground/55 uppercase tracking-wider mt-0.5">Busca un cliente o crea uno nuevo</p>
                                            </div>

                                            {pendingContact ? (
                                                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                                    {/* Editando un pedido: SUS ARMAZONES a la vista (foto,
                                                        medidas, forma). El dato siempre llegó (getOrder trae
                                                        frames); la pantalla lo tiraba. Editar sin ver qué
                                                        armazón es cuál era adivinar. */}
                                                    {editingQuoteId && editingOrderData && (
                                                        <FrameRecapReadOnly order={editingOrderData} defaultOpen contexto="cotizador" />
                                                    )}
                                                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-lg bg-sidebar shadow-sm flex items-center justify-center border border-primary/20"><User className="w-6 h-6 text-primary" /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[9px] font-bold text-primary uppercase tracking-wider">Cliente Seleccionado</p>
                                                            <h4 className="text-base font-bold truncate mt-0.5">{pendingContact.name}</h4>
                                                            {pendingContact.phone && <p className="text-xs text-foreground/55 mt-0.5">{pendingContact.phone}</p>}
                                                        </div>
                                                        {!editingQuoteId && <button onClick={() => setPendingContact(null)} className="p-2 text-foreground/40 hover:text-red-500"><X className="w-5 h-5" /></button>}
                                                    </div>

                                                    {hasCrystals && pendingContact.prescriptions && pendingContact.prescriptions.length > 0 && (
                                                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/50 space-y-3">
                                                            <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Vincular Receta Médica</span></div>
                                                            <select 
                                                                value={quotePrescriptionId || ''} 
                                                                onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                className="w-full bg-sidebar border border-emerald-200 py-2 px-3 rounded-xl text-xs font-bold outline-none cursor-pointer text-foreground/90"
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
                                                        {!editingQuoteId && <button onClick={() => { setPendingContact(null); setPreviousQuotes([]); }} className="px-4 py-3 bg-sidebar border border-sidebar-border text-foreground/40 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-foreground transition-all">Cambiar</button>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="flex gap-3">
                                                        <div className="relative flex-1">
                                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                                                            <input 
                                                                ref={contactSearchRef} 
                                                                type="text" 
                                                                placeholder="Buscar cliente..." 
                                                                value={contactSearch} 
                                                                onChange={e => setContactSearch(e.target.value)}
                                                                className="w-full bg-background border border-sidebar-border py-2.5 pl-9 pr-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground/90 placeholder:text-foreground/55"
                                                            />
                                                        </div>
                                                        <button onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }} className="px-4 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nuevo</button>
                                                    </div>
                                                    {contactResults.length > 0 && (
                                                        <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                            {contactResults.map((c: any) => (
                                                                <button key={c.id} onClick={() => selectContactForQuote(c)} className="flex items-center gap-3 p-3 bg-background border border-sidebar-border rounded-xl hover:border-primary/40 transition-all group text-left">
                                                                    <div className="w-10 h-10 rounded-lg bg-sidebar shadow-sm flex items-center justify-center border border-sidebar-border"><User className="w-5 h-5 text-primary" /></div>
                                                                    <div className="flex-1 text-left min-w-0">
                                                                        <p className="text-xs font-bold truncate">{c.name}</p>
                                                                        {c.phone && <p className="text-[10px] text-foreground/55">{c.phone}</p>}
                                                                    </div>
                                                                    <ChevronRight className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
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
                            <div className="border-t border-sidebar-border bg-background p-5 overflow-y-auto max-h-[250px] animate-in slide-in-from-bottom duration-300" style={{ scrollbarWidth: 'thin' }}>
                                <h3 className="text-[10px] font-bold text-foreground/55 uppercase tracking-wider mb-4">Historial de Consultas</h3>
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
                <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-[50] bg-sidebar border-t border-sidebar-border shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-500 ${cartExpanded ? 'h-[85vh] rounded-t-[2rem]' : 'h-16'}`}>
                    {/* Collapsed Bar */}
                    <button 
                        onClick={() => setCartExpanded(!cartExpanded)}
                        className="h-16 w-full flex items-center justify-between px-6 hover:bg-background transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-primary" />
                                <span className="text-xs font-bold uppercase tracking-wider">Presupuesto</span>
                                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{itemCount}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-extrabold">${Math.round(totalCash).toLocaleString()} <span className="text-[9px] text-foreground/55 font-semibold uppercase ml-0.5">efectivo</span></span>
                            </div>
                        </div>
                        {cartExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>

                    {/* Expanded Content */}
                    {cartExpanded && (
                        <div className="h-[calc(100%-64px)] overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto p-6 pb-28" style={{ scrollbarWidth: 'thin' }}>
                                {!showRegister ? (
                                    <CotizadorCart
                                        items={quoteItems}
                                        setItems={setQuoteItems}
                                        editingOrderData={editingOrderData}
                                        onRefreshOrderData={refrescarOrdenEnEdicion}
                                        markup={markup}
                                        setMarkup={setMarkup}
                                        discountCash={discountCash}
                                        setDiscountCash={setDiscountCash}
                                        discountTransfer={discountTransfer}
                                        setDiscountTransfer={setDiscountTransfer}
                                        discountCard={discountCard}
                                        setDiscountCard={setDiscountCard}
                                        specialDiscount={specialDiscount}
                                        setSpecialDiscount={setSpecialDiscount}
                                        currentUserRole={userRole}
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
                                    isSale={editingIsSale}
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
                                                        ? 'bg-sidebar text-white shadow-md' 
                                                        : 'bg-foreground/[0.06] text-foreground/55 hover:bg-foreground/10'}`}
                                                >
                                                    <History className="w-3.5 h-3.5" /> {showHistory ? 'Cerrar' : `Historial (${previousQuotes.length})`}
                                                </button>
                                            )
                                        }
                                        crystalColors={crystalColors}
                                        tintStylePrices={tintStylePrices}
                                    />
                                ) : (
                                    <div className="bg-sidebar border border-primary/20 rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-300">
                                        <button onClick={() => setShowRegister(false)} className="absolute top-4 right-4 text-foreground/55 hover:text-foreground/90"><X className="w-4 h-4" /></button>
                                        
                                        {savedContact ? (
                                            <div className="py-6 text-center space-y-6">
                                                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                                                    <Check className="w-8 h-8 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold tracking-tight">¡Guardado con éxito!</h4>
                                                    <p className="text-foreground/55 font-semibold text-xs mt-1">Registrado en la ficha de {savedContact.name}</p>
                                                </div>
                                                <div className="flex gap-3 justify-center pt-2">
                                                    <button onClick={() => router.push(`/admin/contactos?clientId=${savedContact.id}`)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all shadow-md">Ver Ficha</button>
                                                    <button onClick={resetRegister} className="px-4 py-2 bg-foreground/[0.06] text-foreground/40 rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all">Nuevo</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-bold tracking-tight">Vincular Contacto</h3>
                                                    <p className="text-[10px] font-bold text-foreground/55 uppercase tracking-wider mt-0.5">Busca un cliente o crea uno nuevo</p>
                                                </div>

                                                {pendingContact ? (
                                                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-lg bg-sidebar shadow-sm flex items-center justify-center border border-primary/20"><User className="w-6 h-6 text-primary" /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[9px] font-bold text-primary uppercase tracking-wider">Cliente Seleccionado</p>
                                                                <h4 className="text-base font-bold truncate mt-0.5">{pendingContact.name}</h4>
                                                                {pendingContact.phone && <p className="text-xs text-foreground/55 mt-0.5">{pendingContact.phone}</p>}
                                                            </div>
                                                            {!editingQuoteId && <button onClick={() => setPendingContact(null)} className="p-2 text-foreground/40 hover:text-red-500"><X className="w-5 h-5" /></button>}
                                                        </div>

                                                        {hasCrystals && pendingContact.prescriptions && pendingContact.prescriptions.length > 0 && (
                                                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200/50 space-y-3">
                                                                <div className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Vincular Receta Médica</span></div>
                                                                <select 
                                                                    value={quotePrescriptionId || ''} 
                                                                    onChange={e => setQuotePrescriptionId(e.target.value || null)}
                                                                    className="w-full bg-sidebar border border-emerald-200 py-2 px-3 rounded-xl text-xs font-bold outline-none cursor-pointer text-foreground/90"
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
                                                            {!editingQuoteId && <button onClick={() => { setPendingContact(null); setPreviousQuotes([]); }} className="px-4 py-3 bg-sidebar border border-sidebar-border text-foreground/40 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-foreground transition-all">Cambiar</button>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6">
                                                        <div className="flex gap-3">
                                                            <div className="relative flex-1">
                                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                                                                <input 
                                                                    ref={contactSearchRef} 
                                                                    type="text" 
                                                                    placeholder="Buscar cliente..." 
                                                                    value={contactSearch} 
                                                                    onChange={e => setContactSearch(e.target.value)}
                                                                    className="w-full bg-background border border-sidebar-border py-2.5 pl-9 pr-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground/90 placeholder:text-foreground/55"
                                                                />
                                                            </div>
                                                            <button onClick={() => { setShowNewContact(true); setNewContactName(contactSearch); }} className="px-4 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nuevo</button>
                                                        </div>
                                                        {contactResults.length > 0 && (
                                                            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                                {contactResults.map((c: any) => (
                                                                    <button key={c.id} onClick={() => selectContactForQuote(c)} className="flex items-center gap-3 p-3 bg-background border border-sidebar-border rounded-xl hover:border-primary/40 transition-all group text-left">
                                                                        <div className="w-10 h-10 rounded-lg bg-sidebar shadow-sm flex items-center justify-center border border-sidebar-border"><User className="w-5 h-5 text-primary" /></div>
                                                                        <div className="flex-1 text-left min-w-0">
                                                                            <p className="text-xs font-bold truncate">{c.name}</p>
                                                                            {c.phone && <p className="text-[10px] text-foreground/55">{c.phone}</p>}
                                                                        </div>
                                                                        <ChevronRight className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
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
                                <div className="border-t border-sidebar-border bg-background p-5 overflow-y-auto max-h-[220px]" style={{ scrollbarWidth: 'thin' }}>
                                    <h3 className="text-[10px] font-bold text-foreground/55 uppercase tracking-wider mb-4">Historial de Consultas</h3>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-sidebar backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-300">
                    <div className="bg-sidebar rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 sm:p-10 animate-in zoom-in-95 duration-300 relative" style={{ scrollbarWidth: 'thin' }}>
                        <button onClick={() => setShowNewContact(false)} aria-label="Cerrar" className="absolute top-8 right-8 p-3 hover:bg-foreground/[0.06] rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <X className="w-5 h-5 text-foreground/55" />
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
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2 flex items-center gap-1">Nombre / Apellido <span className="text-primary">*</span></label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input type="text" placeholder="Nombre completo" value={newContactName} onChange={e => { setNewContactName(e.target.value); setDuplicateError(null); }} className="w-full pl-11 pr-4 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2 flex items-center gap-1">Teléfono <span className="text-primary">*</span></label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input type="tel" placeholder="351XXXXXXX" value={newContactPhone} onChange={e => { setNewContactPhone(e.target.value); setDuplicateError(null); }} className="w-full pl-11 pr-4 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* DNI + Obra Social */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2">DNI</label>
                                    <div className="relative group">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input type="text" placeholder="Número de documento" value={newContactDni} onChange={e => setNewContactDni(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2">Obra Social</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input type="text" placeholder="Apross, OSDE, etc." value={newContactInsurance} onChange={e => setNewContactInsurance(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Médico + Etiqueta */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2">Médico</label>
                                    <div className="relative group">
                                        <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors z-10" />
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground/55 pointer-events-none" />
                                        <select value={newContactDoctor} onChange={e => setNewContactDoctor(e.target.value)} className="w-full pl-11 pr-9 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold appearance-none cursor-pointer outline-none focus:border-primary transition-all">
                                            <option value="">— Sin médico —</option>
                                            {doctors.map(doc => <option key={doc.id} value={doc.name}>{doc.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2 flex items-center gap-1">Origen / Canal <span className="text-primary">*</span></label>
                                    <div className="relative group">
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-foreground/55 pointer-events-none" />
                                        <select value={newContactSource} onChange={e => setNewContactSource(e.target.value)} className="w-full px-5 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold appearance-none cursor-pointer outline-none focus:border-primary transition-all">
                                            <option value="">Seleccionar origen...</option>
                                            {CONTACT_SOURCES_SELECCIONABLES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                                        <input type="email" placeholder="correo@ejemplo.com" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-sidebar border-2 border-sidebar-border rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all" />
                                    </div>
                                </div>
                            </div>

                            {/* Tipo de Producto */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground/55 uppercase tracking-widest ml-2 flex items-center gap-1">Tipo de Producto <span className="text-primary">*</span></label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRODUCT_TYPES.map(type => (
                                        <button key={type} type="button" onClick={() => setNewContactInterest(type)} aria-pressed={newContactInterest === type} className={`px-2 min-h-10 py-2.5 rounded-xl border-2 text-[9px] font-black uppercase transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${newContactInterest === type ? 'bg-primary border-primary text-primary-foreground shadow-lg' : 'bg-sidebar text-foreground/55 border-sidebar-border hover:border-primary/30'}`}>{type}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button onClick={handleCreateAndSave} disabled={!newContactName || !newContactPhone || !newContactSource || !newContactInterest || savingQuote} className="flex-1 py-5 bg-primary text-primary-foreground rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95">{savingQuote ? <><Loader2 className="w-5 h-5 animate-spin" /> Creando...</> : 'Crear y Guardar'}</button>
                                <button onClick={() => { setShowNewContact(false); setDuplicateError(null); }} className="px-8 py-5 bg-foreground/[0.06] text-foreground/40 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-foreground/10 transition-all">Cancelar</button>
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
