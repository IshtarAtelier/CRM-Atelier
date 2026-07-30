import { spawn } from 'child_process';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Solo header Bearer o ?secret= contra CRON_SECRET (patrón de los demás
    // crons). Antes la clave era 'atelier2026' hardcodeada acá: cualquiera con
    // la URL podía disparar una campaña masiva de WhatsApp.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Botón de pánico: el interruptor "Seguimientos" del CRM pausa TODO lo
    // saliente automático, incluido este camino. Sin este check, apagarlo
    // frenaba los crons del wa-service pero este broadcast salía igual.
    const followupsSetting = await prisma.systemSetting.findUnique({
        where: { key: 'followups_enabled' },
    });
    if (followupsSetting && followupsSetting.value !== 'true') {
        return NextResponse.json({
            status: 'skipped',
            message: 'Seguimientos pausados desde el CRM. No se inició el broadcast.',
        });
    }

    try {
        // Lanzar el script en segundo plano de forma independiente (detached)
        // para que la respuesta HTTP no se quede colgando y el bot trabaje tranquilo.
        const child = spawn('npx', ['tsx', 'scripts/broadcast-followup.ts'], {
            detached: true,
            stdio: 'ignore'
        });

        child.unref();

        return NextResponse.json({
            status: 'success',
            message: '🚀 Bot de seguimiento masivo iniciado en segundo plano. Procesará los cierres de este mes.'
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
