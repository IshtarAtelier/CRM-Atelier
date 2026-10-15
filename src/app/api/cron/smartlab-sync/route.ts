import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { sendEmail } from '@/lib/email';
import { PRIVATE_ADMIN_EMAILS } from '@/lib/constants';

import { prisma } from '@/lib/db';
import { GrupoOpticoProvider } from '@/services/lab-providers/grupo-optico.provider';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';
import { correrSeguimiento, tocaPasadaCompleta, ultimaPasadaCompleta } from '@/services/lab-modules/corrida';
import { MODULO_GRUPO_OPTICO } from '@/services/lab-modules/grupo-optico/modulo';

// Ventana del pase rápido de facturación: lo recién facturado aparece cuando el
// pedido pasa a FINALIZADO en el portal; 21 días dan margen incluso para pedidos
// lentos (la pasada diaria completa cubre cualquier cola más vieja).
const FAST_INVOICE_WINDOW_DAYS = 21;

// Ventana del pase rápido del EMAIL de Optovision: alcanza con lo reciente (las
// facturas nuevas se procesan a los minutos de llegar); 3 días cubren fines de
// semana largos. La pasada diaria (35 días) es la red de seguridad.
const FAST_OPTOVISION_EMAIL_DAYS = 3;

// Recuperación del portal de Grupo Óptico: si la pasada COMPLETA lleva más de
// estas horas sin salir bien (el portal caído, o el cron diario que no corrió),
// el próximo pase que lo encuentre en pie hace una completa en vez de la corta.
// Tiene que ser MÁS de 24 h: la diaria corre cada 24 h. Con 20 (hasta el
// 25/9/2026) la "recuperación" se disparaba TODAS las mañanas a las 8:00
// aunque la diaria estuviera bien —a esa hora la última completa tenía ~23 h—
// y chocaba con la diaria de las 8:30 contra el portal (PDFs a medias,
// importes disparatados). Con 26 solo entra si la diaria de verdad no salió.
const FULL_CATCHUP_HOURS = 26;

// Sello de la última pasada COMPLETA exitosa de COSTOS de Grupo Óptico. Es la
// misma clave que escribe runAllProviders en el cron diario
// (lab-providers/index.ts), así que ambos caminos comparten el mismo reloj.
// La salud del SEGUIMIENTO es otra: `lab-modulo:GRUPO_OPTICO:*` (portal/salud.ts).
const GO_LAST_OK_KEY = 'lab-provider:GRUPO_OPTICO:lastOkAt';

async function getSetting(key: string): Promise<string | null> {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row?.value || null;
}

async function setSetting(key: string, value: string) {
    await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
}

/**
 * El tick de Grupo Óptico: seguimiento de pedidos y, EN EL MISMO TICK y
 * DESPUÉS, el pase rápido de conciliación de costos. Lo dispara
 * instrumentation.ts cada 10 minutos en horario comercial (8-20 ARG).
 *
 * El seguimiento es el módulo `MODULO_GRUPO_OPTICO` corrido por
 * `correrSeguimiento` (lab-modules/corrida.ts): turno del portal, salud y los
 * avisos de caída / credencial rechazada / restablecido a PRIVATE_ADMIN_EMAILS.
 * Hasta el 3/10/2026 esta ruta tenía su propio régimen de alertas con
 * `smartlab_down_since` / `smartlab_alerted_at` y una dirección escrita a mano;
 * esas claves ya no se escriben ni se leen.
 *
 * Por qué Grupo Óptico no corre por /api/cron/lab-modulos como los demás
 * módulos: la conciliación rápida de abajo tiene que ir DESPUÉS del
 * seguimiento del mismo tick (lo recién FINALIZADO en el portal es lo que
 * trae importes), y las dos pasadas comparten el turno del portal: acá quedan
 * en orden y nunca a la vez.
 */
