'use client';

import QRCode from 'qrcode';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Send, Wifi, WifiOff, QrCode, RefreshCw, User,
    Clock, CheckCircle2, Bot, Settings, X, ChevronLeft, Phone,
    Tag, Archive, ArchiveRestore, Filter, Plus, Mic, PlaySquare, Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Etiquetas predefinidas para chats
const CHAT_LABEL_OPTIONS = [
    { label: 'Cancelar Bot', color: 'bg-red-100/80 text-red-700 border-red-200' },
    { label: 'VIP', color: 'bg-amber-100/80 text-amber-700 border-amber-200' },
    { label: 'Proveedor', color: 'bg-slate-100/80 text-slate-700 border-slate-200' },
    { label: 'Interesado', color: 'bg-emerald-100/80 text-emerald-700 border-emerald-200' },
    { label: 'No interesado', color: 'bg-stone-100/80 text-stone-600 border-stone-200' },
    { label: 'Seguimiento', color: 'bg-blue-100/80 text-blue-700 border-blue-200' },
    { label: 'Pendiente', color: 'bg-orange-100/80 text-orange-700 border-orange-200' },
];

const getLabelStyle = (label: string) =>
    CHAT_LABEL_OPTIONS.find(o => o.label === label)?.color
    ?? 'bg-violet-100/80 text-violet-700 border-violet-200';

// Respuestas rápidas predefinidas
const QUICK_REPLIES = [
    { label: 'Saludo', text: '¡Hola! 👋 Bienvenido a Atelier Óptica. ¿En qué te puedo ayudar?' },
    { label: 'Receta', text: '¿Me podés compartir tu receta óptica para ayudarte mejor?' },
    { label: 'Turno', text: '¿Querés coordinar un turno para una consulta en el local? 📍' },
    { label: 'Dirección', text: '📍 Nos encontrás en Tejeda 4380, Córdoba.' },
    { label: 'Horario', text: 'Atendemos de lunes a viernes de 9 a 18hs.' },
    { label: 'Listo para retirar', text: '🎉 ¡Tu pedido está listo para retirar!' },
    { label: 'Pago pendiente', text: 'Te recuerdo que quedó pendiente el saldo restante. ¿Cuándo te viene bien coordinar el pago?' },
];

// ── Types ─────────────────────────────────────────
interface Chat {
    id: string;
    waId: string;
    profileName: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string;
    botEnabled: boolean;
    archived: boolean;
    chatLabels: string[];
    client?: { id: string; name: string; phone: string; status: string } | null;
    messages?: Message[];
}

interface Message {
    id: string;
    chatId: string;
    direction: string; // INBOUND | OUTBOUND
    type: string;
    content: string;
    mediaUrl?: string;
    status: string;
    createdAt: string;
}

