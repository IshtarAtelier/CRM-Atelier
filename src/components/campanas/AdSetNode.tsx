import { AdSet, Ad } from '@/services/metaAdsService';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, LayoutTemplate, Plus, Trash2, DollarSign } from 'lucide-react';
import { AdNode } from './AdNode';

interface AdSetNodeProps {
  adSet: AdSet;
  onUpdate: (updates: Partial<AdSet>) => void;
  onDelete: () => void;
}

export function AdSetNode({ adSet, onUpdate, onDelete }: AdSetNodeProps) {
  const addAd = () => {
    const newAd: Ad = {
      id: `ad_${Date.now()}`,
      name: 'Nuevo Anuncio',
      status: 'DRAFT',
    };
    onUpdate({ ads: [...adSet.ads, newAd] });
  };

  const updateAd = (adId: string, updates: Partial<Ad>) => {
    onUpdate({
      ads: adSet.ads.map(a => a.id === adId ? { ...a, ...updates } : a)
    });
  };

  const deleteAd = (adId: string) => {
    onUpdate({
      ads: adSet.ads.filter(a => a.id !== adId)
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-stone-50/80 dark:bg-[#1C1816]/80 backdrop-blur-xl border border-stone-200 dark:border-stone-700/50 p-5 rounded-2xl relative group min-w-[320px]"
    >
      <div className="flex justify-between items-start mb-4">
        <input
          type="text"
          value={adSet.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="font-bold text-lg bg-transparent border-none focus:ring-0 p-0 text-foreground w-full"
          placeholder="Nombre del Conjunto"
        />
        <button
          onClick={onDelete}
          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1"
          title="Eliminar Conjunto de Anuncios"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-300 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-stone-100 dark:border-stone-800">
          <Users size={16} className="text-blue-500" />
          <input
            type="text"
            value={adSet.audience}
            onChange={(e) => onUpdate({ audience: e.target.value })}
            className="bg-transparent border-none focus:ring-0 p-0 w-full text-sm"
            placeholder="Público / Audiencia"
          />
        </div>
        
        <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-300 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-stone-100 dark:border-stone-800">
          <LayoutTemplate size={16} className="text-purple-500" />
          <input
            type="text"
            value={adSet.placement}
            onChange={(e) => onUpdate({ placement: e.target.value })}
            className="bg-transparent border-none focus:ring-0 p-0 w-full text-sm"
            placeholder="Ubicaciones (ej. Stories)"
          />
        </div>

        <div className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-300 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-stone-100 dark:border-stone-800">
          <DollarSign size={16} className="text-green-500" />
          <input
            type="number"
            value={adSet.budget}
            onChange={(e) => onUpdate({ budget: Number(e.target.value) })}
            className="bg-transparent border-none focus:ring-0 p-0 w-full text-sm"
            placeholder="Presupuesto"
          />
        </div>
      </div>

      <div className="pl-4 border-l-2 border-stone-200 dark:border-stone-800 space-y-4 relative">
        <AnimatePresence mode="popLayout">
          {adSet.ads.map(ad => (
            <div key={ad.id} className="relative">
              <div className="absolute -left-4 top-1/2 w-4 h-[2px] bg-stone-200 dark:bg-stone-800" />
              <AdNode
                ad={ad}
                onUpdate={(updates) => updateAd(ad.id, updates)}
                onDelete={() => deleteAd(ad.id)}
              />
            </div>
          ))}
        </AnimatePresence>
        
        <button
          onClick={addAd}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium relative"
        >
          <div className="absolute -left-4 top-1/2 w-4 h-[2px] bg-stone-200 dark:bg-stone-800" />
          <Plus size={16} /> Agregar Anuncio
        </button>
      </div>
    </motion.div>
  );
}
