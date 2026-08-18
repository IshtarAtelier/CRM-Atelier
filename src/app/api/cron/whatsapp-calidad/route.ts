import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { fetchWa } from '@/lib/wa-config';
import { WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates';

export const dynamic = 'force-dynamic';

/**
 * Salud diaria del número de WhatsApp en la API oficial (Fase 5 del plan).
 *
 * Alta en cron-job.org: GET diario a /api/cron/whatsapp-calidad?secret=CRON_SECRET
 *
 * Igual que `social-cadencia`: manda mail TODOS los días con el número en el
 * asunto — una alarma que solo suena cuando hay problema no se distingue de
 * una alarma rota. Lo que mira:
 *   - que la API responda y el número esté conectado;
 *   - la calidad del número (GREEN / YELLOW / RED) y el límite de mensajería;
 *   - plantillas del catálogo que falten, estén PENDING, REJECTED o PAUSED.
 * Si el transporte todavía es WhatsApp Web (legacy), lo dice y termina.
 */
export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const to = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
    try {
        const st = await fetchWa('/api/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
        if (!st || st.transport !== 'cloud') {
            await sendEmail({ to, subject: 'WhatsApp: todavía en WhatsApp Web (sin API oficial)', text: 'El wa-service sigue con WA_TRANSPORT=webjs. Este chequeo aplica cuando el número esté en la API oficial.' });
            return NextResponse.json({ ok: true, transport: st?.transport || 'desconocido' });
        }

        const problemas: string[] = [];
        if (!st.connected) problemas.push(`Sin conexión con la API: ${st.error || 'sin detalle'}`);
        if (st.qualityRating && st.qualityRating !== 'GREEN') problemas.push(`Calidad del número: ${st.qualityRating}`);

        let plantillas: { name: string; status: string }[] = [];
        try {
            plantillas = await fetchWa('/api/templates/sync', { method: 'POST' }).then(r => r.json());
        } catch (e: any) {
            problemas.push(`No se pudieron leer las plantillas: ${e.message}`);
        }
        const porNombre = new Map(plantillas.map(t => [t.name, t.status]));
        const faltan: string[] = [], pendientes: string[] = [], rechazadas: string[] = [];
        for (const name of Object.keys(WHATSAPP_TEMPLATES)) {
            const s = porNombre.get(name);
            if (!s) faltan.push(name);
            else if (s === 'PENDING') pendientes.push(name);
            else if (s === 'REJECTED' || s === 'PAUSED' || s === 'DISABLED') rechazadas.push(`${name} (${s})`);
        }
        if (rechazadas.length) problemas.push(`Plantillas rechazadas/pausadas: ${rechazadas.join(', ')}`);
        if (faltan.length) problemas.push(`Plantillas del catálogo que faltan en Meta: ${faltan.join(', ')}`);

        const resumen = `${st.phone || '?'} · calidad ${st.qualityRating || '?'} · límite ${st.messagingLimitTier || '?'} · plantillas OK ${Object.keys(WHATSAPP_TEMPLATES).length - faltan.length - pendientes.length - rechazadas.length}/${Object.keys(WHATSAPP_TEMPLATES).length}`;
        const subject = problemas.length
            ? `⚠️ WhatsApp API: ${problemas.length} cosa(s) para mirar — ${resumen}`
            : `✅ WhatsApp API sana — ${resumen}`;
        const text = [
            `Número: ${st.phone || '?'} (${st.verifiedName || 'sin nombre verificado'})`,
            `Calidad: ${st.qualityRating || '?'} · Límite de mensajería: ${st.messagingLimitTier || '?'}`,
            '',
            problemas.length ? `Para mirar:\n- ${problemas.join('\n- ')}` : 'Sin problemas.',
            pendientes.length ? `\nPlantillas esperando aprobación de Meta: ${pendientes.join(', ')}` : '',
            '',
            'Dónde: business.facebook.com → WhatsApp Manager → Números de teléfono / Plantillas de mensajes.',
        ].join('\n');

        await sendEmail({ to, subject, text });
        return NextResponse.json({ ok: true, problemas, resumen });
    } catch (e: any) {
        await sendEmail({ to, subject: '⚠️ WhatsApp API: el chequeo diario falló', text: e.message }).catch(() => {});
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
