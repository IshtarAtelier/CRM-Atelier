import { NextResponse } from 'next/server';
import { runAllProviders, LAB_PROVIDERS } from '@/services/lab-providers';
import { LabCostReconciliationService } from '@/services/lab-cost-reconciliation.service';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';

const LAB_LABELS: Record<string, string> = { OPTOVISION: 'Optovision', GRUPO_OPTICO: 'Grupo Óptico' };

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
        const runStart = new Date();

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

        // Digest diario pedido por el administrador: cada pedido/factura NUEVO sin
        // venta en el sistema se informa por email URGENTE, clasificado para el
        // triage: posible postventa sin número / posible venta sin número (con el
        // cliente detectado) / dudoso a revisar con urgencia.
        // Solo los que NADIE avisó todavía: el pase rápido de 10 min puede haber
        // alertado un huérfano mientras esta corrida estaba en curso (y el
        // backfill inicial los deja todos marcados) — sin este filtro, doble email.
        const newOrphans = await prisma.labCostEntry.findMany({
            where: { status: 'UNMATCHED', createdAt: { gte: runStart }, alertedAt: null },
            orderBy: [{ lab: 'asc' }, { labOrderNumber: 'asc' }],
        });
        if (newOrphans.length > 0) {
            // Casos de POSTVENTA recientes sin nº de operación asignado: son los
            // primeros candidatos a dueños de un pedido huérfano.
            const openCases = await prisma.postSaleCase.findMany({
                where: {
                    createdAt: { gte: new Date(Date.now() - 60 * 86400000) },
                    OR: [{ newOrderNumber: null }, { newOrderNumber: '' }],
                },
                select: {
                    id: true, caseType: true, coverage: true,
                    order: { select: { clientId: true, client: { select: { name: true } } } },
                },
            });
            const tokensOf = (s: string) => new Set(
                s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                    .split(/[^a-z]+/).filter(w => w.length >= 3)
            );

            const classified = await Promise.all(newOrphans.map(async (o) => {
                const notes = o.notes || '';
                const nameRaw = notes.match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
                const nameTokens = tokensOf(nameRaw);

                // 0) ¿Matchea un caso de postventa abierto SIN nº asignado? (lo más fuerte)
                if (nameTokens.size > 0) {
                    for (const c of openCases) {
                        const ct = tokensOf(c.order?.client?.name || '');
                        const inter = [...nameTokens].filter(t => ct.has(t)).length;
                        if (inter >= 2 || (inter >= 1 && Math.min(nameTokens.size, ct.size) === 1)) {
                            return {
                                o, tipo: 'POSTVENTA', clientId: c.order?.clientId,
                                detalle: `Caso de POSTVENTA de «${c.order?.client?.name}» SIN nº asignado (${c.caseType || 's/tipo'}${c.coverage ? `, ${c.coverage}` : ''}) — asignarle este pedido`,
                            };
                        }
                    }
                }

                // 1) Señales de postventa: el portal lo marca reproceso o el nombre lo dice
                if (/reproceso|reclamo|garant[ií]a|cambio\s+(de\s+)?(rx|cristal)/i.test(notes)) {
                    return { o, tipo: 'POSTVENTA', detalle: 'Posible caso de postventa sin nº de operación asignado' };
                }
                // 2) ¿Existe un cliente con ese nombre? → venta a la que falta anotarle el número
                const nameInNote = notes.match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
                const words = nameInNote.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w)).slice(0, 2);
                if (words.length > 0) {
                    const client = await prisma.client.findFirst({
                        where: { isDeleted: false, AND: words.map(w => ({ name: { contains: w, mode: 'insensitive' as const } })) },
                        select: { id: true, name: true, orders: { where: { isDeleted: false, orderType: 'SALE' }, select: { labOrderNumber: true }, take: 3, orderBy: { createdAt: 'desc' } } },
                    });
                    if (client) {
                        const sinNumero = client.orders.some(v => !v.labOrderNumber?.match(/\d{4,}/));
                        return {
                            o, tipo: 'VENTA_SIN_NUMERO', clientId: client.id,
                            detalle: `Posible venta de «${client.name}»${sinNumero ? ' (tiene venta SIN nº de lab: asignarle este número)' : ''}`,
                        };
                    }
                }
                // 3) Sin explicación → dudoso
                return { o, tipo: 'DUDOSO', detalle: 'DUDOSO — sin cliente ni postventa que lo explique: revisar con urgencia' };
            }));

            const dudosos = classified.filter(c => c.tipo === 'DUDOSO').length;
            const badge: Record<string, string> = {
                POSTVENTA: 'background:#dbeafe;color:#1d4ed8',
                VENTA_SIN_NUMERO: 'background:#fef3c7;color:#92400e',
                DUDOSO: 'background:#fee2e2;color:#b91c1c;font-weight:bold',
            };
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
            const fmt = (n: number | null) => n ? `$${Math.round(n).toLocaleString('es-AR')}` : '—';
            const rows = classified.map(({ o, tipo, detalle, clientId }: any, i) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${o.labOrderNumber}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb">${LAB_LABELS[o.lab] || o.lab}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${fmt(o.billedNet ?? o.billedTotal)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${o.sourceFile || '—'}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${o.notes || '—'}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px"><span style="padding:2px 8px;border-radius:10px;${badge[tipo]}">${detalle}</span>${clientId ? ` <a href="${appUrl}/admin/contactos?clientId=${clientId}">ver ficha</a>` : ''}</td>
                </tr>`).join('');

            await sendEmail({
                to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
                subject: `🚨 URGENTE: ${newOrphans.length} pedido(s) de lab sin venta en el sistema${dudosos ? ` (${dudosos} dudoso${dudosos > 1 ? 's' : ''})` : ''}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#1f2937">
                        <h2 style="color:#b91c1c">🚨 Pedidos de laboratorio sin venta que los respalde</h2>
                        <p>El cruce diario encontró <strong>${newOrphans.length}</strong> pedido(s) nuevos en el laboratorio sin venta en el sistema. Triage sugerido en la última columna: postventa sin número, venta a la que falta anotarle el número, o <strong style="color:#b91c1c">dudoso a revisar con urgencia</strong>.</p>
                        <table style="border-collapse:collapse;width:100%;font-size:13px">
                            <tr style="background:#111827;color:#fff">
                                <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Lab</th>
                                <th style="padding:8px;text-align:right">Costo real</th><th style="padding:8px;text-align:left">Factura</th>
                                <th style="padding:8px;text-align:left">Pista del portal</th><th style="padding:8px;text-align:left">Clasificación</th>
                            </tr>${rows}
                        </table>
                        <p style="margin-top:14px"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
                    </div>
                `,
            }).then(async (res: any) => {
                // sendEmail nunca lanza: devuelve success=false si no salió. Solo
                // si el digest efectivamente salió se marcan como avisados (para
                // que el pase rápido de 10 min no los repita); si falló, quedan
                // sin marcar y el próximo barrido los reintenta.
                if (!res?.success) {
                    console.error('[Cron lab-invoices] El digest de huérfanos NO salió; se reintenta en la próxima corrida.');
                    return;
                }
                for (const o of newOrphans) await LabCostReconciliationService.markAlerted(o.id, o.status);
            }).catch(err => console.error('[Cron lab-invoices] Error enviando digest de huérfanos:', err));
        }

        // Barrido de alertas inmediatas: diferencias de costo y huérfanos que no
        // entraron en el digest de esta corrida (mismo dedupe que el pase rápido).
        results.alerts = await LabCostReconciliationService.alertNewFindings()
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
            nuevosSinVenta: newOrphans.length,
        }).catch(err => { console.error('[Cron lab-invoices] Error grabando LabAuditRun:', err); return null; });

        return NextResponse.json({ ok: true, ...results, stale: stale.map(s => s.name), auditRunId: auditRun?.id ?? null });
    } catch (error: any) {
        console.error('[Cron lab-invoices] Error:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
