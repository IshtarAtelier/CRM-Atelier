import { reportarFallaDeIA } from '@/services/ia-credito.service';
import { esFallaDeSaldo } from '@/lib/ia/errores-ia';

/**
 * Qué hacer cuando una llamada a la IA (Gemini/Vertex) falla en el CRM.
 *
 * Desde el 16/10/2026 la clasificación y el aviso son los MISMOS que usa el
 * bot: `src/lib/ia/errores-ia.ts` (espejo de `wa-service/shared/errores-ia.js`)
 * y `ia-credito.service.ts`, que avisa por WhatsApp a la dueña UNA vez por
 * episodio (candado en la base). Antes esto mandaba un mail por proceso y no
 * reconocía el 402 del prepago agotado de AI Studio.
 *
 * Usage:
 * try {
 *    // AI Code
 * } catch (error) {
 *    await handleAIError(error, 'OCR de Recetas');
 * }
 */
export async function handleAIError(error: any, context: string): Promise<never> {
    console.error(`[AI Error - ${context}]:`, error);
    const clase = await reportarFallaDeIA(error, context);
    if (clase === 'sin_credito') {
        throw new Error(`La IA se quedó sin crédito al ejecutar ${context}. Ya se le avisó a la administración para cargar saldo.`);
    }
    if (clase === 'cuota') {
        throw new Error(`La IA está saturada (cuota agotada) al ejecutar ${context}. Probá de nuevo en unos minutos.`);
    }
    throw error;
}

/** Para los `catch` que ya tienen su salida: avisa si es de saldo y dice si lo era. Nunca lanza. */
export async function avisarSiSinCredito(error: unknown, context: string): Promise<boolean> {
    try {
        return esFallaDeSaldo(await reportarFallaDeIA(error, context));
    } catch {
        return false;
    }
}
