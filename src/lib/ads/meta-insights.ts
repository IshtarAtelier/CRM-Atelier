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
import { parseAdTag } from '@/lib/ads/ad-tag';
import { getDolarBlueVenta } from '@/lib/targets';

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

export function redact(text: string): string {
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
  // El parseo de corchetes sale del helper único (ad-tag.ts). Acá tenía su
  // propio regex con un juego de caracteres más chico (`[a-z0-9_ -]`), así que
  // una etiqueta con, por ejemplo, un punto o una tilde se leía distinto según
  // quién la mirara: el bot la guardaba y este reporte no la encontraba.
  const parsed = parseAdTag(text);
  if (parsed) return parsed.campaign;
  // Lo que sigue SÍ es propio de este módulo y no va al helper: para los chats
  // sin etiqueta se deduce la campaña por el producto que menciona el cliente.
  // No se persiste nunca — es solo para el reporte.
  const t = String(text).toLowerCase();
  if (/mayolens/.test(t)) return 'myolens';
  if (/myofix/.test(t)) return 'myofix';
  if (/clipon|clip-on|clipones|clippons/.test(t)) return 'clip';
  if (/remarketing|2x1/.test(t)) return 'remarketing2x1';
  return null;
}

/**
 * Cotización blue (venta), o `null` si no se pudo leer.
 *
 * NO consulta nada por su cuenta: delega en `getDolarBlueVenta`
 * (`src/lib/targets.ts`), el helper del dólar que ya usan el dashboard y el
 * reporte. Esta función tenía su propia copia que preguntaba SOLO a Ámbito, y
 * el 10/9/2026 Ámbito no respondió desde el servidor de producción: el abono
 * de Claude Code quedó en $0 y el cierre de septiembre, frenado. El helper
 * prueba Ámbito, después dolarapi.com, y como último recurso la última
 * cotización real que vio en los últimos 30 días.
 *
 * Existe aparte de `dolarBlue` porque los dos usos son distintos: un REPORTE
 * prefiere un número aproximado antes que no salir, pero un gasto que se va a
 * GUARDAR y a entrar al estado de resultados no se convierte con un respaldo
 * escrito a mano. Un número real de hace unos días sí vale; un 1570 inventado, no.
 */
export async function cotizacionDolarONull(): Promise<number | null> {
  return getDolarBlueVenta();
}

/** Respaldo cuando la cotización no se pudo leer. Solo para reportes. */
export const DOLAR_DE_RESPALDO = 1570;

/** Cotización blue (venta) para pasar el gasto en USD a pesos. */
export async function dolarBlue(): Promise<number> {
  // El reporte no se cae por la cotización: si no se pudo leer, vale el respaldo.
  return (await cotizacionDolarONull()) ?? DOLAR_DE_RESPALDO;
}

/**
 * Meta rechazó el `appsecret_proof` en esta corrida: el secreto configurado no
 * es el de la app que emitió el token de Ads. Se recuerda a nivel módulo para
 * dejar de firmar y no pagar una llamada fallida por cada página.
 */
let firmaInvalida = false;
let avisoFirmaDada = false;

/**
 * Ventana temporal de la consulta. Meta acepta `date_preset` (atajos como
 * "this_month") o `time_range` con fechas explícitas. El preset no sirve para
 * un mes cerrado cualquiera —no existe "agosto"—, así que para eso va el rango.
 */
export type VentanaInsights = { preset: string } | { since: string; until: string };

function aplicarVentana(url: URL, ventana: VentanaInsights): void {
  if ('preset' in ventana) {
    url.searchParams.set('date_preset', ventana.preset);
  } else {
    url.searchParams.set('time_range', JSON.stringify({ since: ventana.since, until: ventana.until }));
  }
}

