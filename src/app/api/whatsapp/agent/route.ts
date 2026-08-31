import { NextResponse } from 'next/server';

import { fetchWa } from '@/lib/wa-config';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

// GET /api/whatsapp/agent — obtener configuración del agente
export async function GET() {
    try {
        const res = await fetchWa('/api/agent', { cache: 'no-store' });
        const data = await res.json();
        // El status del wa-service se propaga tal cual: si allá falló, acá no
        // puede figurar 200 (ver el porqué completo en el POST de abajo).
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('[WhatsApp Agent API] Error:', error.message);
        return NextResponse.json({
            prompt: '',
            enabled: false,
            // Sin respuesta del servicio no sabemos el estado real. Mostramos los
            // seguimientos como apagados: que el interruptor diga "Activos" cuando
            // no pudimos confirmarlo es la mentira más cara de las dos.
            followupsEnabled: false,
            apiKey: '',
            model: 'gpt-4o-mini',
            configured: false,
            error: 'Servidor de WhatsApp no disponible'
        });
    }
}

// POST /api/whatsapp/agent — guardar configuración del agente (prompt, enabled, apiKey, model)
export async function POST(request: Request) {
    const actor = getActor(request);

    try {
        const body = await request.json();
        const res = await fetchWa('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();

        // 🔴 El status del wa-service se PROPAGA. Acá siempre se respondía 200,
        // aunque el servicio contestara 410 o 500 con `{error}` en el cuerpo.
        // El provider (`WhatsAppProvider.setFollowupsEnabled`) mira `res.ok`
        // para revertir el interruptor y avisar, así que ese chequeo no
        // disparaba nunca: la dueña apagaba "Seguimientos", veía "Pausados" y
        // los seguimientos seguían saliendo. Un 200 con `{error}` adentro es
        // peor que un error, porque nadie lo mira.
        const ok = res.ok;

        // Trazabilidad de actor (regla de CLAUDE.md): reescribir el prompt del
        // bot o apagar los seguimientos son mutaciones de negocio y hasta acá no
        // dejaban ni una fila de quién las hizo. Del prompt se guarda el LARGO,
        // nunca el cuerpo: son miles de caracteres y no aportan al rastro.
        const cambios: Record<string, unknown> = {};
        if (body?.prompt !== undefined) cambios.promptLargo = String(body.prompt ?? '').length;
        if (body?.dailyContext !== undefined) cambios.contextoDiarioLargo = String(body.dailyContext ?? '').length;
        if (body?.enabled !== undefined) cambios.botActivo = !!body.enabled;
        if (body?.followupsEnabled !== undefined) cambios.seguimientosActivos = !!body.followupsEnabled;
        if (body?.model !== undefined) cambios.model = body.model;
        // La apiKey NUNCA se loguea, ni parcial: solo que se tocó.
        if (body?.apiKey !== undefined) cambios.apiKeyCambiada = true;

        const queCambio = Object.keys(cambios);
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: ok ? 'UPDATE' : 'ATTEMPT_FAILED',
            entityType: 'SETTING',
            entityId: 'whatsapp_agent',
            details: {
                descripcion: ok
                    ? `Configuración del bot de WhatsApp actualizada (${queCambio.join(', ') || 'sin cambios'})`
                    : `Intento fallido de cambiar la configuración del bot de WhatsApp (HTTP ${res.status})`,
                cambios,
                status: res.status,
            },
        }).catch(console.error);

        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('[WhatsApp Agent POST] Error:', error.message);
        logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'ATTEMPT_FAILED',
            entityType: 'SETTING',
            entityId: 'whatsapp_agent',
            details: {
                descripcion: 'Intento de cambiar la configuración del bot: el servidor de WhatsApp no respondió',
                error: error.message,
            },
        }).catch(console.error);
        return NextResponse.json({ error: 'Servidor de WhatsApp no disponible' }, { status: 503 });
    }
}
