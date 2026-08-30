import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PIPELINE_COLUMNS, type PipelineStageKey } from '@/types/leads';
import { classifyLead, isFollowupStage, STAGE_ORDER } from '@/lib/leads-pipeline';
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

const PAUSE_DAYS_ON_BACKWARD_MOVE = 14;

export async function PATCH(req: NextRequest) {
  try {
    const actor = getActor(req);
    const body = await req.json();
    const { leadId, targetStage } = body as { leadId: string; targetStage: PipelineStageKey };

    if (!leadId || !targetStage || !(targetStage in STAGE_TO_LABEL)) {
      return NextResponse.json({ success: false, error: 'leadId y targetStage son requeridos' }, { status: 400 });
    }

    // 1. Load the lead with what we need to know its current stage
    const client = await prisma.client.findUnique({
      where: { id: leadId },
      include: {
        prescriptions: { orderBy: { date: 'desc' }, take: 1, select: { id: true } },
        orders: {
          where: { isDeleted: false, orderType: 'QUOTE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        tags: { select: { name: true } },
        whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1 },
      },
    });

    if (!client) {
      return NextResponse.json({ success: false, error: 'Lead no encontrado' }, { status: 404 });
    }

    const latestQuote = client.orders[0] ?? null;

    // Guard: una columna de seguimiento presupone una cotización enviada.
    // Antes esto fallaba silenciosamente y la tarjeta "volvía sola".
    if (isFollowupStage(targetStage) && !latestQuote) {
      return NextResponse.json(
        { success: false, error: 'Este lead no tiene presupuesto: cargale una cotización antes de pasarlo a seguimiento' },
        { status: 400 }
      );
    }

    const chat = client.whatsappChats[0] ?? null;

    // Current stage (same rule the board uses to place the card)
    const { stage: currentStage } = classifyLead({
      quoteCreatedAt: latestQuote?.createdAt ?? null,
      hasPrescription: client.prescriptions.length > 0,
      chatLabels: chat?.chatLabels || [],
      tagNames: client.tags.map(t => t.name),
      now: Date.now(),
    });

    const movingBackward = STAGE_ORDER[targetStage] < STAGE_ORDER[currentStage];

    // 2-4. Update chat labels (si el lead no tiene chat de WhatsApp, seguimos
    // igual: las tags del cliente también clasifican la etapa)
    if (chat) {
      // Clean ALL followup labels from chatLabels
      let updatedLabels = (chat.chatLabels || []).filter(
        (label: string) => !ALL_FOLLOWUP_LABELS.includes(label)
      );

      // Also remove SIN_SEGUIMIENTO if moving to an active stage
      if (targetStage !== 'nuevaReceta' && targetStage !== 'primerContacto') {
        updatedLabels = updatedLabels.filter((l: string) => l !== 'SIN_SEGUIMIENTO');
      }

      // Add the new stage label (if applicable)
      const newLabel = STAGE_TO_LABEL[targetStage];
      if (newLabel) {
        updatedLabels.push(newLabel);
      }

      await prisma.whatsAppChat.update({
        where: { id: chat.id },
        data: {
          chatLabels: updatedLabels,
          // Retroceso manual: pausamos el motor automático de seguimientos.
          // Sin esto, el wa-service ve el escalón "faltante" y re-manda
          // mensajes que el cliente ya recibió (el retroceso borra las
          // etiquetas que registran los envíos).
          ...(movingBackward && isFollowupStage(currentStage)
            ? { followUpPausedUntil: new Date(Date.now() + PAUSE_DAYS_ON_BACKWARD_MOVE * 86_400_000) }
            : {}),
        },
      });
    }

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
    await prisma.clientTask.updateMany({
      where: {
        clientId: leadId,
        type: 'FOLLOWUP',
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    // 7. Trazabilidad: nota firmada en la ficha + audit log
    const desde = PIPELINE_COLUMNS[currentStage]?.title ?? currentStage;
    const hasta = PIPELINE_COLUMNS[targetStage]?.title ?? targetStage;
    await prisma.interaction.create({
      data: {
        clientId: leadId,
        type: 'NOTE',
        userId: actor.id,
        userName: actor.name,
        content: `📋 [EMBUDO] ${actor.name} movió la tarjeta de "${desde}" a "${hasta}"`,
      },
    });
    logAudit({
      userId: actor.id,
      userName: actor.name,
      action: 'STATUS_CHANGE',
      entityType: 'CONTACT',
      entityId: leadId,
      details: { origen: 'embudo', desde: currentStage, hasta: targetStage },
    }).catch(console.error);

    // Avance manual a seguimiento: el tablero cambia pero NADIE le escribió
    // al cliente (el envío manual es de otra fase). Avisar para que la
    // etiqueta en pantalla no se lea como "mensaje enviado".
    const advertencia =
      !movingBackward && isFollowupStage(targetStage)
        ? 'La tarjeta se movió, pero NO se envió ningún mensaje al cliente'
        : undefined;

    return NextResponse.json({ success: true, stage: targetStage, ...(advertencia ? { advertencia } : {}) });
  } catch (error: any) {
    console.error('[API Leads Move] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