async function fetchInsights(
  account: string,
  level: 'campaign' | 'ad',
  ventana: VentanaInsights,
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
    aplicarVentana(url, ventana);
    url.searchParams.set('limit', '200');
    url.searchParams.set('access_token', token);
    // Una vez que Meta rechazó la firma, no se manda más: reintentar en cada
    // página duplicaría todas las llamadas para nada.
    const secret = firmaInvalida ? null : process.env.META_APP_SECRET;
    if (secret) {
      url.searchParams.set(
        'appsecret_proof',
        crypto.createHmac('sha256', secret).update(token).digest('hex'),
      );
    }
    if (after) url.searchParams.set('after', after);

    const pedir = async (u: URL) => {
      const res = await fetch(u);
      // Un 502 de proxy puede devolver HTML: no dejar que el SyntaxError críptico
      // reemplace al error real.
      return await res.json().catch(() => {
        throw new Error(`Meta Insights: respuesta no-JSON (HTTP ${res.status})`);
      });
    };

    let json = await pedir(url);

    // LA FIRMA PUEDE SER DE OTRA APP.
    //
    // `appsecret_proof` es un HMAC del token hecho con el secreto de LA APP QUE
    // EMITIÓ ESE TOKEN. Acá el token es `META_ADS_TOKEN` y el secreto es
    // `META_APP_SECRET`, y no son de la misma app: Meta responde "Invalid
    // appsecret_proof" y la llamada muere. Como el throw estaba en el camino
    // principal, se llevaba puesto el reporte ENTERO — por eso el mail de ads
    // dejó de llegar el 10/8/2026 y estuvo un mes mudo.
    //
    // La firma es un endurecimiento OPCIONAL (solo obligatorio si la app tiene
    // "Require app secret" prendido, que no es el caso: verificado el 8/9/2026,
    // las mismas consultas responden bien sin ella). Así que si Meta la
    // rechaza, se reintenta sin firma en vez de perder el reporte.
    if (json?.error && /appsecret_proof/i.test(String(json.error.message || ''))) {
      if (!avisoFirmaDada) {
        console.warn('[meta-insights] Meta rechazó el appsecret_proof (META_APP_SECRET no es de la app del token de Ads): se sigue sin firma.');
        avisoFirmaDada = true;
      }
      firmaInvalida = true;
      url.searchParams.delete('appsecret_proof');
      json = await pedir(url);
    }

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
export async function fetchCampaignInsights(
  ventana: string | VentanaInsights,
  rate?: number,
): Promise<InsightRow[]> {
  const v: VentanaInsights = typeof ventana === 'string' ? { preset: ventana } : ventana;
  const r = rate ?? (await dolarBlue());
  const out: InsightRow[] = [];
  // Secuencial a propósito: mismo principio "sin paralelismo" de scripts/ads.
  for (const acct of accountIds()) out.push(...(await fetchInsights(acct, 'campaign', v, r)));
  return out;
}

/**
 * Gasto total en pesos de un mes calendario, sumando todas las cuentas.
 *
 * Devuelve `null` si la integración no está configurada o si Meta falla: para
 * el cierre de mes no es lo mismo "gastamos cero" que "no pude leer cuánto
 * gastamos", y un cero falso se lee como que hay plata de sobra.
 */
export async function fetchGastoMensualArs(month: number, year: number): Promise<number | null> {
  if (!metaAdsConfigured()) return null;
  const ultimoDia = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  try {
    const rows = await fetchCampaignInsights({
      since: `${year}-${mm}-01`,
      until: `${year}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
    });
    return rows.reduce((acc, r) => acc + (r.spendArs || 0), 0);
  } catch (e) {
    console.error('[meta-insights] No se pudo leer el gasto del mes:', redact(String(e)));
    return null;
  }
}

/** Gasto por etiqueta de anuncio (en pesos), sumando todas las cuentas. */
export async function fetchSpendByTag(
  preset: string,
  rate?: number,
): Promise<Map<string, { gasto: number; convMeta: number }>> {
  const r = rate ?? (await dolarBlue());
  const acc = new Map<string, { gasto: number; convMeta: number }>();
  for (const acct of accountIds()) {
    for (const row of await fetchInsights(acct, 'ad', { preset }, r)) {
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
