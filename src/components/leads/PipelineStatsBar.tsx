import { Users, TrendingUp, Calculator, type LucideIcon, AlarmClock } from 'lucide-react';
import type { PipelineStats } from '@/types/leads';

// ─────────────────────────────────────────────────────────────
// PipelineStats — Header KPI cards
// ─────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
}

function StatCard({ icon: Icon, iconBg, iconColor, label, value }: StatCardProps) {
  return (
    <div className="p-5 bg-white dark:bg-stone-900/60 rounded-2xl border border-stone-200/30 dark:border-stone-800/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow duration-300">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{label}</p>
        <h3 className="text-xl font-black text-stone-800 dark:text-white mt-0.5">{value}</h3>
      </div>
    </div>
  );
}

interface PipelineStatsBarProps {
  stats: PipelineStats;
}

export default function PipelineStatsBar({ stats }: PipelineStatsBarProps) {
  const avgTicket = stats.totalLeads > 0
    ? Math.round(stats.totalValue / stats.totalLeads).toLocaleString('es-AR')
    : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        icon={Users}
        iconBg="bg-primary/10"
        iconColor="text-primary"
        label="Leads Calificados"
        value={stats.totalLeads}
      />
      <StatCard
        icon={TrendingUp}
        iconBg="bg-[#c2a38a]/10"
        iconColor="text-[#c2a38a]"
        label="Valor del Embudo"
        value={`$${stats.totalValue.toLocaleString('es-AR')}`}
      />
      <StatCard
        icon={Calculator}
        iconBg="bg-amber-500/10"
        iconColor="text-amber-500"
        label="Promedio por Lead"
        value={`$${avgTicket}`}
      />
      {/* Lo que el equipo tiene que hacer HOY: leads con un paso vencido según
          el playbook (src/lib/embudo/playbook.ts). Es el mismo número que
          llega en el resumen diario. */}
      <StatCard
        icon={AlarmClock}
        iconBg={stats.paraHoy > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}
        iconColor={stats.paraHoy > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}
        label="Para hoy"
        value={stats.paraHoy}
      />
    </div>
  );
}
