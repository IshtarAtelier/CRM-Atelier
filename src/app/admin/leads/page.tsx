'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  MessageSquare, 
  Eye, 
  Calculator, 
  TrendingUp, 
  Check, 
  X, 
  Star, 
  ShieldAlert, 
  Loader2,
  Calendar,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  dni: string | null;
  insurance: string | null;
  priority: number;
  isFavorite: boolean;
  createdAt: string;
  interest: string | null;
  latestRx: {
    id: string;
    date: string;
    sphereOD: number | null;
    cylinderOD: number | null;
    sphereOI: number | null;
    cylinderOI: number | null;
    addition: number | null;
  } | null;
  latestQuote: {
    id: string;
    total: number;
    createdAt: string;
  } | null;
  waChatId: string | null;
}

interface Column {
  title: string;
  count: number;
  totalAmount: number;
  leads: Lead[];
}

export default function LeadsPipelinePage() {
  const [columns, setColumns] = useState<Record<string, Column>>({});
  const [stats, setStats] = useState({ totalLeads: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads/pipeline');
      if (!res.ok) throw new Error('Error al cargar el embudo de ventas');
      const data = await res.json();
      if (data.success) {
        setColumns(data.columns);
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Acción: Marcar como Ganado (CONFIRMED)
  const handleMarkWon = async (leadId: string) => {
    if (!confirm('¿Marcar este lead como Ganado (Confirmado)? Se moverá al listado de Confirmados en el CRM.')) return;
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/contacts/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al actualizar el estado del lead');
      }
      // Refrescar el pipeline
      await fetchPipeline();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Acción: Marcar como Desinteresado (no interesado tag)
  const handleMarkLost = async (leadId: string) => {
    if (!confirm('¿Marcar este lead como Desinteresado? Se le aplicará la etiqueta "no interesado" y saldrá del embudo.')) return;
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/contacts/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isFavorite: false,
          addTagName: 'no interesado' 
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al desestimar el lead');
      }
      // Refrescar el pipeline
      await fetchPipeline();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrar leads según la consulta de búsqueda en el cliente
  const filterLeads = (leads: Lead[]) => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase().trim();
    return leads.filter(lead => 
      lead.name.toLowerCase().includes(query) ||
      (lead.phone && lead.phone.includes(query)) ||
      (lead.dni && lead.dni.includes(query)) ||
      (lead.insurance && lead.insurance.toLowerCase().includes(query)) ||
      (lead.interest && lead.interest.toLowerCase().includes(query))
    );
  };

  // Formatear diferencia de días
  const getDaysElapsed = (dateStr: string) => {
    const elapsedMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    return `Hace ${days} días`;
  };

  return (
    <div className="p-4 lg:p-8 max-w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-24 relative select-none">
      
      {/* Cabecera del Embudo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black uppercase tracking-widest text-stone-900 dark:text-white flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[#c2a38a] animate-pulse" />
            Tablero del Embudo de Leads
          </h1>
          <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mt-1">
            Solo contactos con receta cargada, calificados para cierre
          </p>
        </div>

        {/* Búsqueda en tiempo real */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, celular o prepaga..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-100/50 dark:bg-stone-800/40 border border-stone-200/50 dark:border-stone-700/40 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#c2a38a]/40 dark:text-white placeholder-stone-400/80"
          />
        </div>
      </div>

      {/* Indicadores / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-stone-900/60 rounded-2xl border border-stone-200/30 dark:border-stone-800/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Leads Calificados</p>
            <h3 className="text-xl font-black text-stone-800 dark:text-white mt-0.5">{stats.totalLeads}</h3>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-stone-900/60 rounded-2xl border border-stone-200/30 dark:border-stone-800/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#c2a38a]/10 flex items-center justify-center text-[#c2a38a]">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Valor del Embudo</p>
            <h3 className="text-xl font-black text-stone-800 dark:text-white mt-0.5">${stats.totalValue.toLocaleString('es-AR')}</h3>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-stone-900/60 rounded-2xl border border-stone-200/30 dark:border-stone-800/60 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Promedio por Lead</p>
            <h3 className="text-xl font-black text-stone-800 dark:text-white mt-0.5">
              ${stats.totalLeads > 0 ? Math.round(stats.totalValue / stats.totalLeads).toLocaleString('es-AR') : 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Grid del Tablero Kanban */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-4">Cargando embudo de leads...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
          <div>
            <h3 className="text-sm font-bold text-stone-800 dark:text-white">Error de Carga</h3>
            <p className="text-xs text-stone-400 mt-1">{error}</p>
          </div>
          <button onClick={fetchPipeline} className="px-4 py-2 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-primary/95 transition-colors">
            Reintentar
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 lg:-mx-8 lg:px-8 select-none no-scrollbar snap-x">
          {Object.entries(columns).map(([key, col]) => {
            const colLeads = filterLeads(col.leads);
            return (
              <div 
                key={key} 
                className="w-80 shrink-0 bg-stone-100/50 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/40 rounded-[2rem] p-4 flex flex-col min-h-[500px] max-h-[700px] shadow-sm backdrop-blur-sm snap-start"
              >
                {/* Cabecera de Columna */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-200/40 dark:border-stone-800/40">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-200">
                      {col.title}
                    </h3>
                    <p className="text-[10px] text-stone-400 font-semibold mt-0.5">
                      {colLeads.length} {colLeads.length === 1 ? 'lead' : 'leads'}
                    </p>
                  </div>
                  {col.totalAmount > 0 && (
                    <div className="text-right">
                      <span className="text-xs font-black text-stone-800 dark:text-white">
                        ${col.totalAmount.toLocaleString('es-AR')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenedor de Tarjetas */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 no-scrollbar">
                  {colLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-stone-300 dark:text-stone-700">
                      <Users className="w-10 h-10 stroke-[1.5]" />
                      <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Sin Leads</p>
                    </div>
                  ) : (
                    colLeads.map(lead => (
                      <div 
                        key={lead.id}
                        className="p-4 bg-white dark:bg-stone-950/80 border border-stone-200/40 dark:border-stone-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative group flex flex-col gap-3.5"
                      >
                        {/* Info Principal */}
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <Link 
                              href={`/admin/contactos?id=${lead.id}`}
                              className="text-xs font-bold text-stone-900 dark:text-white hover:text-primary dark:hover:text-[#c2a38a] transition-colors line-clamp-1 flex-1 text-left"
                            >
                              {lead.name}
                            </Link>
                            
                            {/* Prioridad */}
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <Star 
                                  key={idx} 
                                  className={`w-2.5 h-2.5 ${idx < lead.priority ? 'text-amber-400 fill-amber-400' : 'text-stone-200 dark:text-stone-800'}`} 
                                />
                              ))}
                            </div>
                          </div>

                          {/* DNI, Prepaga, etc */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {lead.insurance && (
                              <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-900 text-[8px] font-black uppercase tracking-wider text-stone-500 rounded border border-stone-200/20 dark:border-stone-700/20">
                                {lead.insurance}
                              </span>
                            )}
                            {lead.interest && (
                              <span className="px-1.5 py-0.5 bg-[#c2a38a]/10 text-[8px] font-black uppercase tracking-wider text-[#c2a38a] rounded border border-[#c2a38a]/20">
                                {lead.interest}
                              </span>
                            )}
                            {lead.dni && (
                              <span className="text-[9px] text-stone-400 font-semibold">
                                DNI {lead.dni}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Receta Resumen */}
                        {lead.latestRx && (
                          <div className="p-2 bg-stone-50/50 dark:bg-stone-900/30 border border-stone-200/20 dark:border-stone-800/40 rounded-xl flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[8px] font-black text-stone-400 uppercase tracking-widest">
                              <span>Receta</span>
                              <span className="flex items-center gap-1 font-semibold text-[8px]">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(lead.latestRx.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 text-[9px] text-stone-600 dark:text-stone-400 font-medium">
                              <div>OD: <span className="font-bold text-stone-800 dark:text-white">{(lead.latestRx.sphereOD || 0) > 0 ? `+${lead.latestRx.sphereOD}` : lead.latestRx.sphereOD || 0} / {lead.latestRx.cylinderOD || 0}</span></div>
                              <div>OI: <span className="font-bold text-stone-800 dark:text-white">{(lead.latestRx.sphereOI || 0) > 0 ? `+${lead.latestRx.sphereOI}` : lead.latestRx.sphereOI || 0} / {lead.latestRx.cylinderOI || 0}</span></div>
                            </div>
                            {lead.latestRx.addition && (
                              <div className="text-[8px] text-stone-500 font-bold uppercase tracking-wider">
                                Adición: +{lead.latestRx.addition}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Cotización Resumen */}
                        {lead.latestQuote && (
                          <div className="flex justify-between items-center bg-[#c2a38a]/5 dark:bg-[#c2a38a]/3 border border-[#c2a38a]/10 p-2 rounded-xl">
                            <div className="flex flex-col text-left">
                              <span className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">Presupuesto</span>
                              <span className="text-[8px] text-stone-400 font-semibold">{getDaysElapsed(lead.latestQuote.createdAt)}</span>
                            </div>
                            <span className="text-xs font-black text-stone-800 dark:text-white">
                              ${lead.latestQuote.total.toLocaleString('es-AR')}
                            </span>
                          </div>
                        )}

                        {/* Acciones Rápidas */}
                        <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-900/60 pt-3 gap-2">
                          
                          {/* Detalle, Cotizar, WhatsApp */}
                          <div className="flex items-center gap-1.5">
                            <Link 
                              href={`/admin/contactos?id=${lead.id}`}
                              title="Ver Ficha"
                              className="p-2 bg-stone-100/50 dark:bg-stone-900/50 border border-stone-200/20 dark:border-stone-700/20 text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 rounded-xl transition-all hover:scale-105 active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>

                            {!lead.latestQuote ? (
                              <Link 
                                href={`/admin/cotizador?clientId=${lead.id}`}
                                title="Cotizar Receta"
                                className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </Link>
                            ) : (
                              lead.phone && (
                                <Link 
                                  href={`/admin/whatsapp?chatId=${normalizePhoneForLink(lead.phone)}`}
                                  title="Ir al Chat"
                                  className="p-2 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </Link>
                              )
                            )}
                          </div>

                          {/* Cerrar Ganado / Perdido */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleMarkLost(lead.id)}
                              disabled={actionLoading === lead.id}
                              title="Marcar Desinteresado"
                              className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleMarkWon(lead.id)}
                              disabled={actionLoading === lead.id}
                              title="Marcar Ganado (Confirmado)"
                              className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              {actionLoading === lead.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Auxiliar para formatear el teléfono para el chat
function normalizePhoneForLink(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.length >= 10 ? '549' + clean.slice(-10) : clean;
  return `${formatted}@c.us`;
}
