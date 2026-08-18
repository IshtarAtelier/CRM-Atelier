import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { AdsBudgetService } from '@/services/ads-budget.service';

/**
 * Mantiene al día los renglones "Meta Ads" / "Google Ads" de /admin/gastos
 * (categoría MARKETING) con lo gastado en el mes en curso.
 *
 * Por qué existe: esos dos renglones ya existían como plantilla (DEFAULT_TEMPLATES
 * en admin/gastos/page.tsx) pero se cargaban a mano — o no se cargaban, y el
 * mes quedaba en $0. La plata real ya vive en las dos plataformas; copiarla a
 * mano es la forma de que quede vieja.
 *
 * NO se calcula "en vivo" en cada GET de /api/expenses, como sí hacen los
 * costos de laboratorio de esa misma pantalla (ver esa ruta): esos salen de la
 * propia base con una query local, instantánea; esto depende de dos APIs
 * externas (Meta, Google) que no conviene golpear cada vez que alguien abre la
 * pantalla de gastos. Se lee una vez por día (cron) y se guarda.
 *
 * ES UN NÚMERO "A LA FECHA", no el total del mes: crece día a día vía UPDATE y
 * recién es definitivo el último día. Mismo criterio que el techo publicitario
 * (AdsBudgetService), que es de donde sale el dato — una sola fuente para
 * "cuánto se gastó este mes en ads", la lee el mail diario, el techo Y ahora
 * también gastos.
 *
 * SI UNA PLATAFORMA NO SE PUDO LEER, NO se toca su renglón: sobreescribir con
 * cero sería peor que dejar el número de ayer (un gasto real nunca baja a $0
 * de un día para el otro). El caller decide si avisa.
 */

const NOMBRE_META = 'Meta Ads';
const NOMBRE_GOOGLE = 'Google Ads';
const CATEGORIA_MARKETING = 'MARKETING';

export interface ResultadoSyncGastosAds {
    actualizados: Array<{ nombre: string; monto: number; accion: 'creado' | 'actualizado' | 'sin_cambios' }>;
    saltados: string[];
    mes: number;
    anio: number;
}

/**
 * Crea o actualiza UN renglón de gasto (buscado por nombre+mes+año, que es lo
 * único disponible: FixedCost no tiene una columna única para esos tres campos
 * — no es una limitación nueva, la ruta manual de /api/expenses tampoco la
 * tiene y por eso identifica cada fila por `id`). Firma como 'Sistema' y dos
 * gastos que ya empezaban en $0 esta mañana no generan ruido si el número no
 * cambió realmente.
 */
async function actualizarRenglon(
    nombre: string,
    monto: number,
    mes: number,
    anio: number,
    nota: string,
): Promise<{ nombre: string; monto: number; accion: 'creado' | 'actualizado' | 'sin_cambios' }> {
    const existente = await prisma.fixedCost.findFirst({
        where: { name: nombre, month: mes, year: anio, category: CATEGORIA_MARKETING },
    });

    if (existente) {
        if (Math.round(existente.amount) === Math.round(monto)) {
            return { nombre, monto, accion: 'sin_cambios' };
        }
        const antes = existente.amount;
        await prisma.fixedCost.update({
            where: { id: existente.id },
            data: { amount: monto, notes: nota },
        });
        await logAudit({
            userId: SYSTEM_ACTOR.id,
            userName: SYSTEM_ACTOR.name,
            action: 'UPDATE',
            entityType: 'EXPENSE',
            entityId: existente.id,
            details: {
                descripcion: `Gasto "${nombre}" (${mes}/${anio}) actualizado automáticamente desde la plataforma`,
                before: { amount: antes },
                after: { amount: monto },
            },
        });
        return { nombre, monto, accion: 'actualizado' };
    }

    const creado = await prisma.fixedCost.create({
        data: {
            name: nombre,
            amount: monto,
            category: CATEGORIA_MARKETING,
            type: CATEGORIA_MARKETING,
            month: mes,
            year: anio,
            notes: nota,
        },
    });
    await logAudit({
        userId: SYSTEM_ACTOR.id,
        userName: SYSTEM_ACTOR.name,
        action: 'CREATE',
        entityType: 'EXPENSE',
        entityId: creado.id,
        details: {
            descripcion: `Gasto "${nombre}" (${mes}/${anio}) creado automáticamente desde la plataforma`,
            name: creado.name,
            amount: creado.amount,
            category: creado.category,
            month: mes,
            year: anio,
        },
    });
    return { nombre, monto, accion: 'creado' };
}

/** Lee el gasto del mes en Meta y Google (AdsBudgetService) y actualiza /admin/gastos. */
export async function sincronizarGastosDeAds(): Promise<ResultadoSyncGastosAds> {
    const techo = await AdsBudgetService.getEstado();
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();
    const nota = `Gasto a la fecha (día ${techo.diaDelMes} de ${techo.diasDelMes}) — se actualiza solo, todos los días.`;

    const actualizados: ResultadoSyncGastosAds['actualizados'] = [];
    const saltados: string[] = [];

    if (techo.meta !== null) {
        actualizados.push(await actualizarRenglon(NOMBRE_META, techo.meta, mes, anio, nota));
    } else {
        saltados.push('Meta Ads');
    }

    if (techo.google !== null) {
        actualizados.push(await actualizarRenglon(NOMBRE_GOOGLE, techo.google, mes, anio, nota));
    } else {
        saltados.push('Google Ads');
    }

    return { actualizados, saltados, mes, anio };
}
