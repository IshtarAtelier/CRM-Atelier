import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PIPELINE_COLUMNS, type PipelineStageKey } from '@/types/leads';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// GET /api/leads/pipeline
// Returns qualified leads (CONTACT + has prescription)
// grouped by funnel stage based on latest quote age.
// ─────────────────────────────────────────────────────────────

const EXCLUSION_TAGS = ['no interesado', 'cancelar bot', 'spam', 'no bot', 'cerrado', 'post-venta'];

export async function GET() {
  try {
    const now = Date.now();

    const leads = await prisma.client.findMany({
      where: { status: 'CONTACT', isDeleted: false },
      include: {
        prescriptions: { orderBy: { date: 'desc' } },
        orders: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        tags: true,
        whatsappChats: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter: must have prescription, must NOT have exclusion tags, must NOT have purchased
    const qualifiedLeads = leads.filter(lead => {
      if (lead.prescriptions.length === 0) return false;
      // Excluir si tiene tags de exclusión (no interesado, cerrado, etc.)
      if (lead.tags.some(tag =>
        EXCLUSION_TAGS.some(ex => tag.name.toLowerCase().includes(ex))
      )) return false;
      // Excluir si ya compró (tiene una orden de tipo SALE u ORDER)
      if (lead.orders.some(o => o.orderType === 'SALE' || o.orderType === 'ORDER')) return false;
      return true;
    });

    // Build columns from config
    const columns: Record<PipelineStageKey, {
      title: string; color: string; icon: string;
      count: number; totalAmount: number; leads: any[];
    }> = {} as any;

    for (const [key, cfg] of Object.entries(PIPELINE_COLUMNS)) {
      columns[key as PipelineStageKey] = {
        title: cfg.title,
        color: cfg.color,
        icon: cfg.icon,
        count: 0,
        totalAmount: 0,
        leads: [],
      };
    }

    // Classify each lead
    for (const lead of qualifiedLeads) {
      const latestQuote = lead.orders.find(o => o.orderType === 'QUOTE') ?? null;
      const latestRx = lead.prescriptions[0];
      const chatLabels = lead.whatsappChats[0]?.chatLabels || [];
      const tags = lead.tags.map(t => t.name.toLowerCase());

      let stage: PipelineStageKey = 'nuevaReceta';

      if (latestQuote) {
        const searchPool = [
          ...chatLabels.map(l => l.toLowerCase()),
          ...tags
        ];

        if (searchPool.some(x => x.includes('seguimiento_dia_15') || x.includes('seguimiento 15') || x.includes('frío') || x.includes('frio') || x.includes('fríoo'))) {
          stage = 'seguimiento10dias';
        } else if (searchPool.some(x => x.includes('seguimiento_dia_4') || x.includes('seguimiento 4') || x.includes('seguimiento 2'))) {
          stage = 'seguimiento2';
        } else if (searchPool.some(x => x.includes('seguimiento_dia_1') || x.includes('seguimiento 1'))) {
          stage = 'seguimiento1';
        } else {
          stage = 'cotizacionEnviada';
        }
      }

      const formattedLead = {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        dni: lead.dni,
        insurance: lead.insurance,
        priority: lead.priority,
        isFavorite: lead.isFavorite,
        createdAt: lead.createdAt,
        interest: lead.interest,
        contactSource: lead.contactSource,
        latestRx: {
          id: latestRx.id,
          date: latestRx.date,
          sphereOD: latestRx.sphereOD,
          cylinderOD: latestRx.cylinderOD,
          sphereOI: latestRx.sphereOI,
          cylinderOI: latestRx.cylinderOI,
          addition: latestRx.addition || latestRx.additionOD || latestRx.additionOI || null,
        },
        latestQuote: latestQuote ? {
          id: latestQuote.id,
          total: latestQuote.total,
          createdAt: latestQuote.createdAt,
        } : null,
        waChatId: lead.whatsappChats[0]?.id || null,
      };

      const col = columns[stage];
      col.leads.push(formattedLead);
      col.count++;
      if (latestQuote) col.totalAmount += latestQuote.total;
    }

    return NextResponse.json({
      success: true,
      columns,
      stats: {
        totalLeads: qualifiedLeads.length,
        totalValue: Object.values(columns).reduce((s, c) => s + c.totalAmount, 0),
      },
    });
  } catch (error: any) {
    console.error('[API Leads Pipeline] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
