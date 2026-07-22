/**
 * Lectura de insights de Meta Marketing API para el lado APP (cron del reporte
 * diario). SOLO LECTURA por diseño: este módulo no expone ninguna escritura —
 * las mutaciones viven únicamente en scripts/ads (triple llave, ver
 * scripts/ads/CLAUDE.md). Espeja las protecciones del cliente de scripts:
 * versión pineada, appsecret_proof, errores clasificados, sin tokens en logs.
 */
import crypto from 'crypto';

// v24.0: mínimo que la Marketing API acepta desde jun-2026 (las anteriores dan #2635).
const API_VERSION = 'v24.0';

export interface InsightRow {
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

export function metaAdsConfigured(): boolean {
  return Boolean(process.env.META_ADS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

function accountId(): string {
  const raw = process.env.META_AD_ACCOUNT_ID || '';
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

function redact(text: string): string {
  let out = text;
  for (const secret of [process.env.META_ADS_TOKEN, process.env.META_APP_SECRET]) {
    if (secret) out = out.split(secret).join('***');
  }
  return out.replace(/access_token=[^&\s"']+/gi, 'access_token=***');
}

/**
 * Trae insights por campaña, paginado completo. `preset` es un date_preset de
 * la Insights API ('yesterday' | 'last_7d' | ...). Lanza Error con mensaje
 * redactado si Meta responde error (el cron lo reporta y corta — reintenta
 * recién en la corrida del día siguiente).
 */
export async function fetchCampaignInsights(preset: string): Promise<InsightRow[]> {
  const token = process.env.META_ADS_TOKEN;
  if (!token) throw new Error('META_ADS_TOKEN no configurado');

  const rows: InsightRow[] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://graph.facebook.com/${API_VERSION}/${accountId()}/insights`);
    url.searchParams.set('level', 'campaign');
    url.searchParams.set(
      'fields',
      'campaign_name,spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type',
    );
    url.searchParams.set('date_preset', preset);
    url.searchParams.set('limit', '100');
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
    if (Array.isArray(json.data)) rows.push(...json.data);
    after = json.paging?.cursors?.after;
    if (json.paging?.next && !after) {
      console.warn('[meta-insights] hay más páginas pero sin cursor after — resultado incompleto.');
      break;
    }
    if (!json.paging?.next) break;
  }
  return rows;
}

export function actionValue(row: InsightRow, type: string): number {
  return Number(row.actions?.find((a) => a.action_type === type)?.value || 0);
}

export function costPerAction(row: InsightRow, type: string): number | null {
  const v = row.cost_per_action_type?.find((a) => a.action_type === type)?.value;
  return v != null ? Number(v) : null;
}
