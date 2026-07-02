import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PipelineData, PipelineLead, PipelineColumn } from '@/types/leads';

// ─────────────────────────────────────────────────────────────
// useLeadsPipeline — Custom hook for embudo de ventas
// Encapsulates fetching, searching, and lead actions.
// ─────────────────────────────────────────────────────────────

export function useLeadsPipeline() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leads/pipeline');
      if (!res.ok) throw new Error('Error al cargar el embudo de ventas');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error desconocido');
      setData({ columns: json.columns, stats: json.stats });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // ── Search Filter (client-side) ───────────────────────────
  const filterLeads = useCallback((leads: PipelineLead[]): PipelineLead[] => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase().trim();
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.phone && l.phone.includes(q)) ||
      (l.dni && l.dni.includes(q)) ||
      (l.insurance && l.insurance.toLowerCase().includes(q)) ||
      (l.interest && l.interest.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // ── Filtered columns (memoised) ───────────────────────────
  const filteredColumns = useMemo(() => {
    if (!data) return null;
    const result: Record<string, PipelineColumn & { filteredLeads: PipelineLead[] }> = {};
    for (const [key, col] of Object.entries(data.columns)) {
      result[key] = { ...col, filteredLeads: filterLeads(col.leads) };
    }
    return result;
  }, [data, filterLeads]);

  // ── Actions ────────────────────────────────────────────────

  /** Mark lead as Ganado → CONFIRMED */
  const markWon = useCallback(async (leadId: string) => {
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/contacts/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al actualizar el estado');
      }
      await fetchPipeline();
    } catch (err: any) {
      throw err; // Let consumer handle the UI toast / alert
    } finally {
      setActionLoading(null);
    }
  }, [fetchPipeline]);

  /** Mark lead as Desinteresado → add tag "no interesado" */
  const markLost = useCallback(async (leadId: string) => {
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/contacts/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: false, addTagName: 'no interesado' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al desestimar el lead');
      }
      await fetchPipeline();
    } catch (err: any) {
      throw err;
    } finally {
      setActionLoading(null);
    }
  }, [fetchPipeline]);

  /** Move lead to a different pipeline stage (drag & drop) */
  const moveLead = useCallback(async (leadId: string, targetStage: string) => {
    setActionLoading(leadId);
    try {
      const res = await fetch('/api/leads/pipeline/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, targetStage }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al mover el lead');
      }
      await fetchPipeline();
    } catch (err: any) {
      throw err;
    } finally {
      setActionLoading(null);
    }
  }, [fetchPipeline]);

  return {
    // Data
    columns: filteredColumns,
    stats: data?.stats ?? { totalLeads: 0, totalValue: 0 },

    // State
    loading,
    error,
    searchQuery,
    actionLoading,

    // Setters
    setSearchQuery,

    // Actions
    fetchPipeline,
    markWon,
    markLost,
    moveLead,
  };
}
