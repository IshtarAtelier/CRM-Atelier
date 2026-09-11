import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Actor } from '@/lib/actor';

/**
 * RECALCULA los costos finales de un laboratorio cuando cambia su calibrado o
 * su IVA en Configuración → Laboratorios.
 *
 * Pedido de Ishtar (31/8/2026): "así se ejecuta siempre por el valor que esté
 * configurado; si se cambia el valor desde la configuración de los
 * laboratorios, también se cambie el precio con el nuevo cálculo".
 *
 * La regla de los dos campos (docs/actualizacion-costos-optovision.md):
 *   · `baseCost` — el PELADO: el precio de lista del laboratorio, tal cual.
 *   · `cost`     — el FINAL: (pelado + calibrado) × (1 + IVA/100).
 * Sin este recálculo, cambiar el calibrado en la pantalla era cosmético: los
 * 225 costos seguían calculados con el número viejo hasta la próxima corrida
 * manual de sincronización.
 *
 * QUÉ NO TOCA, a propósito:
 *   · `price` — el precio de venta se decide aparte (Aumentar Precios, piso,
 *     markup por familia). Un cambio de calibrado no puede mover lo que ve el
 *     cliente sin que nadie lo pida.
 *   · Los productos SIN pelado (`baseCost` null): su costo está cargado a mano
 *     (Stellest, HD MR7) y recalcularlo inventaría un número. Se informan.
 */
export async function recalcularCostosDelLaboratorio(
    labName: string,
    calibrado: number,
    iva: number,
    actor?: Actor,
): Promise<{ recalculados: number; sinPelado: number }> {
    // Un solo UPDATE con la fórmula adentro: recalcular 225 filas una por una
    // desde Node tardaría minutos contra la base remota (ya nos pasó con los
    // scripts de carga) y esto corre adentro de un request HTTP.
    //
    // 🔴 ESPEJO de computeFinalLensCost (src/lib/lens-cost.ts): calibrado SIMPLE
    // en los cristales —también en 2x1— y SIN calibrado en los tratamientos,
    // todo con el IVA del laboratorio. Si cambia la fórmula allá, se cambia acá.
    // `npm run check:costos` compara cada costo de la base contra esa función y
    // grita si este SQL y ella se separan.
    //
    // Hasta el 11/9/2026 esto tocaba solo `category = 'Cristal'`: si se cambiaba
    // el IVA de Optovisión, sus 22 tratamientos (que llevan ×1,21) quedaban con
    // el IVA viejo para siempre.
    const recalculados: number = await prisma.$executeRaw`
        update "Product"
        set cost = round(("baseCost" + case when category = 'Tratamiento' then 0 else ${calibrado} end)
                         * (1 + ${iva} / 100.0)),
            "updatedAt" = now()
        where category in ('Cristal', 'Tratamiento')
          and upper(laboratory) = upper(${labName})
          and "baseCost" is not null
          and round(cost) <> round(("baseCost" + case when category = 'Tratamiento' then 0 else ${calibrado} end)
                                   * (1 + ${iva} / 100.0))`;

    const sinPelado = await prisma.product.count({
        where: { category: { in: ['Cristal', 'Tratamiento'] }, laboratory: { equals: labName, mode: 'insensitive' }, baseCost: null },
    });

    await logAudit({
        userId: actor?.id,
        userName: actor?.name ?? 'Sistema',
        action: 'UPDATE',
        entityType: 'PRODUCT',
        entityId: `lab:${labName}`,
        details: {
            descripcion: `Costos de "${labName}" recalculados desde el pelado por cambio de configuración`,
            calibrado, iva, recalculados, sinPelado,
        },
    });

    return { recalculados, sinPelado };
}