// ── Main Component ────────────────────────────────
export default function WhatsAppPage() {
    const [status, setStatus] = useState<{ connected: boolean; phone: string | null; qr: string | null; agentEnabled: boolean }>({
        connected: false, phone: null, qr: null, agentEnabled: false
    });
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [agentPrompt, setAgentPrompt] = useState('');
    const [agentEnabled, setAgentEnabled] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [filterLabel, setFilterLabel] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [showLabelPicker, setShowLabelPicker] = useState(false);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ base64: string; mimetype: string; filename: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // ── Fetch status ──────────────────────────────
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();
            setStatus(data);
            setLoadingStatus(false);
        } catch {
            setStatus({ connected: false, phone: null, qr: null, agentEnabled: false });
            setLoadingStatus(false);
        }
    }, []);

    // ── Fetch chats ───────────────────────────────
    const fetchChats = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/chats');
            const data = await res.json();
            if (Array.isArray(data)) {
                const sorted = [...data].sort((a, b) => {
                    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                    return tb - ta;
                });
                setChats(sorted);
            } else {
                setChats([]);
            }
        } catch { setChats([]); }
    }, []);

    // ── Fetch messages ────────────────────────────
    const fetchMessages = useCallback(async (chatId: string) => {
        try {
            const res = await fetch(`/api/whatsapp/chats/${chatId}/messages`);
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch { setMessages([]); }
    }, []);

    // ── Agent config ──────────────────────────────
    const fetchAgent = async () => {
        try {
            const res = await fetch('/api/whatsapp/agent');
            const data = await res.json();
            setAgentPrompt(data.prompt || '');
            setAgentEnabled(data.enabled || false);
        } catch { }
    };

    const saveAgent = async () => {
        setSaveStatus('saving');
        try {
            await fetch('/api/whatsapp/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: agentPrompt, enabled: agentEnabled }),
            });
            setSaveStatus('success');
            setTimeout(() => {
                setSaveStatus('idle');
                setShowConfig(false);
            }, 1000);
        } catch { 
            alert('Error al intentar guardar la configuración.');
            setSaveStatus('idle');
        }
    };

    // ── Polling ───────────────────────────────────
    useEffect(() => {
        fetchStatus();
        fetchChats();
        fetchAgent();

        pollRef.current = setInterval(() => {
            fetchStatus();
            fetchChats();
            if (selectedChat) fetchMessages(selectedChat.id);
        }, 3000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchStatus, fetchChats, fetchMessages, selectedChat]);

    // ── Auto-scroll ───────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Select chat ───────────────────────────────
    const selectChat = async (chat: Chat) => {
        setSelectedChat(chat);
        setShowLabelPicker(false);
        await fetchMessages(chat.id);
    };

    // ── Send text ─────────────────────────────────
    const sendMessage = async () => {
        if ((!newMessage.trim() && !selectedImage) || !selectedChat || sending) return;
        setSending(true);
        try {
            const body: Record<string, unknown> = { chatId: selectedChat.id, message: newMessage };
            if (selectedImage) body.media = selectedImage;
            await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setNewMessage('');
            setSelectedImage(null);
            await fetchMessages(selectedChat.id);
        } catch (e) {
            console.error('Error enviando:', e);
        }
        setSending(false);
    };

    // ── Pick image from file input ────────────────
    const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setSelectedImage({ base64, mimetype: file.type, filename: file.name });
        };
        reader.readAsDataURL(file);
        e.target.value = ''; 
    };

    // ── Toggle Bot per Chat ──────────────────────
    const toggleBot = async (chatId: string, enabled: boolean) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}/bot`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botEnabled: enabled }),
            });
            if (selectedChat?.id === chatId) {
                setSelectedChat({ ...selectedChat, botEnabled: enabled });
            }
            setChats(chats.map(c => c.id === chatId ? { ...c, botEnabled: enabled } : c));
        } catch (e) {
            console.error('Error al togglear bot:', e);
        }
    };

    // ── Actualizar etiquetas / archivar ───────────
    const updateChat = async (chatId: string, patch: Partial<Pick<Chat, 'chatLabels' | 'archived' | 'botEnabled'>>) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            const updated = (c: Chat) => c.id === chatId ? { ...c, ...patch } : c;
            setChats(prev => prev.map(updated));
            if (selectedChat?.id === chatId) {
                setSelectedChat(prev => prev ? { ...prev, ...patch } : prev);
            }
        } catch (e) {
            console.error('Error actualizando chat:', e);
        }
    };

    // ── Etiqueta: toggle en el chat seleccionado ──
    const toggleLabel = async (label: string) => {
        if (!selectedChat) return;
        const current = selectedChat.chatLabels || [];
        const next = current.includes(label)
            ? current.filter(l => l !== label)
            : [...current, label];
        await updateChat(selectedChat.id, { chatLabels: next });
        if (label === 'Cancelar Bot' && next.includes(label)) {
            await updateChat(selectedChat.id, { botEnabled: false });
        }
    };

    // ── Vista filtrada de chats ───────────────────
    const filteredChats = chats.filter(c => {
        if (c.archived !== showArchived) return false;
        if (filterLabel && !(c.chatLabels || []).includes(filterLabel)) return false;
        return true;
    });

    const usedLabels = Array.from(new Set(chats.flatMap(c => c.chatLabels || [])));

    // ═══════════════════════════════════════════════
    // RENDER: PREMIUM GLASSMORPHIC UI
    // ═══════════════════════════════════════════════

    return (
        <main className="h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-stone-100 to-stone-200 dark:from-stone-900 dark:via-stone-950 dark:to-black">
            {/* Header Flotante / Premium */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/40 dark:border-white/5 bg-white/40 dark:bg-black/30 backdrop-blur-2xl flex-shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-stone-800 dark:text-white tracking-tight">Comunicaciones</h1>
                        <p className="text-[11px] font-bold text-stone-500 flex items-center gap-1.5 uppercase tracking-widest mt-0.5">
                            {status.connected ? <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Activo ({status.phone})</> : <><span className="w-2 h-2 rounded-full bg-red-500" /> Desconectado</>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group bg-white/60 dark:bg-black/20 px-4 py-2 rounded-2xl border border-stone-200 dark:border-white/5 shadow-sm">
                        <span className={`text-[13px] font-black uppercase tracking-wider ${agentEnabled ? 'text-violet-600' : 'text-stone-500'}`}>{agentEnabled ? 'Bot General: ON' : 'Bot General: OFF'}</span>
                        <button
                            onClick={() => {
                                const next = !agentEnabled;
                                setAgentEnabled(next);
                                fetch('/api/whatsapp/agent', {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }),
                                });
                            }}
                            className={`w-14 h-7 rounded-full transition-all relative shadow-inner ${agentEnabled ? 'bg-violet-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                        >
                            <div className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${agentEnabled ? 'left-7.5 translate-x-full' : 'translate-x-0.5'}`} />
                        </button>
                    </label>

                    <button
                        onClick={() => { setShowConfig(!showConfig); if (!showConfig) fetchAgent(); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-sm border ${showConfig
                            ? 'bg-violet-600 text-white border-violet-500 shadow-violet-500/20'
                            : 'bg-white/80 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border-white/50 dark:border-white/10 hover:bg-white hover:scale-105'
                            }`}
                    >
                        <Settings className="w-4 h-4" /> Personalidad
                    </button>
                </div>
            </div>

            {/* Panel de Configuración Agente Animado */}
            {showConfig && (
                <div className="border-b border-violet-200/50 dark:border-violet-900/30 bg-white/60 dark:bg-stone-900/60 backdrop-blur-3xl px-8 py-6 flex-shrink-0 animate-in slide-in-from-top-4 fade-in duration-300 z-10 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-xl">
                                <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-widest">Personalidad del Agente</h3>
                                <p className="text-xs text-stone-500">Define las reglas globales de Sol, la IA.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <button onClick={() => setShowConfig(false)} className="p-2 text-stone-400 hover:text-stone-800 bg-black/5 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <textarea
                            value={agentPrompt}
                            onChange={e => setAgentPrompt(e.target.value)}
                            rows={4}
                            placeholder="Escribí las instrucciones base para la IA..."
                            className="w-full px-5 py-4 bg-white/80 dark:bg-black/40 backdrop-blur-md border border-violet-200 dark:border-violet-800/50 rounded-2xl text-sm focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none font-medium text-stone-800 dark:text-stone-200 transition-all shadow-inner"
                        />
                        <button
                            onClick={saveAgent}
                            disabled={saveStatus !== 'idle'}
                            className={`self-end px-6 py-2.5 bg-gradient-to-r ${saveStatus === 'success' ? 'from-emerald-500 to-emerald-600 shadow-emerald-500/30' : 'from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-violet-500/30'} text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 ${saveStatus === 'saving' ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'success' ? '✓ ¡Guardado!' : 'Guardar Personalidad'}
                        </button>
                    </div>
                </div>
            )}

            {!status.connected ? (
                /* ── PANTALLA DE DESCONECTADO PREMIUM ── */
                <div className="flex-1 overflow-y-auto p-4 lg:p-12 flex items-center justify-center">
                    <div className="bg-white/70 dark:bg-stone-900/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 dark:border-white/10 p-12 text-center max-w-lg shadow-2xl">
                        {loadingStatus ? (
                            <div>
                                <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6 shadow-lg shadow-emerald-500/20" />
                                <p className="text-base font-black tracking-tight text-stone-800 dark:text-white">Estableciendo enlace neural...</p>
                            </div>
                        ) : status.qr ? (
                            <div className="animate-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                                    <QrCode className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight mb-2">Vincular Dispositivo</h2>
                                <p className="text-sm text-stone-500 mb-8 font-medium">Escaneá este código usando WhatsApp Web en tu celular.</p>

                                <div className="inline-block bg-white p-5 rounded-3xl shadow-xl border border-stone-100 relative group overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <QRRenderer qr={status.qr} />
                                </div>

                                <button
                                    onClick={fetchStatus}
                                    className="mt-8 px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mx-auto shadow-xl"
                                >
                                    <RefreshCw className="w-4 h-4" /> Recargar QR
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <WifiOff className="w-10 h-10 text-red-500" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight mb-2">Señal Perdida</h2>
                                <p className="text-sm text-stone-500 mb-8 font-medium">El servicio WA-Service no se está comunicando.</p>
                                <button
                                    onClick={fetchStatus}
                                    className="px-8 py-3.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-black transition-all hover:scale-105 shadow-xl flex items-center gap-2 mx-auto"
                                >
                                    <RefreshCw className="w-4 h-4" /> Reintentar Conexión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ── DASHBOARD PREMIUM DE CHATS ── */
                <div className="flex flex-1 min-h-0 overflow-hidden m-4 lg:m-6 gap-6">
                    {/* Lista de Chats (Glassmorphism Sidebar) */}
                    <div className={`w-[360px] bg-white/60 dark:bg-stone-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-white/10 flex flex-col shadow-xl ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Header de Sidebar */}
                        <div className="p-5 border-b border-stone-200/50 dark:border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-black text-stone-800 dark:text-white tracking-tight">
                                    {showArchived ? 'Buzón Archivado' : 'Buzón Activo'}
                                    <span className="ml-2 text-stone-400 font-medium">({filteredChats.length})</span>
                                </h2>
                                <button
                                    onClick={() => { setShowArchived(v => !v); setFilterLabel(null); }}
                                    className={`p-2 rounded-xl transition-all ${showArchived ? 'bg-stone-800 text-white shadow-md' : 'bg-white text-stone-600 shadow-sm hover:shadow-md border border-stone-100'}`}
                                >
                                    {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                </button>
                            </div>
                            {usedLabels.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 pb-hide-scroll">
                                    <button
                                        onClick={() => setFilterLabel(null)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all flex-shrink-0 shadow-sm ${!filterLabel ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
                                    >
                                        Todos
                                    </button>
                                    {usedLabels.map(lbl => (
                                        <button
                                            key={lbl}
                                            onClick={() => setFilterLabel(filterLabel === lbl ? null : lbl)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shadow-sm border ${filterLabel === lbl ? getLabelStyle(lbl) + ' ring-2 ring-violet-500/50 scale-105' : 'bg-white text-stone-600 border-white/50 hover:bg-stone-50'}`}
                                        >
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Listado */}
                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
                            {filteredChats.length === 0 ? (
                                <div className="text-center py-20 px-6">
                                    <div className="w-16 h-16 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <MessageCircle className="w-6 h-6 text-stone-300" />
                                    </div>
                                    <p className="text-sm font-bold text-stone-400">Todo limpio.</p>
                                </div>
                            ) : (
                                filteredChats.map(chat => {
                                    const isSelected = selectedChat?.id === chat.id;
                                    const lastMsg = chat.messages?.[0];
                                    return (
                                        <button
                                            key={chat.id}
                                            onClick={() => selectChat(chat)}
                                            className={`w-full text-left p-3 rounded-2xl transition-all relative border ${isSelected
                                                ? 'bg-white dark:bg-stone-800 border-transparent shadow-lg shadow-black/5 ring-1 ring-stone-900/5 dark:ring-white/10 z-10'
                                                : 'hover:bg-white/50 dark:hover:bg-stone-800/50 border-transparent text-stone-700 dark:text-stone-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 transition-transform ${isSelected ? 'scale-105' : ''} ${chat.botEnabled && isSelected ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30' : (isSelected ? 'bg-emerald-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300')}`}>
                                                        {(chat.profileName || '?')[0].toUpperCase()}
                                                    </div>
                                                    {chat.botEnabled && agentEnabled && !isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-500 rounded-full border-2 border-white flex items-center justify-center">
                                                            <Bot className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-[13px] font-black truncate ${isSelected ? 'text-stone-900 dark:text-white' : ''}`}>
                                                            {chat.client?.name || chat.profileName || chat.waId.replace('@c.us', '')}
                                                        </span>
                                                        {chat.lastMessageAt && (
                                                            <span className="text-[10px] text-stone-400 font-bold shrink-0">
                                                                {format(new Date(chat.lastMessageAt), "HH:mm")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1">
                                                        <p className={`text-[12px] truncate max-w-[80%] ${chat.unreadCount > 0 ? 'font-black text-stone-800 dark:text-white' : 'text-stone-500 dark:text-stone-400 font-medium'}`}>
                                                            {lastMsg ? (
                                                                <>
                                                                    {lastMsg.direction === 'OUTBOUND' && <span className="opacity-50 mr-1">Tú:</span>}
                                                                    {lastMsg.type === 'AUDIO' ? '🎧 Audio' : (lastMsg.type === 'IMAGE' ? '📷 Imagen' : lastMsg.content)}
                                                                </>
                                                            ) : '...'}
                                                        </p>
                                                        {chat.unreadCount > 0 && (
                                                            <span className="w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse shadow-sm shadow-emerald-500/40">
                                                                {chat.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Chat Abierto */}
                    <div className="flex-1 bg-white/60 dark:bg-stone-900/60 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-white/10 shadow-xl overflow-hidden flex flex-col">
                        {selectedChat ? (
                            <>
                                {/* Cabecera del Chat */}
                                <div className="px-6 py-4 bg-white/80 dark:bg-black/20 backdrop-blur-md border-b border-stone-200/50 dark:border-white/5 flex items-center justify-between shrink-0 z-10 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setSelectedChat(null)} className="lg:hidden p-2 rounded-xl bg-white shadow-sm border border-stone-100">
                                            <ChevronLeft className="w-5 h-5 text-stone-600" />
                                        </button>
                                        <div className="w-12 h-12 rounded-2xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center text-lg font-black shrink-0 shadow-lg relative">
                                            {(selectedChat.client?.name || selectedChat.profileName || '?')[0].toUpperCase()}
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                                                {selectedChat.client?.name || selectedChat.profileName}
                                                {selectedChat.client && (
                                                    <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[9px] font-black tracking-widest uppercase text-stone-500">CRM</span>
                                                )}
                                            </h3>
                                            <p className="text-[11px] font-bold text-stone-500 flex items-center gap-1.5 mt-0.5">
                                                <Phone className="w-3 h-3" /> {selectedChat.waId.replace('@c.us', '')}
                                                {selectedChat.client && (
                                                    <a 
                                                        href={`/contactos?id=${selectedChat.client.id}`}
                                                        className="ml-2 px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg text-[9px] uppercase tracking-widest font-black transition-all shadow-sm active:scale-95"
                                                    >
                                                        Abrir Ficha de Cliente
                                                    </a>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {(selectedChat.chatLabels || []).length > 0 && (
                                            <div className="hidden md:flex flex-wrap gap-1 mr-4 border-r border-stone-200 pr-4">
                                                {selectedChat.chatLabels.map(lbl => (
                                                    <span key={lbl} className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getLabelStyle(lbl)}`}>{lbl}</span>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div className="relative">
                                            <button onClick={() => setShowLabelPicker(v => !v)} className="p-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 rounded-xl transition-all shadow-sm">
                                                <Tag className="w-4 h-4 text-stone-600" />
                                            </button>
                                            {showLabelPicker && (
                                                <div className="absolute right-0 top-12 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200/50 dark:border-white/10 rounded-2xl shadow-2xl z-50 w-48 p-2">
                                                    {CHAT_LABEL_OPTIONS.map(opt => {
                                                        const active = (selectedChat.chatLabels || []).includes(opt.label);
                                                        return (
                                                            <button key={opt.label} onClick={() => toggleLabel(opt.label)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all mb-1 last:mb-0 ${active ? opt.color : 'text-stone-600 hover:bg-stone-100'}`}>
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={() => { updateChat(selectedChat.id, { archived: !selectedChat.archived }); setSelectedChat(null); }} className="p-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 rounded-xl transition-all shadow-sm">
                                            {selectedChat.archived ? <ArchiveRestore className="w-4 h-4 text-stone-600" /> : <Archive className="w-4 h-4 text-stone-600" />}
                                        </button>

                                        <div className="w-px h-8 bg-stone-200 dark:bg-stone-700 mx-1" />

                                        <button onClick={() => toggleBot(selectedChat.id, !selectedChat.botEnabled)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm ${selectedChat.botEnabled ? 'bg-violet-100 text-violet-700 border-violet-200 hover:bg-red-50 hover:text-red-600' : 'bg-stone-100 text-stone-500 hover:bg-violet-500 hover:text-white'}`}>
                                            {selectedChat.botEnabled ? <><Bot className="w-4 h-4" /> IA ON</> : <><Bot className="w-4 h-4 opacity-50" /> IA OFF</>}
                                        </button>
                                    </div>
                                </div>

                                {/* Conversación (Burbujas Premium) */}
                                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 bg-gradient-to-b from-transparent to-stone-50/50 dark:from-transparent dark:to-stone-950/20 custom-scrollbar-smooth">
                                    {messages.map(msg => {
                                        const isOut = msg.direction === 'OUTBOUND';
                                        return (
                                            <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                                                <div className="flex gap-2 max-w-[80%] items-end">
                                                    {!isOut && (
                                                        <div className="w-6 h-6 rounded-full bg-stone-200 flex-shrink-0 flex items-center justify-center text-[9px] font-black text-stone-500 self-end mb-1">
                                                            {selectedChat.profileName?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    
                                                    <div className={`px-5 py-3.5 shadow-sm relative group overflow-hidden ${isOut ? 'bg-emerald-500 text-white rounded-[24px] rounded-br-sm shadow-emerald-500/10' : 'bg-white/90 dark:bg-stone-800/90 backdrop-blur-xl text-stone-800 dark:text-stone-100 rounded-[24px] rounded-bl-sm border border-stone-200/50 dark:border-white/5'}`}>
                                                        
                                                        {/* RENDERIZADO DE MEDIOS */}
                                                        {msg.mediaUrl && msg.type === 'AUDIO' && (
                                                            <div className="mb-2 bg-black/5 dark:bg-white/5 p-2 rounded-2xl flex items-center border border-black/5">
                                                                <Mic className="w-5 h-5 opacity-50 mr-2 shrink-0" />
                                                                <audio controls src={msg.mediaUrl} className="h-10 w-48 ouline-none filter drop-shadow-sm" preload="metadata" />
                                                            </div>
                                                        )}
                                                        {msg.mediaUrl && msg.type === 'IMAGE' && (
                                                            <div className="mb-2 overflow-hidden rounded-xl border border-black/5">
                                                                <img src={msg.mediaUrl} alt="📸" className="max-w-full max-h-64 object-contain" />
                                                            </div>
                                                        )}
                                                        {msg.mediaUrl && msg.type === 'VIDEO' && (
                                                            <div className="mb-2 overflow-hidden rounded-xl border border-black/5">
                                                                <video controls src={msg.mediaUrl} className="max-w-full max-h-64 object-contain rounded-xl" />
                                                            </div>
                                                        )}

                                                        <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-all">{msg.content}</p>
                                                        
                                                        <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold ${isOut ? 'text-emerald-100 justify-end' : 'text-stone-400'}`}>
                                                            <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                                                            {isOut && <CheckCircle2 className="w-3 h-3" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} className="h-4" />
                                </div>

                                {/* Zona de Escritura Premium */}
                                <div className="p-4 bg-white/80 dark:bg-stone-900/80 backdrop-blur-2xl border-t border-stone-200/50 dark:border-white/10 shrink-0">
                                    
                                    {showQuickReplies && (
                                        <div className="mb-4 bg-stone-50 dark:bg-stone-800 rounded-3xl p-4 border border-stone-200/50 shadow-inner max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2">
                                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3">Escudos de Respuesta</p>
                                            <div className="flex flex-wrap gap-2">
                                                {QUICK_REPLIES.map(qr => (
                                                    <button key={qr.label} onClick={() => { setNewMessage(qr.text); setShowQuickReplies(false); }} className="px-4 py-2 bg-white dark:bg-stone-700 rounded-xl shadow-sm hover:shadow-md border border-stone-200 dark:border-stone-600 transition-all text-left group">
                                                        <span className="block text-[11px] font-black text-stone-800 dark:text-white uppercase tracking-wider">{qr.label}</span>
                                                        <span className="block text-xs text-stone-500 truncate max-w-[200px] mt-0.5 group-hover:text-stone-700">{qr.text}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedImage && (
                                        <div className="mb-4 inline-flex items-center gap-3 p-2 pr-4 bg-stone-100 rounded-2xl border border-stone-200 animate-in slide-in-from-bottom-2">
                                            <div className="relative">
                                                <img src={`data:${selectedImage.mimetype};base64,${selectedImage.base64}`} alt="preview" className="h-14 w-14 object-cover rounded-xl" />
                                                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center shadow-lg"><X className="w-3 h-3" /></button>
                                            </div>
                                            <span className="text-xs font-bold text-stone-600">Adjunto listo</span>
                                        </div>
                                    )}

                                    <div className="flex items-end gap-3 max-w-[1200px] mx-auto">
                                        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-3xl p-1.5 shadow-inner">
                                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-stone-500 hover:bg-white hover:text-stone-900 rounded-2xl transition-all shadow-sm">
                                                <ImageIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setShowQuickReplies(v => !v)} className={`p-3 rounded-2xl transition-all shadow-sm ${showQuickReplies ? 'bg-indigo-100 text-indigo-600' : 'text-stone-500 hover:bg-white hover:text-indigo-600'}`}>
                                                <Bot className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="flex-1 bg-white dark:bg-stone-800 border-[3px] border-stone-100 dark:border-stone-700 rounded-[2rem] flex items-center px-6 shadow-sm focus-within:border-emerald-200 dark:focus-within:border-emerald-900/50 transition-colors">
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                                placeholder="Escribe tu mensaje a mano..."
                                                className="w-full py-4 bg-transparent outline-none text-[15px] font-medium text-stone-800 dark:text-white placeholder:text-stone-400"
                                            />
                                        </div>

                                        <button
                                            onClick={sendMessage}
                                            disabled={(!newMessage.trim() && !selectedImage) || sending}
                                            className="h-14 w-14 bg-red-500 hover:bg-black text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-red-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shrink-0"
                                        >
                                            <Send className="w-6 h-6 ml-1" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-70">
                                <div className="w-32 h-32 bg-gradient-to-br from-stone-100 to-white dark:from-stone-800 dark:to-stone-900 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-black/5 hover:scale-105 transition-transform duration-500">
                                    <MessageCircle className="w-12 h-12 text-stone-300 dark:text-stone-600" />
                                </div>
                                <h2 className="text-2xl font-black text-stone-400 dark:text-stone-500">Buzón Atelier</h2>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}

// ── QR Renderer ───────────────────────────────────
function QRRenderer({ qr }: { qr: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!qr || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, qr, {
            width: 280, margin: 2,
            color: { dark: '#1c1917', light: '#ffffff' }
        });
    }, [qr]);
    return <canvas ref={canvasRef} className="mx-auto rounded-[2rem] shadow-sm" />;
}
