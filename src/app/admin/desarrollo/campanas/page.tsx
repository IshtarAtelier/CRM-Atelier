import { MarketingDashboard } from '@/components/marketing/MarketingDashboard';
import { CampaignBuilder } from '@/components/campanas/CampaignBuilder';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campañas Ads | Admin Atelier',
  description: 'Planificador y creador de campañas para Meta Ads y otras plataformas.',
};

export default function CampanasPage() {
  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-stone-50 dark:bg-[#1C1816] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        <MarketingDashboard />
        
        {/* Dejamos el CampaignBuilder abajo para que siga disponible */}
        <div>
          <h3 className="text-xl font-black text-stone-800 dark:text-white mb-6 pl-2 border-l-4 border-primary">
            Creador de Campañas (Planificador Estructural)
          </h3>
          <CampaignBuilder />
        </div>
      </div>
    </div>
  );
}