export async function GET(req: Request) {
    // Auth por header Bearer (preferido) o ?secret= (fallback), tiempo constante.
    const auth = verifyCronAuth(req);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        // Pase rápido (21 días de pedidos del portal) salvo que a Grupo Óptico
        // le toque la pasada completa (120 días, una vez cada 20 h y la primera
        // corrida después de un deploy): es la que pone al día el espejo con lo
        // viejo, y sin ella un nº real pero fuera de la ventana corta saldría
        // como "no encontrado". Misma regla que /api/cron/lab-modulos.
        const completa = tocaPasadaCompleta(await ultimaPasadaCompleta(MODULO_GRUPO_OPTICO.clave), new Date());
        const result = await correrSeguimiento(MODULO_GRUPO_OPTICO, completa ? { esperarTurno: true } : { sinceDays: FAST_INVOICE_WINDOW_DAYS });

        if (result.skipped) {
            console.log(`[CRON SmartLab] Seguimiento omitido: ${result.reason}`);
        } else if (!result.ok) {
            console.error(`[CRON SmartLab] Seguimiento falló: ${result.error}`);
        } else {
            const s = result.seguimiento!;
            console.log(`[CRON SmartLab] Seguimiento completado: ${s.vistos} pedidos vistos, ${s.avanzados} ventas avanzadas, ${s.terminados} terminadas`);
        }

        // PASE RÁPIDO de conciliación de costos (pedido del administrador: revisión
        // cada 10 minutos de todo lo NUEVO facturado por Grupo Óptico). Ventana
        // corta del portal + PDF de comprobantes → completa importes de lo recién
        // FINALIZADO, re-cruza pendientes y dispara las alertas inmediatas
        // (diferencias de costo y pedidos sin venta ni postventa). Tolerante a
        // fallas: nunca rompe el seguimiento que corre arriba. Si el seguimiento
        // se SALTEÓ (otra pasada tiene el turno del portal), el pase rápido
        // tampoco corre: el portal está ocupado y el tick siguiente lo hace.
        // Si el seguimiento FALLÓ (portal caído) sí corre: el escaneo de
        // Optovision y el re-cruce no dependen del portal de Grupo Óptico.
        let fastReconciliation: Record<string, unknown> | null = null;
        if (!result.skipped) {
            try {
                // El modo silencioso pre-backfill lo decide upsertEntry por lab
                // (isQuietLab): hasta que el cron diario complete el backfill de un
                // lab, sus entradas se estampan sin alertar. Acá solo se corre.
                // LECTURA CONSTANTE DE AMBOS LABS (pedido del administrador): cada
                // 10 minutos se leen los emails nuevos de Optovision Y el portal de
                // Grupo Óptico. Los costos se registran en la conciliación, y todo
                // huérfano (de cualquiera de los dos) dispara la alerta inmediata.
                // Tolerante: si el IMAP falla, el resto del pase sigue.
                const optoScan = await LabCostReconciliationService.scanOptovisionInbox(FAST_OPTOVISION_EMAIL_DAYS)
                    .catch((err: any) => { console.error('[CRON SmartLab] Escaneo rápido Optovision falló:', err); return { error: err?.message }; });

                // RECUPERACIÓN AUTOMÁTICA: el portal del lab es un dyndns casero y
                // se cae seguido. Mientras esté caído, cada intento falla; pero
                // apenas responde —en cualquiera de los ~72 intentos del día— hay
                // que recuperar TODO lo que se perdió, no solo la ventana corta.
                // Si la pasada COMPLETA (la del cron diario, que es la que estampa
                // lastOkAt) lleva más de FULL_CATCHUP_HOURS sin salir bien, este
                // pase hace una completa en vez de la rápida y estampa el sello.
                // Así el sistema se pone al día solo, sin esperar al día siguiente.
                const ultimaCompleta = await getSetting(GO_LAST_OK_KEY);
                const horasSinCompleta = ultimaCompleta
                    ? (Date.now() - new Date(ultimaCompleta).getTime()) / 3600000
                    : Infinity;
                const alDia = horasSinCompleta <= FULL_CATCHUP_HOURS;
                // Aislado: el portal de Grupo caído NO puede dejar ciego al resto
                // del pase (los avisos de pedidos sin venta de Optovision y la
                // promoción de pedidos facturados tienen que salir igual).
                const collect: any = await GrupoOpticoProvider.collect(
                    alDia ? { sinceDays: FAST_INVOICE_WINDOW_DAYS } : {},
                ).catch((err: any) => {
                    console.error('[CRON SmartLab] Portal de Grupo Óptico no respondió (se reintenta en la próxima corrida):', err?.message || err);
                    return { error: err?.message || 'portal sin respuesta' };
                });
                // Salteada por el turno (otra pasada contra el portal en curso):
                // no se hizo nada, así que no se sella nada.
                if (!alDia && !collect?.error && !collect?.invoiceError && !collect?.skipped) {
                    // La recuperación salió bien y CON importes: sella la pasada
                    // completa para no repetirla cada 10 minutos.
                    await setSetting(GO_LAST_OK_KEY, new Date().toISOString());
                    console.log(`[CRON SmartLab] Grupo Óptico recuperado: pasada COMPLETA tras ${
                        horasSinCompleta === Infinity ? 'nunca' : `${Math.round(horasSinCompleta)} h`} sin una exitosa.`);
                }
                (collect as any).modo = alDia ? `rápido (${FAST_INVOICE_WINDOW_DAYS} días)` : 'COMPLETO (recuperación)';

                const recheck = await LabCostReconciliationService.recheckUnmatched();
                // El pase rápido ya NO manda mails (Ishtar, 25/9/2026): los pedidos
                // sin venta se avisan una vez por día desde el cron diario, y todo
                // lo demás va en el reporte semanal. Acá solo se registra y cruza.
                // Pedidos de Optovision facturados hace 3+ días hábiles → FINISHED
                // (la factura llega unos días antes de que el pedido esté listo).
                const promoted = await LabCostReconciliationService.promoteFinishedOptovision()
                    .catch((err: any) => { console.error('[CRON SmartLab] promoteFinishedOptovision:', err); return { promoted: 0 }; });
                fastReconciliation = { ...collect, optovision: optoScan, recheck, promoted };

                // Red de seguridad: el backfill (y con él, TODO el régimen de
                // alertas) depende de que el cron diario corra. Si pasadas 24 h
                // desde el primer pase rápido algún lab sigue sin backfill, avisar
                // (máximo una vez por día) en vez de quedar mudos para siempre.
                // Es operación de laboratorio: va a PRIVATE_ADMIN_EMAILS, nunca a
                // la casilla del local ni a ADMIN_EMAIL (no existe en producción).
                try {
                    const pendientes = [];
                    for (const lab of LabCostReconciliationService.BACKFILL_LABS) {
                        if (await LabCostReconciliationService.isQuietLab(lab)) pendientes.push(lab);
                    }
                    if (pendientes.length > 0) {
                        const FIRST_KEY = 'lab_recon_first_fast_pass';
                        const WARN_KEY = 'lab_recon_nodaily_warned_at';
                        const first = await getSetting(FIRST_KEY);
                        if (!first) {
                            await setSetting(FIRST_KEY, new Date().toISOString());
                        } else if (Date.now() - new Date(first).getTime() > 24 * 3600000) {
                            const warned = await getSetting(WARN_KEY);
                            if (!warned || Date.now() - new Date(warned).getTime() > 24 * 3600000) {
                                const r: any = await sendEmail({
                                    to: PRIVATE_ADMIN_EMAILS,
                                    subject: '⚠️ Conciliación de laboratorio: el cron diario nunca corrió',
                                    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
                                        <h2 style="color:#d97706">⚠️ Falta la corrida diaria de conciliación</h2>
                                        <p>Pasaron más de 24 horas y el backfill inicial de <strong>${pendientes.join(' y ')}</strong> sigue pendiente: el cron diario <code>/api/cron/lab-invoices</code> no corrió nunca. Hasta que corra, las alertas de costos de esa(s) fuente(s) están en silencio.</p>
                                        <p>Revisar que la diaria de las 8:30 (instrumentation.ts) esté corriendo: <code>/api/cron/lab-invoices</code>.</p>
                                    </div>`,
                                });
                                if (r?.success) await setSetting(WARN_KEY, new Date().toISOString());
                            }
                        }
                    }
                } catch (warnErr) {
                    console.error('[CRON SmartLab] Aviso de backfill pendiente falló:', warnErr);
                }
                console.log(`[CRON SmartLab] Conciliación rápida: ${collect.withCost || 0} con costo, ` +
                    `${recheck.rematched || 0} re-cruzados`);
            } catch (fastErr) {
                console.error('[CRON SmartLab] Conciliación rápida falló:', fastErr);
                fastReconciliation = { error: fastErr instanceof Error ? fastErr.message : String(fastErr) };
            }
        }

        // Un seguimiento caído responde 500 (como antes), con el detalle del
        // pase de conciliación adentro: el log del tick muestra el cuerpo.
        return NextResponse.json({
            success: result.ok,
            timestamp: new Date().toISOString(),
            ...result,
            fastReconciliation,
        }, { status: result.ok ? 200 : 500 });
    } catch (error: any) {
        console.error('[CRON SmartLab] Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
