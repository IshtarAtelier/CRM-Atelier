import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { verifyCronAuth } from '@/lib/cron-auth';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { fmtARS, fmtFecha, appUrl as appUrlFn, LAB_LABELS } from '@/services/lab-recon/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * REVISIÓN SEMANAL DE LABORATORIOS — un solo email, los lunes, con la semana que
 * pasó. Definido con el administrador el 28/7/2026. Por cada laboratorio, tres
 * cuadros:
 *
 *   1. Operaciones facturadas SIN relación en el sistema (ni venta ni postventa).
 *      Es plata facturada sin dueño: o falta cargar el trabajo, o hay que
 *      reclamarle al laboratorio.
 *   2. Diferencias de costo entre lo que factura el lab y lo que dice el CRM.
 *   3. Operaciones que sí aparecieron en POST VENTA, con el costo cargado en el
 *      caso al lado del facturado — así se ve de una si el reproceso vino con
 *      cargo cuando debía ser garantía.
 *
 * La ventana arranca en el ÚLTIMO ENVÍO (guardado en SystemSetting), no en "hace
 * 7 días": si una semana el cron no corre, la siguiente informa las dos y no se
 * pierde nada. La primera corrida toma 7 días. Y la ventana solo avanza si el
 * email salió.
 *
 * Alta en cron-job.org: GET semanal (lunes) a
 *   /api/cron/laboratorios-semanal?secret=CRON_SECRET
 * Parámetro opcional &dias=N para una corrida puntual que NO mueve la ventana.
 */

const CLAVE_ULTIMO_ENVIO = 'laboratorios_semanal_ultimo_envio';
const LABS = ['OPTOVISION', 'GRUPO_OPTICO'] as const;

const BD = 'border:1px solid #e5e7eb;padding:6px 8px';
const TH = 'padding:8px;text-align:left';

