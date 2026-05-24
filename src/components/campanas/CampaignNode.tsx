import { Campaign, AdSet } from '@/services/metaAdsService';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Trash2, DollarSign } from 'lucide-react';
import { AdSetNode } from './AdSetNode';

interface CampaignNodeProps {
  campaign: Campaign;
  onUpdate: (updates: Partial<Campaign>) => void;
  onDelete: () => void;
}

export function CampaignNode({ campaign, onUpdate, onDelete }: CampaignNodeProps) {
  const addAdSet = () => {
    const newAdSet: AdSet = {
      id: `adset_${Date.now()}`,
      name: 'Nuevo Conjunto',
      audience: '',
      placement: '',
      budget: 0,
      status: 'DRAFT',
      ads: []
    };
    onUpdate({ adSets: [...campaign.adSets, newAdSet] });
  };

  const updateAdSet = (adSetId: string, updates: Partial<AdSet>) => {
    onUpdate({
      adSets: campaign.adSets.map(a => a.id === adSetId ? { ...a, ...updates } : a)
    });
  };

  const deleteAdSet = (adSetId: string) => {
    onUpdate({
      adSets: campaign.adSets.filter(a => a.id !== adSetId)
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-[#221d1a] border border-stone-200 dark:border-white/10 rounded-[2rem] shadow-xl overflow-hidden"
    >
      {/* Header Campaña */}
      <div className="bg-gradient-to-r from-stone-100 to-white dark:from-stone-900 dark:to-[#2A2421] p-6 border-b border-stone-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={campaign.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="font-black text-2xl bg-transparent border-none focus:ring-0 p-0 text-foreground w-full"
              placeholder="Nombre de la Campaña"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400 bg-stone-200/50 dark:bg-stone-800/50 px-3 py-1.5 rounded-lg">
              <Target size={16} className="text-primary" />
              <select
                value={campaign.objective}
                onChange={(e) => onUpdate({ objective: e.target.value })}
                className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium"
              >
                <option value="CONVERSIONS">Conversiones</option>
                <option value="TRAFFIC">Tráfico</option>
                <option value="ENGAGEMENT">Interacción</option>
                <option value="AWARENESS">Reconocimiento</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400 bg-stone-200/50 dark:bg-stone-800/50 px-3 py-1.5 rounded-lg">
              <DollarSign size={16} className="text-green-600 dark:text-green-400" />
              <input
                type="number"
                value={campaign.totalBudget}
                onChange={(e) => onUpdate({ totalBudget: Number(e.target.value) })}
                className="bg-transparent border-none focus:ring-0 p-0 w-24 text-sm font-medium"
                placeholder="Ppto Total"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={campaign.status}
            onChange={(e) => onUpdate({ status: e.target.value as any })}
            className={`font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer border-r-[8px] border-transparent ${
              campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
              campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 
              'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400'
            }`}
          >
            <option value="DRAFT">BORRADOR</option>
            <option value="ACTIVE">ACTIVA</option>
            <option value="PAUSED">PAUSADA</option>
          </select>

          <button
            onClick={onDelete}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
            title="Eliminar Campaña"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Árbol de Conjuntos y Anuncios */}
      <div className="p-6 md:p-8 overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-4">
          <AnimatePresence mode="popLayout">
            {campaign.adSets.map(adSet => (
              <AdSetNode
                key={adSet.id}
                adSet={adSet}
                onUpdate={(updates) => updateAdSet(adSet.id, updates)}
                onDelete={() => deleteAdSet(adSet.id)}
              />
            ))}
          </AnimatePresence>

          <button
            onClick={addAdSet}
            className="flex flex-col items-center justify-center gap-2 min-w-[280px] border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl text-stone-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
              <Plus size={24} />
            </div>
            <span className="font-medium">Agregar Conjunto</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
