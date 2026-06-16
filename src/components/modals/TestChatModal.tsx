'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, Paperclip, ChevronDown, ChevronRight, AlertTriangle, ShieldAlert, Wrench } from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'ai' | 'system';
    content: string;
    blocks?: string[];
    mediaBase64?: string;
    mediaMime?: string;
    mediaType?: 'image' | 'audio';
    toolCalls?: { name: string; args?: any }[];
    guardrailBlocked?: boolean;
    silentShutdown?: boolean;
    apiError?: boolean;
    reason?: string;
}

interface TestChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function TestChatModal({ isOpen, onClose }: TestChatModalProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'ai', content: 'Hola! Soy Matías de Atelier Óptica, contame qué estás necesitando.', blocks: ['Hola! Soy Matías de Atelier Óptica, contame qué estás necesitando.'] }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{base64: string, mime: string, url: string, type: 'image' | 'audio'} | null>(null);
    const [showTools, setShowTools] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isAudio = file.type.startsWith('audio/');
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64 = result.split(',')[1];
            setSelectedFile({ base64, mime: file.type, url: URL.createObjectURL(file), type: isAudio ? 'audio' : 'image' });
        };
        reader.readAsDataURL(file);
    };

    const handleSend = async () => {
        if ((!input.trim() && !selectedFile) || isTyping) return;
        
        const newUserMsg: ChatMessage = { 
            role: 'user', 
            content: input.trim() || (selectedFile?.type === 'audio' ? '[Audio adjunto]' : '[Imagen adjunta]'), 
            mediaBase64: selectedFile?.base64, 
            mediaMime: selectedFile?.mime,
            mediaType: selectedFile?.type
        };
        const newMessages = [...messages, newUserMsg];
        setMessages(newMessages);
        setInput('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsTyping(true);

        try {
            // Enviar solo el último mensaje con media, los anteriores sin base64
            const apiMessages = newMessages.map((m, idx) => {
                if (idx === newMessages.length - 1) return { role: m.role, content: m.content, mediaBase64: m.mediaBase64, mediaMime: m.mediaMime, mediaType: m.mediaType };
                return { role: m.role, content: m.content };
            });

            const res = await fetch('/api/whatsapp/test-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages })
            });
            
            const data = await res.json();
            
            if (data.silentShutdown) {
                setMessages(prev => [...prev, { 
                    role: 'system', 
                    content: `⚠️ Bot desactivado silenciosamente — ${data.reason || 'Chat personal detectado'}`,
                    silentShutdown: true,
                    toolCalls: data.toolCalls
                }]);
            } else if (data.apiError) {
                setMessages(prev => [...prev, { 
                    role: 'system', 
                    content: `🚨 Error de API — Bot se apagó en silencio`,
                    apiError: true,
                    reason: data.reason,
                    toolCalls: data.toolCalls
                }]);
            } else if (res.ok && data.response) {
                const aiMsg: ChatMessage = {
                    role: 'ai',
                    content: data.response,
                    blocks: data.blocks || [data.response],
                    toolCalls: data.toolCalls,
                    guardrailBlocked: data.guardrailBlocked,
                };
                setMessages(prev => [...prev, aiMsg]);
            } else {
                setMessages(prev => [...prev, { role: 'ai', content: 'Dejame revisarlo bien y en un ratito te respondo.', blocks: ['Dejame revisarlo bien y en un ratito te respondo.'] }]);
            }
        } catch (_e) {
            setMessages(prev => [...prev, { role: 'ai', content: 'Dejame revisarlo bien y en un ratito te respondo.', blocks: ['Dejame revisarlo bien y en un ratito te respondo.'] }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} />
            <div className="relative w-full max-w-md h-[600px] max-h-[85vh] bg-stone-100 dark:bg-stone-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-stone-200 dark:border-stone-800 animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl border-b border-stone-200 dark:border-stone-800 px-4 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center relative shadow-inner">
                            <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-stone-900" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">Matías - Atelier Óptica</h3>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Simulador · Réplica exacta</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-stone-500" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center dark:bg-blend-multiply dark:bg-stone-900">
                    {messages.map((msg, idx) => {
                        // System messages (shutdown, errors)
                        if (msg.role === 'system') {
                            return (
                                <div key={idx} className="flex justify-center my-2">
                                    <div className="bg-amber-100/90 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-xs px-4 py-2 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-2 shadow-sm">
                                        {msg.silentShutdown && <AlertTriangle className="w-3.5 h-3.5" />}
                                        {msg.apiError && <ShieldAlert className="w-3.5 h-3.5" />}
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        }

                        // User messages
                        if (msg.role === 'user') {
                            return (
                                <div key={idx} className="flex justify-end">
                                    <div className="max-w-[80%] rounded-2xl px-4 py-2 shadow-sm bg-emerald-500 text-white rounded-tr-sm">
                                        {msg.mediaBase64 && msg.mediaType !== 'audio' && (
                                            <img src={`data:${msg.mediaMime};base64,${msg.mediaBase64}`} alt="Adjunto" className="w-full max-w-[200px] rounded-lg mb-2" />
                                        )}
                                        {msg.mediaType === 'audio' && (
                                            <div className="flex items-center gap-2 mb-1 bg-emerald-600/50 rounded-lg px-3 py-1.5">
                                                <span className="text-xs">🎙️ Audio adjunto</span>
                                            </div>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            );
                        }

                        // AI messages — render each block as separate bubble (igual que WhatsApp real)
                        const blocks = msg.blocks || [msg.content];
                        return (
                            <div key={idx} className="space-y-1">
                                {blocks.map((block, bIdx) => (
                                    <div key={bIdx} className="flex justify-start">
                                        <div className="max-w-[80%] rounded-2xl px-4 py-2 shadow-sm bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-sm border border-stone-100 dark:border-stone-700">
                                            <p className="text-sm whitespace-pre-wrap">{block}</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Guardrail blocked indicator */}
                                {msg.guardrailBlocked && (
                                    <div className="flex justify-center">
                                        <span className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 px-3 py-1 rounded-full">🛡️ Guardrail bloqueó la respuesta original</span>
                                    </div>
                                )}

                                {/* Tool calls debug - collapsible */}
                                {msg.toolCalls && msg.toolCalls.length > 0 && (
                                    <div className="ml-2">
                                        <button 
                                            onClick={() => setShowTools(showTools === idx ? null : idx)}
                                            className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-600 dark:hover:text-stone-500 transition-colors"
                                        >
                                            {showTools === idx ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            <Wrench className="w-3 h-3" />
                                            {msg.toolCalls.length} herramienta{msg.toolCalls.length > 1 ? 's' : ''}
                                        </button>
                                        {showTools === idx && (
                                            <div className="mt-1 bg-stone-800/90 text-stone-500 rounded-lg px-3 py-2 text-xs font-mono space-y-0.5">
                                                {msg.toolCalls.map((tc, tIdx) => (
                                                    <div key={tIdx}>→ {tc.name}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-stone-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-stone-100 dark:border-stone-700 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 p-3 shrink-0">
                    {selectedFile && (
                        <div className="mb-3 flex items-center gap-3 bg-stone-100 dark:bg-stone-800 p-2 rounded-xl relative w-fit">
                            {selectedFile.type === 'image' ? (
                                <img src={selectedFile.url} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                                    <span className="text-lg">🎙️</span>
                                </div>
                            )}
                            <button 
                                type="button"
                                onClick={() => {
                                    setSelectedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="absolute -top-2 -right-2 bg-stone-200 dark:bg-stone-700 rounded-full p-1 hover:bg-stone-300 dark:hover:bg-stone-600"
                            >
                                <X className="w-3 h-3 text-stone-600 dark:text-stone-500" />
                            </button>
                        </div>
                    )}
                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex items-center gap-2"
                    >
                        <input type="file" accept="image/*,audio/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors shrink-0">
                            <Paperclip className="w-5 h-5 text-stone-500" />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe un mensaje de prueba..."
                            className="flex-1 bg-stone-100 dark:bg-stone-800 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-emerald-500 dark:text-white"
                        />
                        <button 
                            type="submit" 
                            disabled={(!input.trim() && !selectedFile) || isTyping}
                            className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shrink-0 shadow-md"
                        >
                            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}
