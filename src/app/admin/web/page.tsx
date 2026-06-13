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
  CheckCircle2, 
  X, 
  ArrowUpRight, 
  Loader2, 
  Eye, 
  Save, 
  FileText, 
  Settings, 
  Star, 
  AlertCircle,
  Download,
  Maximize2,
  Minimize2,
  Copy
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { resolveStorageUrl } from '@/lib/utils/storage';

interface WebProduct {
  id: string;
  productId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  category: string;
  updatedAt: string;
  product: {
    brand: string | null;
    model: string | null;
    price: number;
    stock: number;
    publishToWeb: boolean;
    imagenesCatalogo: string[];
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
  const [activeTab, setActiveTab] = useState<'products' | 'blog' | 'config' | 'flyers'>('products');

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
  
  // Products states
  const [products, setProducts] = useState<WebProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<WebProduct | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    id: "",
    category: "",
    isFeatured: false,
    isActive: false,
    description: "",
    slug: ""
  });

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
          web_store_phone: data.web_store_phone || "+54 9 354 121 5971",
          web_store_whatsapp_id: data.web_store_whatsapp_id || "5493541215971",
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
  const handleEditProduct = (p: WebProduct) => {
    setEditingProduct(p);
    setProductForm({
      id: p.id,
      category: p.category,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      description: p.description || "",
      slug: p.slug
    });
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
    return wp.name.toLowerCase().includes(term) || 
           (wp.product.brand || '').toLowerCase().includes(term) ||
           (wp.product.model || '').toLowerCase().includes(term) ||
           wp.slug.toLowerCase().includes(term) ||
           wp.category.toLowerCase().includes(term);
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
      <div className="flex border-b border-stone-200 dark:border-stone-800">
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
      </div>

      {/* TAB 1: PRODUCTS LIST */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* SEARCH BAR */}
          <div className="flex gap-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-2xl shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por marca, modelo, categoría web..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all"
              />
            </div>
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
                      const img = wp.product.imagenesCatalogo?.length > 0 
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
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold uppercase tracking-wider rounded-sm text-[9px] border border-stone-200/50 dark:border-stone-700/50">
                              {wp.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-stone-500 max-w-[200px] truncate" title={wp.slug}>
                            /{wp.slug}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {wp.isFeatured ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded-sm">
                                <Star className="w-2.5 h-2.5 fill-current" /> Sí
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-bold">No</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {wp.isActive ? (
                              <span className="px-2 py-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-sm">
                                Activo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[9px] font-bold text-stone-450 bg-stone-100 border border-stone-200 rounded-sm">
                                Oculto
                              </span>
                            )}
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
                        target="_blank"
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
                      placeholder="Ej: +54 9 354 121 5971"
                      value={configForm.web_store_phone}
                      onChange={e => setConfigForm({ ...configForm, web_store_phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block">ID de WhatsApp para Enlaces (Solo Números)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                      placeholder="Ej: 5493541215971"
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
                <h2 className="text-xl sm:text-2xl font-black italic tracking-tight">Diseño de Story & Búsqueda de Personal</h2>
                <p className="text-stone-300 text-xs sm:text-sm font-medium leading-relaxed">
                  Descargá el flyer oficial de alta gama diseñado por Inteligencia Artificial para redes sociales, o personalizá un flyer interactivo en tiempo real con los requisitos específicos del puesto.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* EDITOR PANEL / SHOWCASE (COLUMNS 1-7) */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* SECCIÓN 1: FLYER OFICIAL */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Flyer Oficial (Pre-diseñado por IA)
                  </h3>
                  <p className="text-[10px] text-stone-400 mt-1">Flyer en formato story de alta definición listo para publicar en Instagram o WhatsApp.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-stone-50 dark:bg-stone-800/40 rounded-2xl border border-stone-200/50 dark:border-stone-700/50">
                  <div className="w-36 h-64 bg-stone-200 dark:bg-stone-800 rounded-xl overflow-hidden shadow-md shrink-0 border border-stone-200 dark:border-stone-700 relative group">
                    <img 
                      src="/images/buscamos_personal_story.png" 
                      alt="Flyer Oficial Buscamos Personal" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-sm font-black text-stone-800 dark:text-stone-100">Flyer Editorial &quot;Atelier&quot;</h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                        Un diseño sofisticado y minimalista que incluye una montura de acetato transparente sobre mármol travertino con tipografía serif de alta moda. Ideal para mantener la identidad premium de la marca.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a 
                        href="/images/buscamos_personal_story.png" 
                        download="buscamos_personal_story.png"
                        className="px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar Flyer PNG
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: CREADOR DE FLYER DINÁMICO */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Creador de Flyer Interactivo
                  </h3>
                  <p className="text-[10px] text-stone-400 mt-1">Escribí los detalles de la búsqueda laboral para actualizar el diseño en la previsualización.</p>
                </div>

                <div className="space-y-6">
                  {/* Selector de Temas */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Tema Visual del Story</label>
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
                          className={`p-3 rounded-xl border text-left transition-all ${
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

                  {/* Inputs de Texto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Título Principal</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                        value={flyerTitle}
                        onChange={(e) => setFlyerTitle(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Subtítulo</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                        value={flyerSubtitle}
                        onChange={(e) => setFlyerSubtitle(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Puesto a Cubrir</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-bold"
                        value={flyerPosition}
                        onChange={(e) => setFlyerPosition(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Descripción Breve</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                        value={flyerDescription}
                        onChange={(e) => setFlyerDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Requisitos */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest block">Requisitos del Puesto (Hasta 4)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {flyerRequirements.map((req, i) => (
                        <div key={i} className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-stone-400">{i + 1}</span>
                          <input
                            type="text"
                            className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                            placeholder={`Requisito ${i + 1}`}
                            value={req}
                            onChange={(e) => {
                              const newReqs = [...flyerRequirements];
                              newReqs[i] = e.target.value;
                              setFlyerRequirements(newReqs);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Información de contacto */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Llamado a la Acción</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-semibold"
                        value={flyerAction}
                        onChange={(e) => setFlyerAction(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Email de Envío</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-mono"
                        value={flyerContact}
                        onChange={(e) => setFlyerContact(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Instagram</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs outline-none focus:border-primary transition-all font-medium"
                        value={flyerInstagram}
                        onChange={(e) => setFlyerInstagram(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Botones de acción del creador */}
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
                        alert('¡Email de contacto copiado al portapapeles!');
                      }}
                      className="py-3 px-5 border border-stone-200 dark:border-stone-750 hover:bg-stone-50 dark:hover:bg-stone-850 text-stone-500 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Contacto
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTAINER (COLUMNS 8-12) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center sticky top-8">
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Vista Previa 9:16 (Instagram Story)</span>
              
              {/* Story Canvas Container */}
              <div className="relative border-4 border-stone-250 dark:border-stone-800 rounded-[2.5rem] p-3 shadow-2xl bg-white dark:bg-[#141211] w-full max-w-[340px] overflow-hidden">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-5 bg-stone-250 dark:bg-stone-800 rounded-full z-30 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-stone-300 dark:bg-stone-950 ml-auto mr-4" />
                </div>

                <div 
                  id="flyer-story-preview"
                  className="relative rounded-[1.8rem] w-full aspect-[9/16] overflow-hidden select-none"
                  style={{
                    background: flyerTheme === 'cream' 
                      ? 'linear-gradient(135deg, #f5f2eb 0%, #e8e2db 50%, #dfd8cf 100%)' 
                      : flyerTheme === 'obsidian' 
                      ? 'linear-gradient(135deg, #181514 0%, #0d0c0b 50%, #000000 100%)'
                      : 'linear-gradient(135deg, #f7f1eb 0%, #efe1d8 50%, #e2cdbe 100%)',
                    fontFamily: 'Playfair Display, Georgia, "Times New Roman", serif',
                  }}
                >
                  {/* Decorative background light flares */}
                  <div 
                    className="absolute w-64 h-64 rounded-full filter blur-[80px] pointer-events-none opacity-30 z-0"
                    style={{
                      top: '-50px',
                      right: '-50px',
                      background: flyerTheme === 'obsidian' ? '#b08f62' : '#ffffff',
                    }}
                  />
                  <div 
                    className="absolute w-48 h-48 rounded-full filter blur-[60px] pointer-events-none opacity-20 z-0"
                    style={{
                      bottom: '-30px',
                      left: '-30px',
                      background: flyerTheme === 'obsidian' ? '#3d2b1f' : '#e2d3c5',
                    }}
                  />

                  {/* Story Header (Brand & Logo) */}
                  <div className="relative z-10 pt-10 px-6 flex flex-col items-center">
                    <img 
                      src={flyerTheme === 'obsidian' ? '/images/logo-blanco.png' : '/images/logo-negro.png'} 
                      alt="Atelier Logo" 
                      className="h-7 object-contain opacity-90"
                      onError={(e) => {
                        // Fallback text if logo doesn't exist yet
                        (e.target as any).style.display = 'none';
                        const fallbackEl = document.getElementById('flyer-logo-fallback');
                        if (fallbackEl) fallbackEl.style.display = 'block';
                      }}
                    />
                    <div 
                      id="flyer-logo-fallback" 
                      className="hidden text-center text-sm font-black uppercase tracking-[0.3em] font-sans"
                      style={{ color: flyerTheme === 'obsidian' ? '#e2c5a2' : '#4a3f35' }}
                    >
                      Atelier Óptica
                    </div>
                    <div 
                      className="w-10 h-[1px] mt-4 opacity-30" 
                      style={{ backgroundColor: flyerTheme === 'obsidian' ? '#fff' : '#000' }}
                    />
                  </div>

                  {/* Main Content Area */}
                  <div className="relative z-10 px-5 pt-8 pb-10 flex flex-col h-[calc(100%-100px)] justify-between">
                    
                    {/* Glassmorphic Flyer Panel */}
                    <div 
                      className="rounded-2xl p-5 border shadow-xl flex-1 flex flex-col justify-center gap-3 backdrop-blur-md"
                      style={{
                        backgroundColor: flyerTheme === 'obsidian' ? 'rgba(30, 26, 24, 0.55)' : 'rgba(255, 255, 255, 0.45)',
                        borderColor: flyerTheme === 'obsidian' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.35)',
                      }}
                    >
                      {/* Title block */}
                      <div className="text-center space-y-1">
                        <p 
                          className="text-[9px] font-black uppercase tracking-[0.2em] font-sans"
                          style={{ color: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                        >
                          {flyerDescription}
                        </p>
                        <h2 
                          className="text-2xl font-black tracking-wider leading-none"
                          style={{ color: flyerTheme === 'obsidian' ? '#fff' : '#3c352d' }}
                        >
                          {flyerTitle}
                        </h2>
                        <h3 
                          className="text-xl font-bold tracking-[0.15em] italic opacity-95"
                          style={{ color: flyerTheme === 'obsidian' ? '#e2c5a2' : '#6b5947' }}
                        >
                          {flyerSubtitle}
                        </h3>
                      </div>

                      {/* Job Position display */}
                      <div 
                        className="py-2.5 px-3 rounded-lg text-center border font-sans font-bold"
                        style={{
                          backgroundColor: flyerTheme === 'obsidian' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                          borderColor: flyerTheme === 'obsidian' ? 'rgba(176, 143, 98, 0.25)' : 'rgba(158, 127, 101, 0.2)',
                        }}
                      >
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-60 text-stone-500">PUESTO A CUBRIR</p>
                        <p 
                          className="text-xs uppercase tracking-wide mt-0.5"
                          style={{ color: flyerTheme === 'obsidian' ? '#f5e8d8' : '#3c352d' }}
                        >
                          {flyerPosition || 'Personal de Óptica'}
                        </p>
                      </div>

                      {/* Requirements checklist */}
                      <div className="space-y-2 py-1">
                        <p 
                          className="text-[8px] font-black uppercase tracking-widest font-sans"
                          style={{ color: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                        >
                          Requisitos:
                        </p>
                        <ul className="space-y-1.5 font-sans">
                          {flyerRequirements.filter(Boolean).map((req, idx) => (
                            <li 
                              key={idx} 
                              className="text-[10px] font-medium leading-tight flex items-start gap-2"
                              style={{ color: flyerTheme === 'obsidian' ? '#e2e0db' : '#4e453c' }}
                            >
                              <span 
                                className="w-1 h-1 rounded-full shrink-0 mt-1.5"
                                style={{ backgroundColor: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                              />
                              <span>{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Story Footer */}
                    <div className="text-center pt-5 space-y-2.5">
                      <div className="space-y-0.5">
                        <p 
                          className="text-[9px] font-black uppercase tracking-[0.25em] font-sans"
                          style={{ color: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                        >
                          {flyerAction}
                        </p>
                        <p 
                          className="text-xs font-bold font-mono tracking-tight"
                          style={{ color: flyerTheme === 'obsidian' ? '#fff' : '#3c352d' }}
                        >
                          {flyerContact}
                        </p>
                      </div>
                      
                      <div 
                        className="text-[9px] font-bold tracking-widest font-sans opacity-60 uppercase"
                        style={{ color: flyerTheme === 'obsidian' ? '#a39b94' : '#6b5947' }}
                      >
                        {flyerInstagram}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Instructions below story */}
              <div className="mt-4 p-4 max-w-[340px] bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/50 dark:border-stone-750 text-[10px] text-stone-500 space-y-1 leading-relaxed text-center">
                <p className="font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">💡 ¿Cómo capturar este flyer?</p>
                <p>Hacé click en &quot;Ver en Pantalla Completa&quot;, y sacale una captura de pantalla desde tu celular o computadora para subirlo directamente a tus historias de Instagram o estados de WhatsApp.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN FLYER MODAL PREVIEW FOR SCREENSHOTTING */}
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

          {/* Actual 9:16 Canvas sized perfectly for high-resolution screenshots */}
          <div 
            className="relative w-full max-w-[450px] aspect-[9/16] shadow-2xl overflow-hidden select-none"
            style={{
              background: flyerTheme === 'cream' 
                ? 'linear-gradient(135deg, #f5f2eb 0%, #e8e2db 50%, #dfd8cf 100%)' 
                : flyerTheme === 'obsidian' 
                ? 'linear-gradient(135deg, #181514 0%, #0d0c0b 50%, #000000 100%)'
                : 'linear-gradient(135deg, #f7f1eb 0%, #efe1d8 50%, #e2cdbe 100%)',
              fontFamily: 'Playfair Display, Georgia, "Times New Roman", serif',
            }}
          >
            {/* Background lights */}
            <div 
              className="absolute w-[400px] h-[400px] rounded-full filter blur-[100px] pointer-events-none opacity-30 z-0"
              style={{
                top: '-100px',
                right: '-100px',
                background: flyerTheme === 'obsidian' ? '#b08f62' : '#ffffff',
              }}
            />
            <div 
              className="absolute w-[300px] h-[300px] rounded-full filter blur-[80px] pointer-events-none opacity-20 z-0"
              style={{
                bottom: '-50px',
                left: '-50px',
                background: flyerTheme === 'obsidian' ? '#3d2b1f' : '#e2d3c5',
              }}
            />

            {/* Story Header */}
            <div className="relative z-10 pt-16 px-10 flex flex-col items-center">
              <img 
                src={flyerTheme === 'obsidian' ? '/images/logo-blanco.png' : '/images/logo-negro.png'} 
                alt="Atelier Logo" 
                className="h-10 object-contain opacity-95"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                  const fallbackEl = document.getElementById('flyer-fullscreen-logo-fallback');
                  if (fallbackEl) fallbackEl.style.display = 'block';
                }}
              />
              <div 
                id="flyer-fullscreen-logo-fallback" 
                className="hidden text-center text-lg font-black uppercase tracking-[0.3em] font-sans"
                style={{ color: flyerTheme === 'obsidian' ? '#e2c5a2' : '#4a3f35' }}
              >
                Atelier Óptica
              </div>
              <div 
                className="w-14 h-[1px] mt-6 opacity-30" 
                style={{ backgroundColor: flyerTheme === 'obsidian' ? '#fff' : '#000' }}
              />
            </div>

            {/* Main Content Area */}
            <div className="relative z-10 px-8 pt-10 pb-16 flex flex-col h-[calc(100%-150px)] justify-between">
              
              {/* Glassmorphic Panel */}
              <div 
                className="rounded-3xl p-8 border shadow-2xl flex-1 flex flex-col justify-center gap-6 backdrop-blur-md"
                style={{
                  backgroundColor: flyerTheme === 'obsidian' ? 'rgba(30, 26, 24, 0.55)' : 'rgba(255, 255, 255, 0.45)',
                  borderColor: flyerTheme === 'obsidian' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.35)',
                }}
              >
                <div className="text-center space-y-2">
                  <p 
                    className="text-[11px] font-black uppercase tracking-[0.25em] font-sans"
                    style={{ color: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                  >
                    {flyerDescription}
                  </p>
                  <h2 
                    className="text-4xl font-black tracking-wider leading-none"
                    style={{ color: flyerTheme === 'obsidian' ? '#fff' : '#3c352d' }}
                  >
                    {flyerTitle}
                  </h2>
                  <h3 
                    className="text-3xl font-bold tracking-[0.15em] italic opacity-95"
                    style={{ color: flyerTheme === 'obsidian' ? '#e2c5a2' : '#6b5947' }}
                  >
                    {flyerSubtitle}
                  </h3>
                </div>

                <div 
                  className="py-4 px-5 rounded-xl text-center border font-sans font-bold shadow-sm"
                  style={{
                    backgroundColor: flyerTheme === 'obsidian' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.65)',
                    borderColor: flyerTheme === 'obsidian' ? 'rgba(176, 143, 98, 0.35)' : 'rgba(158, 127, 101, 0.25)',
                  }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 text-stone-500">PUESTO A CUBRIR</p>
                  <p 
                    className="text-lg uppercase tracking-wide mt-1.5"
                    style={{ color: flyerTheme === 'obsidian' ? '#f5e8d8' : '#3c352d' }}
                  >
                    {flyerPosition}
                  </p>
                </div>

                <div className="space-y-3 py-2">
                  <p 
                    className="text-[10px] font-black uppercase tracking-widest font-sans"
                    style={{ color: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                  >
                    Requisitos:
                  </p>
                  <ul className="space-y-2.5 font-sans">
                    {flyerRequirements.filter(Boolean).map((req, idx) => (
                      <li 
                        key={idx} 
                        className="text-sm font-medium leading-relaxed flex items-start gap-3.5"
                        style={{ color: flyerTheme === 'obsidian' ? '#e2e0db' : '#4e453c' }}
                      >
                        <span 
                          className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                          style={{ backgroundColor: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                        />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Story Footer */}
              <div className="text-center pt-8 space-y-3.5">
                <div className="space-y-1">
                  <p 
                    className="text-[11px] font-black uppercase tracking-[0.25em] font-sans"
                    style={{ color: flyerTheme === 'obsidian' ? '#b08f62' : '#9e7f65' }}
                  >
                    {flyerAction}
                  </p>
                  <p 
                    className="text-lg font-bold font-mono tracking-tight"
                    style={{ color: flyerTheme === 'obsidian' ? '#fff' : '#3c352d' }}
                  >
                    {flyerContact}
                  </p>
                </div>
                
                <div 
                  className="text-[10px] font-bold tracking-widest font-sans opacity-60 uppercase"
                  style={{ color: flyerTheme === 'obsidian' ? '#a39b94' : '#6b5947' }}
                >
                  {flyerInstagram}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT PRODUCT PROPERTIES */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
          <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6">
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
                  <img src={editingProduct.product.imagenesCatalogo?.length > 0 ? resolveStorageUrl(editingProduct.product.imagenesCatalogo[0]) : editingProduct.imageUrl || "/images/placeholder.svg"} className="object-contain w-full h-full mix-blend-multiply dark:mix-blend-normal" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200 leading-tight">{editingProduct.product.model}</h4>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mt-0.5">{editingProduct.product.brand || 'ATELIER'}</p>
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
