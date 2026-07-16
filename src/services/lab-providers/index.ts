import { prisma } from '../../lib/db';
import { LabCostReconciliationService } from '../lab-cost-reconciliation.service';
import { GrupoOpticoProvider } from './grupo-optico.provider';

/**
 * Capa de proveedores de la conciliación de costos de laboratorio.
 * Cada laboratorio es un proveedor con una operación `collect()` que trae sus
 * datos (pedidos y/o costos facturados) y los registra vía upsertEntry — que es
 * idempotente y nunca pisa facturación previa. Agregar un laboratorio nuevo =
 * agregar un proveedor a esta lista; el cron y la UI no cambian.
 */

export interface LabProvider {
    name: string;
    description: string;
    collect(opts?: { days?: number }): Promise<any>;
}

const STATE_KEY = (name: string) => `lab-provider:${name}:lastOkAt`;

export const LAB_PROVIDERS: LabProvider[] = [
    {
        name: 'OPTOVISION',
        description: 'Facturas PDF por email (IMAP)',
        collect: ({ days = 35 } = {}) => LabCostReconciliationService.scanOptovisionInbox(days),
    },
    {
        name: 'GRUPO_OPTICO',
        description: 'Pedidos vía la API del portal SmartLab',
        collect: () => GrupoOpticoProvider.collect(),
    },
];

/**
 * Corre todos los proveedores tolerando fallas parciales, luego re-cruza lo
 * pendiente, y devuelve el estado de salud de cada proveedor (cuánto hace que
 * no corre bien) para que el cron pueda alertar si alguno quedó caído.
 */
export async function runAllProviders(opts: { days?: number } = {}) {
    const results: Record<string, any> = {};

    for (const provider of LAB_PROVIDERS) {
        try {
            const summary = await provider.collect(opts);
            results[provider.name] = { ok: !summary?.skipped && !summary?.error, ...summary };
            if (results[provider.name].ok) {
                await prisma.systemSetting.upsert({
                    where: { key: STATE_KEY(provider.name) },
                    update: { value: new Date().toISOString() },
                    create: { key: STATE_KEY(provider.name), value: new Date().toISOString() },
                });
            }
        } catch (err: any) {
            console.error(`[LabProviders] ${provider.name} falló:`, err);
            results[provider.name] = { ok: false, error: err?.message || 'Error' };
        }
    }

    results.recheck = await LabCostReconciliationService.recheckUnmatched()
        .catch((err: any) => ({ error: err?.message }));

    // Salud: días desde la última corrida exitosa de cada proveedor.
    const health: Record<string, number | null> = {};
    for (const provider of LAB_PROVIDERS) {
        const state = await prisma.systemSetting.findUnique({ where: { key: STATE_KEY(provider.name) } });
        health[provider.name] = state
            ? Math.floor((Date.now() - new Date(state.value).getTime()) / 86400000)
            : null; // null = nunca corrió bien
    }
    results.health = health;

    return results;
}
