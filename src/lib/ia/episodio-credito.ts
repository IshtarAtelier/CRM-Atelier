/**
 * Episodios de "IA sin crédito": cuándo se avisa, cuándo no, y cuándo se
 * dice que volvió (pedido de Ishtar del 16/10/2026).
 *
 * Lógica pura sobre un almacén con compare-and-set: en producción es
 * `SystemSetting` (ver `ia-credito.service.ts`), en el check es un Map. Así
 * dos instancias del CRM, el bot y la sonda pueden reportar a la vez y sale
 * UN aviso por episodio — gana el que logra mover la marca en la base.
 *
 * Reglas:
 *  - 'sin_credito' abre el episodio y avisa enseguida.
 *  - 'cuota' (429) solo cuenta si dura MINUTOS_CUOTA_SOSTENIDA: un pico de un
 *    minuto se arregla solo y no merece un WhatsApp.
 *  - Mientras siga, se re-avisa como mucho cada HORAS_ENTRE_AVISOS_SIN_CREDITO.
 *  - Una llamada que anda cierra el episodio; si se había avisado, se manda
 *    UNA vez "volvió".
 *  - Las marcas viven en la base: un reinicio no re-avisa.
 */

import {
    CLAVE_AVISADO_AT,
    CLAVE_CUOTA_DESDE,
    CLAVE_EPISODIO_DESDE,
    HORAS_ENTRE_AVISOS_SIN_CREDITO,
    MINUTOS_CUOTA_SOSTENIDA,
} from '@/lib/constants/ia-credito';
import type { ClaseErrorIA } from '@/lib/ia/errores-ia';

export interface AlmacenDeMarcas {
    /** Valor actual ('' si no existe). */
    leer(clave: string): Promise<string>;
    /** Escribe `nuevo` SOLO si el valor actual es `esperado` ('' = vacío o sin fila). Atómico. */
    cambiarSi(clave: string, esperado: string, nuevo: string): Promise<boolean>;
}

export type DecisionDeFalla =
    | { avisar: false; motivo: string }
    | { avisar: true; tipo: 'primer_aviso' | 'recordatorio'; clase: ClaseErrorIA; desde: Date };

const ms = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : NaN;
};

/** Abre la marca `clave` si estaba vacía y devuelve la vigente. */
async function abrir(almacen: AlmacenDeMarcas, clave: string, ahoraIso: string): Promise<string> {
    const actual = await almacen.leer(clave);
    if (actual) return actual;
    if (await almacen.cambiarSi(clave, '', ahoraIso)) return ahoraIso;
    return (await almacen.leer(clave)) || ahoraIso;
}

export async function registrarFallaDeSaldo(
    almacen: AlmacenDeMarcas,
    clase: ClaseErrorIA,
    ahora: Date = new Date(),
): Promise<DecisionDeFalla> {
    const ahoraIso = ahora.toISOString();
    if (clase !== 'sin_credito' && clase !== 'cuota') return { avisar: false, motivo: `no es de saldo (${clase})` };

    if (clase === 'cuota') {
        const cuotaDesde = await abrir(almacen, CLAVE_CUOTA_DESDE, ahoraIso);
        const minutos = (ahora.getTime() - ms(cuotaDesde)) / 60000;
        if (!(minutos >= MINUTOS_CUOTA_SOSTENIDA)) {
            return { avisar: false, motivo: `cuota agotada hace ${Math.max(0, Math.round(minutos))} min (se avisa desde ${MINUTOS_CUOTA_SOSTENIDA})` };
        }
    }

    const desde = await abrir(almacen, CLAVE_EPISODIO_DESDE, ahoraIso);
    const avisado = await almacen.leer(CLAVE_AVISADO_AT);
    if (avisado && ahora.getTime() - ms(avisado) < HORAS_ENTRE_AVISOS_SIN_CREDITO * 3600_000) {
        return { avisar: false, motivo: 'ya se avisó en este episodio' };
    }
    // Gana UNA instancia: la que mueve la marca desde el valor que leyó.
    if (!(await almacen.cambiarSi(CLAVE_AVISADO_AT, avisado, ahoraIso))) {
        return { avisar: false, motivo: 'otra instancia avisó recién' };
    }
    return { avisar: true, tipo: avisado ? 'recordatorio' : 'primer_aviso', clase, desde: new Date(ms(desde) || ahora.getTime()) };
}

export type DecisionDeExito = { avisarVuelta: false } | { avisarVuelta: true; desde: Date };

/** Una llamada anduvo: cierra el episodio. `avisarVuelta` solo si se había avisado que faltaba. */
export async function registrarExitoDeIA(almacen: AlmacenDeMarcas): Promise<DecisionDeExito> {
    const cuota = await almacen.leer(CLAVE_CUOTA_DESDE);
    if (cuota) await almacen.cambiarSi(CLAVE_CUOTA_DESDE, cuota, '');
    const desde = await almacen.leer(CLAVE_EPISODIO_DESDE);
    if (!desde) return { avisarVuelta: false };
    if (!(await almacen.cambiarSi(CLAVE_EPISODIO_DESDE, desde, ''))) return { avisarVuelta: false };
    const avisado = await almacen.leer(CLAVE_AVISADO_AT);
    if (!avisado) return { avisarVuelta: false };
    await almacen.cambiarSi(CLAVE_AVISADO_AT, avisado, '');
    return { avisarVuelta: true, desde: new Date(ms(desde)) };
}

// ── Textos ──────────────────────────────────────────────────────────────────
// Cortos y en un renglón: van como variable de la plantilla `nota_interna`,
// que termina en ". Podés responderle desde el sistema." (por eso sin punto final).

export function textoDelAviso(d: Extract<DecisionDeFalla, { avisar: true }>, link: string, horaDesde: string): string {
    const que = d.clase === 'sin_credito'
        ? 'Se acabó el crédito de la IA (Gemini)'
        : `La IA (Gemini) está sin cuota hace más de ${MINUTOS_CUOTA_SOSTENIDA} min`;
    const sigue = d.tipo === 'recordatorio' ? `Sigue igual desde las ${horaDesde}. ` : '';
    return `${sigue}${que}: el bot de WhatsApp NO les contesta a los clientes y el CRM no lee recetas ni comprobantes. `
        + `Cargá saldo en AI Studio → Billing → Add funds (${link}) y conviene prender la recarga automática. `
        + 'Cuando vuelva te aviso y el bot contesta lo que quedó pendiente';
}

export function textoDeLaVuelta(horaDesde: string): string {
    return `Volvió la IA (Gemini), que estaba sin crédito desde las ${horaDesde}: el bot ya contesta y retoma los chats que quedaron esperando de las últimas 24 h`;
}
