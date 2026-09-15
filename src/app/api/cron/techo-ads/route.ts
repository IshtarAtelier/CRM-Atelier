import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AdsBudgetService } from '@/services/ads-budget.service';
import { InternalMessagingService } from '@/services/internal-messaging.service';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Aviso de que se acabó el presupuesto de publicidad.
//
// Por qué NO es un email ni un WhatsApp (pedido de Ishtar, 14/9/26):
//  · El email se ignora — de eso nació todo este cambio: el reporte de pauta
//    pasó a quincenal justamente porque 30 mails por mes no se leían.
//  · Un WhatsApp iniciado por el sistema necesita una plantilla aprobada en
//    Meta. Es un trámite que depende de Meta y que ya falló antes acá
//    (aviso_pago_interno estuvo meses sin aprobarse).
//  · El aviso interno URGENTE le tapa la pantalla a la dueña cuando entra al
//    CRM y no se va hasta que lo abre. No depende de nadie más y es inmediato.
//
// Avisa DOS cosas distintas, una sola vez cada una por mes:
//  · Se acabó de verdad (lo gastado pasó el techo) → urgente, pop-up.
//  · Al ritmo actual el mes cierra por encima del techo → aviso normal, sin
//    tapar la pantalla: todavía hay plata, es una advertencia.
//
// Como todos los crons del proyecto: avisa, NO apaga campañas. Apagar sola una
// campaña que la dueña acaba de prender sería peor que el problema.
// ─────────────────────────────────────────────────────────────────────────────

/** Recuerda qué se avisó, para no repetirlo todos los días del mes. */
const CLAVE_AVISO = 'ads_techo_aviso_enviado';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const techo = await AdsBudgetService.getEstado();
        if (techo.estado === 'sin_datos' || techo.gastadoArs === null) {
            return NextResponse.json({ ok: true, avisado: false, motivo: 'no se pudo leer el gasto' });
        }

        // "Se acabó" es lo GASTADO por encima del techo, no la proyección: la
        // proyección es una advertencia, esto es un hecho.
        const seAcabo = techo.gastadoArs >= techo.techoArs;
        const vaAExcederse = !seAcabo && techo.estado === 'excedido';
        if (!seAcabo && !vaAExcederse) {
            return NextResponse.json({ ok: true, avisado: false, estado: techo.estado });
        }

        const mes = new Date().toISOString().slice(0, 7); // YYYY-MM
        const marca = `${mes}:${seAcabo ? 'agotado' : 'proyeccion'}`;
        const previo = await prisma.systemSetting.findUnique({ where: { key: CLAVE_AVISO } });
        if (previo?.value === marca) {
            return NextResponse.json({ ok: true, avisado: false, motivo: 'ya se avisó este mes', marca });
        }

        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length === 0) {
            return NextResponse.json({ ok: true, avisado: false, motivo: 'no hay administradores a quién avisarle' });
        }

        const plata = (n: number | null) => '$' + Math.round(n ?? 0).toLocaleString('es-AR');
        const cuerpo = seAcabo
            ? `Se acabó el presupuesto de publicidad de este mes.\n\n`
              + `Van ${plata(techo.gastadoArs)} de ${plata(techo.techoArs)} (Meta ${techo.meta !== null ? plata(techo.meta) : 'sin leer'} · Google ${techo.google !== null ? plata(techo.google) : 'sin leer'}), `
              + `en ${techo.diaDelMes} de ${techo.diasDelMes} días.\n\n`
              + `Las campañas NO se apagaron solas: si querés frenar el gasto hay que pausarlas a mano en Meta y en Google.`
              + (techo.sinLeer.length ? `\n\nOjo: no se pudo leer ${techo.sinLeer.join(' ni ')}, así que el gasto real es todavía mayor.` : '')
            : `Al ritmo actual el presupuesto de publicidad no llega a fin de mes.\n\n${techo.mensaje}\n\n`
              + `Van ${plata(techo.gastadoArs)} de ${plata(techo.techoArs)} en ${techo.diaDelMes} de ${techo.diasDelMes} días. Todavía hay plata, pero al ritmo de hoy se pasa.`;

        let enviados = 0;
        for (const admin of admins) {
            // `urgent` solo cuando se acabó: el pop-up que tapa la pantalla se
            // gasta rápido si salta también por una proyección.
            const res = await InternalMessagingService.mensajeDeIA({
                paraUserId: admin.id,
                asunto: seAcabo ? 'Se acabó el presupuesto de publicidad' : 'El presupuesto de publicidad se va a pasar',
                cuerpo,
                urgent: seAcabo,
                dedupePrefijo: cuerpo.slice(0, 40),
            }).catch((e) => { console.error('[CRON techo-ads] No se le pudo avisar a un admin:', e); return null; });
            if (res) enviados++;
        }

        // La marca se guarda aunque un envío falle: reintentar mañana es mejor
        // que repetir el pop-up todos los días si ya le llegó a alguien.
        if (enviados > 0) {
            await prisma.systemSetting.upsert({
                where: { key: CLAVE_AVISO },
                update: { value: marca },
                create: { key: CLAVE_AVISO, value: marca },
            });
        }

        return NextResponse.json({ ok: true, avisado: enviados > 0, enviados, urgente: seAcabo, estado: techo.estado, marca });
    } catch (error) {
        console.error('[CRON techo-ads] Error:', error);
        return NextResponse.json({ error: 'Error al revisar el techo de publicidad' }, { status: 500 });
    }
}
