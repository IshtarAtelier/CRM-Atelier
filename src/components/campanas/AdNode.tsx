import { Ad } from '@/services/metaAdsService';
import { motion } from 'framer-motion';
import { Image, Type, Trash2 } from 'lucide-react';

interface AdNodeProps {
  ad: Ad;
  onUpdate: (updates: Partial<Ad>) => void;
  onDelete: () => void;
}

export function AdNode({ ad, onUpdate, onDelete }: AdNodeProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white/80 dark:bg-[#2A2421]/80 backdrop-blur-md border border-stone-200 dark:border-stone-700/50 p-4 rounded-xl shadow-sm relative group"
    >
      <div className="flex justify-between items-start mb-3">
        <input
          type="text"
          value={ad.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="font-semibold text-sm bg-transparent border-none focus:ring-0 p-0 text-foreground w-full"
          placeholder="Nombre del Anuncio"
        />
        <button
          onClick={onDelete}
          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
          title="Eliminar Anuncio"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <Type size={14} />
          <input
            type="text"
            value={ad.copyText || ''}
            onChange={(e) => onUpdate({ copyText: e.target.value })}
            className="bg-stone-100 dark:bg-stone-800/50 rounded px-2 py-1 w-full border-none focus:ring-1 focus:ring-primary/50 text-foreground"
            placeholder="Texto principal (Copy)"
          />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <Image size={14} />
          <input
            type="text"
            value={ad.creativeUrl || ''}
            onChange={(e) => onUpdate({ creativeUrl: e.target.value })}
            className="bg-stone-100 dark:bg-stone-800/50 rounded px-2 py-1 w-full border-none focus:ring-1 focus:ring-primary/50 text-foreground"
            placeholder="URL de la imagen/video"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <select
          value={ad.status}
          onChange={(e) => onUpdate({ status: e.target.value as any })}
          className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
            ad.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
            ad.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 
            'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
          }`}
        >
          <option value="DRAFT">Borrador</option>
          <option value="ACTIVE">Activo</option>
          <option value="PAUSED">Pausado</option>
        </select>
      </div>
    </motion.div>
  );
}
