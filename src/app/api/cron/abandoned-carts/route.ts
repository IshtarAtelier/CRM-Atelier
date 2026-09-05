import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { runRecoveryTouch, RECOVERY_STAGE, type RecoveryTouch } from '@/lib/checkout/recovery';

/**
 * Recuperación de carritos abandonados (tienda), multi-toque.
 *
 * Dos oportunidades, no una:
 *  - ~1h de la última actividad: mail corto de recordatorio, SIN cupón.
 *  - ~24h: el mail con cupón de siempre.
 *
 * Los dos toques salen por MAIL. El de las 24hs supo preferir un toque por
 * WhatsApp cuando el cliente ya tenía chat abierto; eso dependía de un ejecutor
 * que no existe en la API oficial, así que consumía el toque sin mandar nada
 * (ver runRecoveryTouch). Por WhatsApp los toca una persona desde Oportunidades
 * de Cierre.
 *
 * Piso de 72h: un carrito de hace cuatro días ya no se recupera, se persigue.
 *
 * El candado de "ya compró" y el reclamo del toque viven en
 * `src/lib/checkout/recovery.ts`; acá solo se elige a quién le toca.
 *
 * Quién lo dispara: el scheduler interno de `src/instrumentation.ts`, una vez
 * por hora de 9 a 20 ARG. Antes decía "hay que darlo de alta en un scheduler
 * externo" y nadie lo dio de alta nunca — el `vercel.json` que declaraba el
 * schedule no lo ejecuta Railway. Sigue aceptando el disparo manual: GET a
 * /api/cron/abandoned-carts?secret=CRON_SECRET.
 *
 * Cada hora y no una vez por día: con una corrida diaria el toque temprano casi
 * nunca cae dentro de su ventana de 1h a 24h y el carrito termina recibiendo
 * solo el de las 24hs.
 */

/** Horas desde la última actividad del cliente para cada toque. */
const TOQUE_TEMPRANO_HS = 1;
const TOQUE_TARDIO_HS = 24;
/** Piso: no perseguir carritos de hace más de 3 días. */
const VENTANA_MAXIMA_HS = 72;

/** Con casilla utilizable: `not: null` no alcanza, en la base hay strings vacíos. */
const CON_EMAIL: Prisma.CheckoutSessionWhereInput = { email: { not: null, notIn: [''] } };

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Header Bearer o ?secret= contra CRON_SECRET (patrón de los demás crons).
    // Antes había dos agujeros: una clave por defecto hardcodeada acá —o sea
    // publicada en el repo— y un bypass `!request.url.includes('localhost')`
    // que alcanzaba con burlar mandando cualquier query string con esa palabra
    // (`?x=localhost`). Cualquiera de los dos habilitaba a un desconocido a
    // disparar una tanda de emails a clientes reales.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const haceUnaHora = new Date(now - TOQUE_TEMPRANO_HS * 60 * 60 * 1000);
    const hace24Horas = new Date(now - TOQUE_TARDIO_HS * 60 * 60 * 1000);
    const hace72Horas = new Date(now - VENTANA_MAXIMA_HS * 60 * 60 * 1000);

    // Toque temprano: entre 1h y 24h, sin ningún toque previo. Solo por mail,
    // así que exige email. `updatedAt` es el reloj del abandono — si el cliente
    // volvió a tocar su carrito, se reinicia y no lo estamos interrumpiendo.
    const tempranos = await prisma.checkoutSession.findMany({
      where: {
        status: 'PENDING',
        recoveryStage: 0,
        updatedAt: { lte: haceUnaHora, gt: hace24Horas },
        ...CON_EMAIL,
      }
    });

    // Toque de las 24hs: el que ya existía. `recoveryStage < 2` deja entrar
    // tanto al que recibió el temprano como al que se lo salteó (cron caído,
    // o carrito abandonado hace 30hs que nunca estuvo en la ventana de 1h).
    // Los que dejaron teléfono y no mail entran igual y salen contados en
    // `sinCanal`: no se les consume el toque (el reclamo pasa después del
    // chequeo de email), así que siguen enteros en Oportunidades de Cierre
    // para que una persona los toque por WhatsApp.
    const tardios = await prisma.checkoutSession.findMany({
      where: {
        status: 'PENDING',
        recoveryStage: { lt: RECOVERY_STAGE.LATE },
        updatedAt: { lte: hace24Horas, gte: hace72Horas },
        OR: [
          CON_EMAIL,
          { phone: { not: null, notIn: [''] } },
        ],
      }
    });

    const stats = {
      early: 0,
      late: 0,
      skippedPurchased: 0,
      alreadyTouched: 0,
      // Dejó teléfono pero no mail, y no tiene chat con entrantes: no hay canal
      // por dónde tocarlo. No es una falla, es un carrito anónimo.
      sinCanal: 0,
      failed: 0,
    };

    const procesar = async (sessions: typeof tempranos, touch: RecoveryTouch) => {
      for (const session of sessions) {
        try {
          const result = await runRecoveryTouch(session, touch);
          if (result.sent) {
            if (touch === 'EARLY') stats.early++;
            else stats.late++;
          } else if (result.skipped === 'purchased') {
            stats.skippedPurchased++;
          } else if (result.skipped === 'already_touched') {
            // Otra corrida se lo llevó (o el scheduler disparó dos veces): no es
            // un error, es justamente lo que el reclamo previo tiene que evitar.
            stats.alreadyTouched++;
          } else if (result.skipped === 'no_email') {
            stats.sinCanal++;
          } else {
            stats.failed++;
          }
        } catch (err: any) {
          console.error(`[Cron Abandoned Cart] Error en sesión ${session.id} (${touch}):`, err.message);
          stats.failed++;
        }
      }
    };

    await procesar(tempranos, 'EARLY');
    await procesar(tardios, 'LATE');

    const processed = tempranos.length + tardios.length;
    console.log(
      `[Cron Abandoned Cart] ${stats.early} recordatorios (1h), ${stats.late} emails (24h), ` +
      `${stats.skippedPurchased} omitidos (ya compró), ` +
      `${stats.alreadyTouched} ya tocados, ${stats.sinCanal} sin canal, ${stats.failed} fallidos de ${processed}`
    );

    return NextResponse.json({
      success: true,
      processed,
      // `sent` es el total de toques efectivos: lo que miraban los reportes
      // cuando esto mandaba un solo mail.
      sent: stats.early + stats.late,
      ...stats,
    });
  } catch (error: any) {
    console.error('[Cron Abandoned Cart] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
