/**
 * IA sin crédito → WhatsApp a la dueña (pedido de Ishtar del 16/10/2026).
 *
 * Un solo lugar para las tres puntas:
 *  - `reportarFallaDeIA(error, origen)`: cualquier llamada a Gemini/Vertex que
 *    falló (rutas del CRM vía `ai-error-handler`, el bot vía
 *    /api/bot/ia-credito, la sonda). Clasifica con `errores-ia` y, si es plata
 *    o cuota sostenida, avisa UNA vez por episodio.
 *  - `reportarExitoDeIA()`: una llamada anduvo; cierra el episodio y avisa
 *    "volvió" una vez.
 *  - `sondearCreditoIA()`: la prueba de cada 30 min (5 tokens) para enterarse
 *    aunque nadie escriba.
 *
 * El aviso va por WhatsApp (plantilla `nota_interna`, aprobada) a cada ADMIN
 * con `User.whatsappPhone`, y copia al canal "Fallos y salud del sistema" de
 * la mensajería interna (`avisarAdmins`). Nada por mail (regla del 8/10/2026).
 *
 * Nunca lanza: un aviso roto no puede romper la ruta que estaba avisando.
 */

import { prisma } from '@/lib/db';
import { avisarAdmins } from '@/lib/avisos/aviso-al-equipo';
import { avisarEquipoPorWhatsApp } from '@/lib/whatsapp/aviso-interno';
import { clasificarErrorIA, textoDelError, type ClaseErrorIA } from '@/lib/ia/errores-ia';
import {
    registrarExitoDeIA,
    registrarFallaDeSaldo,
    textoDeLaVuelta,
    textoDelAviso,
    type AlmacenDeMarcas,
} from '@/lib/ia/episodio-credito';
import { LINK_RECARGA_AI_STUDIO, MODELO_SONDA_CREDITO } from '@/lib/constants/ia-credito';

/** SystemSetting con compare-and-set atómico (dos instancias, un solo ganador). */
export const almacenSystemSetting: AlmacenDeMarcas = {
    async leer(clave) {
        const row = await prisma.systemSetting.findUnique({ where: { key: clave }, select: { value: true } });
        return row?.value || '';
    },
    async cambiarSi(clave, esperado, nuevo) {
        if (esperado === '') {
            const n = await prisma.$executeRaw`
                INSERT INTO "SystemSetting" ("key", "value", "updatedAt") VALUES (${clave}, ${nuevo}, now())
                ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
                WHERE "SystemSetting"."value" = ''`;
            return n > 0;
        }
        const n = await prisma.$executeRaw`
            UPDATE "SystemSetting" SET "value" = ${nuevo}, "updatedAt" = now()
            WHERE "key" = ${clave} AND "value" = ${esperado}`;
        return n > 0;
    },
};

const hora = (d: Date) =>
    d.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Cordoba', hour: '2-digit', minute: '2-digit', hour12: false });

async function mandarAviso(asunto: string, texto: string, urgente: boolean): Promise<void> {
    const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, name: true, whatsappPhone: true },
    });
    const resultados = await avisarEquipoPorWhatsApp({
        destinatarios: admins,
        remitente: { id: null, name: 'El sistema' },
        contexto: 'la IA (Gemini)',
        texto,
    });
    const salieron = resultados.filter(r => r.ok).length;
    if (!salieron) console.error(`[IA crédito] El WhatsApp "${asunto}" no le llegó a ningún ADMIN (${resultados.length} con número).`);
    await avisarAdmins({
        asunto,
        cuerpo: `${texto}.${salieron ? '' : '\n\n⚠️ El WhatsApp de este aviso no salió: revisá que tu celular esté cargado en Configuración → Usuarios.'}`,
        urgente,
        // Cada envío ya está deduplicado por la marca en la base; el prefijo
        // con la hora evita que el dedup de 20 h del canal se coma el recordatorio.
        dedupePrefijo: `${asunto} ${new Date().toISOString().slice(0, 13)}`,
    });
}

export async function reportarFallaDeIA(
    error: unknown,
    origen: string,
    opts: { clase?: ClaseErrorIA; almacen?: AlmacenDeMarcas; ahora?: Date } = {},
): Promise<ClaseErrorIA> {
    const clase = opts.clase ?? clasificarErrorIA(error);
    if (clase !== 'sin_credito' && clase !== 'cuota') return clase;
    try {
        const d = await registrarFallaDeSaldo(opts.almacen ?? almacenSystemSetting, clase, opts.ahora ?? new Date());
        console.error(`[IA crédito] ${origen}: ${clase} → ${d.avisar ? `AVISO (${d.tipo})` : `sin aviso: ${d.motivo}`}. ${textoDelError(error).slice(0, 200)}`);
        if (d.avisar) {
            await mandarAviso(
                d.clase === 'sin_credito' ? '💳 La IA se quedó sin crédito' : '💳 La IA está sin cuota',
                textoDelAviso(d, LINK_RECARGA_AI_STUDIO, hora(d.desde)),
                true,
            );
        }
    } catch (e) {
        console.error('[IA crédito] No se pudo procesar la falla:', e);
    }
    return clase;
}

export async function reportarExitoDeIA(opts: { almacen?: AlmacenDeMarcas } = {}): Promise<boolean> {
    try {
        const d = await registrarExitoDeIA(opts.almacen ?? almacenSystemSetting);
        if (!d.avisarVuelta) return false;
        console.log('[IA crédito] Volvió la IA: se avisa una vez.');
        await mandarAviso('✅ Volvió la IA', textoDeLaVuelta(hora(d.desde)), false);
        return true;
    } catch (e) {
        console.error('[IA crédito] No se pudo procesar la vuelta:', e);
        return false;
    }
}

/**
 * La sonda: una llamada de 5 tokens con la MISMA clave que usa el bot. 200 →
 * hay saldo; 402 → sin crédito. Devuelve qué vio, para el log del cron.
 */
export async function sondearCreditoIA(fetchImpl: typeof fetch = fetch): Promise<'ok' | ClaseErrorIA | 'sin_clave'> {
    const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return 'sin_clave';
    let res: Response;
    try {
        res = await fetchImpl(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_SONDA_CREDITO}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
                    generationConfig: { maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
                }),
                signal: AbortSignal.timeout(20_000),
            },
        );
    } catch (e) {
        return clasificarErrorIA(e); // red: transitorio, no se avisa
    }
    if (res.ok) {
        await reportarExitoDeIA();
        return 'ok';
    }
    const cuerpo = await res.text().catch(() => '');
    const error = { status: res.status, message: `[${res.status} ${res.statusText}] ${cuerpo.slice(0, 500)}` };
    return reportarFallaDeIA(error, 'sonda de crédito');
}
