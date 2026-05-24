export interface Ad {
  id: string;
  name: string;
  creativeUrl?: string;
  copyText?: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
}

export interface AdSet {
  id: string;
  name: string;
  audience: string;
  placement: string;
  budget: number;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  ads: Ad[];
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  totalBudget: number;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  adSets: AdSet[];
}

class MetaAdsService {
  // Simulates fetching existing campaigns from Meta API
  async getCampaigns(): Promise<Campaign[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: 'camp_1',
            name: 'Lanzamiento Colección Verano',
            objective: 'CONVERSIONS',
            totalBudget: 500,
            status: 'ACTIVE',
            adSets: [
              {
                id: 'adset_1',
                name: 'Público Lookalike 1%',
                audience: 'Mujeres 18-35',
                placement: 'Instagram Stories',
                budget: 250,
                status: 'ACTIVE',
                ads: [
                  { id: 'ad_1', name: 'Video Story 1', copyText: '¡Nueva colección!', status: 'ACTIVE' }
                ]
              }
            ]
          }
        ]);
      }, 1000);
    });
  }

  // Simulates creating a new campaign structure in Meta
  async syncCampaign(campaign: Campaign): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Syncing campaign to Meta Ads API...', campaign);
        resolve({ success: true, message: 'Campaña sincronizada correctamente con Meta Ads.' });
      }, 1500);
    });
  }
}

export const metaAdsService = new MetaAdsService();
