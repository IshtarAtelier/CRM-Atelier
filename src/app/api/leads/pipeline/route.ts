import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();

    // Obtener los leads (CONTACT) que no están eliminados
    const leads = await prisma.client.findMany({
      where: {
        status: 'CONTACT',
        isDeleted: false,
      },
      include: {
        prescriptions: {
          orderBy: { date: 'desc' },
        },
        orders: {
          where: {
            orderType: 'QUOTE',
            isDeleted: false,
          },
          orderBy: { createdAt: 'desc' },
        },
        tags: true,
        whatsappChats: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filtros de exclusión:
    // 1. Debe tener receta.
    // 2. No debe tener etiquetas como "no interesado", "cancelar bot" o "spam".
    const exclusionTags = ['no interesado', 'cancelar bot', 'spam', 'no bot'];
    const qualifiedLeads = leads.filter(lead => {
      const hasPrescription = lead.prescriptions.length > 0;
      const hasExclusionTag = lead.tags.some(tag => 
        exclusionTags.some(exclude => tag.name.toLowerCase().includes(exclude))
      );
      return hasPrescription && !hasExclusionTag;
    });

    // Estructura de las columnas
    const columns: Record<string, { title: string; count: number; totalAmount: number; leads: any[] }> = {
      nuevaReceta: { title: 'Nueva Receta', count: 0, totalAmount: 0, leads: [] },
      cotizacionEnviada: { title: 'Cotización Enviada', count: 0, totalAmount: 0, leads: [] },
      seguimiento1: { title: 'Seguimiento 1 (24-48h)', count: 0, totalAmount: 0, leads: [] },
      seguimiento2: { title: 'Seguimiento 2 (48-96h)', count: 0, totalAmount: 0, leads: [] },
      seguimiento10dias: { title: 'Seguimiento 10 Días', count: 0, totalAmount: 0, leads: [] },
    };

    for (const lead of qualifiedLeads) {
      const latestQuote = lead.orders[0]; // La cotización más reciente
      const latestRx = lead.prescriptions[0];

      // Formatear información del lead para el Kanban
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
      };

      if (!latestQuote) {
        // Nueva Receta: no tiene cotización
        columns.nuevaReceta.leads.push(formattedLead);
        columns.nuevaReceta.count++;
      } else {
        const quoteTime = new Date(latestQuote.createdAt).getTime();
        const hoursElapsed = (now.getTime() - quoteTime) / (1000 * 60 * 60);

        if (hoursElapsed < 24) {
          // Cotización Enviada (< 24hs)
          columns.cotizacionEnviada.leads.push(formattedLead);
          columns.cotizacionEnviada.count++;
          columns.cotizacionEnviada.totalAmount += latestQuote.total;
        } else if (hoursElapsed >= 24 && hoursElapsed < 48) {
          // Seguimiento 1 (24hs a 48hs)
          columns.seguimiento1.leads.push(formattedLead);
          columns.seguimiento1.count++;
          columns.seguimiento1.totalAmount += latestQuote.total;
        } else if (hoursElapsed >= 48 && hoursElapsed < 240) {
          // Seguimiento 2 (48hs a 10 días / 240hs)
          columns.seguimiento2.leads.push(formattedLead);
          columns.seguimiento2.count++;
          columns.seguimiento2.totalAmount += latestQuote.total;
        } else {
          // Seguimiento 10 Días (>= 240hs)
          columns.seguimiento10dias.leads.push(formattedLead);
          columns.seguimiento10dias.count++;
          columns.seguimiento10dias.totalAmount += latestQuote.total;
        }
      }
    }

    return NextResponse.json({
      success: true,
      columns,
      stats: {
        totalLeads: qualifiedLeads.length,
        totalValue: Object.values(columns).reduce((sum, col) => sum + col.totalAmount, 0),
      }
    });

  } catch (error: any) {
    console.error('[API Leads Pipeline] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
