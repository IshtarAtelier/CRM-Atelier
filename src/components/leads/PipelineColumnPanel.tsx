import { useState } from 'react';
import { Users } from 'lucide-react';
import type { PipelineLead, PipelineColumn } from '@/types/leads';
import { PIPELINE_COLUMNS, type PipelineStageKey } from '@/types/leads';
import LeadCard from './LeadCard';

// ─────────────────────────────────────────────────────────────
// PipelineColumnPanel — A single Kanban column with drop zone
// ─────────────────────────────────────────────────────────────

interface PipelineColumnPanelProps {
  stageKey: PipelineStageKey;
  column: PipelineColumn;
  filteredLeads: PipelineLead[];
  actionLoading: string | null;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string) => void;
  onMoveLead: (leadId: string, targetStage: string) => void;
}

// Accent pill color per stage
const ACCENT_MAP: Record<string, string> = {
  violet:  'from-violet-500/20 to-violet-500/5 border-violet-500/30',
  blue:    'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  amber:   'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  orange:  'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  rose:    'from-rose-500/20 to-rose-500/5 border-rose-500/30',
};

const COUNT_COLOR: Record<string, string> = {
  violet:  'bg-violet-500/15 text-violet-500',
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
  onMoveLead,
}: PipelineColumnPanelProps) {
  const config = PIPELINE_COLUMNS[stageKey];
  const accentClasses = ACCENT_MAP[config.color] ?? ACCENT_MAP.blue;
  const countClasses = COUNT_COLOR[config.color] ?? COUNT_COLOR.blue;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only trigger if actually leaving the column (not entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData('text/plain');
    const fromStage = e.dataTransfer.getData('application/x-stage');
    if (leadId && fromStage !== stageKey) {
      onMoveLead(leadId, stageKey);
    }
  };

  return (
    <div
      className={`w-80 shrink-0 border rounded-[2rem] p-4 flex flex-col min-h-[500px] max-h-[75vh] shadow-sm backdrop-blur-sm snap-start transition-all duration-200
        ${isDragOver
          ? 'bg-primary/5 border-primary/40 ring-2 ring-primary/20 scale-[1.01]'
          : 'bg-stone-50/60 dark:bg-stone-900/40 border-stone-200/50 dark:border-stone-800/40'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
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
          <div className={`flex flex-col items-center justify-center py-16 text-center transition-colors ${isDragOver ? 'text-primary/60' : 'text-stone-300 dark:text-stone-700'}`}>
            <Users className="w-10 h-10 stroke-[1.5]" />
            <p className="text-[10px] font-bold uppercase tracking-widest mt-3">
              {isDragOver ? 'Soltar aquí' : 'Sin leads'}
            </p>
          </div>
        ) : (
          filteredLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              stageKey={stageKey}
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
