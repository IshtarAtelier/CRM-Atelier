/**
 * OPORTUNIDADES DE CIERRE — las reglas puras del panel.
 *
 * Todo lo que decide QUÉ tarjetas se ven y en qué orden, sin tocar la base:
 * qué es ticket alto, cuándo dos candidatos son la misma persona, y qué pasa
 * cuando ya le escribieron. Las consultas viven en `CierresService`; acá solo
 * las decisiones, para que `npm run check:cierres` las pueda probar con
 * fixtures y sin base (antes estaban mezcladas con 700 líneas de consultas
 * dentro de la ruta y no había forma de testearlas).
 *
 * Reglas dictadas por Ishtar el 10/9/2026 — ver `src/lib/constants/cierres.ts`.
 */

import { formatPhoneForWhatsApp } from '@/lib/phone-utils';
import { MONTO_TICKET_ALTO } from '@/lib/constants/cierres';

export type TipoCierre = 'STALLED_FAVORITE' | 'PENDING_QUOTE' | 'ABANDONED_CART' | 'SIN_PRESUPUESTO';

export interface YaEscrito {
    cuando: string;
    quien: string | null;
}

export interface Oportunidad {
    id: string;
    type: TipoCierre;
    title: string;
    clientName: string;
    clientId: string | null;
    phone: string | null;
    email: string | null;
    /** Especial (multifocal, miopía, graduación alta): va primero dentro de su grupo. */
    isPriority: boolean;
    /** Ticket alto: "importante del mes". Se persigue más y no se esconde. */
    importante: boolean;
    detail: string;
    amount: number | null;
    daysElapsed: number;
    lastActivity: string;
    yaEscrito?: YaEscrito;
}

// ── Ticket alto ─────────────────────────────────────────────────────────────

/**
 * Palabras que delatan un lente de alto compromiso. Estaba copiada TRES veces
 * en la ruta (favoritos, presupuestos, carritos) con diferencias: el favorito
 * buscaba "miop" y el presupuesto "miopía"/"miopia"/"control miop".
 */
export const PALABRAS_LENTE_ESPECIAL = [
    'multifocal', 'progresivo', 'bifocal', 'myofix', 'myopilux', 'myolens', 'miop',
] as const;

export function esLenteEspecial(texto: string | null | undefined): boolean {
    const t = (texto || '').toLowerCase();
    return PALABRAS_LENTE_ESPECIAL.some(p => t.includes(p));
}

/** Esfera ≥ 4 o cilindro ≥ 2, en valor absoluto, en cualquier ojo. */
export function esGraduacionAlta(esferas: (number | null | undefined)[], cilindros: (number | null | undefined)[]): boolean {
    return esferas.some(s => s != null && Math.abs(s) >= 4) || cilindros.some(c => c != null && Math.abs(c) >= 2);
}

export function esMontoAlto(monto: number | null | undefined): boolean {
    return (monto ?? 0) >= MONTO_TICKET_ALTO;
}

// ── Identidad ───────────────────────────────────────────────────────────────

/**
 * Llave de teléfono: normaliza formatos argentinos (el "15" intercalado, el 0
 * de área, +54 9) y se queda con los últimos 8 dígitos. Sin normalizar,
 * "0351 15 6123456" y "3516123456" parecían dos personas.
 */
export function llaveTelefono(phone: string | null | undefined): string | null {
    const e164 = formatPhoneForWhatsApp(phone);
    if (e164.length <= 3) return null;
    const local = e164.slice(3);
    return local.length >= 8 ? local.slice(-8) : null;
}

/**
 * Llave de NOMBRE: sin tildes ni signos, y SOLO si tiene dos palabras o más.
 * "Sandra" a secas coincide con cualquier Sandra — ese match difuso ya dejó el
 * panel en cero una vez ("fernando" tapaba a todos los Fernandos).
 */
