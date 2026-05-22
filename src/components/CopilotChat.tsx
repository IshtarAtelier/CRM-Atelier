'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, Bot, User, Minimize2 } from 'lucide-react';

interface CopilotChatProps {
  userName?: string;
  userRole?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function CopilotChat({ userName = 'Usuario', userRole = 'STAFF' }: CopilotChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Ctrl+J / Cmd+J shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setHasInteracted(true);
    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: newMessages.slice(-10), // Last 10 messages for context
        }),
      });

      const data = await res.json();
      if (res.ok && data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ No pude procesar tu consulta. Intentá de nuevo.',
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Error de conexión. Verificá tu red e intentá de nuevo.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = userRole === 'ADMIN'
    ? ['Cuánto facturamos este mes?', 'Saldos pendientes', 'Ranking de vendedores']
    : ['Saldo de un cliente', 'Estado de pedido', 'Cuánto vendí hoy?'];

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-4 md:bottom-8 md:right-8 z-[90] w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/25 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        title="Copilot (Ctrl+J)"
        id="copilot-fab"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat Panel */}
      <div className={`fixed bottom-6 right-6 z-[95] w-[420px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'}`}>
        <div className="h-[560px] max-h-[80vh] bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/20 border border-stone-200/80 dark:border-stone-700/80 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Copilot</h3>
                <p className="text-[10px] text-white/70 font-medium">
                  {userRole === 'ADMIN' ? 'Acceso completo' : 'Consultas operativas'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="hidden md:inline px-1.5 py-0.5 bg-white/15 rounded text-[9px] font-bold text-white/60 border border-white/20">
                ⌘J
              </kbd>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/15 rounded-xl transition-colors"
              >
                <Minimize2 className="w-4 h-4 text-white/80" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Welcome state */}
            {!hasInteracted && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-violet-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
                    Hola {userName.split(' ')[0]} 👋
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                    Preguntame lo que necesites
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2 px-4">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(s);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-medium rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 transition-all border border-stone-200 dark:border-stone-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-violet-100 dark:bg-violet-900/50'
                      : 'bg-stone-100 dark:bg-stone-800'
                  }`}>
                    {msg.role === 'user'
                      ? <User className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      : <Sparkles className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                    }
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-md'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-bl-md border border-stone-200 dark:border-stone-700'
                  }`}>
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                  </div>
                  <div className="bg-stone-100 dark:bg-stone-800 rounded-2xl rounded-bl-md px-4 py-3 border border-stone-200 dark:border-stone-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 px-4 py-3 shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Preguntá algo..."
                className="flex-1 bg-stone-100 dark:bg-stone-800 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none"
                id="copilot-input"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-40 disabled:shadow-none transition-all shrink-0"
                id="copilot-send"
              >
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
