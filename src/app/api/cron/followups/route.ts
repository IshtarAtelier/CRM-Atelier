import { spawn } from 'child_process';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
    // Dispara un broadcast masivo de WhatsApp: mismo esquema de auth que auto-blog
    // (CRON_SECRET por header Authorization, comparación en tiempo constante).
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(cronSecret);
    if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