export function llaveNombre(name: string | null | undefined): string | null {
    const limpio = (name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return limpio.split(' ').length >= 2 ? limpio : null;
}

export function llaveEmail(email: string | null | undefined): string | null {
    const e = (email || '').trim().toLowerCase();
    return e || null;
}

function llavesDe(o: Pick<Oportunidad, 'clientId' | 'phone' | 'email' | 'clientName'>): string[] {
    const pk = llaveTelefono(o.phone);
    const ek = llaveEmail(o.email);
    const nk = llaveNombre(o.clientName);
    return [
        o.clientId ? `c:${o.clientId}` : null,
        pk ? `t:${pk}` : null,
        ek ? `e:${ek}` : null,
        nk ? `n:${nk}` : null,
    ].filter((k): k is string => !!k);
}

// ── Orden ───────────────────────────────────────────────────────────────────

/** Importantes arriba; adentro, especiales, después monto, después antigüedad. */
export function compararOportunidades(a: Oportunidad, b: Oportunidad): number {
    if (b.importante !== a.importante) return b.importante ? 1 : -1;
    if (b.isPriority !== a.isPriority) return b.isPriority ? 1 : -1;
    const montoA = a.amount || 0;
    const montoB = b.amount || 0;
    if (montoB !== montoA) return montoB - montoA;
    return b.daysElapsed - a.daysElapsed;
}

// ── Una persona = una tarjeta ───────────────────────────────────────────────

export interface Persona {
    /** La tarjeta que representa a la persona: la más importante de su grupo. */
    tarjeta: Oportunidad;
    /** Todas las fichas que resultaron ser esta persona. */
    fichas: string[];
}

/**
 * Agrupa los candidatos por PERSONA — nunca dos tarjetas para la misma
 * (Ishtar, 10/9/2026).
 *
 * Unión de conjuntos sobre TODOS los candidatos antes de elegir: si A comparte
 * teléfono con B y B comparte email con C, las tres son una persona aunque A y
 * C no tengan nada en común. La versión anterior decidía en una sola pasada,
 * así que un candidato que aparecía después "uniendo" dos tarjetas ya armadas
 * dejaba a la misma persona dos veces — justo lo que se pidió que no pase.
 */
export function agruparPorPersona(candidatos: Oportunidad[]): Persona[] {
    const padre = candidatos.map((_, i) => i);
    const raiz = (i: number): number => {
        while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; }
        return i;
    };
    const primeroConLlave = new Map<string, number>();
    candidatos.forEach((o, i) => {
        for (const k of llavesDe(o)) {
            const j = primeroConLlave.get(k);
            if (j === undefined) primeroConLlave.set(k, i);
            else padre[raiz(i)] = raiz(j);
        }
    });

    const grupos = new Map<number, Oportunidad[]>();
    candidatos.forEach((o, i) => {
        const r = raiz(i);
        const g = grupos.get(r);
        if (g) g.push(o); else grupos.set(r, [o]);
    });

    return [...grupos.values()].map(miembros => {
        const orden = [...miembros].sort(compararOportunidades);
        return {
            tarjeta: orden[0],
            fichas: [...new Set(miembros.map(m => m.clientId).filter((x): x is string => !!x))],
        };
    });
}

// ── "Ya le escribí" ─────────────────────────────────────────────────────────

/**
 * Arma la lista final:
 *   · a lo COMÚN que ya le escribieron (en cualquiera de sus fichas) se lo
 *     esconde — vuelve solo cuando vence la ventana, si sigue sin comprar;
 *   · a lo IMPORTANTE se lo deja, al fondo y marcado con quién y cuándo
 *     ("los importantes del mes, tenerlos presentes").
 *
 * `ultimoEscrito` va por ficha; ya viene filtrado a la ventana de días.
 */
export function armarPanel(personas: Persona[], ultimoEscrito: Map<string, YaEscrito>): Oportunidad[] {
    const visibles: Oportunidad[] = [];
    for (const { tarjeta, fichas } of personas) {
        const esc = fichas
            .map(id => ultimoEscrito.get(id))
            .filter((x): x is YaEscrito => !!x)
            .sort((a, b) => b.cuando.localeCompare(a.cuando))[0];
        if (esc && !tarjeta.importante) continue;
        visibles.push(esc ? { ...tarjeta, yaEscrito: esc } : tarjeta);
    }
    return visibles.sort((a, b) => {
        const grupo = (o: Oportunidad) => (o.yaEscrito ? 1 : 0);
        return grupo(a) - grupo(b) || compararOportunidades(a, b);
    });
}
