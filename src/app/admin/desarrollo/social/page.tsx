'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Sparkles, Loader2, Copy, Download, CheckCircle2, Image as ImageIcon, Instagram, Facebook, Clock, Hash, Trash2 } from 'lucide-react';

interface Product { id: string; brand: string | null; model: string | null; category: string; }
interface BlogPost { id: string; title: string; category: string; }
interface SocialResult {
    id: string; copy: string; hashtags: string; cta: string;
    imagePrompt: string; imageUrl?: string | null; sourceName: string;
    publishTips: { bestTime: string; tone: string; format: string; tips: string[] };
    platform: string; format: string; sourceType: string; createdAt: string;
}
interface HistoryItem extends SocialResult { status: string; }

const PLATFORMS = [
    { value: 'INSTAGRAM', label: 'Instagram', icon: Instagram, color: 'from-pink-500 to-purple-500' },
    { value: 'FACEBOOK', label: 'Meta / Facebook', icon: Facebook, color: 'from-blue-500 to-indigo-500' },
];

const FORMATS = [
    { value: 'STORY', label: 'Story', desc: '9:16 vertical', icon: '📱' },
    { value: 'REEL', label: 'Reel', desc: 'Video 9:16', icon: '🎬' },
    { value: 'CAROUSEL', label: 'Carrusel', desc: '1:1 slides', icon: '📑' },
    { value: 'POST', label: 'Post', desc: '1:1 feed', icon: '🖼️' },
];

const SOURCES = [
    { value: 'PRODUCT', label: 'Producto del catálogo' },
    { value: 'BLOG', label: 'Artículo del blog' },
    { value: 'PROMO', label: 'Campaña / Promoción' },
    { value: 'FREE', label: 'Tema libre' },
];

const IMAGE_STYLES = [
    { value: 'PLACA', label: 'Placa', desc: 'Fondo premium para texto', icon: '🎨' },
    { value: 'UGC_AVATAR', label: 'UGC Avatar', desc: 'Persona con anteojos', icon: '🧑' },
    { value: 'EDITORIAL', label: 'Editorial', desc: 'Producto de campaña', icon: '📸' },
];

const GOALS = [
    { value: 'Aportar valor y educar', label: 'Educar (Valor)' },
    { value: 'Inspirar con moda y tendencias', label: 'Inspirar (Tendencias)' },
    { value: 'Generar interacción (preguntas, encuestas)', label: 'Interacción' },
    { value: 'Promocionar y vender un producto', label: 'Venta Directa' },
];

