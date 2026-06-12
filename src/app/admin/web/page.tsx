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
  AlertCircle 
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
  const [activeTab, setActiveTab] = useState<'products' | 'blog' | 'config'>('products');
  
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
