/**
 * Actor: identidad de quién ejecuta cada acción del sistema.
 *
 * El middleware (src/middleware.ts) valida el JWT de la cookie `session`
 * y reinyecta la identidad en los headers x-user-id / x-user-name / x-user-role
 * de TODA request API autenticada, sobrescribiendo lo que mande el cliente
 * (o sea: son confiables). Este helper es la única forma canónica de leerlos.
 *
 * Convención de nombres de sistema (para acciones sin humano detrás):
 *   'Bot'                — bot de WhatsApp (auth por BOT_API_KEY)
 *   'Sistema'            — crons y procesos automáticos
 *   'Sistema (Payway)'   — checkout web
 */

export interface Actor {
    id: string | null;
    name: string;
    role: string | null;
}

export const SYSTEM_ACTOR: Actor = { id: null, name: 'Sistema', role: null };
export const BOT_ACTOR: Actor = { id: null, name: 'Bot', role: null };

/** Lee el actor desde los headers inyectados por el middleware. */
export function getActor(request: Request, fallbackName = 'Sistema'): Actor {
    const id = request.headers.get('x-user-id');
    const name = request.headers.get('x-user-name');
    const role = request.headers.get('x-user-role');
    return {
        id: id || null,
        name: name || fallbackName,
        role: role || null,
    };
}

/** Texto "por Milena" / "" según haya o no actor humano identificado. */
export function byActor(actor?: Actor | null): string {
    if (!actor?.name || actor.name === 'Sistema') return '';
    return ` por ${actor.name}`;
}
