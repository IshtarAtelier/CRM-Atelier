import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { saludDelEmbudo } from '@/lib/seguimientos/salud';

export const dynamic = 'force-dynamic';

/**
 * Alerta diaria del embudo. La dispara `src/instrumentation.ts` a las 19:30
 * (Córdoba), cuando el motor ya hizo su último tick del día.
 *
 * Igual que `whatsapp-calidad`: manda mail TODOS los días con el resultado en
 * el asunto — una alarma que solo suena cuando hay problema no se distingue
 * de una alarma rota. Lo que mira lo define `lib/seguimientos/salud.ts`:
 * motor que no corrió, corrió sin mandar, fallas, freno, y leads olvidados.
 */
export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const to = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
    try {
        const s = await saludDelEmbudo(7);
        const hoy = s.dias[s.dias.length - 1];
        const subject = s.problemasHoy.length
            ? `⚠️ Embudo: ${s.problemasHoy.length} problema(s) hoy — ${hoy.enviados} seguimientos enviados`
            : `✅ Embudo: ${hoy.enviados} seguimientos enviados hoy, ${hoy.corridas} corridas, ${hoy.respuestas} respuestas`;
        const tabla = s.dias.map(d => `  ${d.dia}  corridas ${String(d.corridas).padStart(2)}  enviados ${String(d.enviados).padStart(3)}  fallidos ${String(d.fallidos).padStart(2)}  en espera ${String(d.enEsperaUltimo).padStart(3)}  respuestas ${d.respuestas}${d.horasSinCorrida.length ? `  ⚠️ sin correr: ${d.horasSinCorrida.join(',')}` : ''}${d.frenos ? '  ⛔ freno' : ''}`).join('\n');
        const text = [
            s.problemasHoy.length ? `Para mirar hoy:\n- ${s.problemasHoy.join('\n- ')}` : 'Hoy sin problemas.',
            '',
            'Últimos 7 días:',
            tabla,
            '',
            hoy.vetosPrincipales.length ? `Por qué no salieron más hoy (mayor motivo por corrida):\n${hoy.vetosPrincipales.map(v => `  - ${v.cantidad} × ${v.motivo}`).join('\n')}` : '',
            s.olvidados.length ? `\nOlvidados (toque vencido hace +24 h y nadie les escribió):\n${s.olvidados.slice(0, 15).map(o => `  - ${o.nombre}: ${o.paso} (vencido hace ${o.vencidoHace})`).join('\n')}${s.olvidados.length > 15 ? `\n  … y ${s.olvidados.length - 15} más` : ''}` : '',
            '',
            'Vista completa: /admin/leads/salud',
        ].filter(Boolean).join('\n');
        await sendEmail({ to, subject, text });
        return NextResponse.json({ ok: true, problemas: s.problemasHoy, hoy });
    } catch (e: any) {
        await sendEmail({ to, subject: '⚠️ Embudo: el chequeo diario falló', text: e.message }).catch(() => {});
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
