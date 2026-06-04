'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TeamMessage {
    id: string;
    sender: string;
    content: string;
    createdAt: string;
}

export default function TeamChatPage() {
    const [messages, setMessages] = useState<TeamMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sender, setSender] = useState<'ISHTAR' | 'MATIAS'>('ISHTAR');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        try {
            const res = await fetch('/api/equipo/mensajes');
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                scrollToBottom();
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            const res = await fetch('/api/equipo/mensajes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newMessage, sender })
            });
            if (res.ok) {
                setNewMessage('');
                await fetchMessages();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6 bg-white dark:bg-stone-800 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight">Chat Interno</h1>
                    <p className="text-sm text-stone-500">Los mensajes se enviarán automáticamente por WhatsApp.</p>
                </div>
                <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-900 p-1.5 rounded-xl">
                    <button
                        onClick={() => setSender('ISHTAR')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${sender === 'ISHTAR' ? 'bg-primary text-white shadow-md' : 'text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800'}`}
                    >
                        Ishtar
                    </button>
                    <button
                        onClick={() => setSender('MATIAS')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${sender === 'MATIAS' ? 'bg-stone-800 text-white shadow-md' : 'text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800'}`}
                    >
                        Matías
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-stone-800 rounded-3xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-stone-400">
                            <Bot className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm font-medium">No hay mensajes aún.</p>
                            <p className="text-xs">Inicia la conversación para probar el enrutamiento.</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.sender === sender;
                            const isSystem = msg.sender === 'SYSTEM';

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-4 ${
                                        isSystem ? 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 w-full text-center' :
                                        isMe ? 'bg-primary text-white shadow-md rounded-br-none' : 
                                        'bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-bl-none'
                                    }`}>
                                        {!isMe && !isSystem && (
                                            <div className="flex items-center gap-1 mb-1 opacity-70">
                                                <User className="w-3 h-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{msg.sender}</span>
                                            </div>
                                        )}
                                        {isSystem && (
                                            <div className="flex justify-center items-center gap-1 mb-2 opacity-50">
                                                <Bot className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">SISTEMA</span>
                                            </div>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <div className={`flex items-center gap-1 mt-2 ${isMe ? 'text-primary-100' : 'text-stone-400'} text-[9px] font-medium justify-end`}>
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(msg.createdAt), "HH:mm", { locale: es })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={`Escribir como ${sender === 'ISHTAR' ? 'Ishtar' : 'Matías'}...`}
                            className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            disabled={isSending}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || isSending}
                            className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6 py-3 flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4" />
                            Enviar
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