export default function SocialMediaPage() {
    const [platform, setPlatform] = useState('INSTAGRAM');
    const [format, setFormat] = useState('STORY');
    const [sourceType, setSourceType] = useState('FREE');
    const [sourceId, setSourceId] = useState('');
    const [topic, setTopic] = useState('');
    const [imageStyle, setImageStyle] = useState('EDITORIAL');
    const [goal, setGoal] = useState('Aportar valor y educar');
    const [generating, setGenerating] = useState(false);
    const [generatingImage, setGeneratingImage] = useState(false);
    const [result, setResult] = useState<SocialResult | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/products').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setProducts(d.filter((p: any) => p.brand));
        }).catch(() => {});
        fetch('/api/blog').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setBlogPosts(d);
        }).catch(() => {});
        fetch('/api/social/history').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setHistory(d);
        }).catch(() => {});
    }, []);

    const handleGenerate = async () => {
        setGenerating(true); setError(''); setResult(null);
        try {
            const res = await fetch('/api/social/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, format, sourceType, sourceId: sourceId || undefined, topic: topic || undefined, imageStyle, goal })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Error al generar');
            setResult(data.content);
            // Refresh history
            fetch('/api/social/history').then(r => r.json()).then(d => { if (Array.isArray(d)) setHistory(d); }).catch(() => {});
        } catch (e: any) { setError(e.message); }
        setGenerating(false);
    };

    const handleGenerateImage = async () => {
        if (!result?.id) return;
        setGeneratingImage(true);
        try {
            const res = await fetch('/api/social/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate-image', contentId: result.id })
            });
            const data = await res.json();
            if (data.imageUrl) {
                setResult(prev => prev ? { ...prev, imageUrl: data.imageUrl } : prev);
            }
        } catch (e: any) { setError(e.message); }
        setGeneratingImage(false);
    };

    const copyText = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este contenido?')) return;
        await fetch(`/api/social/history?id=${id}`, { method: 'DELETE' });
        setHistory(h => h.filter(i => i.id !== id));
        if (result?.id === id) setResult(null);
    };

    const slides = result?.copy?.split('---SLIDE---') || [];

    return (
        <main className="p-4 lg:p-8 max-w-6xl mx-auto animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Megaphone className="w-9 h-9 text-primary" /> Social Media Studio
                    </h1>
                    <p className="text-stone-400 text-sm mt-1 font-medium">
                        Generá campañas listas para publicar con IA
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={async () => {
                            if(!confirm('¿Estás seguro que querés buscar noticias y generar un artículo de blog con IA ahora?')) return;
                            setGenerating(true);
                            setError('');
                            try {
                                const res = await fetch('/api/blog/generate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ adminPhone: '5493512222222' })
                                });
                                const data = await res.json();
                                if(data.success) {
                                    alert('¡Artículo generado exitosamente! Se guardó como borrador en el blog.');
                                } else {
                                    setError(data.error || 'Error al generar artículo');
                                }
                            } catch (e) {
                                setError('Error de conexión');
                            }
                            setGenerating(false);
                        }}
                        disabled={generating}
                        className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-fuchsia-500 text-white hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-fuchsia-500/25 disabled:opacity-50"
                    >
                        <Sparkles className="w-4 h-4 animate-pulse" /> Generar Artículo Blog
                    </button>
                    <button onClick={() => setShowHistory(!showHistory)} className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-stone-100 dark:bg-stone-700 text-stone-500 hover:scale-105 transition-all flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Historial ({history.length})
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Generator Panel */}
                <section className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b-2 border-stone-100 dark:border-stone-700">
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-5 h-5 text-primary" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Generar Contenido</h2>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Platform Selector */}
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-3">Plataforma</label>
                            <div className="grid grid-cols-2 gap-2">
                                {PLATFORMS.map(p => {
                                    const Icon = p.icon;
                                    return (
                                        <button key={p.value} onClick={() => setPlatform(p.value)}
                                            className={`p-3 rounded-xl flex items-center gap-3 transition-all border-2 hover:scale-[1.02] ${platform === p.value ? `border-transparent bg-gradient-to-r ${p.color} text-white shadow-lg` : 'border-stone-100 dark:border-stone-700 hover:border-stone-200'}`}>
                                            <Icon className="w-5 h-5" />
                                            <span className="text-sm font-black">{p.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Format Selector */}
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-3">Formato</label>
                            <div className="grid grid-cols-2 gap-2">
                                {FORMATS.map(f => (
                                    <button key={f.value} onClick={() => setFormat(f.value)}
                                        className={`p-3 rounded-xl text-left transition-all border-2 hover:scale-[1.02] ${format === f.value ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-stone-100 dark:border-stone-700 hover:border-stone-200'}`}>
                                        <span className="text-lg">{f.icon}</span>
                                        <p className="text-sm font-black mt-1">{f.label}</p>
                                        <p className="text-[10px] text-stone-400">{f.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Goal Selector */}
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Objetivo del contenido</label>
                            <select value={goal} onChange={e => setGoal(e.target.value)}
                                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all">
                                {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                        </div>

                        {/* Source Selector */}
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Fuente del contenido</label>
                            <select value={sourceType} onChange={e => { setSourceType(e.target.value); setSourceId(''); setTopic(''); }}
                                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all">
                                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>

                        {/* Dynamic Source Input */}
                        {sourceType === 'PRODUCT' && (
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Elegí un producto</label>
                                <select value={sourceId} onChange={e => setSourceId(e.target.value)}
                                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all">
                                    <option value="">Seleccionar producto...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model} ({p.category})</option>)}
                                </select>
                            </div>
                        )}

                        {sourceType === 'BLOG' && (
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Elegí un artículo</label>
                                <select value={sourceId} onChange={e => setSourceId(e.target.value)}
                                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all">
                                    <option value="">Seleccionar artículo...</option>
                                    {blogPosts.map(b => <option key={b.id} value={b.id}>{b.title} ({b.category})</option>)}
                                </select>
                            </div>
                        )}

                        {(sourceType === 'PROMO' || sourceType === 'FREE') && (
                            <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">
                                    {sourceType === 'PROMO' ? 'Describí la promo' : 'Tema o idea'}
                                </label>
                                <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3} placeholder={sourceType === 'PROMO' ? 'Ej: 20% off en lentes de sol esta semana...' : 'Ej: Consejos para elegir multifocales...'}
                                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-600 rounded-xl text-sm font-bold outline-none focus:border-primary transition-all resize-none" />
                            </div>
                        )}

                        {/* Image Style Selector */}
                        <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-3">Estilo de imagen</label>
                            <div className="grid grid-cols-3 gap-2">
                                {IMAGE_STYLES.map(s => (
                                    <button key={s.value} onClick={() => setImageStyle(s.value)}
                                        className={`p-3 rounded-xl text-center transition-all border-2 hover:scale-[1.02] ${imageStyle === s.value ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-lg shadow-amber-500/10' : 'border-stone-100 dark:border-stone-700 hover:border-stone-200'}`}>
                                        <span className="text-lg">{s.icon}</span>
                                        <p className="text-xs font-black mt-1">{s.label}</p>
                                        <p className="text-[9px] text-stone-400">{s.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold">{error}</div>
                        )}

                        {/* Generate Button */}
                        <button onClick={handleGenerate} disabled={generating || ((sourceType === 'PRODUCT' || sourceType === 'BLOG') && !sourceId)}
                            className="w-full py-4 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                            {generating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generando con IA...</> : <><Sparkles className="w-5 h-5" /> Generar Contenido</>}
                        </button>
                    </div>
                </section>

                {/* Result Panel */}
                <section className="space-y-6">
                    {!result && !generating && (
                        <div className="bg-white dark:bg-stone-800 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-2xl p-12 text-center">
                            <Megaphone className="w-16 h-16 text-stone-200 dark:text-stone-700 mx-auto mb-4" />
                            <p className="text-sm font-black text-stone-300 dark:text-stone-600 uppercase tracking-widest">Tu contenido aparecerá acá</p>
                            <p className="text-xs text-stone-300 dark:text-stone-600 mt-2">Elegí formato, fuente y dale a Generar</p>
                        </div>
                    )}

                    {generating && (
                        <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-12 text-center">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                            <p className="text-sm font-bold text-stone-500">Generando contenido premium...</p>
                            <p className="text-xs text-stone-400 mt-1">Esto puede demorar 10-20 segundos</p>
                        </div>
                    )}

                    {result && (
                        <>
                            {/* Copy Section */}
                            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b-2 border-stone-100 dark:border-stone-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Instagram className="w-4 h-4 text-pink-500" />
                                        <span className="text-xs font-black uppercase tracking-widest text-stone-400">{result.format} — {result.sourceName}</span>
                                    </div>
                                    <button onClick={() => copyText(result.copy + '\n\n' + result.hashtags, 'all')}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1">
                                        {copied === 'all' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copied === 'all' ? '¡Copiado!' : 'Copiar todo'}
                                    </button>
                                </div>
                                <div className="p-6">
                                    {result.format === 'CAROUSEL' && slides.length > 1 ? (
                                        <div className="space-y-3">
                                            {slides.map((slide, i) => (
                                                <div key={i} className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-700">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Slide {i + 1}</span>
                                                        <button onClick={() => copyText(slide.trim(), `slide-${i}`)} className="text-stone-400 hover:text-primary transition-colors">
                                                            {copied === `slide-${i}` ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{slide.trim()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.copy}</p>
                                    )}
                                </div>
                            </div>

                            {/* Hashtags */}
                            {result.hashtags && (
                                <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Hash className="w-4 h-4 text-blue-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Hashtags</span>
                                        </div>
                                        <button onClick={() => copyText(result.hashtags, 'hash')} className="text-stone-400 hover:text-primary transition-colors">
                                            {copied === 'hash' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-blue-500 leading-relaxed break-all">{result.hashtags}</p>
                                </div>
                            )}

                            {/* Image Prompt + Generate */}
                            <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <ImageIcon className="w-4 h-4 text-amber-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Creatividad Visual</span>
                                </div>
                                {result.imageUrl ? (
                                    <div className="space-y-3">
                                        <img src={`/api/storage/view?key=${encodeURIComponent(result.imageUrl)}`} alt="Generada" className="w-full rounded-xl border border-stone-200 dark:border-stone-700" />
                                        <a href={`/api/storage/view?key=${encodeURIComponent(result.imageUrl)}`} download className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                            <Download className="w-4 h-4" /> Descargar Imagen
                                        </a>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl">
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Prompt para generar imagen</p>
                                            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{result.imagePrompt}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => copyText(result.imagePrompt, 'prompt')}
                                                className="flex-1 py-2.5 bg-stone-100 dark:bg-stone-700 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                                {copied === 'prompt' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                                Copiar prompt
                                            </button>
                                            <button onClick={handleGenerateImage} disabled={generatingImage}
                                                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                                {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                                {generatingImage ? 'Generando...' : 'Generar con IA'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Publishing Tips */}
                            {result.publishTips && (
                                <div className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Indicaciones de publicación</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl">
                                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Mejor hora</p>
                                            <p className="text-xs font-bold">{result.publishTips.bestTime}</p>
                                        </div>
                                        <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl">
                                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-0.5">Formato</p>
                                            <p className="text-xs font-bold">{result.publishTips.format}</p>
                                        </div>
                                    </div>
                                    {result.publishTips.tips?.length > 0 && (
                                        <ul className="space-y-1.5">
                                            {result.publishTips.tips.map((tip, i) => (
                                                <li key={i} className="text-xs text-stone-500 flex items-start gap-2">
                                                    <span className="text-primary font-black">•</span> {tip}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>
            </div>

            {/* History Panel */}
            {showHistory && history.length > 0 && (
                <section className="mt-10">
                    <h2 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Contenidos generados
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map(item => (
                            <div key={item.id} className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl p-4 group hover:border-primary/30 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-pink-100 dark:bg-pink-950 text-pink-600 dark:text-pink-400 rounded text-[9px] font-black uppercase">{item.format}</span>
                                        <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded text-[9px] font-black uppercase">{item.sourceType}</span>
                                    </div>
                                    <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 transition-all">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {item.sourceName && <p className="text-xs font-bold text-primary mb-1 truncate">{item.sourceName}</p>}
                                <p className="text-xs text-stone-500 line-clamp-3 leading-relaxed mb-2">{item.copy}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-stone-400">{new Date(item.createdAt).toLocaleDateString('es-AR')}</span>
                                    <button onClick={() => { setResult(item); setShowHistory(false); }} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </main>
    );
}
