import { Search, Sparkles } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// PipelineHeader — Title bar + real-time search
// ─────────────────────────────────────────────────────────────

interface PipelineHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function PipelineHeader({ searchQuery, onSearchChange }: PipelineHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 className="text-xl lg:text-2xl font-black uppercase tracking-widest text-stone-900 dark:text-white flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#c2a38a] animate-pulse" />
          Embudo de Leads
        </h1>
        <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mt-1">
          Contactos con receta cargada · Calificados para cierre
        </p>
      </div>

      <div className="relative w-full md:w-80">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Buscar nombre, celular, prepaga..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-stone-100/50 dark:bg-stone-800/40 border border-stone-200/50 dark:border-stone-700/40 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#c2a38a]/40 dark:text-white placeholder-stone-400/80 transition-shadow"
        />
      </div>
    </div>
  );
}
