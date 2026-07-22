import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import {
  metaAdsConfigured,
  fetchCampaignInsights,
  actionValue,
  type InsightRow,
} from '@/lib/ads/meta-insights';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Reporte diario de ads: gasto/resultados de Meta por campaña (ayer + 7 días)
// cruzado con las ventas propias del CRM, con alertas accionables arriba.
// Pensado para cron-job.org a la mañana (después de los otros crons de las 9).
// Si META_ADS_TOKEN no está configurado, responde skipped sin error (permite
// dar de alta el cron antes de tener el token).
// ─────────────────────────────────────────────────────────────────────────────

const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

/** Medianoche de hace `daysAgo` días en Argentina (sin DST, -03:00 fijo es seguro). */
function arDayStart(daysAgo: number): Date {
  const dateStr = new Date(Date.now() - daysAgo * 864e5).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  return new Date(`${dateStr}T00:00:00-03:00`);
}

interface CrmCampaignSales {
  count: number;
  revenue: number;
}

/**
 * Ventas propias (purchase de AnalyticsEvent) agrupadas por utmCampaign en la
 * ventana dada. Las compras nuevas ya traen las UTM estampadas (herencia en
 * recordServerEvent); para las viejas se resuelve por sessionId acá.
 */
async function crmSalesByCampaign(from: Date, to: Date): Promise<Map<string, CrmCampaignSales>> {
  const purchases = await prisma.analyticsEvent.findMany({
    where: { type: 'purchase', createdAt: { gte: from, lt: to } },
    select: { utmCampaign: true, sessionId: true, value: true },
  });

  const orphanSessions = [...new Set(purchases.filter((p) => !p.utmCampaign).map((p) => p.sessionId))];
  const sessionAttr = new Map<string, string>();
  if (orphanSessions.length) {
    const attrEvents = await prisma.analyticsEvent.findMany({
      where: { sessionId: { in: orphanSessions }, utmCampaign: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { sessionId: true, utmCampaign: true },
    });
    for (const ev of attrEvents) sessionAttr.set(ev.sessionId, ev.utmCampaign as string);
  }

  const out = new Map<string, CrmCampaignSales>();
  for (const p of purchases) {
    const campaign = p.utmCampaign || sessionAttr.get(p.sessionId) || '(sin atribución)';
    const acc = out.get(campaign) || { count: 0, revenue: 0 };
    acc.count += 1;
    acc.revenue += Number(p.value || 0);
    out.set(campaign, acc);
  }
  return out;
}

/**
 * Métricas agregadas por NOMBRE de campaña. Meta permite campañas homónimas
 * (filas distintas en insights): si se mapeara por nombre sin sumar, una
 * pisaría a la otra y el gasto desaparecería de la tabla y de las alertas.
 */
interface CampaignAgg {
  spend: number;
  buys: number;
  msgs: number;
}

function aggregateByName(rows: InsightRow[]): Map<string, CampaignAgg> {
  const out = new Map<string, CampaignAgg>();
  for (const r of rows) {
    const key = r.campaign_name || '?';
    const acc = out.get(key) || { spend: 0, buys: 0, msgs: 0 };
    acc.spend += Number(r.spend || 0);
    acc.buys += actionValue(r, 'purchase');
    acc.msgs += Number(
      r.actions?.find((a) => a.action_type.includes('messaging_conversation_started'))?.value || 0,
    );
    out.set(key, acc);
  }
  return out;
}

function campaignRow(
  name: string,
  yesterday: CampaignAgg | undefined,
  week: CampaignAgg | undefined,
  crmWeek: CrmCampaignSales | undefined,
): string {
  const spendY = yesterday?.spend || 0;
  const spend7 = week?.spend || 0;
  const buys7 = week?.buys || 0;
  const cpa7 = buys7 > 0 ? spend7 / buys7 : null;
  const crmTxt = crmWeek ? `${crmWeek.count} venta(s) · ${money(crmWeek.revenue)}` : '—';
  return `
    <tr style="border-bottom:1px dotted #f0eae4;">
      <td style="padding:7px 4px;font-size:12px;color:#433831;font-weight:600;">${name}</td>
      <td style="padding:7px 4px;text-align:right;font-size:12px;color:#706359;white-space:nowrap;">${money(spendY)}</td>
      <td style="padding:7px 4px;text-align:right;font-size:12px;color:#706359;white-space:nowrap;">${money(spend7)}</td>
      <td style="padding:7px 4px;text-align:right;font-size:12px;color:#706359;white-space:nowrap;">${buys7 || '—'}${cpa7 ? ` (${money(cpa7)})` : ''}</td>
      <td style="padding:7px 4px;text-align:right;font-size:12px;color:#433831;font-weight:600;white-space:nowrap;">${crmTxt}</td>
    </tr>`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    if (secret !== cronSecret && token !== cronSecret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!metaAdsConfigured()) {
      return NextResponse.json({ skipped: 'META_ADS_TOKEN / META_AD_ACCOUNT_ID sin configurar' });
    }

    // Secuencial a propósito: mismo principio "sin paralelismo" que los
    // scripts de ads imponen con su cola serializada.
    const yesterdayRows = await fetchCampaignInsights('yesterday');
    const weekRows = await fetchCampaignInsights('last_7d');
    const crmWeek = await crmSalesByCampaign(arDayStart(7), arDayStart(0));

    const yMap = aggregateByName(yesterdayRows);
    const wMap = aggregateByName(weekRows);

    const spendYesterday = [...yMap.values()].reduce((acc, a) => acc + a.spend, 0);
    const spendWeek = [...wMap.values()].reduce((acc, a) => acc + a.spend, 0);
    const crmSalesTotal = [...crmWeek.values()].reduce((a, s) => a + s.count, 0);

    // Sin actividad en ningún lado → no mandar email vacío todos los días.
    if (spendWeek === 0 && crmSalesTotal === 0) {
      return NextResponse.json({ ok: true, sent: false, reason: 'sin actividad en 7 días' });
    }

    // ── Alertas accionables ──────────────────────────────────────────────
    const alerts: string[] = [];

    // El caso más grave primero: los ads se FRENARON (tarjeta rechazada,
    // cuenta inhabilitada, pausa por error). Sin esta alerta, un gasto que cae
    // a $0 pasaría en silencio justo cuando más importa avisar.
    if (spendYesterday === 0 && spendWeek > 0) {
      alerts.push(
        `<b>Gasto en CERO ayer</b> pese a que la semana lleva ${money(spendWeek)}. Revisar estado de campañas y facturación en el Ads Manager — puede ser una tarjeta rechazada o una pausa involuntaria.`,
      );
    }

    for (const [name, week] of wMap) {
      const crm = crmWeek.get(name);
      if (week.spend > 0 && week.buys === 0 && week.msgs === 0 && !crm?.count) {
        alerts.push(`<b>${name}</b>: ${money(week.spend)} gastados en 7 días sin ninguna conversión (ni Meta ni CRM). Candidata a pausar o rehacer.`);
      }
      const y = yMap.get(name);
      const cpaY = y && y.buys > 0 ? y.spend / y.buys : null;
      const cpa7 = week.buys > 0 ? week.spend / week.buys : null;
      if (cpaY != null && cpa7 != null && cpa7 > 0 && cpaY > cpa7 * 1.5) {
        alerts.push(`<b>${name}</b>: el CPA de ayer (${money(cpaY)}) fue ${Math.round((cpaY / cpa7 - 1) * 100)}% más alto que el promedio semanal (${money(cpa7)}).`);
      }
    }
    // Fatiga de frecuencia: por fila cruda (por campaña real, no por nombre
    // agregado — la frecuencia no se puede sumar entre campañas homónimas).
    for (const r of weekRows) {
      const freq = Number(r.frequency || 0);
      if (freq > 3.5) {
        alerts.push(`<b>${r.campaign_name}</b>: frecuencia ${freq.toFixed(1)} en 7 días — la audiencia está viendo el anuncio demasiadas veces (fatiga). Conviene renovar creatividad o ampliar audiencia.`);
      }
    }

    // ── Email ────────────────────────────────────────────────────────────
    const allNames = [...new Set([...wMap.keys(), ...crmWeek.keys()])].filter((n) => n !== '(sin atribución)');
    const rowsHtml = allNames
      .map((name) => campaignRow(name, yMap.get(name), wMap.get(name), crmWeek.get(name)))
      .join('');
    const unattributed = crmWeek.get('(sin atribución)');

    const html = `
      <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;color:#433831;">
        <h2 style="font-size:18px;border-bottom:2px solid #9e7f65;padding-bottom:8px;">📊 Ads — reporte diario</h2>
        ${
          alerts.length
            ? `<div style="background:#fdf6ec;border-left:4px solid #b45309;padding:10px 14px;margin:16px 0;">
                 <p style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">Para mirar hoy</p>
                 ${alerts.map((a) => `<p style="margin:4px 0;font-size:12px;">• ${a}</p>`).join('')}
               </div>`
            : '<p style="font-size:12px;color:#706359;">Sin alertas: las campañas están dentro de sus parámetros normales.</p>'
        }
        <p style="font-size:13px;">Gasto de ayer: <b>${money(spendYesterday)}</b> · últimos 7 días: <b>${money(spendWeek)}</b></p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tr style="border-bottom:2px solid #9e7f65;">
            <th style="text-align:left;padding:6px 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Campaña</th>
            <th style="text-align:right;padding:6px 4px;font-size:11px;text-transform:uppercase;">Ayer</th>
            <th style="text-align:right;padding:6px 4px;font-size:11px;text-transform:uppercase;">7 días</th>
            <th style="text-align:right;padding:6px 4px;font-size:11px;text-transform:uppercase;">Compras Meta (CPA)</th>
            <th style="text-align:right;padding:6px 4px;font-size:11px;text-transform:uppercase;">Ventas CRM 7d</th>
          </tr>
          ${rowsHtml}
        </table>
        ${
          unattributed
            ? `<p style="font-size:11px;color:#706359;margin-top:10px;">Además: ${unattributed.count} venta(s) web por ${money(unattributed.revenue)} sin atribución de campaña (directo/orgánico).</p>`
            : ''
        }
        <p style="font-size:10px;color:#a89c90;margin-top:18px;">Las "Ventas CRM" salen de la medición propia de la tienda (más conservadora que Meta). Generado automáticamente.</p>
      </div>`;

    await sendEmail({
      to: ADMIN_ALERT_EMAILS,
      subject: `📊 Ads diario — ayer ${money(spendYesterday)}${alerts.length ? ` · ${alerts.length} alerta(s)` : ''}`,
      html,
    });

    return NextResponse.json({
      ok: true,
      sent: true,
      spendYesterday,
      spendWeek,
      campaigns: allNames.length,
      alerts: alerts.length,
    });
  } catch (error) {
    console.error('[CRON ads-report] Error:', error);
    return NextResponse.json({ error: 'Error generando el reporte de ads' }, { status: 500 });
  }
}