export async function GET(request: Request) {
    try {
        const auth = verifyCronAuth(request);
        if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { searchParams } = new URL(request.url);
        const hasta = new Date();
        const dias = parseInt(searchParams.get('dias') || '', 10);
        const puntual = Number.isFinite(dias) && dias > 0;

        const guardado = await prisma.systemSetting.findUnique({ where: { key: CLAVE_ULTIMO_ENVIO } });
        const desde = puntual
            ? new Date(hasta.getTime() - dias * 86400000)
            : guardado?.value
                ? new Date(guardado.value)
                : new Date(hasta.getTime() - 7 * 86400000);

        const appUrl = appUrlFn();
        const ficha = (clientId: string | null | undefined, nombre: string) =>
            clientId ? `<a href="${appUrl}/admin/contactos?clientId=${clientId}">${nombre}</a>` : nombre;

        const resumen: Record<string, any> = {};
        const secciones: string[] = [];

        for (const lab of LABS) {
            // El corte es por fecha de FACTURA: la que figura en el comprobante y
            // en el resumen de cuenta, no la del día en que se procesó.
            const entradas = await prisma.labCostEntry.findMany({
                where: { lab, invoiceDate: { gte: desde, lte: hasta } },
                select: {
                    labOrderNumber: true, invoiceDate: true, sourceFile: true, notes: true,
                    billedNet: true, billedTotal: true, systemCost: true, difference: true,
                    status: true, orderId: true,
                    order: { select: { clientId: true, labOrderNumber: true, client: { select: { name: true } } } },
                },
                orderBy: { invoiceDate: 'asc' },
            });

            // Optovisión discrimina IVA y Atelier es monotributo (no lo recupera):
            // su costo real es el TOTAL. Grupo Óptico factura a consumidor final.
            const facturado = (e: typeof entradas[number]) => lab === 'OPTOVISION'
                ? (e.billedTotal ?? e.billedNet ?? null)
                : (e.billedNet ?? e.billedTotal ?? null);
            const comprobante = (e: typeof entradas[number]) => {
                const m = String(e.labOrderNumber || '').match(/\d{4}-\d{4,8}/)
                    || String(e.sourceFile || '').match(/\d{4}-\d{4,8}/);
                return m ? m[0] : (e.sourceFile ? String(e.sourceFile).replace(/\.pdf$/i, '') : 'sin comprobante');
            };
            const esOperacion = (e: typeof entradas[number]) => /^\d{5,}$/.test(String(e.labOrderNumber || '').trim());
            const esPostventa = (e: typeof entradas[number]) => (e.notes || '').includes('POSTVENTA (caso');

            const sinRespaldo = entradas.filter(e => e.status === 'UNMATCHED');
            const enPostventa = entradas.filter(esPostventa);
            const diferencias = entradas
                .filter(e => e.difference != null && Math.abs(e.difference) >= 1 && !esPostventa(e))
                .sort((a, b) => Math.abs(b.difference!) - Math.abs(a.difference!));

            const casos = enPostventa.length
                ? await prisma.postSaleCase.findMany({
                    where: { OR: enPostventa.map(e => ({ newOrderNumber: { contains: e.labOrderNumber } })) },
                    select: { newOrderNumber: true, caseType: true, coverage: true, cost: true, status: true },
                })
                : [];
            const casoDe = (n: string) => casos.find(c => (c.newOrderNumber || '').includes(n));

            const suma = (xs: number[]) => xs.reduce((t, n) => t + n, 0);
            const totalSinRespaldo = suma(sinRespaldo.map(e => facturado(e) || 0));
            const totalFacturado = suma(entradas.map(e => facturado(e) || 0));

            const cuadro = (titulo: string, bajada: string, cabeceras: string[], filas: string[], vacio: string) => `
                <h4 style="margin:20px 0 4px;font-size:14px">${titulo}</h4>
                <p style="margin:0 0 8px;font-size:12px;color:#6b7280">${bajada}</p>
                ${filas.length ? `<table style="border-collapse:collapse;width:100%;font-size:13px">
                    <tr style="background:#111827;color:#fff">${cabeceras.map(c => `<th style="${TH}">${c}</th>`).join('')}</tr>
                    ${filas.join('')}
                </table>` : `<p style="font-size:13px;color:#059669;margin:0">✅ ${vacio}</p>`}`;

            const filasSinRespaldo = sinRespaldo.map((e, i) => `
                <tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
                    <td style="${BD};font-family:monospace;font-weight:bold">${esOperacion(e) ? e.labOrderNumber : '<span style="color:#b91c1c">la factura no trae nº</span>'}</td>
                    <td style="${BD};white-space:nowrap">${fmtFecha(e.invoiceDate)}</td>
                    <td style="${BD};font-family:monospace;font-size:12px">${comprobante(e)}</td>
                    <td style="${BD};text-align:right;font-weight:bold">${fmtARS(facturado(e))}</td>
                </tr>`);

            const filasDiferencias = diferencias.map((e, i) => `
                <tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
                    <td style="${BD};font-family:monospace">${e.labOrderNumber}</td>
                    <td style="${BD};white-space:nowrap">${fmtFecha(e.invoiceDate)}</td>
                    <td style="${BD}">${ficha(e.order?.clientId, e.order?.client?.name || '—')}</td>
                    <td style="${BD};text-align:right">${fmtARS(e.systemCost)}</td>
                    <td style="${BD};text-align:right;font-weight:bold">${fmtARS(facturado(e))}</td>
                    <td style="${BD};text-align:right;font-weight:bold;color:${e.difference! > 0 ? '#b91c1c' : '#047857'}">
                        ${e.difference! > 0 ? '+' : ''}${fmtARS(e.difference)}</td>
                </tr>`);

            const filasPostventa = enPostventa.map((e, i) => {
                const c = casoDe(e.labOrderNumber);
                const cargado = c?.cost ?? null;
                const cobrado = facturado(e) ?? 0;
                return `
                <tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
                    <td style="${BD};font-family:monospace">${e.labOrderNumber}</td>
                    <td style="${BD};white-space:nowrap">${fmtFecha(e.invoiceDate)}</td>
                    <td style="${BD}">${ficha(e.order?.clientId, e.order?.client?.name || '—')}</td>
                    <td style="${BD};font-size:12px">${c?.caseType || 'sin tipo'}${c?.coverage ? ` · ${c.coverage}` : ''}</td>
                    <td style="${BD};text-align:right">${cargado != null ? fmtARS(cargado) : '<span style="color:#b45309">sin costo cargado</span>'}</td>
                    <td style="${BD};text-align:right;font-weight:bold">${fmtARS(facturado(e))}</td>
                    <td style="${BD};font-size:12px">${(cargado ?? 0) === 0 && cobrado > 0
                    ? '<span style="color:#b91c1c;font-weight:bold">cargado como garantía y el lab lo cobró</span>'
                    : '—'}</td>
                </tr>`;
            });

            resumen[lab] = {
                facturadas: entradas.length, sinRespaldo: sinRespaldo.length,
                diferencias: diferencias.length, postventa: enPostventa.length,
                montoSinRespaldo: Math.round(totalSinRespaldo),
            };

            secciones.push(`
                <h3 style="margin:30px 0 2px;padding-bottom:6px;border-bottom:2px solid #111827">${LAB_LABELS[lab] || lab}</h3>
                <p style="margin:6px 0 0;font-size:12px;color:#6b7280">
                    ${entradas.length} operación(es) facturada(s) por ${fmtARS(totalFacturado)}</p>
                ${cuadro(
                `1 · Facturado sin nada que lo respalde${sinRespaldo.length ? ` — ${fmtARS(totalSinRespaldo)}` : ''}`,
                'Operaciones que el laboratorio facturó y que no figuran en el sistema: ni como venta, ni como caso de post venta.',
                ['N° operación', 'Fecha factura', 'Comprobante', 'Importe'],
                filasSinRespaldo,
                'Todo lo facturado tiene su trabajo en el sistema.')}
                ${cuadro(
                '2 · Diferencias de costo',
                'Lo que cobró el laboratorio contra el costo cargado en el sistema.',
                ['N° operación', 'Fecha factura', 'Cliente', 'Costo sistema', 'Facturado', 'Diferencia'],
                filasDiferencias,
                'Sin diferencias de costo.')}
                ${cuadro(
                '3 · Encontradas en Post Venta',
                'Reprocesos con su caso cargado. Si el caso figura en $0 y el laboratorio lo cobró, era garantía y hay que reclamarlo.',
                ['N° operación', 'Fecha factura', 'Cliente', 'Caso', 'Costo del caso', 'Facturado', ''],
                filasPostventa,
                'Ninguna operación corresponde a un caso de post venta.')}`);
        }

        const rango = `${fmtFecha(desde)} al ${fmtFecha(hasta)}`;
        const totalSinRespaldo = LABS.reduce((t, l) => t + resumen[l].montoSinRespaldo, 0);
        const cuentaSinRespaldo = LABS.reduce((t, l) => t + resumen[l].sinRespaldo, 0);
        const cuentaDiferencias = LABS.reduce((t, l) => t + resumen[l].diferencias, 0);

        const html = `
            <div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;color:#1f2937">
                <h2 style="margin-bottom:4px">Laboratorios — revisión semanal</h2>
                <p style="margin:0;color:#4b5563;font-size:13px">
                    Facturas del <strong>${rango}</strong>. Las fechas son las de emisión de la factura.</p>
                ${secciones.join('')}
                <p style="margin-top:24px;font-size:13px">
                    <a href="${appUrl}/admin/laboratorio/costos">Ver la conciliación completa en el CRM</a></p>
                <p style="font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:18px">
                    Atelier Óptica — revisión semanal de laboratorios.${puntual
                ? ' Corrida puntual: la ventana no se movió.'
                : ` La próxima toma desde ${fmtFecha(hasta)}.`}</p>
            </div>`;

        const res: any = await sendEmail({
            to: ADMIN_ALERT_EMAILS,
            subject: `Laboratorios ${rango}: ${cuentaSinRespaldo} sin respaldo${totalSinRespaldo ? ` (${fmtARS(totalSinRespaldo)})` : ''} · ${cuentaDiferencias} con diferencia de costo`,
            html,
        });

        if (!res?.success) {
            console.error('[Laboratorios semanal] El email no salió; la ventana no avanza.');
            return NextResponse.json({ ok: false, error: 'email no enviado', desde, hasta }, { status: 500 });
        }
        // Una corrida puntual (&dias=N) informa pero NO mueve la ventana: si no,
        // una consulta manual se comería la semana del envío real.
        if (!puntual) {
            await prisma.systemSetting.upsert({
                where: { key: CLAVE_ULTIMO_ENVIO },
                update: { value: hasta.toISOString() },
                create: { key: CLAVE_ULTIMO_ENVIO, value: hasta.toISOString() },
            });
        }

        return NextResponse.json({ ok: true, desde, hasta, puntual, ...resumen });
    } catch (error: any) {
        console.error('[Laboratorios semanal] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
