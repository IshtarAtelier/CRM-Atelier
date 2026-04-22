'use client';

import QRCode from 'qrcode';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle, Send, Wifi, WifiOff, QrCode, RefreshCw, User,
    Clock, CheckCircle2, Bot, Settings, X, ChevronLeft, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────
interface Chat {
    id: string;
    waId: string;
    profileName: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string;
    botEnabled: boolean;
    client?: { id: string; name: string; phone: string; status: string } | null;
    messages?: Message[];
}

interface Message {
    id: string;
    chatId: string;
    direction: string; // INBOUND | OUTBOUND
    type: string;
    content: string;
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
    const [loadingStatus, setLoadingStatus] = useState(true);
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
            setChats(Array.isArray(data) ? data : []);
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
        try {
            await fetch('/api/whatsapp/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: agentPrompt, enabled: agentEnabled }),
            });
        } catch { }
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
        await fetchMessages(chat.id);
    };

    // ── Send ──────────────────────────────────────
    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedChat || sending) return;
        setSending(true);
        try {
            await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: selectedChat.id, message: newMessage }),
            });
            setNewMessage('');
            await fetchMessages(selectedChat.id);
        } catch (e) {
            console.error('Error enviando:', e);
        }
        setSending(false);
    };

    // ── Toggle Bot per Chat ──────────────────────
    const toggleBot = async (chatId: string, enabled: boolean) => {
        try {
            await fetch(`/api/whatsapp/chats/${chatId}/bot-toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            // Update local state
            if (selectedChat?.id === chatId) {
                setSelectedChat({ ...selectedChat, botEnabled: enabled });
            }
            setChats(chats.map(c => c.id === chatId ? { ...c, botEnabled: enabled } : c));
        } catch (e) {
            console.error('Error al togglear bot:', e);
        }
    };

    // ═══════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════

    // ── QR / Connection Screen ────────────────────
    if (!status.connected) {
        return (
            <main className="p-4 lg:p-8 max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-stone-800 dark:text-white tracking-tight flex items-center justify-center gap-3">
                        <MessageCircle className="w-9 h-9 text-emerald-500" /> WhatsApp
                    </h1>
                    <p className="text-stone-400 text-sm mt-1">Conectá tu WhatsApp escaneando el código QR</p>
                </div>

                <div className="bg-white dark:bg-stone-800 rounded-3xl border-2 border-stone-100 dark:border-stone-700 p-12 text-center max-w-lg mx-auto">
                    {loadingStatus ? (
                        <div>
                            <div className="w-12 h-12 border-4 border-stone-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm font-bold text-stone-400">Conectando con servidor WhatsApp...</p>
                            <p className="text-xs text-stone-300 mt-2">Asegurate de que el servidor esté corriendo: <code className="bg-stone-100 dark:bg-stone-700 px-2 py-0.5 rounded">node whatsapp-server.js</code></p>
                        </div>
                    ) : status.qr ? (
                        <div>
                            <QrCode className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-black text-stone-800 dark:text-white mb-2">Escaneá el código QR</h2>
                            <p className="text-sm text-stone-400 mb-6">Abrí WhatsApp en tu celular → Menú → Dispositivos vinculados → Vincular</p>

                            {/* QR Code rendered as text grid */}
                            <div className="inline-block bg-white p-4 rounded-2xl shadow-lg">
                                <QRRenderer qr={status.qr} />
                            </div>

                            <button
                                onClick={fetchStatus}
                                className="mt-6 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all flex items-center gap-2 mx-auto"
                            >
                                <RefreshCw className="w-4 h-4" /> Actualizar QR
                            </button>
                        </div>
                    ) : (
                        <div>
                            <WifiOff className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                            <h2 className="text-xl font-black text-stone-800 dark:text-white mb-2">Servidor no encontrado</h2>
                            <p className="text-sm text-stone-400 mb-4">El servidor de WhatsApp no está corriendo.</p>
                            <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl p-4 text-left text-sm">
                                <p className="font-bold text-stone-600 dark:text-stone-300 mb-2">Para iniciar:</p>
                                <code className="block bg-stone-900 dark:bg-stone-950 text-emerald-400 p-3 rounded-xl text-xs font-mono">
                                    node whatsapp-server.js
                                </code>
                            </div>
                            <button
                                onClick={fetchStatus}
                                className="mt-6 px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl font-bold text-sm hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                            >
                                <RefreshCw className="w-4 h-4" /> Reintentar
                            </button>
                        </div>
                    )}
                </div>
            </main>
        );
    }

    // ── Connected: Chat Interface ─────────────────
    return (
        <main className="h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <MessageCircle className="w-7 h-7 text-emerald-500" />
                    <h1 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight">WhatsApp</h1>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold">
                        <Wifi className="w-3 h-3" />
                        {status.phone || 'Conectado'}
                    </div>
                    {chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
                        <span className="px-2.5 py-0.5 bg-red-500 text-white rounded-full text-xs font-black animate-pulse">
                            {chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0)} nuevos
                        </span>
                    )}
                </div>
                <button
                    onClick={() => { setShowConfig(!showConfig); if (!showConfig) fetchAgent(); }}
                    className={`p-2.5 rounded-xl transition-all ${showConfig
                        ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900'
                        : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:bg-stone-200'
                        }`}
                    title="Configurar agente"
                >
                    <Bot className="w-5 h-5" />
                </button>
            </div>

            {/* Agent Config Panel */}
            {showConfig && (
                <div className="border-b-2 border-stone-100 dark:border-stone-700 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 px-6 py-5 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-violet-500" />
                            <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-widest">Agente de Ventas IA</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-xs font-bold text-stone-500">{agentEnabled ? 'Activado' : 'Desactivado'}</span>
                                <button
                                    onClick={() => {
                                        const next = !agentEnabled;
                                        setAgentEnabled(next);
                                        fetch('/api/whatsapp/agent', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ enabled: next }),
                                        });
                                    }}
                                    className={`w-12 h-6 rounded-full transition-all relative ${agentEnabled ? 'bg-violet-500' : 'bg-stone-300'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${agentEnabled ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </label>
                            <button onClick={() => setShowConfig(false)} className="p-1 text-stone-400 hover:text-stone-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={agentPrompt}
                        onChange={e => setAgentPrompt(e.target.value)}
                        onBlur={saveAgent}
                        rows={4}
                        placeholder="Escribí las instrucciones para el agente de ventas... Ej: 'Eres un asistente de Atelier Óptica, responde consultas sobre lentes y marcos...'"
                        className="w-full px-4 py-3 bg-white dark:bg-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none font-medium"
                    />
                    <p className="text-[10px] text-stone-400 mt-2 font-bold uppercase tracking-widest">
                        📝 El prompt se guarda automáticamente. Cuando conectes un modelo de IA, el agente usará estas instrucciones.
                    </p>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex flex-1 min-h-0">
                {/* Chat List */}
                <div className={`w-80 border-r-2 border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 flex flex-col flex-shrink-0 ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-stone-100 dark:border-stone-700">
                        <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                            Conversaciones ({chats.length})
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {chats.length === 0 ? (
                            <div className="text-center py-16 px-6">
                                <MessageCircle className="w-12 h-12 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
                                <p className="text-xs font-bold text-stone-300 dark:text-stone-600">No hay conversaciones aún</p>
                                <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1">Las conversaciones aparecerán cuando un cliente escriba</p>
                            </div>
                        ) : (
                            chats.map(chat => {
                                const isSelected = selectedChat?.id === chat.id;
                                const lastMsg = chat.messages?.[0];
                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => selectChat(chat)}
                                        className={`w-full text-left px-4 py-3.5 border-b border-stone-50 dark:border-stone-700/50 transition-all ${isSelected
                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500'
                                            : 'hover:bg-stone-50 dark:hover:bg-stone-700/50 border-l-4 border-l-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black ${isSelected
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-stone-100 dark:bg-stone-600 text-stone-500 dark:text-stone-300'
                                                }`}>
                                                {(chat.profileName || '?')[0].toUpperCase()}
                                                {chat.botEnabled && agentEnabled && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-violet-500 rounded-full border-2 border-white flex items-center justify-center">
                                                        <Bot className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold text-stone-800 dark:text-white truncate">
                                                        {chat.client?.name || chat.profileName || chat.waId.replace('@c.us', '')}
                                                    </span>
                                                    {chat.unreadCount > 0 && (
                                                        <span className="w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                                            {chat.unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-stone-400 truncate mt-0.5">
                                                    {lastMsg ? (lastMsg.direction === 'OUTBOUND' ? '✓ ' : '') + lastMsg.content.substring(0, 50) : 'Sin mensajes'}
                                                </p>
                                                {chat.lastMessageAt && (
                                                    <p className="text-[10px] text-stone-300 mt-1">
                                                        {format(new Date(chat.lastMessageAt), "d MMM HH:mm", { locale: es })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Message Area */}
                <div className="flex-1 flex flex-col bg-stone-50 dark:bg-stone-900 min-h-0">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-6 py-3.5 bg-white dark:bg-stone-800 border-b border-stone-100 dark:border-stone-700 flex items-center gap-4 flex-shrink-0">
                                <button
                                    onClick={() => setSelectedChat(null)}
                                    className="lg:hidden p-1 text-stone-400 hover:text-stone-600"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black flex-shrink-0">
                                    {(selectedChat.profileName || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black text-stone-800 dark:text-white truncate">
                                        {selectedChat.client?.name || selectedChat.profileName}
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold">
                                        <Phone className="w-3 h-3" />
                                        {selectedChat.waId.replace('@c.us', '')}
                                        {selectedChat.client && (
                                            <>
                                                <span>·</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${selectedChat.client.status === 'CLIENT'
                                                    ? 'bg-emerald-100 text-emerald-600'
                                                    : selectedChat.client.status === 'CONFIRMED'
                                                        ? 'bg-blue-100 text-blue-600'
                                                        : 'bg-stone-100 text-stone-500'
                                                    }`}>
                                                    {selectedChat.client.status === 'CLIENT' ? 'Cliente' : selectedChat.client.status === 'CONFIRMED' ? 'Confirmado' : 'Contacto'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Bot Status & Toggle */}
                                {agentEnabled && (
                                    <div className="flex items-center gap-3">
                                        {!selectedChat.botEnabled ? (
                                            <button
                                                onClick={() => toggleBot(selectedChat.id, true)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-600 rounded-xl text-xs font-black transition-all"
                                            >
                                                <Bot className="w-3.5 h-3.5" />
                                                Reactivar IA
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                <Bot className="w-3.5 h-3.5" />
                                                IA Atendiendo
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                                {messages.length === 0 ? (
                                    <div className="text-center py-16">
                                        <MessageCircle className="w-10 h-10 text-stone-200 dark:text-stone-700 mx-auto mb-2" />
                                        <p className="text-xs text-stone-300 font-bold">Cargando mensajes...</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${msg.direction === 'OUTBOUND'
                                                    ? 'bg-emerald-500 text-white rounded-br-md'
                                                    : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-white border border-stone-100 dark:border-stone-700 rounded-bl-md'
                                                    }`}
                                            >
                                                <p className="text-sm font-medium whitespace-pre-wrap break-words">{msg.content}</p>
                                                <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'OUTBOUND' ? 'justify-end' : ''}`}>
                                                    <span className={`text-[10px] ${msg.direction === 'OUTBOUND' ? 'text-emerald-200' : 'text-stone-300'}`}>
                                                        {format(new Date(msg.createdAt), "HH:mm", { locale: es })}
                                                    </span>
                                                    {msg.direction === 'OUTBOUND' && (
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="px-6 py-4 bg-white dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        placeholder="Escribí un mensaje..."
                                        className="flex-1 px-4 py-3 bg-stone-50 dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!newMessage.trim() || sending}
                                        className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto mb-4">
                                    <MessageCircle className="w-12 h-12 text-emerald-500" />
                                </div>
                                <h2 className="text-xl font-black text-stone-800 dark:text-white mb-1">WhatsApp Inbox</h2>
                                <p className="text-sm text-stone-400">Seleccioná una conversación para comenzar</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}


// ── QR Renderer Component ─────────────────────────
function QRRenderer({ qr }: { qr: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!qr || !canvasRef.current) return;

        const renderQR = async () => {
            try {
                await QRCode.toCanvas(canvasRef.current, qr, {
                    width: 256,
                    margin: 2,
                    color: {
                        dark: '#1c1917',
                        light: '#ffffff'
                    }
                });
            } catch (e) {
                console.error('QR render error:', e);
            }
        };

        renderQR();
    }, [qr]);

    return (
        <div className="text-center flex flex-col items-center justify-center">
            <canvas ref={canvasRef} className="mx-auto rounded-xl shadow-sm border border-stone-100" />
            <p className="text-[10px] text-stone-400 mt-4 font-bold">
                💡 Escaneá este código con tu celular
            </p>
        </div>
    );
}
