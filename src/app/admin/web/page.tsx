'use client';

import { useState, useEffect } from 'react';
import { 
  Globe, 
  BookOpen, 
  Search, 
  Plus, 
  Sparkles, 
  Trash2, 
  Edit3, 
  X, 
  Loader2, 
  Eye, 
  Save, 
  FileText, 
  Settings, 
  Star, 
  AlertCircle,
  Maximize2,
  Copy,
  Grid,
  List,
  Ticket
} from "lucide-react";
import Link from "next/link";
import CouponsManager from '@/components/admin/CouponsManager';
import AnalyticsDashboard from '@/components/admin/analytics/AnalyticsDashboard';
import { LineChart } from 'lucide-react';
import { resolveStorageUrl } from '@/lib/utils/storage';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { getSelectedShapeFromTags, getSelectedMaterialFromTags, updateTagsWithShapeAndMaterial, getProductAttributes } from '@/utils/product-controllers';

interface WebProduct {
  id: string;
  productId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  images: string[];
  imageAlts: string[];
  isActive: boolean;
  isFeatured: boolean;
  category: string;
  updatedAt: string;
  product: {
    brand: string | null;
    model: string | null;
    price: number;
    salePrice?: number | null;
    stock: number;
    publishToWeb: boolean;
    imagenesCatalogo: string[];
    seoTags?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    gender?: string | null;
  };
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  content: string;
  date: string;
  category: string;
  imageUrl: string | null;
  status: string;
}

