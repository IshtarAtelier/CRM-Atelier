import { prisma } from '../../lib/db';
import { labPortalClientName } from '../../lib/lab-portal-client-name';

/**
 * 2x1 CON LOS DOS PARES COBRADOS.
 *
 * En el 2x1 el laboratorio factura un par y el otro va sin cargo (o a unos
 * pesos). Cuando cobra los DOS, es plata a reclamar — y hasta ahora no lo
 * detectaba nadie: el cruce compara a nivel VENTA, así que si los pedidos
 * quedaron sin venta enganchada (huérfanos) nunca se comparan contra nada y el
 * doble cobro pasa entero. Así aparecieron los seis pares que la administradora
 * juntó a mano el 12/8/2026 (Neira, Romero, García, Nuñez, Ovejero, Braun):
 * $953.492 en segundos pares cobrados.
 *
 * Se agrupa por los dos caminos posibles:
 *   - por VENTA, cuando los pedidos están enganchados a una;
 *   - por NOMBRE DEL PORTAL, cuando son huérfanos (el portal del laboratorio
 *     trae el nombre que escribió la óptica al cargar el pedido, y es lo único
 *     que hermana dos pedidos sin venta).
 *
 * Es una SOSPECHA, no un veredicto: dos pares cobrados pueden ser legítimos
 * (dos anteojos distintos comprados juntos, o el mismo cristal a precio de
 * lista — ver CLAUDE.md). Por eso informa los dos importes y deja decidir.
 */

/** Piso para considerar que un par "vino con cargo" y no a $0 simbólico. */
const CON_CARGO_MIN = 5000;

export interface DobleCobro {
    lab: string;
    cliente: string | null;
    clientId: string | null;
    /** Cómo se hermanaron los pedidos: por la venta o por el nombre del portal. */
    origen: 'VENTA' | 'PORTAL';
    pedidos: { labOrderNumber: string; importe: number; invoiceDate: Date | null }[];
    total: number;
    /** El más barato de los pares cobrados: lo que se reclamaría. */
    aReclamar: number;
    mismoImporte: boolean;
}

const importeDe = (e: { lab: string; billedNet: number | null; billedTotal: number | null }) =>
    e.lab === 'OPTOVISION' ? (e.billedTotal ?? e.billedNet) : (e.billedNet ?? e.billedTotal);

/**
 * Busca ventas (o clientes del portal) con DOS O MÁS pedidos facturados con
 * cargo en la ventana pedida. Solo lee.
 */
export async function detectarDobleCobro(dias = 120): Promise<DobleCobro[]> {
    const desde = new Date(Date.now() - dias * 86400000);
    const entradas = await prisma.labCostEntry.findMany({
        where: {
            createdAt: { gte: desde },
            OR: [{ billedNet: { not: null } }, { billedTotal: { not: null } }],
        },
        select: {
            lab: true, labOrderNumber: true, billedNet: true, billedTotal: true,
            invoiceDate: true, notes: true, orderId: true,
            order: { select: { clientId: true, client: { select: { name: true } } } },
        },
    });

    const grupos = new Map<string, { origen: 'VENTA' | 'PORTAL'; cliente: string | null; clientId: string | null; items: typeof entradas }>();
    for (const e of entradas) {
        const importe = importeDe(e);
        if (importe === null || importe < CON_CARGO_MIN) continue;
        // Un reproceso de garantía no es el segundo par de un 2x1.
        if ((e.notes || '').includes('POSTVENTA (caso')) continue;

        const porPortal = labPortalClientName(e.notes);
        const key = e.orderId
            ? `V:${e.lab}:${e.orderId}`
            : porPortal ? `P:${e.lab}:${porPortal.toLowerCase().replace(/\s+/g, ' ').trim()}` : null;
        if (!key) continue;

        if (!grupos.has(key)) {
            grupos.set(key, {
                origen: e.orderId ? 'VENTA' : 'PORTAL',
                cliente: e.order?.client?.name ?? porPortal,
                clientId: e.order?.clientId ?? null,
                items: [] as typeof entradas,
            });
        }
        grupos.get(key)!.items.push(e);
    }

    const hallazgos: DobleCobro[] = [];
    for (const g of grupos.values()) {
        if (g.items.length < 2) continue;
        const pedidos = g.items
            .map(e => ({ labOrderNumber: e.labOrderNumber, importe: importeDe(e)!, invoiceDate: e.invoiceDate }))
            .sort((a, b) => b.importe - a.importe);
        const total = pedidos.reduce((a, p) => a + p.importe, 0);
        hallazgos.push({
            lab: g.items[0].lab,
            cliente: g.cliente,
            clientId: g.clientId,
            origen: g.origen,
            pedidos,
            total,
            // Lo reclamable es todo lo cobrado de más allá del par más caro.
            aReclamar: total - pedidos[0].importe,
            mismoImporte: pedidos.every(p => Math.round(p.importe) === Math.round(pedidos[0].importe)),
        });
    }
    return hallazgos.sort((a, b) => b.aReclamar - a.aReclamar);
}

/** Clave estable del hallazgo (no depende del orden ni de los importes). */
export const claveDobleCobro = (d: DobleCobro) =>
    `${d.lab}:${d.pedidos.map(p => p.labOrderNumber).sort().join('+')}`;

const AVISADOS_KEY = 'lab_doble_cobro_avisados';

/**
 * Los que todavía no se avisaron. El dedupe es imprescindible: sin él, el mismo
 * par reaparecería en el resumen todos los días hasta que se resuelva con el
 * laboratorio (semanas), y un aviso que se repite deja de leerse.
 */
export async function dobleCobroNuevos(dias = 120): Promise<DobleCobro[]> {
    const todos = await detectarDobleCobro(dias);
    const row = await prisma.systemSetting.findUnique({ where: { key: AVISADOS_KEY } }).catch(() => null);
    const avisados = new Set<string>(row?.value ? JSON.parse(row.value) : []);
    return todos.filter(d => !avisados.has(claveDobleCobro(d)));
}

/** Marca hallazgos como avisados (después de que el email salió de verdad). */
export async function marcarDobleCobroAvisado(hallazgos: DobleCobro[]) {
    if (hallazgos.length === 0) return;
    const row = await prisma.systemSetting.findUnique({ where: { key: AVISADOS_KEY } }).catch(() => null);
    const avisados: string[] = row?.value ? JSON.parse(row.value) : [];
    const value = JSON.stringify([...new Set([...avisados, ...hallazgos.map(claveDobleCobro)])]);
    await prisma.systemSetting.upsert({
        where: { key: AVISADOS_KEY },
        update: { value },
        create: { key: AVISADOS_KEY, value },
    }).catch(err => console.error('[LabCost] Error marcando doble cobro avisado:', err));
}
