import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { PipelineStageKey } from '@/types/leads';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// PATCH /api/leads/pipeline/move
// Moves a lead to a different pipeline stage by updating its
// chatLabels on the WhatsApp chat (the source of truth for
// pipeline stage classification).
// ─────────────────────────────────────────────────────────────

// The followup system uses these chatLabels to classify stage:
// SEGUIMIENTO_DIA_1  → seguimiento1
// SEGUIMIENTO_DIA_4  → seguimiento2
// SEGUIMIENTO_DIA_15 → seguimiento10dias (frío)
// (absence of all)   → cotizacionEnviada (if has quote) or nuevaReceta

// Label to ADD for each target stage
const STAGE_TO_LABEL: Record<string, string> = {
  primerContacto: '',
  nuevaReceta: '',
  cotizacionEnviada: '',
  seguimiento1: 'SEGUIMIENTO_DIA_1',
  seguimiento2: 'SEGUIMIENTO_DIA_4',
  seguimiento10dias: 'SEGUIMIENTO_DIA_15',
};

// All followup labels that must be REMOVED before setting a new one
const ALL_FOLLOWUP_LABELS = ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4', 'SEGUIMIENTO_DIA_15'];

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, targetStage } = body as { leadId: string; targetStage: PipelineStageKey };

    if (!leadId || !targetStage) {
      return NextResponse.json({ success: false, error: 'leadId y targetStage son requeridos' }, { status: 400 });
    }

    // 1. Find the client's WhatsApp chat
    const chat = await prisma.whatsAppChat.findFirst({
      where: { clientId: leadId },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!chat) {
      return NextResponse.json({ success: false, error: 'No se encontró chat de WhatsApp para este lead' }, { status: 404 });
    }

    // 2. Clean ALL followup labels from chatLabels
    let updatedLabels = (chat.chatLabels || []).filter(
      (label: string) => !ALL_FOLLOWUP_LABELS.includes(label)
    );

    // Also remove SIN_SEGUIMIENTO if moving to an active stage
    if (targetStage !== 'nuevaReceta' && targetStage !== 'primerContacto') {
      updatedLabels = updatedLabels.filter((l: string) => l !== 'SIN_SEGUIMIENTO');
    }

    // 3. Add the new stage label (if applicable)
    const newLabel = STAGE_TO_LABEL[targetStage];
    if (newLabel) {
      updatedLabels.push(newLabel);
    }

    // 4. Update the chat
    await prisma.whatsAppChat.update({
      where: { id: chat.id },
      data: { chatLabels: updatedLabels },
    });

    // 5. Also sync client tags for consistency (add/remove Frío, Seguimiento tags)
    const FOLLOWUP_CLIENT_TAGS = ['Seguimiento 1', 'Seguimiento 2', 'Frío', 'Sin Seguimiento'];
    const existingTags = await prisma.tag.findMany({
      where: {
        clients: { some: { id: leadId } },
        name: { in: FOLLOWUP_CLIENT_TAGS, mode: 'insensitive' },
      },
    });

    // Disconnect old followup tags
    if (existingTags.length > 0) {
      await prisma.client.update({
        where: { id: leadId },
        data: {
          tags: { disconnect: existingTags.map(t => ({ id: t.id })) },
        },
      });
    }

    // Connect new stage tag on client if applicable
    const CLIENT_STAGE_TAGS: Record<string, string> = {
      seguimiento1: 'Seguimiento 1',
      seguimiento2: 'Seguimiento 2',
      seguimiento10dias: 'Frío',
    };
    const clientTagName = CLIENT_STAGE_TAGS[targetStage];
    if (clientTagName) {
      let tag = await prisma.tag.findFirst({
        where: { name: { equals: clientTagName, mode: 'insensitive' } },
      });
      if (!tag) {
        tag = await prisma.tag.create({ data: { name: clientTagName } });
      }
      await prisma.client.update({
        where: { id: leadId },
        data: { tags: { connect: { id: tag.id } } },
      });
    }

    // 6. Cancel any pending FOLLOWUP tasks (the cron will regenerate if needed)
    const cancelled = await prisma.clientTask.updateMany({
      where: {
        clientId: leadId,
        type: 'FOLLOWUP',
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    // 7. Firmar la mutación: quién movió el lead, a qué etapa y cuántas tareas
    // FOLLOWUP se cancelaron (mueve tags, chatLabels y tareas → trazabilidad obligatoria).
    const actor = getActor(req);
    // Interaction firmada en la ficha del cliente (estándar del proyecto: timeline + logAudit)
    await prisma.interaction.create({
      data: {
        clientId: leadId,
        type: 'NOTE',
        content: `${actor.name} movió el lead a la etapa "${targetStage}" desde el pipeline${cancelled.count ? ` (${cancelled.count} tarea/s de seguimiento canceladas)` : ''}`,
        userId: actor.id || undefined,
        userName: actor.name,
      },
    }).catch(console.error);
    await logAudit({
      userId: actor.id,
      userName: actor.name,
      action: 'STATUS_CHANGE',
      entityType: 'CONTACT',
      entityId: leadId,
      details: {
        descripcion: `${actor.name} movió el lead a la etapa "${targetStage}" desde el pipeline`,
        targetStage,
        followupTasksCancelled: cancelled.count,
      },
    }).catch(console.error);

    return NextResponse.json({ success: true, stage: targetStage });
  } catch (error: any) {
    console.error('[API Leads Move] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
