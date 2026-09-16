/**
 * Traduce el id de anuncio que llega en el click-to-WhatsApp al nombre del
 * anuncio y de la campaña, preguntándole a Meta.
 *
 * Por qué existe (16/9/2026): la prueba de que un chat vino de un anuncio es el
 * `referral` de la Cloud API, y ahí Meta manda un id —120250350194950023—, no un
 * nombre. El nombre vive en Meta y puede cambiar, así que no se copia a mano ni
 * se mantiene una tabla paralela: se consulta y se guarda en `MetaAd` para no
 * pegarle a la Graph API en cada lectura. Verificado ese día contra la cuenta
 * real: ese id devuelve el anuncio "[metaishvarilux]" de la campaña
 * "Mensajes ✉️" — el mismo nombre que ya usan los reportes por etiqueta.
 *
 * SOLO LECTURA: este módulo no escribe nada en Meta. Mismas protecciones que
 * meta-insights.ts — versión pineada, appsecret_proof, y el token nunca se
 * imprime.
 */
import crypto from 'crypto';
import { prisma } from '@/lib/db';

const API_VERSION = 'v24.0';

/** Cuánto vale un nombre cacheado antes de volver a preguntar. */
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;

export interface AnuncioDeMeta {
    id: string;
    name: string | null;
    campaignId: string | null;
    campaignName: string | null;
    adsetName: string | null;
    status: string | null;
}

export function metaLookupConfigurado(): boolean {
    return Boolean(process.env.META_ADS_TOKEN);
}

function firmar(url: URL, token: string): void {
    const secret = process.env.META_APP_SECRET;
    if (!secret) return;
    url.searchParams.set('appsecret_proof', crypto.createHmac('sha256', secret).update(token).digest('hex'));
}

/** Una sola consulta a Meta por un id de anuncio. Devuelve null si no se pudo. */
async function preguntarleAMeta(adId: string): Promise<AnuncioDeMeta | null> {
    const token = process.env.META_ADS_TOKEN;
    if (!token) return null;
    const url = new URL(`https://graph.facebook.com/${API_VERSION}/${adId}`);
    url.searchParams.set('fields', 'name,effective_status,campaign{id,name},adset{name}');
    url.searchParams.set('access_token', token);
    firmar(url, token);
    try {
        const res = await fetch(url);
        const json: any = await res.json().catch(() => null);
        if (!json || json.error) return null;
        return {
            id: adId,
            name: json.name ?? null,
            campaignId: json.campaign?.id ?? null,
            campaignName: json.campaign?.name ?? null,
            adsetName: json.adset?.name ?? null,
            status: json.effective_status ?? null,
        };
    } catch {
        return null;
    }
}

/**
 * Nombre del anuncio y de la campaña para una lista de ids.
 *
 * Primero lo que ya está guardado y vigente; a Meta solo se le pregunta por lo
 * que falta. Si Meta no contesta, se devuelve lo viejo antes que nada: un
 * nombre de la semana pasada sirve; un hueco, no.
 */
export async function resolverAnuncios(ids: string[]): Promise<Map<string, AnuncioDeMeta>> {
    const unicos = [...new Set(ids.filter(Boolean))];
    const resultado = new Map<string, AnuncioDeMeta>();
    if (unicos.length === 0) return resultado;

    const guardados = await prisma.metaAd.findMany({
        where: { id: { in: unicos } },
        select: { id: true, name: true, campaignId: true, campaignName: true, adsetName: true, status: true, fetchedAt: true },
    });
    const porId = new Map(guardados.map((a) => [a.id, a]));
    const corte = Date.now() - VIGENCIA_MS;

    for (const id of unicos) {
        const guardado = porId.get(id);
        const vigente = guardado && guardado.fetchedAt.getTime() > corte;
        if (vigente) {
            resultado.set(id, guardado);
            continue;
        }
        const fresco = await preguntarleAMeta(id);
        if (fresco) {
            await prisma.metaAd
                .upsert({
                    where: { id },
                    create: { ...fresco, fetchedAt: new Date() },
                    update: { ...fresco, fetchedAt: new Date() },
                })
                .catch(() => {});
            resultado.set(id, fresco);
        } else if (guardado) {
            resultado.set(id, guardado);
        }
    }
    return resultado;
}

/** Cómo mostrar un anuncio en pantalla: su nombre si se sabe, el id si no. */
export function nombreDeAnuncio(anuncio: AnuncioDeMeta | undefined, id: string): string {
    if (!anuncio?.name) return `anuncio ${id}`;
    return anuncio.campaignName ? `${anuncio.name} · ${anuncio.campaignName}` : anuncio.name;
}
