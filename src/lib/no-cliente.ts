import type { Prisma } from '@prisma/client';

/**
 * "Esta ficha no es un cliente que vaya a comprar."
 *
 * Al mismo WhatsApp y al mismo CRM entran proveedores, laboratorios, ópticas
 * del canal mayorista y gente del propio equipo. Si se los trata como leads,
 * aparecen en el embudo y en Oportunidades de Cierre, y alguien termina
 * persiguiendo al laboratorio para que "termine la compra".
 *
 * La marca es una ETIQUETA en la ficha, para que no haga falta tocar código ni
 * migrar nada: se la pone una persona desde la ficha (o queda de un alta que ya
 * la traía) y esa persona desaparece del embudo, del panel de oportunidades y
 * de cualquier seguimiento. Es deliberadamente una decisión humana y reversible
 * —se saca la etiqueta y vuelve— porque el mismo teléfono puede ser proveedor
 * hoy y cliente el mes que viene.
 *
 * El otro lado de la misma regla vive en `wa-service/transport/alta-de-ficha.js`:
 * ahí se decide, ANTES de crear la ficha, si el que escribe es una óptica
 * mayorista, alguien del equipo o un número propio, y en ese caso no se crea.
 */

/**
 * Se comparan en minúsculas y por CONTENIDO, así que "Proveedor Grupo Óptico"
 * y "PROVEEDOR" caen las dos. Mantener la lista corta y sin palabras que
 * puedan aparecer en una etiqueta legítima de cliente.
 */
export const TAGS_NO_CLIENTE = ['no cliente', 'proveedor', 'laboratorio', 'mayorista'] as const;

/** ¿Las etiquetas de esta ficha dicen que no es un cliente? */
export function esNoCliente(tags: { name: string }[] | undefined | null): boolean {
    if (!tags?.length) return false;
    return tags.some(t => {
        const n = t.name.toLowerCase();
        return TAGS_NO_CLIENTE.some(x => n.includes(x));
    });
}

/**
 * Fragmento de `where` para dejarlos afuera desde la base, sin traerlos y
 * filtrarlos después. Se mezcla con el resto del where del `Client`.
 */
export const SOLO_CLIENTES_POSIBLES: Prisma.ClientWhereInput = {
    tags: {
        none: {
            OR: TAGS_NO_CLIENTE.map(name => ({ name: { contains: name, mode: 'insensitive' as const } })),
        },
    },
};
