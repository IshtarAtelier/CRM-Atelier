'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useLeadsPipeline } from '@/hooks/useLeadsPipeline';
import { PIPELINE_COLUMNS, type PipelineStageKey } from '@/types/leads';

// Modular components
import PipelineHeader from '@/components/leads/PipelineHeader';
import PipelineStatsBar from '@/components/leads/PipelineStatsBar';
import PipelineColumnPanel from '@/components/leads/PipelineColumnPanel';

// ─────────────────────────────────────────────────────────────
// LeadsPipelinePage — Orchestrator page
// Composes hook + modular components. No business logic here.
// ─────────────────────────────────────────────────────────────

export default function LeadsPipelinePage() {
  const {
    columns,
    stats,
    loading,
    error,
    searchQuery,
    actionLoading,
    setSearchQuery,
    fetchPipeline,
    markWon,
    markLost,
  } = useLeadsPipeline();

  // Wrap actions with user confirmation
  const handleMarkWon = async (leadId: string) => {
    if (!confirm('¿Marcar este lead como Ganado (Confirmado)?')) return;
    try { await markWon(leadId); } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const handleMarkLost = async (leadId: string) => {
    if (!confirm('¿Marcar como Desinteresado? Se le aplicará la etiqueta "no interesado".')) return;
    try { await markLost(leadId); } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  // Column keys in display order
  const stageKeys = Object.keys(PIPELINE_COLUMNS) as PipelineStageKey[];

  return (
    <div className="p-4 lg:p-8 max-w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-24 select-none">

      <PipelineHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <PipelineStatsBar stats={stats} />

      {/* ── Kanban Board ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-4">Cargando embudo...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
          <div>
            <h3 className="text-sm font-bold text-stone-800 dark:text-white">Error de Carga</h3>
            <p className="text-xs text-stone-400 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchPipeline}
            className="px-4 py-2 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : columns ? (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 lg:-mx-8 lg:px-8 no-scrollbar snap-x">
          {stageKeys.map(key => {
            const col = columns[key];
            if (!col) return null;
            return (
              <PipelineColumnPanel
                key={key}
                stageKey={key}
                column={col}
                filteredLeads={col.filteredLeads}
                actionLoading={actionLoading}
                onMarkWon={handleMarkWon}
                onMarkLost={handleMarkLost}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