export default function WebManagementPage() {
  const [activeTab, setActiveTab] = useState<'analitica' | 'products' | 'blog' | 'config' | 'flyers' | 'coupons'>('analitica');

  // Flyer Builder states
  const [flyerTheme, setFlyerTheme] = useState<'cream' | 'obsidian' | 'rose'>('cream');
  const [flyerTitle, setFlyerTitle] = useState('BUSCAMOS');
  const [flyerSubtitle, setFlyerSubtitle] = useState('PERSONAL');
  const [flyerDescription, setFlyerDescription] = useState('Únete a nuestro equipo de Óptica Atelier');
  const [flyerPosition, setFlyerPosition] = useState('Asesor de Ventas & Atención al Cliente');
  const [flyerRequirements, setFlyerRequirements] = useState([
    'Experiencia en el sector óptico (deseable)',
    'Pasión por la moda y asesoramiento de imagen',
    'Excelente comunicación y vocación de servicio',
    'Disponibilidad horaria full-time'
  ]);
  const [flyerAction, setFlyerAction] = useState('Envíanos tu CV');
  const [flyerContact, setFlyerContact] = useState('rrhh@opticaatelier.com');
  const [flyerInstagram, setFlyerInstagram] = useState('@optica.atelier');
  const [isFullscreenFlyer, setIsFullscreenFlyer] = useState(false);

  // New Flyer States for Generalization & Catalog Interactivity
  const [flyerType, setFlyerType] = useState<'hiring' | 'promo' | 'announcement' | 'quote' | 'holiday'>('hiring');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [showProductPrice, setShowProductPrice] = useState<boolean>(true);
  const [flyerPromoBadge, setFlyerPromoBadge] = useState<string>('15% OFF');
  const [flyerQuoteText, setFlyerQuoteText] = useState<string>('El estilo es una forma de decir quién eres sin tener que hablar.');
  const [flyerQuoteAuthor, setFlyerQuoteAuthor] = useState<string>('Rachel Zoe');
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  
  // Products states
  const [products, setProducts] = useState<WebProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterGender, setFilterGender] = useState<string>("ALL");
  const [filterShape, setFilterShape] = useState<string>("ALL");
  const [filterMaterial, setFilterMaterial] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [editingProduct, setEditingProduct] = useState<WebProduct | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    id: "",
    category: "",
    isFeatured: false,
    isActive: false,
    description: "",
    slug: "",
    seoTags: "",
    gender: "",
    images: [] as string[],
    imageAlts: [] as string[],
    salePrice: "",
    seoTitle: "",
    seoDescription: ""
  });
  // Estado de subida de fotos en el editor de galería
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  const renderStoryContent = (isFullscreen = false) => {
    const p = products.find(prod => prod.id === selectedProductId);
    const img = p ? (p.product.imagenesCatalogo?.length > 0 ? resolveStorageUrl(p.product.imagenesCatalogo[0]) : (p.imageUrl || "/images/placeholder.svg")) : null;

    // Theme values
    const isDark = flyerTheme === 'obsidian';
    const textColor = isDark ? '#fff' : '#3c352d';
    const subtextColor = isDark ? '#e2c5a2' : '#6b5947';
    const badgeColor = isDark ? '#b08f62' : '#9e7f65';
    const panelBg = isDark ? 'rgba(30, 26, 24, 0.55)' : 'rgba(255, 255, 255, 0.45)';
    const panelBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.35)';

    return (
      <div 
        className="w-full h-full flex flex-col justify-between absolute inset-0 select-none overflow-hidden"
        style={{
          background: flyerTheme === 'cream' 
            ? 'linear-gradient(135deg, #f5f2eb 0%, #e8e2db 50%, #dfd8cf 100%)' 
            : isDark 
            ? 'linear-gradient(135deg, #181514 0%, #0d0c0b 50%, #000000 100%)'
            : 'linear-gradient(135deg, #f7f1eb 0%, #efe1d8 50%, #e2cdbe 100%)',
          
        }}
      >
        {/* Background light flares */}
        <div 
          className="absolute w-80 h-80 rounded-full filter blur-[90px] pointer-events-none opacity-25 z-0"
          style={{ top: '-10%', right: '-10%', background: isDark ? '#b08f62' : '#ffffff' }}
        />
        <div 
          className="absolute w-64 h-64 rounded-full filter blur-[70px] pointer-events-none opacity-15 z-0"
          style={{ bottom: '-10%', left: '-10%', background: isDark ? '#3d2b1f' : '#e2d3c5' }}
        />

        {/* Story Header */}
        <div className="relative z-10 pt-10 px-6 flex flex-col items-center shrink-0">
          <img 
            src={isDark ? '/images/logo-blanco.png' : '/images/logo-negro.png'} 
            alt="Atelier Logo" 
            className="h-8 object-contain opacity-90"
            onError={(e) => {
              (e.target as any).style.display = 'none';
              const id = `fallback-${isFullscreen ? 'fs' : 'pr'}`;
              const el = document.getElementById(id);
              if (el) el.style.display = 'block';
            }}
          />
          <div 
            id={`fallback-${isFullscreen ? 'fs' : 'pr'}`}
            className="hidden text-center text-xs font-black uppercase tracking-[0.3em] font-sans"
            style={{ color: subtextColor }}
          >
            Atelier Óptica
          </div>
          <div 
            className="w-12 h-[1px] mt-4 opacity-20" 
            style={{ backgroundColor: isDark ? '#fff' : '#000' }}
          />
        </div>

        {/* Main Content Area */}
        <div className="relative z-10 px-6 py-4 flex-1 flex flex-col justify-center">
          <div 
            className="rounded-2xl p-5 border shadow-xl flex flex-col justify-center gap-3 backdrop-blur-md overflow-hidden relative"
            style={{ backgroundColor: panelBg, borderColor: panelBorder }}
          >
            {/* 1. HIRING TEMPLATE */}
            {flyerType === 'hiring' && (
              <div className="space-y-3 flex flex-col justify-center">
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] font-sans" style={{ color: badgeColor }}>
                    {flyerDescription}
                  </p>
                  <h2 className="text-2xl font-black tracking-wider leading-none" style={{ color: textColor }}>
                    {flyerTitle}
                  </h2>
                  <h3 className="text-lg font-bold tracking-[0.15em] italic opacity-90" style={{ color: subtextColor }}>
                    {flyerSubtitle}
                  </h3>
                </div>

                <div 
                  className="py-2.5 px-3 rounded-lg text-center border font-sans font-bold shadow-sm"
                  style={{
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.65)',
                    borderColor: isDark ? 'rgba(176, 143, 98, 0.25)' : 'rgba(158, 127, 101, 0.2)',
                  }}
                >
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-60 text-stone-500">PUESTO A CUBRIR</p>
                  <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: isDark ? '#f5e8d8' : '#3c352d' }}>
                    {flyerPosition || 'Personal de Óptica'}
                  </p>
                </div>

                {img ? (
                  <div className="relative flex flex-col items-center justify-center pt-2">
                    <div className="relative w-40 h-20 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 dark:bg-black/20 blur-md rounded-full" />
                      <img src={img} alt="Glasses highlight" className="object-contain w-full h-full relative z-10 drop-shadow-md scale-110" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-1">
                    <p className="text-[8px] font-black uppercase tracking-widest font-sans" style={{ color: badgeColor }}>
                      Requisitos:
                    </p>
                    <ul className="space-y-1 font-sans">
                      {flyerRequirements.filter(Boolean).map((req, idx) => (
                        <li key={idx} className="text-[9px] font-medium leading-tight flex items-start gap-2" style={{ color: isDark ? '#e2e0db' : '#4e453c' }}>
                          <span className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: badgeColor }} />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 2. PROMO TEMPLATE */}
            {flyerType === 'promo' && (
              <div className="space-y-3 flex flex-col justify-center">
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] font-sans" style={{ color: badgeColor }}>
                    {flyerDescription}
                  </p>
                  <span className="inline-block px-2.5 py-1 text-[8px] font-black tracking-widest uppercase rounded-full bg-primary/10 border border-primary/20 text-primary">
                    PROMO EXCLUSIVA
                  </span>
                </div>

                <div className="text-center py-1">
                  <h2 className="text-3xl font-black tracking-wider leading-none" style={{ color: textColor }}>
                    {flyerPromoBadge || '15% OFF'}
                  </h2>
                  <p className="text-[10px] font-bold tracking-widest uppercase mt-1 opacity-80" style={{ color: subtextColor }}>
                    {flyerSubtitle}
                  </p>
                </div>

                {img ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="relative w-40 h-20 flex items-center justify-center">
                      <div className="absolute w-24 h-24 rounded-full bg-primary/10 filter blur-xl" />
                      <img src={img} alt="Product promo" className="object-contain w-full h-full relative z-10 drop-shadow-md" />
                    </div>
                    <div className="text-center font-sans">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500">{p?.product.model}</p>
                      {showProductPrice && (
                        <p className="text-xs font-black text-primary mt-0.5">${p?.product.price?.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 py-1 text-center font-sans">
                    {flyerRequirements.filter(Boolean).slice(0, 3).map((req, idx) => (
                      <p key={idx} className="text-[10px] font-bold leading-tight" style={{ color: isDark ? '#e2e0db' : '#4e453c' }}>
                        ✨ {req}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. ANNOUNCEMENT TEMPLATE */}
            {flyerType === 'announcement' && (
              <div className="space-y-3 flex flex-col justify-center">
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] font-sans text-stone-500" style={{ color: badgeColor }}>
                    {flyerDescription}
                  </p>
                  <h2 className="text-2xl font-black tracking-wider leading-none" style={{ color: textColor }}>
                    {flyerTitle}
                  </h2>
                </div>

                {img ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="relative w-44 h-20 flex items-center justify-center p-1 rounded-xl bg-white/20 dark:bg-black/10 border border-white/10 shadow-inner">
                      <img src={img} alt="New glasses arrival" className="object-contain w-full h-full drop-shadow-md scale-110" />
                    </div>
                    <div className="text-center font-sans">
                      <p className="text-[8px] font-black uppercase tracking-widest text-primary">{p?.product.brand || 'ATELIER'}</p>
                      <h4 className="text-xs font-black uppercase tracking-wide mt-0.5" style={{ color: textColor }}>
                        {p?.product.model}
                      </h4>
                      {showProductPrice && (
                        <p className="text-xs font-black text-stone-700 dark:text-stone-300 mt-1">${p?.product.price?.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="py-2 px-3 rounded-lg text-center border font-sans font-bold shadow-sm" style={{
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.65)',
                      borderColor: isDark ? 'rgba(176, 143, 98, 0.25)' : 'rgba(158, 127, 101, 0.2)',
                    }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: isDark ? '#f5e8d8' : '#3c352d' }}>
                        {flyerPosition || 'Nuevos Modelos'}
                      </p>
                    </div>
                    <div className="space-y-1.5 py-1">
                      <ul className="space-y-1 font-sans">
                        {flyerRequirements.filter(Boolean).map((req, idx) => (
                          <li key={idx} className="text-[9px] font-medium leading-tight flex items-start gap-2" style={{ color: isDark ? '#e2e0db' : '#4e453c' }}>
                            <span className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: badgeColor }} />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="text-center mt-1">
                  <p className="text-[9px] font-bold tracking-widest uppercase opacity-75" style={{ color: subtextColor }}>
                    {flyerSubtitle}
                  </p>
                </div>
              </div>
            )}

            {/* 4. QUOTE TEMPLATE */}
            {flyerType === 'quote' && (
              <div className="space-y-3 flex flex-col justify-center text-center">
                <div className="text-3xl font-serif text-primary leading-none h-4 opacity-50 select-none">“</div>
                <p 
                  className="text-xs sm:text-sm font-medium leading-relaxed px-2 italic"
                  style={{ color: textColor }}
                >
                  {flyerQuoteText || 'El estilo es una forma de decir quién eres sin tener que hablar.'}
                </p>
                <p className="text-[8px] font-black uppercase tracking-widest font-sans opacity-70" style={{ color: badgeColor }}>
                  — {flyerQuoteAuthor || 'Rachel Zoe'}
                </p>

                {img && (
                  <div className="flex flex-col items-center justify-center pt-3 mt-1 border-t border-stone-200/10 shrink-0">
                    <div className="w-24 h-8 flex items-center justify-center overflow-hidden">
                      <img src={img} alt="Quote glasses" className="object-contain w-full h-full drop-shadow-sm" />
                    </div>
                    <p className="text-[7px] font-black uppercase tracking-widest opacity-60 text-stone-400 mt-1">
                      {p?.product.brand} {p?.product.model}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 5. HOLIDAY TEMPLATE */}
            {flyerType === 'holiday' && (
              <div className="space-y-3 flex flex-col justify-center text-center">
                <div className="text-center space-y-1">
                  <span className="inline-block px-3 py-1 text-[8px] font-black tracking-widest uppercase rounded-full bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400">
                    {flyerDescription || 'AVISO IMPORTANTE'}
                  </span>
                  <h2 className="text-2xl font-black tracking-wider leading-none mt-2" style={{ color: textColor }}>
                    {flyerTitle || 'FERIADO'}
                  </h2>
                  <h3 className="text-sm font-bold tracking-[0.1em] uppercase opacity-90" style={{ color: subtextColor }}>
                    {flyerSubtitle || 'LUNES 15 DE JUNIO'}
                  </h3>
                </div>

                {img ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="relative w-40 h-20 flex items-center justify-center">
                      <div className="absolute w-24 h-24 rounded-full bg-primary/10 filter blur-xl" />
                      <img src={img} alt="Holiday product highlight" className="object-contain w-full h-full relative z-10 drop-shadow-md" />
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mt-1">{p?.product.model}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-1 text-center font-sans">
                    {flyerRequirements.filter(Boolean).map((req, idx) => (
                      <p key={idx} className="text-[10px] font-medium leading-tight" style={{ color: isDark ? '#e2e0db' : '#4e453c' }}>
                        {req}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Story Footer */}
        <div className="relative z-10 pt-4 pb-8 px-6 text-center shrink-0 space-y-2">
          <div className="space-y-0.5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] font-sans" style={{ color: badgeColor }}>
              {flyerAction}
            </p>
            <p className="text-xs font-bold font-mono tracking-tight" style={{ color: textColor }}>
              {flyerContact}
            </p>
          </div>
          <div className="text-[8px] font-bold tracking-widest font-sans opacity-50 uppercase" style={{ color: subtextColor }}>
            {flyerInstagram}
          </div>
        </div>
      </div>
    );
  };

  // Blog states
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({
    id: "",
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "Salud Visual",
    imageUrl: "",
    status: "DRAFT",
    metaTitle: "",
    metaDescription: ""
  });

  // Web Config states
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    web_announcement_text: "",
    web_announcement_active: true,
    web_announcement_link: "",
    web_store_address: "",
    web_store_locality: "",
    web_store_maps_url: "",
    web_store_phone: "",
    web_store_whatsapp_id: "",
    web_promo_installments: "",
    web_promo_cash_discount: 15
  });

  useEffect(() => {
    loadProducts();
    loadPosts();
    loadWebConfig();
  }, []);

  const loadWebConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setConfigForm({
          web_announcement_text: data.web_announcement_text || "6 Cuotas Sin Interés • 15% OFF en Efectivo o Transferencia • Envío Gratis",
          web_announcement_active: data.web_announcement_active !== undefined ? data.web_announcement_active : true,
          web_announcement_link: data.web_announcement_link || "/tienda",
          web_store_address: data.web_store_address || "José Luis de Tejeda 4380",
          web_store_locality: data.web_store_locality || "Cerro de las Rosas, Córdoba",
          web_store_maps_url: data.web_store_maps_url || "https://www.google.com/maps?cid=14830223812501661125",
          web_store_phone: data.web_store_phone || "+54 9 351 868-5644",
          web_store_whatsapp_id: data.web_store_whatsapp_id || WHATSAPP_PHONE,
          web_promo_installments: data.web_promo_installments || "6 cuotas sin interés",
          web_promo_cash_discount: data.web_promo_cash_discount !== undefined ? Number(data.web_promo_cash_discount) : 15
        });
      }
    } catch (error) {
      console.error("Error loading web config:", error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const promises = Object.entries(configForm).map(([key, value]) => {
        return fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value })
        });
      });
      
      const results = await Promise.all(promises);
      const allOk = results.every(res => res.ok);
      if (allOk) {
        alert("¡Configuración y promociones web guardadas exitosamente!");
        loadWebConfig();
      } else {
        alert("Ocurrió un error al guardar algunas configuraciones.");
      }
    } catch (error) {
      alert("Error de conexión al guardar los ajustes.");
    } finally {
      setSavingConfig(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/admin/web-products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error loading web products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch('/api/admin/blog');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Error loading blog posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Product actions
  const toggleWebProductStatus = async (id: string, field: 'isFeatured' | 'isActive', currentValue: boolean) => {
    // Optimistic UI update
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: !currentValue } : p));
    
    try {
      const res = await fetch('/api/admin/web-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: !currentValue })
      });
      if (!res.ok) throw new Error('Failed to update');
    } catch (err) {
      console.error(err);
      alert(`Error al actualizar el estado.`);
      // Revert
      setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: currentValue } : p));
    }
  };

  const handleEditProduct = (p: WebProduct) => {
    setEditingProduct(p);
    // La galería web es WebProduct.images; si está vacía, se muestra la del inventario (imagenesCatalogo)
    const gallery = (p.images && p.images.length > 0) ? p.images : (p.product.imagenesCatalogo || []);
    const alts = gallery.map((_, i) => (p.images && p.images.length > 0 ? (p.imageAlts?.[i] || "") : ""));
    setProductForm({
      id: p.id,
      category: p.category,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      description: p.description || "",
      slug: p.slug,
      seoTags: p.product.seoTags || "",
      gender: p.product.gender || "",
      images: [...gallery],
      imageAlts: alts,
      salePrice: p.product.salePrice != null ? String(p.product.salePrice) : "",
      seoTitle: p.product.seoTitle || "",
      seoDescription: p.product.seoDescription || ""
    });
    setNewPhotoUrl("");
  };

  // ---- Gestión de galería de fotos en el editor ----
  const movePhoto = (from: number, to: number) => {
    setProductForm(prev => {
      if (to < 0 || to >= prev.images.length) return prev;
      const images = [...prev.images];
      const alts = [...prev.imageAlts];
      const [img] = images.splice(from, 1);
      const [alt] = alts.splice(from, 1);
      images.splice(to, 0, img);
      alts.splice(to, 0, alt);
      return { ...prev, images, imageAlts: alts };
    });
  };
  const setMainPhoto = (idx: number) => movePhoto(idx, 0);
  const removePhoto = (idx: number) => {
    setProductForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
      imageAlts: prev.imageAlts.filter((_, i) => i !== idx),
    }));
  };
  const setPhotoAlt = (idx: number, value: string) => {
    setProductForm(prev => {
      const imageAlts = [...prev.imageAlts];
      imageAlts[idx] = value;
      return { ...prev, imageAlts };
    });
  };
  const addPhotoUrl = (url: string) => {
    const clean = (url || "").trim();
    if (!clean) return;
    setProductForm(prev => ({ ...prev, images: [...prev.images, clean], imageAlts: [...prev.imageAlts, ""] }));
  };
  const handlePhotoFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        addPhotoUrl(data.url);
      } else {
        alert(data.error || 'No se pudo subir la foto');
      }
    } catch {
      alert('Error de conexión al subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const res = await fetch('/api/admin/web-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      });
      if (res.ok) {
        setEditingProduct(null);
        loadProducts();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar los cambios');
      }
    } catch (error) {
      alert('Error de conexión al guardar');
    } finally {
      setSavingProduct(false);
    }
  };

  // Blog actions
  const handleCreatePost = () => {
    setEditingPost(null);
    setPostForm({
      id: "",
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      category: "Salud Visual",
      imageUrl: "",
      status: "DRAFT",
      metaTitle: "",
      metaDescription: ""
    });
    setShowPostModal(true);
  };

  const handleEditPost = (p: BlogPost) => {
    setEditingPost(p);
    setPostForm({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || "",
      content: p.content || "",
      category: p.category || "Salud Visual",
      imageUrl: p.imageUrl || "",
      status: p.status || "DRAFT",
      metaTitle: p.metaTitle || "",
      metaDescription: p.metaDescription || ""
    });
    setShowPostModal(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPost(true);
    try {
      const isEdit = !!postForm.id;
      const url = isEdit ? `/api/admin/blog/${postForm.id}` : '/api/admin/blog';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postForm)
      });

      if (res.ok) {
        setShowPostModal(false);
        loadPosts();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar el artículo');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeletePost = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de eliminar el artículo "${title}"?`)) return;
    setDeletingPostId(id);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadPosts();
      } else {
        alert('Error al eliminar el artículo');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleGeneratePostIA = async () => {
    if (!confirm('¿Querés generar un nuevo artículo de blog optimizado para SEO con Inteligencia Artificial?')) return;
    setGeneratingPost(true);
    try {
      const res = await fetch('/api/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPhone: '5493515742741' })
      });
      const data = await res.json();
      if (data.success) {
        alert('¡Artículo generado como Borrador exitosamente!');
        loadPosts();
      } else {
        alert('Error: ' + (data.error || 'No se pudo generar el artículo. Verificá la clave de Gemini en la configuración.'));
      }
    } catch (error) {
      alert('Error de conexión con el agente de IA');
    } finally {
      setGeneratingPost(false);
    }
  };

  // Filter products list
  const filteredProducts = products.filter(wp => {
    const term = productSearch.toLowerCase();
    const matchesSearch = wp.name.toLowerCase().includes(term) || 
           (wp.product.brand || '').toLowerCase().includes(term) ||
           (wp.product.model || '').toLowerCase().includes(term) ||
           wp.slug.toLowerCase().includes(term) ||
           wp.category.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (filterCategory !== 'ALL' && wp.category !== filterCategory) return false;

    if (filterGender !== 'ALL') {
      const productGender = (wp.product.gender || '').toLowerCase();
      const targetGender = filterGender.toLowerCase();
      if (!productGender.includes(targetGender)) return false;
    }

    const { shape, material } = getProductAttributes(wp.product.model, wp.product.seoTags);

    if (filterShape !== 'ALL') {
      const lowerShape = shape.toLowerCase();
      const targetShape = filterShape.toLowerCase();
      if (!lowerShape.includes(targetShape)) return false;
    }

    if (filterMaterial !== 'ALL') {
      const lowerMaterial = material.toLowerCase();
      const targetMaterial = filterMaterial.toLowerCase();
      if (!lowerMaterial.includes(targetMaterial)) return false;
    }

    return true;
  });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-100 dark:border-stone-800 pb-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary shrink-0">
            <Globe className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-stone-800 dark:text-stone-100 italic">
              Gestión <span className="text-primary not-italic">Web y Contenido</span>
            </h1>
            <p className="text-stone-500 dark:text-stone-400 mt-1 text-xs md:text-sm font-medium">
              Administrá los filtros de la tienda, visualización de productos y el contenido editorial del Blog.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === 'blog' && (
            <>
              <button
                onClick={handleGeneratePostIA}
                disabled={generatingPost}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-md"
              >
                {generatingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generar con IA
              </button>
              <button
                onClick={handleCreatePost}
                className="px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 text-xs font-black uppercase tracking-widest flex items-center gap-2 rounded-xl"
              >
                <Plus className="w-4 h-4" /> Nuevo Artículo
              </button>
            </>
          )}
        </div>
      </header>

      {/* TABS CONTROLLER */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('analitica')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-widest transition-all ${
            activeTab === 'analitica'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          <LineChart className="w-4 h-4" /> Analítica
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-widest transition-all ${
            activeTab === 'products'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          <Globe className="w-4 h-4" /> Productos en Tienda
        </button>
        <button
          onClick={() => setActiveTab('blog')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-widest transition-all ${
            activeTab === 'blog'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Artículos del Blog
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-widest transition-all ${
            activeTab === 'config'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          <Settings className="w-4 h-4" /> Configuración y Promos
        </button>
        <button
          onClick={() => setActiveTab('flyers')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-widest transition-all ${
            activeTab === 'flyers'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Creador de Flyers
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 text-xs font-bold uppercase tracking-widest transition-all ${
            activeTab === 'coupons'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          <Ticket className="w-4 h-4" /> Cupones
        </button>
      </div>

      {/* TAB 0: ANALÍTICA (default — todo lo de la tienda arranca acá) */}
      {activeTab === 'analitica' && <AnalyticsDashboard />}

      {/* TAB 1: PRODUCTS LIST */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* SEARCH BAR */}
          <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-2xl shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por marca, modelo, categoría web..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold text-stone-600 dark:text-stone-300"
              >
                <option value="ALL">Categoría (Todas)</option>
                <option value="Receta">Receta</option>
                <option value="Sol">Sol</option>
                <option value="XL">XL</option>
                <option value="Clip-On">Clip-On</option>
                <option value="Contacto">Contacto</option>
              </select>

              {/* Gender Filter */}
              <select
                value={filterGender}
                onChange={e => setFilterGender(e.target.value)}
                className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold text-stone-600 dark:text-stone-300"
              >
                <option value="ALL">Género (Todos)</option>
                <option value="Femenino">Mujer</option>
                <option value="Masculino">Hombre</option>
                <option value="Unisex">Unisex</option>
              </select>

              {/* Shape Filter */}
              <select
                value={filterShape}
                onChange={e => setFilterShape(e.target.value)}
                className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold text-stone-600 dark:text-stone-300"
              >
                <option value="ALL">Forma (Todas)</option>
                <option value="Cuadrado">Cuadrado</option>
                <option value="Redondo">Redondo</option>
                <option value="Cat-Eye">Cat-Eye</option>
                <option value="Hexagonal">Hexagonal</option>
                <option value="Aviador">Aviador</option>
                <option value="XL">XL</option>
              </select>

              {/* Material Filter */}
              <select
                value={filterMaterial}
                onChange={e => setFilterMaterial(e.target.value)}
                className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold text-stone-600 dark:text-stone-300"
              >
                <option value="ALL">Material (Todos)</option>
                <option value="Acetato">Acetato</option>
                <option value="Metal">Metal</option>
                <option value="Titanio">Titanio</option>
                <option value="TR90">TR90</option>
              </select>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden p-0.5 bg-stone-50 dark:bg-stone-850 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-stone-900 text-black dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'}`}
                title="Vista de Lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-stone-900 text-black dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'}`}
                title="Vista de Grilla"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            <a 
              href="/api/catalog"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:opacity-90 rounded-xl text-xs font-bold transition-opacity"
            >
              <FileText className="w-4 h-4" /> Catálogo PDF
            </a>

            <button 
              onClick={loadProducts}
              className="px-4 py-2 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl text-xs font-bold transition-colors"
            >
              Refrescar
            </button>
          </div>

          {loadingProducts ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">Cargando catálogo web...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-24 text-center bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl">
              <AlertCircle className="w-8 h-8 mx-auto text-stone-400 mb-4" />
              <p className="text-sm text-stone-500 font-semibold">No se encontraron productos publicados para la web.</p>
              <p className="text-xs text-stone-400 mt-1">Habilitá &quot;Publicar en Web&quot; en la sección de Stock y Productos.</p>
            </div>
          ) : (
            viewMode === 'list' ? (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-stone-800/50 text-stone-400 text-[10px] font-black uppercase tracking-widest border-b border-stone-200 dark:border-stone-800">
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Filtro / Categoría Web</th>
                        <th className="px-6 py-4">Slug en URL</th>
                        <th className="px-6 py-4 text-center">Destacado</th>
                        <th className="px-6 py-4 text-center">Visible</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-150 dark:divide-stone-800 text-xs">
                      {filteredProducts.map(wp => {
                        const img = wp.images?.length > 0
                          ? resolveStorageUrl(wp.images[0])
                          : wp.product.imagenesCatalogo?.length > 0
                          ? resolveStorageUrl(wp.product.imagenesCatalogo[0])
                          : (wp.imageUrl || "/images/placeholder.svg");
                        return (
                          <tr key={wp.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                              <div className="w-10 h-10 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0 relative">
                                <img src={img} alt={wp.name} className="object-contain w-full h-full mix-blend-multiply dark:mix-blend-normal" />
                              </div>
                              <div>
                                <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">{wp.product.brand || 'ATELIER'}</p>
                                <p className="font-bold text-stone-850 dark:text-stone-200">{wp.product.model || wp.name}</p>
                                <p className="text-[9px] text-stone-400 font-mono mt-0.5">Precio: ${wp.product.price?.toLocaleString()} | Stock: {wp.product.stock}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 space-y-1.5">
                              <div>
                                <span className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold uppercase tracking-wider rounded-sm text-[9px] border border-stone-200/50 dark:border-stone-700/50">
                                  {wp.category}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {wp.product.gender && (
                                  <span className="px-1.5 py-0.5 bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 font-bold rounded text-[8px] uppercase tracking-wider border border-pink-200/40">
                                    {wp.product.gender}
                                  </span>
                                )}
                                {(() => {
                                  const { shape, material } = getProductAttributes(wp.product.model, wp.product.seoTags);
                                  return (
                                    <>
                                      {shape && (
                                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-bold rounded text-[8px] uppercase tracking-wider border border-blue-200/40">
                                          {shape}
                                        </span>
                                      )}
                                      {material && (
                                        <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold rounded text-[8px] uppercase tracking-wider border border-stone-200/55">
                                          {material}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-[10px] text-stone-500 max-w-[200px] truncate" title={wp.slug}>
                              /{wp.slug}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => toggleWebProductStatus(wp.id, 'isFeatured', wp.isFeatured)}
                                className={`inline-flex items-center justify-center p-1.5 rounded-md transition-all hover:scale-110 ${wp.isFeatured ? 'bg-amber-50 text-amber-500 border border-amber-200 shadow-sm' : 'text-stone-300 hover:text-amber-400 hover:bg-amber-50/50'}`}
                                title={wp.isFeatured ? "Quitar de Destacados" : "Destacar en Inicio"}
                              >
                                <Star className={`w-4 h-4 ${wp.isFeatured ? 'fill-current' : ''}`} />
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => toggleWebProductStatus(wp.id, 'isActive', wp.isActive)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all border ${wp.isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300' : 'text-stone-500 bg-stone-50 border-stone-200 hover:bg-stone-100'}`}
                                title={wp.isActive ? "Ocultar producto de la web" : "Publicar producto en la web"}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full ${wp.isActive ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                                {wp.isActive ? 'Activo' : 'Oculto'}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleEditProduct(wp)}
                                className="p-2 text-stone-500 hover:text-black dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-all"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {filteredProducts.map(wp => {
                  const img = wp.images?.length > 0
                    ? resolveStorageUrl(wp.images[0])
                    : wp.product.imagenesCatalogo?.length > 0
                    ? resolveStorageUrl(wp.product.imagenesCatalogo[0])
                    : (wp.imageUrl || "/images/placeholder.svg");
                  return (
                    <div 
                      key={wp.id} 
                      className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col relative group"
                    >
                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-center z-10">
                        <span className="px-2 py-0.5 bg-stone-100/90 dark:bg-stone-800/90 text-stone-700 dark:text-stone-300 font-bold uppercase tracking-wider rounded text-[8px] border border-stone-200/50 dark:border-stone-700/50">
                          {wp.category}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => toggleWebProductStatus(wp.id, 'isFeatured', wp.isFeatured)}
                            className={`p-1.5 rounded-lg transition-all ${wp.isFeatured ? 'bg-amber-50 text-amber-500 border border-amber-200 shadow-sm' : 'bg-white/80 dark:bg-stone-800/80 text-stone-300 hover:text-amber-400'}`}
                          >
                            <Star className={`w-3 h-3 ${wp.isFeatured ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Image Container with high contrast and larger view */}
                      <div className="aspect-[4/3] bg-stone-50 dark:bg-stone-950/20 border-b border-stone-100 dark:border-stone-800 relative flex items-center justify-center p-6 group-hover:scale-102 transition-transform">
                        <img 
                          src={img} 
                          alt={wp.name} 
                          className="object-contain w-full h-full mix-blend-multiply dark:mix-blend-normal" 
                        />
                      </div>

                      {/* Info Container */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] text-stone-400 font-black uppercase tracking-widest">{wp.product.brand || 'ATELIER'}</p>
                          <h4 className="font-bold text-stone-800 dark:text-stone-200 text-xs mt-0.5 truncate" title={wp.product.model || wp.name}>
                            {wp.product.model || wp.name}
                          </h4>
                          <p className="font-mono text-[9px] text-stone-500 truncate mt-1">/{wp.slug}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {wp.product.gender && (
                              <span className="px-1.5 py-0.5 bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 font-bold rounded text-[8px] uppercase tracking-wider border border-pink-200/40">
                                {wp.product.gender}
                              </span>
                            )}
                            {(() => {
                              const { shape, material } = getProductAttributes(wp.product.model, wp.product.seoTags);
                              return (
                                <>
                                  {shape && (
                                    <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-bold rounded text-[8px] uppercase tracking-wider border border-blue-200/40">
                                      {shape}
                                    </span>
                                  )}
                                  {material && (
                                    <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold rounded text-[8px] uppercase tracking-wider border border-stone-200/55">
                                      {material}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-stone-850 dark:text-stone-200">${wp.product.price?.toLocaleString()}</p>
                            <p className="text-[8px] text-stone-400">Stock: {wp.product.stock}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleWebProductStatus(wp.id, 'isActive', wp.isActive)}
                              className={`p-1.5 rounded-lg border transition-all ${wp.isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100' : 'text-stone-500 bg-stone-50 border-stone-200 hover:bg-stone-100'}`}
                              title={wp.isActive ? "Oculto" : "Activo"}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${wp.isActive ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                            </button>
                            <button
                              onClick={() => handleEditProduct(wp)}
                              className="p-1.5 text-stone-500 hover:text-black dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg transition-all"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* TAB 2: BLOG LIST */}
      {activeTab === 'blog' && (
        <div className="space-y-6">
          {loadingPosts ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">Cargando blog...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-24 text-center bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl">
              <BookOpen className="w-8 h-8 mx-auto text-stone-400 mb-4" />
              <p className="text-sm text-stone-500 font-semibold">Aún no hay artículos creados en el blog.</p>
              <p className="text-xs text-stone-400 mt-1">Generá uno automáticamente con IA o hacé click en &quot;Nuevo Artículo&quot;.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <div key={post.id} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-lg transition-shadow">
                  <div>
                    <div className="h-44 bg-stone-100 dark:bg-stone-800 relative w-full overflow-hidden">
                      {post.imageUrl ? (
                        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <FileText className="w-10 h-10" />
                        </div>
                      )}
                      <span className={`absolute top-4 left-4 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-md rounded-full ${post.status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {post.status}
                      </span>
                      <span className="absolute bottom-4 left-4 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white bg-black/40 backdrop-blur-sm rounded-full">
                        {post.category}
                      </span>
                    </div>
                    
                    <div className="p-6 space-y-3">
                      <span className="text-[10px] text-stone-400 font-medium">
                        {new Date(post.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      <h3 className="text-base font-bold text-stone-900 dark:text-white leading-snug line-clamp-2" title={post.title}>
                        {post.title}
                      </h3>
                      <p className="text-stone-500 dark:text-stone-400 text-xs leading-relaxed line-clamp-3">
                        {post.excerpt || 'Sin extracto/copete.'}
                      </p>
                      <p className="text-[10px] font-mono text-stone-450 dark:text-stone-500 truncate">
                        Slug: /{post.slug}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 border-t border-stone-100 dark:border-stone-800/50 flex justify-between items-center mt-4">
                    <div className="flex gap-2">
                      <Link 
                        href={`/blog/${post.slug}`} 
                        target="_blank" rel="noopener noreferrer"
                        className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-black dark:hover:text-white rounded-lg transition-all"
                        title="Previsualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleEditPost(post)}
                        className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-primary rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      disabled={deletingPostId === post.id}
                      onClick={() => handleDeletePost(post.id, post.title)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-500 hover:text-red-600 rounded-lg transition-all disabled:opacity-50"
                      title="Eliminar"
                    >
                      {deletingPostId === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WEB CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-300">
          <div className="border-b border-stone-100 dark:border-stone-800 pb-4">
            <h2 className="text-lg font-black text-stone-900 dark:text-white uppercase tracking-wider">Ajustes Generales del Sitio y Promos</h2>
            <p className="text-xs text-stone-500 mt-1">Configurá las promociones globales, banner de anuncio y los datos de contacto/dirección del local.</p>
          </div>

          {loadingConfig ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">Cargando configuración...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-8">
              {/* SECCIÓN 1: BANNER DE ANUNCIO */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Barra de Anuncios Superior (Storefront)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-stone-50 dark:bg-stone-800/25 rounded-2xl border border-stone-100 dark:border-stone-800">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Barra Activa</label>
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                      <input
                        type="checkbox"
                        checked={configForm.web_announcement_active}
                        onChange={e => setConfigForm({ ...configForm, web_announcement_active: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary accent-black"
                      />
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Mostrar Banner</span>
                    </label>
                  </div>
                  
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Texto del Anuncio</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                      placeholder="Ej: 6 Cuotas Sin Interés • 15% de Descuento por Transferencia • Envío Gratis"
                      value={configForm.web_announcement_text}
                      onChange={e => setConfigForm({ ...configForm, web_announcement_text: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Enlace de Redirección (Opcional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                      placeholder="Ej: /tienda o /arma-tus-lentes"
                      value={configForm.web_announcement_link}
                      onChange={e => setConfigForm({ ...configForm, web_announcement_link: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: PROMOS FINANCIERAS */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Promociones y Descuentos Globales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-stone-50 dark:bg-stone-800/25 rounded-2xl border border-stone-100 dark:border-stone-800">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Texto de Cuotas (Storefront)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                      placeholder="Ej: 6 cuotas sin interés"
                      value={configForm.web_promo_installments}
                      onChange={e => setConfigForm({ ...configForm, web_promo_installments: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Porcentaje de Descuento Efectivo / Transferencia</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="90"
                        className="w-full pl-3 pr-8 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                        placeholder="Ej: 15"
                        value={configForm.web_promo_cash_discount}
                        onChange={e => setConfigForm({ ...configForm, web_promo_cash_discount: Number(e.target.value) })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: SUCURSAL Y CONTACTO */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Datos de la Sucursal y Contacto
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-stone-50 dark:bg-stone-800/25 rounded-2xl border border-stone-100 dark:border-stone-800">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Dirección Física</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                      placeholder="Ej: José Luis de Tejeda 4380"
                      value={configForm.web_store_address}
                      onChange={e => setConfigForm({ ...configForm, web_store_address: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Localidad y Provincia</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                      placeholder="Ej: Cerro de las Rosas, Córdoba"
                      value={configForm.web_store_locality}
                      onChange={e => setConfigForm({ ...configForm, web_store_locality: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">Teléfono / WhatsApp Visible</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                      placeholder="Ej: +54 9 351 868-5644"
                      value={configForm.web_store_phone}
                      onChange={e => setConfigForm({ ...configForm, web_store_phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">ID de WhatsApp para Enlaces (Solo Números)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                      placeholder="Ej: 5493518685644"
                      value={configForm.web_store_whatsapp_id}
                      onChange={e => setConfigForm({ ...configForm, web_store_whatsapp_id: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">URL de Enlace de Google Maps</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                      placeholder="https://..."
                      value={configForm.web_store_maps_url}
                      onChange={e => setConfigForm({ ...configForm, web_store_maps_url: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* ACCIONES DEL FORMULARIO */}
              <div className="flex justify-end gap-3 pt-6 border-t border-stone-150 dark:border-stone-800">
                <button
                  type="button"
                  onClick={loadWebConfig}
                  className="px-6 py-3 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-500 rounded-xl text-xs font-bold transition-colors"
                >
                  Restaurar Valores
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Configuración
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: FLYER GENERATOR & SOCIAL MARKETING */}
      {activeTab === 'coupons' && (
        <div className="animate-in fade-in duration-300">
          <CouponsManager />
        </div>
      )}

      {activeTab === 'flyers' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* INTRO HERO */}
          <div className="bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-primary/20 transition-colors" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-primary/20 text-primary rounded-full border border-primary/25">
                  <Sparkles className="w-3 h-3" /> Kit de Difusión Atelier
                </span>
                <h2 className="text-xl sm:text-2xl font-black italic tracking-tight">Creador de Contenido & Stories</h2>
                <p className="text-stone-300 text-xs sm:text-sm font-medium leading-relaxed">
                  Crea historias y flyers premium para Instagram y WhatsApp. Personalizá búsquedas laborales, promociones, novedades de la marca o frases inspiradoras, e integra tus anteojos del catálogo web al instante.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* EDITOR PANEL (COLUMNS 1-7) */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* SECCIÓN 1: TIPO DE PUBLICACIÓN Y TEMA */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> 1. Tipo de Story y Estilo
                  </h3>
                  <p className="text-[10px] text-stone-400 mt-1">Configurá el tema visual y la plantilla de contenido.</p>
                </div>

                <div className="space-y-6">
                  {/* Selector de Tipo */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Plantilla de Contenido</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: 'hiring', name: 'Búsqueda', desc: 'Personal' },
                        { id: 'promo', name: 'Promoción', desc: 'Descuentos' },
                        { id: 'announcement', name: 'Novedades', desc: 'Lanzamientos' },
                        { id: 'quote', name: 'Frase', desc: 'Inspiración' },
                        { id: 'holiday', name: 'Feriados', desc: 'Horarios' }
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => {
                            setFlyerType(type.id as any);
                            // Load defaults to help start
                            if (type.id === 'promo') {
                              setFlyerTitle('PROMO ESPECIAL');
                              setFlyerSubtitle('15% OFF TRANSFERENCIA');
                              setFlyerDescription('Descuentos exclusivos en Atelier');
                            } else if (type.id === 'announcement') {
                              setFlyerTitle('NUEVA COLECCIÓN');
                              setFlyerSubtitle('EDICIÓN LIMITADA');
                              setFlyerDescription('Exclusivos de temporada');
                            } else if (type.id === 'hiring') {
                              setFlyerTitle('BUSCAMOS');
                              setFlyerSubtitle('PERSONAL');
                              setFlyerDescription('Únete a nuestro equipo de Óptica Atelier');
                            } else if (type.id === 'holiday') {
                              setFlyerTitle('FERIADO');
                              setFlyerSubtitle('LUNES 15 DE JUNIO');
                              setFlyerDescription('AVISO IMPORTANTE');
                              setFlyerRequirements([
                                'Mañana lunes el local permanecerá cerrado.',
                                'Atención online activa en nuestra web.',
                                'Reabrimos el martes de 09:00 a 19:00 hs.',
                                '¡Que disfruten el fin de semana!'
                              ]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            flyerType === type.id
                              ? 'border-primary bg-primary/5 shadow-sm scale-102 font-black'
                              : 'border-stone-200 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-850 text-stone-500'
                          }`}
                        >
                          <p className="text-xs font-bold">{type.name}</p>
                          <p className="text-[8px] text-stone-400 mt-0.5 uppercase tracking-wide">{type.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selector de Tema */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Tema Visual del Story</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'cream', name: 'Cream Elegant', desc: 'Minimalista Beige', bg: 'bg-[#faf8f5]' },
                        { id: 'obsidian', name: 'Obsidian Gold', desc: 'Oscuro Lujoso', bg: 'bg-[#181514] border border-yellow-750/30' },
                        { id: 'rose', name: 'Champagne Rose', desc: 'Blush y Dorado', bg: 'bg-[#f7f1eb] border-r-4 border-rose-200' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFlyerTheme(t.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            flyerTheme === t.id
                              ? 'border-primary bg-primary/5 shadow-md scale-102'
                              : 'border-stone-200 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-850'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-md mb-2 ${t.bg}`} />
                          <p className="text-xs font-bold text-stone-850 dark:text-stone-100">{t.name}</p>
                          <p className="text-[9px] text-stone-450 mt-0.5">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: ANTEOJOS INTERACTIVOS DEL CATÁLOGO */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 2. Integración de Anteojos
                  </h3>
                  <p className="text-[10px] text-stone-400 mt-1">Vinculá fotos y precios de tus anteojos cargados en la web.</p>
                </div>

                <div className="space-y-4">
                  {/* Buscador */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-10 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium animate-in fade-in"
                      placeholder="Buscar por marca o modelo (ej: Ray-Ban, Dior, Acetato...)"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                    />
                    {productSearchQuery && (
                      <button 
                        onClick={() => setProductSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-black dark:hover:text-white rounded-full transition-colors text-xs"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Resultados */}
                  {productSearchQuery && (
                    <div className="max-h-52 overflow-y-auto border border-stone-250 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 bg-white dark:bg-stone-900 shadow-lg custom-scrollbar relative z-30">
                      {products.filter(p => {
                        const term = productSearchQuery.toLowerCase();
                        return p.name.toLowerCase().includes(term) || 
                               (p.product.brand || '').toLowerCase().includes(term) ||
                               (p.product.model || '').toLowerCase().includes(term);
                      }).slice(0, 6).map(p => {
                        const img = p.product.imagenesCatalogo?.length > 0 
                          ? resolveStorageUrl(p.product.imagenesCatalogo[0]) 
                          : (p.imageUrl || "/images/placeholder.svg");
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setProductSearchQuery('');
                              if (flyerType === 'announcement') {
                                setFlyerPosition(`${p.product.brand || 'ATELIER'} ${p.product.model || ''}`.trim());
                              }
                            }}
                            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-stone-50 dark:hover:bg-stone-850 text-xs cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-stone-50 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                                <img src={img} alt={p.name} className="object-contain w-full h-full mix-blend-multiply dark:mix-blend-normal" />
                              </div>
                              <div>
                                <p className="font-bold text-stone-800 dark:text-stone-100 leading-none">{p.product.model || p.name}</p>
                                <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider mt-1 block">{p.product.brand || 'ATELIER'}</span>
                              </div>
                            </div>
                            <span className="font-black text-stone-800 dark:text-stone-200">${p.product.price?.toLocaleString()}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Detalle de Selección */}
                  {selectedProductId ? (
                    (() => {
                      const p = products.find(prod => prod.id === selectedProductId);
                      if (!p) return null;
                      const img = p.product.imagenesCatalogo?.length > 0 
                        ? resolveStorageUrl(p.product.imagenesCatalogo[0]) 
                        : (p.imageUrl || "/images/placeholder.svg");
                      return (
                        <div className="flex items-center justify-between p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/50 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                              <img src={img} alt={p.name} className="object-contain w-full h-full mix-blend-multiply dark:mix-blend-normal" />
                            </div>
                            <div>
                              <p className="font-black text-xs text-stone-800 dark:text-stone-100">{p.product.model}</p>
                              <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">{p.product.brand || 'ATELIER'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={showProductPrice}
                                onChange={(e) => setShowProductPrice(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-stone-300 text-indigo-500 focus:ring-indigo-500 accent-indigo-500"
                              />
                              <span className="text-[9px] font-black text-stone-600 dark:text-stone-400">Mostrar Precio (${p.product.price?.toLocaleString()})</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setSelectedProductId('')}
                              className="px-2.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 rounded-lg text-[9px] font-bold transition-colors cursor-pointer"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-3 text-center border-2 border-dashed border-stone-200 dark:border-stone-850 rounded-2xl text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                      Ningún anteojo vinculado (Se usará diseño de solo texto/requisitos)
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: TEXTOS PERSONALIZADOS */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> 3. Textos del Contenido
                  </h3>
                  <p className="text-[10px] text-stone-400 mt-1">Personalizá las leyendas visibles del flyer.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Categoría / Texto Superior</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                        value={flyerDescription}
                        onChange={(e) => setFlyerDescription(e.target.value)}
                      />
                    </div>
                    {flyerType !== 'quote' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Título Principal</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                          value={flyerTitle}
                          onChange={(e) => setFlyerTitle(e.target.value.toUpperCase())}
                        />
                      </div>
                    )}
                    {flyerType === 'promo' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Badge / Descuento</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold text-primary"
                          value={flyerPromoBadge}
                          onChange={(e) => setFlyerPromoBadge(e.target.value.toUpperCase())}
                        />
                      </div>
                    )}
                    {flyerType !== 'quote' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Subtítulo / Bajada</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                          value={flyerSubtitle}
                          onChange={(e) => setFlyerSubtitle(e.target.value.toUpperCase())}
                        />
                      </div>
                    )}
                  </div>

                  {/* Contenidos de Búsqueda Laboral y Anuncios */}
                  {(flyerType === 'hiring' || flyerType === 'announcement') && (
                    <div className="space-y-4 pt-3 border-t border-stone-100 dark:border-stone-800">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">
                          {flyerType === 'hiring' ? 'Puesto a Cubrir' : 'Nombre del Anuncio'}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold"
                          value={flyerPosition}
                          onChange={(e) => setFlyerPosition(e.target.value)}
                        />
                      </div>

                      {!selectedProductId && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Detalles / Requisitos (Hasta 4)</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {flyerRequirements.map((req, i) => (
                              <input
                                key={i}
                                type="text"
                                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium text-stone-750"
                                placeholder={`Línea ${i + 1}`}
                                value={req}
                                onChange={(e) => {
                                  const nr = [...flyerRequirements];
                                  nr[i] = e.target.value;
                                  setFlyerRequirements(nr);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Requisitos Promo sin anteojo */}
                  {flyerType === 'promo' && !selectedProductId && (
                    <div className="space-y-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Detalles de la Promoción (Hasta 4)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {flyerRequirements.map((req, i) => (
                          <input
                            key={i}
                            type="text"
                            className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium text-stone-750"
                            placeholder={`Línea ${i + 1}`}
                            value={req}
                            onChange={(e) => {
                              const nr = [...flyerRequirements];
                              nr[i] = e.target.value;
                              setFlyerRequirements(nr);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detalles Feriado sin anteojo */}
                  {flyerType === 'holiday' && !selectedProductId && (
                    <div className="space-y-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Detalles del Feriado / Horarios (Hasta 4)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {flyerRequirements.map((req, i) => (
                          <input
                            key={i}
                            type="text"
                            className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium text-stone-750"
                            placeholder={`Línea ${i + 1}`}
                            value={req}
                            onChange={(e) => {
                              const nr = [...flyerRequirements];
                              nr[i] = e.target.value;
                              setFlyerRequirements(nr);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frases */}
                  {flyerType === 'quote' && (
                    <div className="space-y-4 pt-3 border-t border-stone-100 dark:border-stone-800">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Frase Célebre o Cita</label>
                        <textarea
                          rows={3}
                          className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all resize-none font-medium italic text-stone-700 dark:text-stone-300"
                          value={flyerQuoteText}
                          onChange={(e) => setFlyerQuoteText(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Autor</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold"
                          value={flyerQuoteAuthor}
                          onChange={(e) => setFlyerQuoteAuthor(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Datos del pie de página */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-stone-100 dark:border-stone-800 pt-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Llamado a la Acción</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                        value={flyerAction}
                        onChange={(e) => setFlyerAction(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Email / Contacto</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                        value={flyerContact}
                        onChange={(e) => setFlyerContact(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Instagram</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold text-stone-700 dark:text-stone-300"
                        value={flyerInstagram}
                        onChange={(e) => setFlyerInstagram(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => setIsFullscreenFlyer(true)}
                      className="flex-1 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:opacity-90 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Ver Pantalla Completa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(flyerContact);
                        alert('¡Email de contacto copiado!');
                      }}
                      className="py-3 px-5 border border-stone-200 dark:border-stone-750 hover:bg-stone-50 dark:hover:bg-stone-850 text-stone-500 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Contacto
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PREVIEW STORY CANVAS */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center sticky top-8">
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Vista Previa 9:16 (Instagram Story)</span>
              
              <div className="relative border-4 border-stone-250 dark:border-stone-800 rounded-[2.5rem] p-3 shadow-2xl bg-white dark:bg-[#141211] w-full max-w-[340px] overflow-hidden">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-5 bg-stone-250 dark:bg-stone-800 rounded-full z-30 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-stone-300 dark:bg-stone-950 ml-auto mr-4" />
                </div>
                <div className="relative rounded-[1.8rem] w-full aspect-[9/16] overflow-hidden select-none">
                  {renderStoryContent(false)}
                </div>
              </div>

              <div className="mt-4 p-4 max-w-[340px] bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/50 dark:border-stone-750 text-[10px] text-stone-505 space-y-1 leading-relaxed text-center">
                <p className="font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">💡 ¿Cómo capturar este flyer?</p>
                <p>Hacé click en &quot;Ver en Pantalla Completa&quot;, y sacale una captura de pantalla desde tu celular o computadora para subirlo directamente a tus historias de Instagram o estados de WhatsApp.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN FLYER MODAL PREVIEW */}
      {isFullscreenFlyer && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-black/45 px-3 py-1.5 rounded-full border border-stone-800">
              Presioná ESC para cerrar
            </span>
            <button
              onClick={() => setIsFullscreenFlyer(false)}
              className="p-3 bg-white text-black hover:bg-stone-100 rounded-full shadow-2xl transition-transform hover:scale-105 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full max-w-[450px] aspect-[9/16] shadow-2xl overflow-hidden select-none">
            {renderStoryContent(true)}
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT PRODUCT PROPERTIES */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
          <div className="relative bg-white dark:bg-stone-900 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary">Tienda Web</span>
                <h3 className="text-lg font-black text-stone-900 dark:text-white">Editar Parámetros de Tienda</h3>
              </div>
              <button 
                onClick={() => setEditingProduct(null)}
                className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-black dark:hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200/50 dark:border-stone-700/50">
                <div className="w-12 h-12 bg-white border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-1 relative">
                  <img src={productForm.images.length > 0 ? resolveStorageUrl(productForm.images[0]) : (editingProduct.product.imagenesCatalogo?.length > 0 ? resolveStorageUrl(editingProduct.product.imagenesCatalogo[0]) : editingProduct.imageUrl || "/images/placeholder.svg")} alt="Producto" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal p-1" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200 leading-tight">{editingProduct.product.model}</h4>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mt-0.5">{editingProduct.product.brand || 'ATELIER'}</p>
                </div>
              </div>

              {/* ---- Galería de fotos ---- */}
              <div className="space-y-3 p-3 bg-stone-50/60 dark:bg-stone-800/30 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Fotos del producto ({productForm.images.length})</label>
                  <span className="text-[9px] text-stone-400">La 1ª es la principal</span>
                </div>

                {productForm.images.length === 0 && (
                  <p className="text-[11px] text-stone-400 italic py-2">Sin fotos. Agregá una abajo.</p>
                )}

                <div className="space-y-2">
                  {productForm.images.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl">
                      <div className="w-14 h-14 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                        <img src={resolveStorageUrl(img)} alt={productForm.imageAlts[idx] || `Foto ${idx + 1}`} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                        {idx === 0 && <span className="absolute top-0 left-0 bg-primary text-white text-[7px] font-black px-1 py-0.5 rounded-br-lg">PRINCIPAL</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          placeholder={`Texto alternativo (alt) — opcional, ayuda al SEO`}
                          className="w-full px-2 py-1.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-[11px] outline-none focus:border-primary transition-all"
                          value={productForm.imageAlts[idx] || ""}
                          onChange={e => setPhotoAlt(idx, e.target.value)}
                        />
                        <p className="text-[8px] text-stone-400 font-mono mt-0.5 truncate" title={img}>{img}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" title="Hacer principal" disabled={idx === 0} onClick={() => setMainPhoto(idx)} className="p-1.5 rounded-lg text-stone-400 hover:text-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <Star className="w-3.5 h-3.5" fill={idx === 0 ? "currentColor" : "none"} />
                        </button>
                        <button type="button" title="Subir" disabled={idx === 0} onClick={() => movePhoto(idx, idx - 1)} className="px-1.5 py-1 rounded-lg text-stone-400 hover:text-black dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none transition-colors">↑</button>
                        <button type="button" title="Bajar" disabled={idx === productForm.images.length - 1} onClick={() => movePhoto(idx, idx + 1)} className="px-1.5 py-1 rounded-lg text-stone-400 hover:text-black dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none transition-colors">↓</button>
                        <button type="button" title="Eliminar foto" onClick={() => removePhoto(idx)} className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agregar foto: subir archivo o pegar link */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <label className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${uploadingPhoto ? 'bg-stone-200 dark:bg-stone-700 text-stone-400' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                    {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    {uploadingPhoto ? 'Subiendo…' : 'Subir foto'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={e => { handlePhotoFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="o pegá un link de imagen…"
                      className="flex-1 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-[11px] outline-none focus:border-primary transition-all"
                      value={newPhotoUrl}
                      onChange={e => setNewPhotoUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPhotoUrl(newPhotoUrl); setNewPhotoUrl(''); } }}
                    />
                    <button type="button" onClick={() => { addPhotoUrl(newPhotoUrl); setNewPhotoUrl(''); }} className="px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-[11px] font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">Agregar</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Filtro en Storefront</label>
                  <select
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    <option value="Receta">Receta</option>
                    <option value="Sol">Sol</option>
                    <option value="XL">XL</option>
                    <option value="Clip-On">Clip-On</option>
                    <option value="Contacto">Contacto</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Slug (URL)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                    value={productForm.slug}
                    onChange={e => setProductForm({ ...productForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  />
                </div>
              </div>

              {/* ---- Precio de oferta ---- */}
              <div className="space-y-1.5 p-3 bg-stone-50/60 dark:bg-stone-800/30 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Precio de oferta (opcional)</label>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-stone-500 dark:text-stone-400 shrink-0">
                    Precio de lista: <span className="font-bold text-stone-700 dark:text-stone-200">${(editingProduct.product.price || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-stone-400 text-sm font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Sin oferta"
                      className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                      value={productForm.salePrice}
                      onChange={e => setProductForm({ ...productForm, salePrice: e.target.value })}
                    />
                    {productForm.salePrice && (
                      <button type="button" title="Quitar oferta" onClick={() => setProductForm({ ...productForm, salePrice: "" })} className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {(() => {
                  const list = editingProduct.product.price || 0;
                  const sale = Number(productForm.salePrice);
                  if (!productForm.salePrice) return null;
                  if (!Number.isFinite(sale) || sale <= 0) return <p className="text-[10px] text-red-500 font-bold">Ingresá un número válido.</p>;
                  if (sale >= list) return <p className="text-[10px] text-red-500 font-bold">La oferta debe ser menor al precio de lista.</p>;
                  const pct = Math.round((1 - sale / list) * 100);
                  return <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">En oferta a ${sale.toLocaleString('es-AR')} — {pct}% OFF sobre el precio de lista.</p>;
                })()}
              </div>

              <div className="space-y-1.5 pb-2">
                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Filtros de Género (Sección Web)</label>
                <div className="flex flex-wrap gap-5 mt-1 ml-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={(productForm.gender || '').toLowerCase().includes('femenino')}
                      onChange={e => {
                        let list = (productForm.gender || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (e.target.checked) {
                          if (!list.includes('Femenino')) list.push('Femenino');
                        } else {
                          list = list.filter(g => g !== 'Femenino');
                        }
                        setProductForm({ ...productForm, gender: list.join(', ') });
                      }}
                      className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary accent-black"
                    />
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Mujer (Femme)</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={(productForm.gender || '').toLowerCase().includes('masculino')}
                      onChange={e => {
                        let list = (productForm.gender || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (e.target.checked) {
                          if (!list.includes('Masculino')) list.push('Masculino');
                        } else {
                          list = list.filter(g => g !== 'Masculino');
                        }
                        setProductForm({ ...productForm, gender: list.join(', ') });
                      }}
                      className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary accent-black"
                    />
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Hombre (Homme)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={(productForm.gender || '').toLowerCase().includes('unisex')}
                      onChange={e => {
                        let list = (productForm.gender || '').split(',').map(s => s.trim()).filter(Boolean);
                        if (e.target.checked) {
                          if (!list.includes('Unisex')) list.push('Unisex');
                        } else {
                          list = list.filter(g => g !== 'Unisex');
                        }
                        setProductForm({ ...productForm, gender: list.join(', ') });
                      }}
                      className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary accent-black"
                    />
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Unisex (No Gender)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-6 py-2 border-y border-stone-100 dark:border-stone-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={productForm.isFeatured}
                    onChange={e => setProductForm({ ...productForm, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary accent-black"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Destacar Producto</p>
                    <p className="text-[9px] text-stone-400">Mostrar destacado en portadas</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={productForm.isActive}
                    onChange={e => setProductForm({ ...productForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary accent-black"
                  />
                  <div>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Habilitar en Tienda</p>
                    <p className="text-[9px] text-stone-400">Mostrar u ocultar del catálogo</p>
                  </div>
                </label>
              </div>

              {['Receta', 'Sol', 'XL', 'Clip-On'].includes(productForm.category) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Forma del Armazón</label>
                    <select
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                      value={getSelectedShapeFromTags(productForm.seoTags)}
                      onChange={e => {
                        const currentMaterial = getSelectedMaterialFromTags(productForm.seoTags);
                        const updated = updateTagsWithShapeAndMaterial(productForm.seoTags, e.target.value, currentMaterial);
                        setProductForm({ ...productForm, seoTags: updated });
                      }}
                    >
                      <option value="">Automático</option>
                      <option value="Cuadrado">Cuadrado</option>
                      <option value="Redondo">Redondo</option>
                      <option value="Cat-Eye">Cat-Eye</option>
                      <option value="Hexagonal">Hexagonal</option>
                      <option value="Aviador">Aviador</option>
                      <option value="XL">XL</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-2">Material</label>
                    <select
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                      value={getSelectedMaterialFromTags(productForm.seoTags)}
                      onChange={e => {
                        const currentShape = getSelectedShapeFromTags(productForm.seoTags);
                        const updated = updateTagsWithShapeAndMaterial(productForm.seoTags, currentShape, e.target.value);
                        setProductForm({ ...productForm, seoTags: updated });
                      }}
                    >
                      <option value="">Automático</option>
                      <option value="Acetato">Acetato</option>
                      <option value="Metal">Metal</option>
                      <option value="Titanio">Titanio</option>
                      <option value="TR90">TR90</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Descripción Comercial Exclusiva Web</label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all resize-none"
                  placeholder="Detalles de diseño, sensaciones, estilo, etc. Se mostrará en el storefront en reemplazo de la descripción estándar."
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              {/* ---- SEO (Google) ---- */}
              <div className="space-y-3 p-3 bg-stone-50/60 dark:bg-stone-800/30 rounded-xl border border-stone-200/60 dark:border-stone-700/50">
                <div className="flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-stone-400" />
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">SEO — cómo aparece en Google</label>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Título SEO</label>
                    <span className={`text-[9px] font-mono ${productForm.seoTitle.length > 60 ? 'text-amber-500' : 'text-stone-400'}`}>{productForm.seoTitle.length}/60</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Ej: Anteojos de sol Verona C1 clip-on | Atelier Óptica"
                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                    value={productForm.seoTitle}
                    onChange={e => setProductForm({ ...productForm, seoTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Meta descripción</label>
                    <span className={`text-[9px] font-mono ${productForm.seoDescription.length > 160 ? 'text-amber-500' : 'text-stone-400'}`}>{productForm.seoDescription.length}/160</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Texto que Google muestra bajo el título. 120-160 caracteres con palabras clave."
                    className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all resize-none"
                    value={productForm.seoDescription}
                    onChange={e => setProductForm({ ...productForm, seoDescription: e.target.value })}
                  />
                </div>
                <p className="text-[9px] text-stone-400">Si los dejás vacíos, se usa el título/descripción automáticos del producto.</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-3 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-500 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {savingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW / EDIT BLOG POST */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPostModal(false)} />
          <div className="relative bg-white dark:bg-stone-900 w-full max-w-3xl rounded-[2rem] p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary">Contenido Editorial</span>
                <h3 className="text-xl font-black text-stone-900 dark:text-white">
                  {editingPost ? 'Editar Artículo del Blog' : 'Crear Nuevo Artículo del Blog'}
                </h3>
              </div>
              <button 
                onClick={() => setShowPostModal(false)}
                className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-black dark:hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Título del Artículo</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                    placeholder="Ej: Tendencias de verano en lentes de sol"
                    value={postForm.title}
                    onChange={e => {
                      const slugStr = e.target.value
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, '-');
                      setPostForm({ ...postForm, title: e.target.value, slug: slugStr });
                    }}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Slug (URL)</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                    placeholder="ej: tendencias-verano-lentes-sol"
                    value={postForm.slug}
                    onChange={e => setPostForm({ ...postForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Categoría</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                    placeholder="Ej: Salud Visual, Tecnología, Cristales"
                    value={postForm.category}
                    onChange={e => setPostForm({ ...postForm, category: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Estado</label>
                  <select
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                    value={postForm.status}
                    onChange={e => setPostForm({ ...postForm, status: e.target.value })}
                  >
                    <option value="DRAFT">Borrador (DRAFT)</option>
                    <option value="PUBLISHED">Publicado (PUBLISHED)</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">URL de Imagen de Portada</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                    placeholder="Ej: /images/blog/imagen.png o enlace de internet (https://...)"
                    value={postForm.imageUrl}
                    onChange={e => setPostForm({ ...postForm, imageUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Resumen / Copete (Excerpt)</label>
                <textarea
                  rows={2}
                  maxLength={200}
                  className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all resize-none"
                  placeholder="Escribí una frase introductoria atractiva..."
                  value={postForm.excerpt}
                  onChange={e => setPostForm({ ...postForm, excerpt: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Contenido del Artículo (Se puede usar HTML para estructurar)</label>
                <textarea
                  rows={10}
                  required
                  className="w-full px-4 py-3 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs outline-none focus:border-primary transition-all font-mono leading-relaxed"
                  placeholder="<p>El cuerpo del artículo...</p>&#10;<h2>Título Sección</h2>&#10;<p>Contenido...</p>"
                  value={postForm.content}
                  onChange={e => setPostForm({ ...postForm, content: e.target.value })}
                />
              </div>

              {/* SEO METADATA DROPDOWN */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-400">Metadatos SEO del Artículo (Opcionales)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Título de Pestaña (Meta Title)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                      placeholder="Título SEO (Máx 70 caracteres)"
                      value={postForm.metaTitle}
                      onChange={e => setPostForm({ ...postForm, metaTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Meta Descripción</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
                      placeholder="Meta Descripción (Máx 160 caracteres)"
                      value={postForm.metaDescription}
                      onChange={e => setPostForm({ ...postForm, metaDescription: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="flex-1 py-3 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-500 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPost}
                  className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {savingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editingPost ? 'Guardar Cambios' : 'Crear Artículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
