'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
    ArrowLeft, Upload, Trash2, Copy, Check, 
    Image as ImageIcon, Loader2, Sparkles, AlertCircle, FileText
} from 'lucide-react';

interface AgentFile {
    key: string;
    cleanKey: string;
    url: string;
    size?: number;
    lastModified?: string;
}

export default function AgentPhotosPage() {
    const [files, setFiles] = useState<AgentFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [copiedType, setCopiedType] = useState<'label' | 'url' | null>(null);
    const [imagePrompt, setImagePrompt] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch existing files
    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp/agent/media');
            const data = await res.json();
            if (data.success) {
                setFiles(data.files);
            } else {
                setError(data.error || 'Error al obtener las fotos.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión al cargar las fotos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    // Format file size
    const formatBytes = (bytes?: number, decimals = 2) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // Format date
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    // Handle Copy to Clipboard
    const handleCopy = async (file: AgentFile, type: 'label' | 'url') => {
        const absoluteUrl = window.location.origin + file.url;
        const textToCopy = type === 'label' ? `[IMAGE: ${absoluteUrl}]` : absoluteUrl;
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopiedKey(file.key);
            setCopiedType(type);
            setTimeout(() => {
                setCopiedKey(null);
                setCopiedType(null);
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    // Handle File Upload
    const uploadSelectedFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Solo se permiten imágenes.');
            return;
        }

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/whatsapp/agent/media', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                if (imagePrompt.trim()) {
                    const absoluteUrl = window.location.origin + data.file.url;
                    try {
                        const agentRes = await fetch('/api/whatsapp/agent');
                        const agentConfig = await agentRes.json();
                        if (agentConfig && agentConfig.prompt !== undefined) {
                            const newRule = `\n\nREGLA PARA ESTA IMAGEN:\n${imagePrompt.trim()}\n[IMAGE: ${absoluteUrl}]`;
                            const updatedPrompt = agentConfig.prompt + newRule;
                            
                            await fetch('/api/whatsapp/agent', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ...agentConfig, prompt: updatedPrompt })
                            });
                        }
                    } catch (e) {
                        console.error('Failed to update agent prompt:', e);
                    }
                    setImagePrompt('');
                }
                await fetchFiles();
            } else {
                setError(data.error || 'Error al subir la imagen.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de red al intentar subir el archivo.');
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadSelectedFile(e.target.files[0]);
        }
    };

    // Handle Drag & Drop
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadSelectedFile(e.dataTransfer.files[0]);
        }
    };

    // Handle File Delete
    const handleDelete = async (key: string) => {
        if (!confirm('¿Estás seguro de que querés eliminar esta foto? El bot ya no podrá enviarla.')) {
            return;
        }

        try {
            const res = await fetch(`/api/whatsapp/agent/media?key=${encodeURIComponent(key)}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                setFiles(prev => prev.filter(f => f.key !== key));
            } else {
                setError(data.error || 'Error al eliminar la imagen.');
            }
        } catch (err) {
            console.error(err);
            setError('Error de red al intentar eliminar.');
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link 
                            href="/admin/whatsapp" 
                            className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-stone-500 hover:text-stone-900 dark:hover:text-white transition-all shadow-sm hover:scale-105"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                                <ImageIcon className="w-7 h-7 text-indigo-500" />
                                Galería de Fotos del Bot
                            </h1>
                            <p className="text-sm text-stone-500">Cargá imágenes para que el bot las envíe en sus respuestas utilizando la etiqueta `[IMAGE: URL]`</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left: Upload Area */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-[2rem] p-6 shadow-sm space-y-6">
                            <div>
                                <h3 className="font-black text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest">Subir Imagen</h3>
                                <p className="text-xs text-stone-500 mt-1">Sube banners promocionales, fotos de armazones, lentes de sol, recetas de muestra o mapas de ubicación.</p>
                            </div>

                            <div className="space-y-2 border-t border-b border-stone-100 dark:border-stone-800 py-4">
                                <label className="text-[11px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                    Regla para el Bot (Opcional)
                                </label>
                                <textarea
                                    value={imagePrompt}
                                    onChange={(e) => setImagePrompt(e.target.value)}
                                    placeholder="Ej: Enviar esta foto cuando el cliente pregunte por la ubicación del local."
                                    className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all resize-none h-20 placeholder:text-stone-400"
                                />
                                <p className="text-[10px] text-stone-400">Si escribís una instrucción aquí, la foto se vinculará automáticamente al "cerebro" del bot al subirla.</p>
                            </div>

                            <form 
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                    dragActive 
                                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10' 
                                        : 'border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700'
                                }`}
                            >
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={uploading}
                                />
                                
                                {uploading ? (
                                    <div className="space-y-3">
                                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                                        <p className="text-sm font-bold text-stone-600 dark:text-stone-300">Subiendo archivo...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 text-stone-500">
                                        <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-600 dark:text-stone-300 shadow-sm">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
                                                Arrastrá una imagen aquí
                                            </p>
                                            <p className="text-xs text-stone-400 mt-1">
                                                o hacé click para explorar archivos
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </form>

                            <div className="bg-stone-50 dark:bg-stone-950 rounded-2xl p-4 border border-stone-200/50 dark:border-stone-850 space-y-3">
                                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                    ¿Cómo usar con el bot?
                                </h4>
                                <ol className="list-decimal list-inside text-[11px] text-stone-500 space-y-2 leading-relaxed">
                                    <li>Subí una foto en esta galería.</li>
                                    <li>Hacé click en <strong>Copiar Etiqueta Bot</strong>.</li>
                                    <li>Pegá la etiqueta (ej: <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded border dark:border-stone-800 font-mono text-[10px]">[IMAGE: https://...]</code>) directamente en el prompt/reglas de personalidad del bot en la sección de WhatsApp.</li>
                                    <li>Cuando el bot deba mandar esa foto, usará la etiqueta al principio del párrafo y el sistema de WhatsApp la procesará como una imagen adjunta real.</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    {/* Right: File List / Grid */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-[2rem] p-6 shadow-sm min-h-[400px] flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="font-black text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest">Fotos Almacenadas</h3>
                                    <p className="text-xs text-stone-500 mt-1">Tenés {files.length} fotos listas para que use el bot.</p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 text-stone-400 gap-3">
                                    <Loader2 className="w-10 h-10 animate-spin text-stone-300" />
                                    <p className="text-sm font-medium">Cargando galería...</p>
                                </div>
                            ) : files.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 text-stone-400 dark:text-stone-600 gap-4 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
                                    <ImageIcon className="w-12 h-12 opacity-30" />
                                    <div className="text-center">
                                        <p className="text-sm font-bold">No hay imágenes en la galería</p>
                                        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Subí tu primera foto desde la barra lateral.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                                    {files.map((file) => (
                                        <div 
                                            key={file.key} 
                                            className="group bg-stone-50 dark:bg-stone-950 border border-stone-200/60 dark:border-stone-800/80 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all hover:border-stone-300 dark:hover:border-stone-700 relative overflow-hidden"
                                        >
                                            <div className="space-y-3">
                                                {/* Image Preview */}
                                                <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-900 border border-stone-200/50 dark:border-stone-800 relative">
                                                    <img 
                                                        src={file.url} 
                                                        alt={file.cleanKey} 
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                </div>

                                                {/* File Details */}
                                                <div className="space-y-1">
                                                    <p 
                                                        title={file.cleanKey.replace(/^agent_\d+_/, '')}
                                                        className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate"
                                                    >
                                                        {file.cleanKey.replace(/^agent_\d+_/, '')}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] text-stone-400 font-medium">
                                                        <span>{formatBytes(file.size)}</span>
                                                        <span>{formatDate(file.lastModified)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-stone-200/50 dark:border-stone-900">
                                                <button
                                                    onClick={() => handleCopy(file, 'label')}
                                                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                                                        copiedKey === file.key && copiedType === 'label'
                                                            ? 'bg-emerald-500 text-white border-emerald-400'
                                                            : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800'
                                                    }`}
                                                >
                                                    {copiedKey === file.key && copiedType === 'label' ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5" />
                                                            Copiado!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5 text-indigo-500" />
                                                            Copiar Etiqueta
                                                        </>
                                                    )}
                                                </button>
                                                
                                                <button
                                                    onClick={() => handleCopy(file, 'url')}
                                                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                                                        copiedKey === file.key && copiedType === 'url'
                                                            ? 'bg-emerald-500 text-white border-emerald-400'
                                                            : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800'
                                                    }`}
                                                >
                                                    {copiedKey === file.key && copiedType === 'url' ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5" />
                                                            Copiado!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5 text-amber-500" />
                                                            Copiar Link
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Delete Button (Trash icon in top corner) */}
                                            <button 
                                                onClick={() => handleDelete(file.key)}
                                                title="Eliminar foto"
                                                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-md"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
