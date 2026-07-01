'use client';

import dynamic from 'next/dynamic';

// ─────────────────────────────────────────────────────────────
// /admin/leads — Embudo de Leads (Sales Pipeline)
// Server wrapper that disables SSR to avoid prerender errors
// when the database is unreachable during build.
// ─────────────────────────────────────────────────────────────

const LeadsPipelineView = dynamic(
  () => import('@/components/leads/LeadsPipelineView'),
  { ssr: false }
);

export default function LeadsPage() {
  return <LeadsPipelineView />;
}
