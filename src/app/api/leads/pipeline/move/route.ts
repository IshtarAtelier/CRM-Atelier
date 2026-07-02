import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { PipelineStageKey } from '@/types/leads';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// PATCH /api/leads/pipeline/move
// Moves a lead to a different pipeline stage by updating its
// follow-up tags. Also handles "desinteresado" as a special stage.
// ─────────────────────────────────────────────────────────────

// Tags that map to each pipeline stage (used to SET the new stage)
const STAGE_TAGS: Record<string, string> = {
  nuevaReceta: '',                    // No tag needed — absence of quote = nueva receta
  cotizacionEnviada: '',              // Presence of quote without follow-up tags
  seguimiento1: 'Seguimiento 1',
  seguimiento2: 'Seguimiento 2',
  seguimiento10dias: 'Frío',
};

// All follow-up tags that need to be REMOVED when moving to a new stage
const ALL_FOLLOWUP_TAGS = ['Seguimiento 1', 'Seguimiento 2', 'Frío'];

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, targetStage } = body as { leadId: string; targetStage: PipelineStageKey };

    if (!leadId || !targetStage) {
      return NextResponse.json({ success: false, error: 'leadId y targetStage son requeridos' }, { status: 400 });
    }

    // 1. Remove all existing follow-up tags from this client
    const existingTags = await prisma.tag.findMany({
      where: {
        clients: { some: { id: leadId } },
        name: { in: ALL_FOLLOWUP_TAGS, mode: 'insensitive' },
      },
    });

    if (existingTags.length > 0) {
      await prisma.client.update({
        where: { id: leadId },
        data: {
          tags: {
            disconnect: existingTags.map(t => ({ id: t.id })),
          },
        },
      });
    }

    // 2. Also clean chatLabels on the WhatsApp chat
    const chat = await prisma.whatsAppChat.findFirst({
      where: { clientId: leadId },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (chat) {
      const cleanedLabels = (chat.chatLabels || []).filter(
        (label: string) => !ALL_FOLLOWUP_TAGS.some(t => label.toLowerCase().includes(t.toLowerCase())) &&
          !label.toLowerCase().includes('seguimiento_dia') &&
          !label.toLowerCase().includes('frío') &&
          !label.toLowerCase().includes('frio')
      );
      await prisma.whatsAppChat.update({
        where: { id: chat.id },
        data: { chatLabels: cleanedLabels },
      });
    }

    // 3. Add the new stage tag (if the stage requires one)
    const newTagName = STAGE_TAGS[targetStage];
    if (newTagName) {
      // Find or create the tag
      let tag = await prisma.tag.findFirst({
        where: { name: { equals: newTagName, mode: 'insensitive' } },
      });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: newTagName } });
      }
      await prisma.client.update({
        where: { id: leadId },
        data: {
          tags: { connect: { id: tag.id } },
        },
      });
    }

    return NextResponse.json({ success: true, stage: targetStage });
  } catch (error: any) {
    console.error('[API Leads Move] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
