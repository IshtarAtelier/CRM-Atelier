/**
 * Lectura de insights de Meta Marketing API para el lado APP (cron del reporte
 * diario). SOLO LECTURA por diseño: este módulo no expone ninguna escritura —
 * las mutaciones viven únicamente en scripts/ads (triple llave, ver
 * scripts/ads/CLAUDE.md). Espeja las protecciones del cliente de scripts:
 * versión pineada, appsecret_proof, errores clasificados, sin tokens en logs.
 *
 * Lee TODAS las cuentas listadas en META_AD_ACCOUNT_ID (separadas por coma).
 * Atelier tiene dos —una en pesos y otra en dólares— y la actividad se mueve
 * de una a otra; mirar una sola deja el reporte ciego. El gasto en USD se
 * convierte a pesos con el blue, igual que los objetivos.
 */
import crypto from 'crypto';

// v24.0: mínimo que la Marketing API acepta desde jun-2026 (las anteriores dan #2635).
const API_VERSION = 'v24.0';

export interface InsightRow {
  campaign_name?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  /** Gasto ya normalizado a pesos (lo agrega este módulo, no viene de Meta). */
  spendArs?: number;
}

export function metaAdsConfigured(): boolean {
  return Boolean(process.env.META_ADS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

function accountIds(): string[] {
  return (process.env.META_AD_ACCOUNT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => (id.startsWith('act_') ? id : `act_${id}`));
}

function redact(text: string): string {
  let out = text;
  for (const secret of [process.env.META_ADS_TOKEN, process.env.META_APP_SECRET]) {
    if (secret) out = out.split(secret).join('***');
  }
  return out.replace(/access_token=[^&\s"']+/gi, 'access_token=***');
}

/**
 * Etiqueta que une el anuncio con la conversación de WhatsApp. Los anuncios se
 * llaman "[metaFlor]", "[MetaAgos]"… y el texto pre-cargado que llega por
 * WhatsApp trae la misma etiqueta entre corchetes. Para los que no la tienen,
 * se deduce por el producto que mencionan.
 */
export function adTag(text?: string | null): string | null {
  if (!text) return null;
  const m = String(text).match(/\[\s*meta([a-z0-9_ -]+?)\s*\]/i);
  if (m) return m[1].trim().toLowerCase().replace(/\s+/g, '');
  const t = String(text).toLowerCase();
  if (/mayolens/.test(t)) return 'myolens';
  if (/myofix/.test(t)) return 'myofix';
  if (/clipon|clip-on|clipones|clippons/.test(t)) return 'clip';
  if (/remarketing|2x1/.test(t)) return 'remarketing2x1';
  return null;
}

/** Cotización blue (venta) para pasar el gasto en USD a pesos. */
export async function dolarBlue(): Promise<number> {
  try {
    const res = await fetch('https://mercados.ambito.com/dolar/informal/variacion', {
      signal: AbortSignal.timeout(8000),
    });
    const j = await res.json();
    const v = Number(String(j?.venta ?? '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : 1570;
  } catch {
    return 1570; // respaldo: el reporte no se cae por la cotización
  }
}

async function fetchInsights(
  account: string,
  level: 'campaign' | 'ad',
  preset: string,
  rate: number,
): Promise<InsightRow[]> {
  const token = process.env.META_ADS_TOKEN;
  if (!token) throw new Error('META_ADS_TOKEN no configurado');

  const rows: InsightRow[] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://graph.facebook.com/${API_VERSION}/${account}/insights`);
    url.searchParams.set('level', level);
    url.searchParams.set(
      'fields',
      level === 'ad'
        ? 'ad_name,campaign_name,spend,actions,account_currency'
        : 'campaign_name,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type,account_currency',
    );
    url.searchParams.set('date_preset', preset);
    url.searchParams.set('limit', '200');
    url.searchParams.set('access_token', token);
    const secret = process.env.META_APP_SECRET;
    if (secret) {
      url.searchParams.set(
        'appsecret_proof',
        crypto.createHmac('sha256', secret).update(token).digest('hex'),
      );
    }
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url);
    // Un 502 de proxy puede devolver HTML: no dejar que el SyntaxError críptico
    // reemplace al error real.
    const json = await res.json().catch(() => {
      throw new Error(`Meta Insights: respuesta no-JSON (HTTP ${res.status})`);
    });
    if (json.error) {
      throw new Error(redact(`Meta Insights error ${json.error.code}: ${json.error.message}`));
    }
    for (const r of json.data || []) {
      const enUsd = (r as { account_currency?: string }).account_currency === 'USD';
      rows.push({ ...r, spendArs: Number(r.spend || 0) * (enUsd ? rate : 1) });
    }
    after = json.paging?.cursors?.after;
    if (json.paging?.next && !after) {
      console.warn('[meta-insights] hay más páginas pero sin cursor after — resultado incompleto.');
      break;
    }
    if (!json.paging?.next) break;
  }
  return rows;
}

/** Insights por campaña de TODAS las cuentas configuradas, gasto en pesos. */
export async function fetchCampaignInsights(preset: string, rate?: number): Promise<InsightRow[]> {
  const r = rate ?? (await dolarBlue());
  const out: InsightRow[] = [];
  // Secuencial a propósito: mismo principio "sin paralelismo" de scripts/ads.
  for (const acct of accountIds()) out.push(...(await fetchInsights(acct, 'campaign', preset, r)));
  return out;
}

/** Gasto por etiqueta de anuncio (en pesos), sumando todas las cuentas. */
export async function fetchSpendByTag(
  preset: string,
  rate?: number,
): Promise<Map<string, { gasto: number; convMeta: number }>> {
  const r = rate ?? (await dolarBlue());
  const acc = new Map<string, { gasto: number; convMeta: number }>();
  for (const acct of accountIds()) {
    for (const row of await fetchInsights(acct, 'ad', preset, r)) {
      const tag = adTag(row.ad_name);
      if (!tag) continue;
      const conv = (row.actions || [])
        .filter((a) => a.action_type.includes('messaging_conversation_started'))
        .reduce((s, a) => s + Number(a.value), 0);
      const prev = acc.get(tag) || { gasto: 0, convMeta: 0 };
      acc.set(tag, { gasto: prev.gasto + (row.spendArs || 0), convMeta: prev.convMeta + conv });
    }
  }
  return acc;
}

export function actionValue(row: InsightRow, type: string): number {
  return Number(row.actions?.find((a) => a.action_type === type)?.value || 0);
}

export function costPerAction(row: InsightRow, type: string): number | null {
  const v = row.cost_per_action_type?.find((a) => a.action_type === type)?.value;
  return v != null ? Number(v) : null;
}
