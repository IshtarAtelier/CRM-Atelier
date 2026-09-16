import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const KEY = 'bot_mantener_apagado_fuera_horario';

/**
 * El escape del vigilante de horario (`@/lib/whatsapp/vigilar-horario-bot.ts`):
 * fuera de horario comercial el bot se prende solo, SALVO que esto esté
 * tildado. Pedido de Ishtar (16/9/2026): "por si por algún motivo realmente
 * quiero apagarlo".
 */
export async function GET() {
    const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    return NextResponse.json({ mantenerApagadoFueraHorario: row?.value === 'true' });
}

export async function POST(request: Request) {
    const actor = getActor(request);
    const body = await request.json().catch(() => ({}));
    const value = Boolean(body?.value);

    await prisma.systemSetting.upsert({
        where: { key: KEY },
        update: { value: String(value) },
        create: { key: KEY, value: String(value) },
    });

    logAudit({
        userId: actor.id,
        userName: actor.name,
        action: 'UPDATE',
        entityType: 'SETTING',
        entityId: KEY,
        details: { descripcion: value ? 'Activó "mantener apagado fuera de horario"' : 'Desactivó "mantener apagado fuera de horario"', mantenerApagadoFueraHorario: value },
    }).catch(console.error);

    return NextResponse.json({ ok: true, mantenerApagadoFueraHorario: value });
}
