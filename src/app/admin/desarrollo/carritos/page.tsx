"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ShoppingCart, MessageCircle, AlertCircle, Clock, Trash2, Mail, CheckCircle2, Loader2 } from "lucide-react";

export default function CarritosAbandonadosPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<Set<string>>(new Set());

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/session");
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRetomar = async (session: any) => {
    const phone = session.phone?.replace(/\D/g, "");
    if (!phone) {
      alert("El cliente no ingresó un teléfono válido.");
      return;
    }
    
    // Construct WhatsApp Message
    const name = session.firstName || "Hola";
    const items = session.cartData ? session.cartData.map((item: any) => item.model).join(', ') : 'los anteojos';
    const message = `¡Hola ${name}! Somos de Atelier Óptica. Vimos que dejaste en tu carrito ${items}. ¿Tuviste algún problema con el pago o necesitás ayuda con algo? ¡Avisanos y te damos una mano!`;
    
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");

    // Marcar como recuperado (opcional, en una futura iteración)
    try {
      await fetch('/api/checkout/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, status: 'RECOVERED' })
      });
      fetchSessions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendEmail = async (session: any) => {
    if (!session.email) {
      alert("El cliente no tiene email registrado.");
      return;
    }

    setEmailSending(session.id);
    try {
      const res = await fetch('/api/checkout/recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      });
      const data = await res.json();
      if (data.success) {
        setEmailSent(prev => new Set(prev).add(session.id));
        // Brief success indicator then refresh
        setTimeout(() => fetchSessions(), 1500);
      } else {
        alert(data.error || 'Error al enviar el email');
      }
    } catch (e) {
      console.error(e);
      alert('Error al enviar el email');
    } finally {
      setEmailSending(null);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="w-full lg:w-auto">
          <h1 className="text-2xl lg:text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">
            Carritos <span className="text-amber-500 not-italic border-b-4 border-amber-500/30">Abandonados</span>
          </h1>
          <p className="text-stone-400 mt-1 font-medium uppercase text-[8px] lg:text-[10px] tracking-[0.2em]">
            Recuperación de ventas perdidas
          </p>
        </div>
      </header>

      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-100 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="hidden lg:block overflow-x-auto">
          <div className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr_180px] gap-4 px-6 py-3 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800 items-center">
            {['Fecha', 'Cliente', 'Carrito', 'Total', 'Estado', 'Acciones'].map((h, i) => (
              <div key={i} className="text-[9px] font-black text-stone-400 uppercase tracking-widest text-center">
                {h}
              </div>
            ))}
          </div>

          <div className="divide-y divide-stone-50 dark:divide-stone-800">
            {loading ? (
              <div className="py-20 text-center text-stone-400 font-bold text-xs uppercase tracking-widest">Cargando...</div>
            ) : sessions.length === 0 ? (
              <div className="py-24 text-center px-4">
                <ShoppingCart className="w-12 h-12 text-stone-100 mx-auto mb-4" />
                <p className="text-stone-400 font-black uppercase tracking-widest text-[10px]">No hay carritos abandonados recientes</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr_180px] gap-4 px-6 py-4 items-center hover:bg-stone-50/70 dark:hover:bg-stone-800/30 transition-colors">
                  <div className="text-center flex flex-col items-center">
                    <Clock className="w-4 h-4 text-stone-300 mb-1" />
                    <span className="text-[10px] font-bold text-stone-500">{formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale: es })}</span>
                  </div>
                  
                  <div className="flex flex-col items-center text-center">
                    <p className="font-black text-sm text-stone-800 dark:text-stone-100">{session.firstName} {session.lastName}</p>
                    <p className="text-[10px] text-stone-500">{session.email || 'Sin email'}</p>
                    <p className="text-[10px] text-stone-500 font-mono mt-0.5">{session.phone || 'Sin teléfono'}</p>
                  </div>
                  
                  <div className="flex flex-col items-center text-center text-xs text-stone-600 dark:text-stone-300">
                    {session.cartData && Array.isArray(session.cartData) ? session.cartData.map((item: any, idx: number) => (
                      <div key={idx} className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded mb-1 last:mb-0 w-full truncate max-w-[200px]">
                        <span className="font-bold">{item.quantity}x</span> {item.model}
                      </div>
                    )) : 'Sin items detectados'}
                  </div>
                  
                  <div className="text-center font-black text-stone-800 dark:text-white">
                    ${(session.total || 0).toLocaleString()}
                  </div>

                  <div className="text-center flex justify-center">
                    <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-600 px-2.5 py-1 rounded-lg">ABANDONADO</span>
                  </div>

                  <div className="flex items-center gap-2 justify-center">
                    <button 
                      onClick={() => handleRetomar(session)}
                      disabled={!session.phone}
                      className="flex items-center justify-center gap-1 px-2.5 py-2 bg-[#25D366] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Retomar por WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span className="hidden xl:inline">WA</span>
                    </button>
                    <button
                      onClick={() => handleSendEmail(session)}
                      disabled={!session.email || emailSending === session.id || emailSent.has(session.id)}
                      className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all disabled:cursor-not-allowed ${
                        emailSent.has(session.id)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'
                      }`}
                      title="Enviar email de recuperación"
                    >
                      {emailSending === session.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : emailSent.has(session.id) ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Mail className="w-3 h-3" />
                      )}
                      <span className="hidden xl:inline">{emailSent.has(session.id) ? 'Enviado' : 'Email'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
          {loading ? (
            <div className="py-20 text-center text-stone-400 font-bold text-xs uppercase tracking-widest">Cargando...</div>
          ) : sessions.length === 0 ? (
            <div className="py-24 text-center px-4">
              <ShoppingCart className="w-12 h-12 text-stone-100 mx-auto mb-4" />
              <p className="text-stone-400 font-black uppercase tracking-widest text-[10px]">No hay carritos abandonados</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-sm text-stone-800 dark:text-stone-100">{session.firstName} {session.lastName}</p>
                    <p className="text-[10px] text-stone-500">{session.email || 'Sin email'}</p>
                    <p className="text-[10px] text-stone-500">{session.phone || 'Sin teléfono'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-stone-500">{formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale: es })}</span>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-700">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Productos</p>
                  {session.cartData && Array.isArray(session.cartData) ? session.cartData.map((item: any, idx: number) => (
                    <div key={idx} className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                      {item.quantity}x {item.model}
                    </div>
                  )) : 'Sin items'}
                  <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total</span>
                    <span className="font-black text-sm">${(session.total || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleRetomar(session)}
                    disabled={!session.phone}
                    className="flex items-center justify-center gap-2 px-4 py-3 w-full bg-[#25D366] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-50"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </button>
                  <button
                    onClick={() => handleSendEmail(session)}
                    disabled={!session.email || emailSending === session.id || emailSent.has(session.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:opacity-90 disabled:opacity-50 transition-all ${
                      emailSent.has(session.id)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {emailSending === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : emailSent.has(session.id) ? (
                      <><CheckCircle2 className="w-4 h-4" /> Enviado</>
                    ) : (
                      <><Mail className="w-4 h-4" /> Email</>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
