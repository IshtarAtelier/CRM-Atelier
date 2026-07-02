import Link from 'next/link';
import {
  Star,
  Eye,
  Calculator,
  MessageSquare,
  Check,
  X,
  Loader2,
  Calendar,
} from 'lucide-react';
import type { PipelineLead } from '@/types/leads';
import type { PipelineStageKey } from '@/types/leads';

// ─────────────────────────────────────────────────────────────
// LeadCard — Single draggable lead card inside a pipeline column
// ─────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: PipelineLead;
  stageKey: PipelineStageKey;
  actionLoading: string | null;
  onMarkWon: (id: string) => void;
  onMarkLost: (id: string) => void;
}

/** Format elapsed days label */
function getDaysElapsed(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

/** Normalize phone to WhatsApp chat link format */
function normalizePhoneForLink(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 ? `549${clean.slice(-10)}@c.us` : `${clean}@c.us`;
}

/** Format sphere value with sign */
function fmtSphere(v: number | null): string {
  if (v === null || v === undefined) return '0';
  return v > 0 ? `+${v}` : String(v);
}

export default function LeadCard({ lead, stageKey, actionLoading, onMarkWon, onMarkLost }: LeadCardProps) {
  const isActing = actionLoading === lead.id;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', lead.id);
    e.dataTransfer.setData('application/x-stage', stageKey);
    e.dataTransfer.effectAllowed = 'move';
    // Add slight opacity to dragged card
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="p-4 bg-white dark:bg-stone-950/80 border border-stone-200/40 dark:border-stone-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-3.5 group cursor-grab active:cursor-grabbing"
    >

      {/* ── Header: Name + Priority Stars ──────────────────── */}
      <div className="flex justify-between items-start gap-2">
        <Link
          href={`/admin/contactos?id=${lead.id}`}
          className="text-xs font-bold text-stone-900 dark:text-white hover:text-primary dark:hover:text-[#c2a38a] transition-colors line-clamp-1 flex-1"
        >
          {lead.name}
        </Link>

        <div className="flex items-center gap-0.5 shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-2.5 h-2.5 ${i < lead.priority ? 'text-amber-400 fill-amber-400' : 'text-stone-200 dark:text-stone-800'}`}
            />
          ))}
        </div>
      </div>

      {/* ── Tags (prepaga / interés / DNI / fuente) ─────── */}
      <div className="flex flex-wrap gap-1.5">
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
        {lead.contactSource && (
          <span className="px-1.5 py-0.5 bg-blue-500/8 text-[8px] font-black uppercase tracking-wider text-blue-500 rounded border border-blue-500/15">
            {lead.contactSource}
          </span>
        )}
        {lead.dni && (
          <span className="text-[9px] text-stone-400 font-semibold">DNI {lead.dni}</span>
        )}
      </div>

      {/* ── Prescription Summary ───────────────────────────── */}
      {lead.latestRx && (
        <div className="p-2.5 bg-stone-50/50 dark:bg-stone-900/30 border border-stone-200/20 dark:border-stone-800/40 rounded-xl space-y-1">
          <div className="flex justify-between items-center text-[8px] font-black text-stone-400 uppercase tracking-widest">
            <span>Receta</span>
            <span className="flex items-center gap-1 font-semibold">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(lead.latestRx.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 text-[9px] text-stone-600 dark:text-stone-400 font-medium">
            <div>OD: <span className="font-bold text-stone-800 dark:text-white">{fmtSphere(lead.latestRx.sphereOD)} / {lead.latestRx.cylinderOD ?? 0}</span></div>
            <div>OI: <span className="font-bold text-stone-800 dark:text-white">{fmtSphere(lead.latestRx.sphereOI)} / {lead.latestRx.cylinderOI ?? 0}</span></div>
          </div>
          {lead.latestRx.addition != null && (
            <div className="text-[8px] text-stone-500 font-bold uppercase tracking-wider">
              Adición: +{lead.latestRx.addition}
            </div>
          )}
        </div>
      )}

      {/* ── Quote Summary ──────────────────────────────────── */}
      {lead.latestQuote && (
        <div className="flex justify-between items-center bg-[#c2a38a]/5 border border-[#c2a38a]/10 p-2.5 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">Presupuesto</span>
            <span className="text-[8px] text-stone-400 font-semibold">{getDaysElapsed(lead.latestQuote.createdAt)}</span>
          </div>
          <span className="text-xs font-black text-stone-800 dark:text-white">
            ${lead.latestQuote.total.toLocaleString('es-AR')}
          </span>
        </div>
      )}

      {/* ── Quick Actions ──────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-900/60 pt-3 gap-2">
        {/* Nav actions */}
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
              className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              <Calculator className="w-3.5 h-3.5" />
            </Link>
          ) : lead.phone ? (
            <Link
              href={`/admin/whatsapp?chatId=${normalizePhoneForLink(lead.phone)}`}
              title="Ir al Chat"
              className="p-2 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl transition-all hover:scale-105 active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMarkLost(lead.id)}
            disabled={isActing}
            title="Desinteresado"
            className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMarkWon(lead.id)}
            disabled={isActing}
            title="Ganado (Confirmado)"
            className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isActing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
