import { Users } from 'lucide-react';
import type { PipelineLead, PipelineColumn } from '@/types/leads';
import { PIPELINE_COLUMNS, type PipelineStageKey } from '@/types/leads';
import LeadCard from './LeadCard';

// ─────────────────────────────────────────────────────────────
// PipelineColumnPanel — A single Kanban column
// ─────────────────────────────────────────────────────────────

interface PipelineColumnPanelProps {
  stageKey: PipelineStageKey;
  column: PipelineColumn;
  filteredLeads: PipelineLead[];
  actionLoading: string | null;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string) => void;
}

// Accent pill color per stage
const ACCENT_MAP: Record<string, string> = {
  blue:    'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  amber:   'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  orange:  'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  rose:    'from-rose-500/20 to-rose-500/5 border-rose-500/30',
};

const COUNT_COLOR: Record<string, string> = {
  blue:    'bg-blue-500/15 text-blue-500',
  emerald: 'bg-emerald-500/15 text-emerald-500',
  amber:   'bg-amber-500/15 text-amber-500',
  orange:  'bg-orange-500/15 text-orange-500',
  rose:    'bg-rose-500/15 text-rose-500',
};

export default function PipelineColumnPanel({
  stageKey,
  column,
  filteredLeads,
  actionLoading,
  onMarkWon,
  onMarkLost,
}: PipelineColumnPanelProps) {
  const config = PIPELINE_COLUMNS[stageKey];
  const accentClasses = ACCENT_MAP[config.color] ?? ACCENT_MAP.blue;
  const countClasses = COUNT_COLOR[config.color] ?? COUNT_COLOR.blue;

  return (
    <div className="w-80 shrink-0 bg-stone-50/60 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/40 rounded-[2rem] p-4 flex flex-col min-h-[500px] max-h-[75vh] shadow-sm backdrop-blur-sm snap-start">
      
      {/* ── Column Header ─────────────────────────────────── */}
      <div className={`flex items-center justify-between mb-4 pb-3 border-b bg-gradient-to-r ${accentClasses} rounded-xl px-3 py-2`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-6 h-6 rounded-lg ${countClasses} flex items-center justify-center text-[10px] font-black`}>
            {filteredLeads.length}
          </span>
          <h3 className="text-[10px] font-black uppercase tracking-wider text-stone-700 dark:text-stone-200">
            {column.title}
          </h3>
        </div>
        {column.totalAmount > 0 && (
          <span className="text-[10px] font-black text-stone-600 dark:text-stone-300">
            ${column.totalAmount.toLocaleString('es-AR')}
          </span>
        )}
      </div>

      {/* ── Cards Container ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-stone-300 dark:text-stone-700">
            <Users className="w-10 h-10 stroke-[1.5]" />
            <p className="text-[10px] font-bold uppercase tracking-widest mt-3">Sin leads</p>
          </div>
        ) : (
          filteredLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              actionLoading={actionLoading}
              onMarkWon={onMarkWon}
              onMarkLost={onMarkLost}
            />
          ))
        )}
      </div>
    </div>
  );
}
