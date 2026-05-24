'use client';

import { useState, useEffect } from 'react';
import { Campaign, metaAdsService } from '@/services/metaAdsService';
import { CampaignNode } from './CampaignNode';
import { Plus, Save, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CampaignBuilder() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const data = await metaAdsService.getCampaigns();
      setCampaigns(data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // En una implementación real, iteraríamos o sincronizaríamos el estado completo.
      // Aquí hacemos sync de la primera a modo de demo.
      if (campaigns.length > 0) {
        const result = await metaAdsService.syncCampaign(campaigns[0]);
        alert(result.message);
      } else {
        alert("No hay campañas para sincronizar.");
      }
    } catch (error) {
      console.error('Error syncing:', error);
      alert("Error al sincronizar con Meta Ads.");
    } finally {
      setIsSyncing(false);
    }
  };

  const addCampaign = () => {
    const newCampaign: Campaign = {
      id: `camp_${Date.now()}`,
      name: 'Nueva Campaña',
      objective: 'CONVERSIONS',
      totalBudget: 0,
      status: 'DRAFT',
      adSets: []
    };
    setCampaigns([newCampaign, ...campaigns]);
  };

  const updateCampaign = (id: string, updates: Partial<Campaign>) => {
    setCampaigns(campaigns.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCampaign = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta campaña?")) {
      setCampaigns(campaigns.filter(c => c.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/50 dark:bg-[#1C1816]/50 backdrop-blur-md p-6 rounded-3xl border border-stone-200 dark:border-white/5 shadow-sm">
        <div>
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
            Planificador de Campañas
          </h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
            Diseña la estructura de tus anuncios para Meta (Facebook/Instagram).
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={loadCampaigns}
            className="p-3 text-stone-500 hover:text-primary bg-stone-100 dark:bg-stone-800 hover:bg-primary/10 rounded-xl transition-colors"
            title="Recargar desde API"
          >
            <RefreshCw size={20} />
          </button>
          
          <button
            onClick={addCampaign}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20} />
            Nueva Campaña
          </button>
          
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all ${
              isSyncing ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 active:scale-95 shadow-lg shadow-primary/30'
            }`}
          >
            {isSyncing ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            Sincronizar API
          </button>
        </div>
      </div>

      <div className="space-y-10">
        <AnimatePresence>
          {campaigns.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white/30 dark:bg-black/10 rounded-3xl border border-dashed border-stone-300 dark:border-stone-800"
            >
              <div className="w-16 h-16 bg-stone-200 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                <Plus size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">No hay campañas</h3>
              <p className="text-stone-500 dark:text-stone-400 max-w-md mx-auto mb-6">
                Comienza creando tu primera campaña para estructurar tus conjuntos de anuncios y creatividades.
              </p>
              <button
                onClick={addCampaign}
                className="px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl font-bold hover:scale-105 transition-all"
              >
                Crear Primera Campaña
              </button>
            </motion.div>
          ) : (
            campaigns.map(campaign => (
              <CampaignNode
                key={campaign.id}
                campaign={campaign}
                onUpdate={(updates) => updateCampaign(campaign.id, updates)}
                onDelete={() => deleteCampaign(campaign.id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
