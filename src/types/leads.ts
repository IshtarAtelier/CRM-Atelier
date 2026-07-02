// ─────────────────────────────────────────────────────────────
// Types for the Leads Pipeline (Embudo de Ventas)
// ─────────────────────────────────────────────────────────────

export interface PipelineRx {
  id: string;
  date: string;
  sphereOD: number | null;
  cylinderOD: number | null;
  sphereOI: number | null;
  cylinderOI: number | null;
  addition: number | null;
}

export interface PipelineQuote {
  id: string;
  total: number;
  createdAt: string;
}

export interface PipelineLead {
  id: string;
  name: string;
  phone: string | null;
  dni: string | null;
  insurance: string | null;
  priority: number;
  isFavorite: boolean;
  createdAt: string;
  interest: string | null;
  contactSource: string | null;
  latestRx: PipelineRx | null;
  latestQuote: PipelineQuote | null;
  waChatId: string | null;
}

export type PipelineStageKey =
  | 'primerContacto'
  | 'nuevaReceta'
  | 'cotizacionEnviada'
  | 'seguimiento1'
  | 'seguimiento2'
  | 'seguimiento10dias';

export interface PipelineColumn {
  title: string;
  count: number;
  totalAmount: number;
  leads: PipelineLead[];
  color: string;        // Accent color for the column header
  icon: string;          // lucide icon name
}

export interface PipelineStats {
  totalLeads: number;
  totalValue: number;
}

export interface PipelineData {
  columns: Record<PipelineStageKey, PipelineColumn>;
  stats: PipelineStats;
}

// Column configuration — single source of truth for display metadata
export const PIPELINE_COLUMNS: Record<PipelineStageKey, { title: string; color: string; icon: string; accent: string }> = {
  primerContacto:     { title: 'Primer Contacto',           color: 'violet',  icon: 'User',        accent: '#8b5cf6' },
  nuevaReceta:        { title: 'Nueva Receta',              color: 'blue',    icon: 'FileText',    accent: '#3b82f6' },
  cotizacionEnviada:  { title: 'Cotización Enviada',        color: 'emerald', icon: 'Send',        accent: '#10b981' },
  seguimiento1:       { title: 'Seguimiento 1 (24-48h)',    color: 'amber',   icon: 'Clock',       accent: '#f59e0b' },
  seguimiento2:       { title: 'Seguimiento 2 (2-10 días)', color: 'orange',  icon: 'Bell',        accent: '#f97316' },
  seguimiento10dias:  { title: 'Frío (+10 días)',           color: 'rose',    icon: 'Snowflake',   accent: '#f43f5e' },
};
