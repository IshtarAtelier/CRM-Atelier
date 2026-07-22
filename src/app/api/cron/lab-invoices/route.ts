import { NextResponse } from 'next/server';
import { runAllProviders, LAB_PROVIDERS } from '@/services/lab-providers';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Alertar cuando un proveedor lleva esta cantidad de días sin correr bien.
const STALE_DAYS = 3;

/**
 * Cron DIARIO de conciliación de costos de laboratorio. Orquesta la capa de
 * proveedores (src/services/lab-providers):
 *   - OPTOVISION: facturas PDF por email (IMAP) → costo real + alertas de sobrecosto
 *   - GRUPO_OPTICO: pedidos vía la API del portal SmartLab → cruce y huérfanos
 * Después re-cruza lo pendiente y controla la salud de cada proveedor: si alguno
 * lleva 3+ días sin una corrida exitosa, avisa por email (el sistema se audita
 * a sí mismo — un pipeline caído en silencio es un agujero de auditoría).
 *
 * Alta en cron-job.org: GET diario a /api/cron/lab-invoices?secret=CRON_SECRET
 * Query params opcionales: &days=35 (ventana IMAP hacia atrás)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const auth = verifyCronAuth(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const days = Math.min(parseInt(searchParams.get('days') || '35', 10) || 35, 365);

        // PRIMERA CORRIDA EN PRODUCCIÓN = BACKFILL SILENCIOSO, POR PROVEEDOR: el
        // lab sin backfill registra y cruza todo su histórico (35 días de facturas
        // / toda la era CRM del portal) sin emails ni flips de estado — todo queda
        // marcado como ya alertado (lo decide upsertEntry vía isQuietLab). El flag
        // de cada lab se setea SOLO si SU corrida terminó bien: si IMAP falla el
        // día del estreno, el histórico de Optovision sigue en silencio hasta que
        // su backfill de verdad ocurra — con un flag global, esa falla parcial
        // soltaba el aluvión retroactivo completo al día siguiente.
        const results: Record<string, any> = await runAllProviders({ days });

        const backfilled: string[] = [];
        for (const lab of LabCostReconciliationService.BACKFILL_LABS) {
            const yaHecho = await prisma.systemSetting.findUnique({
                where: { key: LabCostReconciliationService.backfillKey(lab) },
            });
            if (yaHecho?.value) continue;
            // El backfill de un lab está completo solo si su corrida terminó bien
            // Y con los importes cargados: para Grupo Óptico, un portal que responde
            // pero con el PDF de comprobantes caído (invoiceError) deja los costos
            // sin ingresar — marcar el flag ahí haría que los importes históricos
            // entren "ruidosos" en la corrida siguiente.
            if (results[lab]?.ok === true && !results[lab]?.invoiceError) {
                await prisma.systemSetting.upsert({
                    where: { key: LabCostReconciliationService.backfillKey(lab) },
                    update: { value: new Date().toISOString() },
                    create: { key: LabCostReconciliationService.backfillKey(lab), value: new Date().toISOString() },
                });
                backfilled.push(lab);
            } else {
                console.warn(`[Cron lab-invoices] Backfill de ${lab} NO completado (corrida fallida/salteada): sigue en modo silencioso.`);
            }
        }
        if (backfilled.length > 0) {
            LabCostReconciliationService.invalidateBackfillCache();
            results.backfill = backfilled;
            console.log(`[Cron lab-invoices] Backfill inicial completado en silencio para: ${backfilled.join(', ')}. Desde ahora, sus hallazgos nuevos alertan.`);
        }

        // Cuenta corriente de Optovision: leer el último resumen de cuenta de
        // Essilor ("Documentos Pendientes") y snapshotear la deuda. Tolerante:
        // si no hay resumen o falla el parseo, no rompe el resto de la revisión.
        results.essilorStatement = await LabCostReconciliationService.scanEssilorStatement()
            .catch((err: any) => { console.error('[Cron lab-invoices] Resumen Essilor:', err); return { error: err?.message }; });

        // Los pedidos SIN VENTA ya avisan en el momento (pase de 10 min) con su
        // triage hecho — ver alertNewFindings({ modo: 'urgente' }) más abajo.

        // RESUMEN DEL DÍA: todo lo que se movió (facturas que llegaron con su
        // veredicto, sobrecostos, ahorros) en UN solo email. Los pedidos sin venta
        // ya se avisaron en el momento — acá solo se barren los que hayan quedado.
        results.sinVenta = await LabCostReconciliationService.alertNewFindings({ modo: 'urgente' })
            .catch((err: any) => ({ error: err?.message }));
        results.resumenDiario = await LabCostReconciliationService.alertNewFindings({ modo: 'diario' })
            .catch((err: any) => ({ error: err?.message }));

        // Pedidos de Optovision facturados hace 3+ días hábiles → FINISHED (la
        // factura llega unos días antes de que el pedido esté terminado).
        results.promoted = await LabCostReconciliationService.promoteFinishedOptovision()
            .catch((err: any) => ({ error: err?.message }));

        // Watchdog: proveedores caídos hace STALE_DAYS o más. El pipeline de
        // importes de Grupo Óptico cuenta aparte: el portal puede responder bien
        // (pedidos registrados, "corrida exitosa") con el PDF de comprobantes roto
        // — sin esto, los costos dejarían de llegar con el semáforo en verde.
        const stale = LAB_PROVIDERS
            .map(p => ({ name: p.name, description: p.description, days: results.health?.[p.name] ?? null }))
            .filter(p => p.days === null || p.days >= STALE_DAYS);
        if (results.GRUPO_OPTICO?.invoiceError && !stale.some(s => s.name === 'GRUPO_OPTICO')) {
            stale.push({
                name: 'GRUPO_OPTICO (importes)',
                description: `PDF de comprobantes falló: ${results.GRUPO_OPTICO.invoiceError}`,
                days: null,
            });
        }

        if (stale.length > 0) {
            const items = stale.map(p =>
                `<li><strong>${p.name}</strong> (${p.description}): ${p.days === null ? 'nunca corrió bien' : `sin corrida exitosa hace ${p.days} días`}</li>`
            ).join('');
            await sendEmail({
                to: ADMIN_ALERT_EMAILS,
                subject: `⚠️ Conciliación de laboratorio: ${stale.length} fuente(s) sin datos`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                        <h2 style="color: #d97706;">⚠️ Fuentes de costos de laboratorio caídas</h2>
                        <p>El cruce de costos sigue corriendo, pero estas fuentes no traen datos — la auditoría está incompleta hasta resolverlo:</p>
                        <ul style="line-height: 1.7;">${items}</ul>
                        <p style="font-size: 13px; color: #6b7280;">Causa típica: credencial vencida (IMAP de Gmail / login del portal SmartLab).</p>
                    </div>
                `,
            }).catch(err => console.error('[Cron lab-invoices] Error enviando alerta de salud:', err));
        }

        // Libro de auditoría: deja constancia de que la revisión diaria se
        // ejecutó y con qué resultado (con venta / postventa / sin venta / etc.).
        const auditRun = await LabCostReconciliationService.recordAuditRun({
            trigger: 'CRON',
            providerResults: results,
            staleSources: stale.map(s => s.name),
            nuevosSinVenta: Number(results.sinVenta?.alerted ?? 0),
        }).catch(err => { console.error('[Cron lab-invoices] Error grabando LabAuditRun:', err); return null; });

        return NextResponse.json({ ok: true, ...results, stale: stale.map(s => s.name), auditRunId: auditRun?.id ?? null });
    } catch (error: any) {
        console.error('[Cron lab-invoices] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
