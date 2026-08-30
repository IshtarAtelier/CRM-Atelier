import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PIPELINE_COLUMNS, type PipelineStageKey } from '@/types/leads';
import { classifyLead } from '@/lib/leads-pipeline';

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
      where: {
        status: 'CONTACT',
        isDeleted: false,
        // Excluir si ya compró (tiene una orden de tipo SALE u ORDER) —
        // filtrado en la base para no traer todas las órdenes de cada lead.
        orders: {
          none: { isDeleted: false, orderType: { in: ['SALE', 'ORDER'] } },
        },
      },
      include: {
        // Solo la receta más reciente: es la única que se muestra.
        prescriptions: { orderBy: { date: 'desc' }, take: 1 },
        // Solo el presupuesto más reciente: es el único que se usa.
        orders: {
          where: { isDeleted: false, orderType: 'QUOTE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        tags: true,
        whatsappChats: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter: must NOT have exclusion tags (no interesado, cerrado, etc.)
    const qualifiedLeads = leads.filter(lead =>
      !lead.tags.some(tag =>
        EXCLUSION_TAGS.some(ex => tag.name.toLowerCase().includes(ex))
      )
    );

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

    // Classify each lead — la lógica vive en src/lib/leads-pipeline.ts:
    // max(etapa por etiquetas enviadas, etapa por antigüedad del presupuesto).
    for (const lead of qualifiedLeads) {
      const latestQuote = lead.orders[0] ?? null;
      const latestRx = lead.prescriptions[0];
      const chatLabels = lead.whatsappChats[0]?.chatLabels || [];

      const { stage, contactado } = classifyLead({
        quoteCreatedAt: latestQuote?.createdAt ?? null,
        hasPrescription: !!latestRx,
        chatLabels,
        tagNames: lead.tags.map(t => t.name),
        now,
      });

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
        latestRx: latestRx ? {
          id: latestRx.id,
          date: latestRx.date,
          sphereOD: latestRx.sphereOD,
          cylinderOD: latestRx.cylinderOD,
          sphereOI: latestRx.sphereOI,
          cylinderOI: latestRx.cylinderOI,
          addition: latestRx.addition || latestRx.additionOD || latestRx.additionOI || null,
        } : null,
        latestQuote: latestQuote ? {
          id: latestQuote.id,
          total: latestQuote.total,
          createdAt: latestQuote.createdAt,
        } : null,
        waChatId: lead.whatsappChats[0]?.id || null,
        // true = la etapa vino por un mensaje de seguimiento enviado;
        // false = llegó a la columna solo por el paso del tiempo (sin contactar).
        contactado,
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
