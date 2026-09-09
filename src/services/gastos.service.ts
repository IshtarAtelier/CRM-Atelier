/**
 * Los gastos de un mes: los que carga una persona y los que trae el sistema.
 *
 * Antes esto vivía repartido entre la pantalla (`/admin/gastos`, que llevaba
 * su propia plantilla) y la ruta API (que calculaba los laboratorios a mano).
 * El resultado era que el mes se armaba una sola vez, el día que alguien lo
 * abría: un concepto nuevo no aparecía en los meses ya abiertos y uno borrado
 * por error no volvía. Acá el mes se RECONCILIA en cada lectura contra
 * `CONCEPTOS_GASTO`, así que la lista fija está siempre completa.
 *
 * Los importes automáticos (Meta, Google, suscripciones en dólares) se
 * PERSISTEN, no se calculan al vuelo para mostrarlos: el dashboard y el cierre
 * de mes leen `FixedCost` derecho de la base (`report.service.ts`), así que un
 * gasto que solo existiera en la pantalla no entraría nunca en el resultado
 * del negocio — que es justo el número que importa.
 */
import { prisma } from '@/lib/db';
import { CONCEPTOS_GASTO, esAutomatico, type ConceptoGasto } from '@/lib/constants/gastos-fijos';
import { fetchGastoMensualArs, dolarBlue, metaAdsConfigured } from '@/lib/ads/meta-insights';
import { GoogleAdsService } from '@/services/google-ads.service';

export interface GastoDelMes {
    id: string;
    name: string;
    amount: number;
    category: string;
    type: string;
    month: number;
    year: number;
    notes?: string | null;
    clave?: string | null;
    fuente: string;
    obligatorio: boolean;
    /** La pantalla lo usa para bloquear el input y poner el cartelito. */
    isCalculated: boolean;
    /** Por qué un automático quedó sin importe (Meta caída, sin credenciales…). */
    aviso?: string;
}

export interface EstadoDeCarga {
    total: number;
    cargados: number;
    /** Obligatorios que quedaron en $0. */
    enCero: string[];
    /** Automáticos que el sistema no pudo leer: son los que frenan el cierre. */
    ilegibles: string[];
    /** `false` solo si hay automáticos ilegibles. */
    listoParaCerrar: boolean;
}

/**
 * Los automáticos se releen cada pocos minutos, no en cada request: la
 * pantalla de gastos se refresca al navegar entre meses y cada lectura son dos
 * llamadas de red (Meta pagina, Google hace OAuth). Sin esto, mover el mes
 * cinco veces son diez llamadas a las plataformas para el mismo número.
 */
const CACHE_MS = 5 * 60 * 1000;
const cacheAuto = new Map<string, { valor: number | null; vence: number }>();

async function conCache(clave: string, leer: () => Promise<number | null>): Promise<number | null> {
    const hit = cacheAuto.get(clave);
    if (hit && hit.vence > Date.now()) return hit.valor;
    const valor = await leer();
    // Un fallo se cachea por menos tiempo: si Meta volvió, no queremos esperar
    // cinco minutos para enterarnos.
    cacheAuto.set(clave, { valor, vence: Date.now() + (valor === null ? 60_000 : CACHE_MS) });
    return valor;
}

/** Importe que le corresponde a un concepto automático, o null si no se pudo leer. */
async function importeAutomatico(
    concepto: ConceptoGasto,
    month: number,
    year: number,
): Promise<number | null> {
    const clave = `${concepto.clave}-${year}-${month}`;
    switch (concepto.fuente) {
        case 'meta-ads':
            if (!metaAdsConfigured()) return null;
            return conCache(clave, () => fetchGastoMensualArs(month, year));
        case 'google-ads':
            return conCache(clave, () => GoogleAdsService.getGastoMensualArs(month, year));
        case 'usd-fijo': {
            if (!concepto.usdMensual) return null;
            const cotizacion = await conCache(`dolar-${year}-${month}`, async () => dolarBlue());
            return cotizacion ? Math.round(concepto.usdMensual * cotizacion) : null;
        }
        default:
            return null;
    }
}

/**
 * Costo de cada laboratorio según las ventas enviadas a fábrica en el mes.
 *
 * OJO con el medio par: un cristal cargado por ojo (`eye`) viene con el costo
 * del PAR en cada línea, porque los labs facturan por par. Sumar las dos
 * líneas duplicaría el costo, así que se cuenta una sola vez por producto y
 * pedido — mismo criterio que traía la ruta API.
 */
async function costosDeLaboratorio(month: number, year: number) {
    const desde = new Date(year, month - 1, 1);
    const hasta = new Date(year, month, 1);

    const orders = await prisma.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false,
            labSentAt: { gte: desde, lt: hasta },
        },
        select: {
            id: true,
            items: {
                select: { productId: true, productCostSnapshot: true, laboratorySnapshot: true },
            },
        },
    });

    const porLab = new Map<string, number>();
    for (const order of orders) {
        const yaContados = new Set<string>();
        for (const item of order.items) {
            if (!item.laboratorySnapshot || !item.productCostSnapshot) continue;
            const prodId = item.productId || 'unknown';
            if (yaContados.has(prodId)) continue;
            yaContados.add(prodId);
            const lab = item.laboratorySnapshot.trim();
            porLab.set(lab, (porLab.get(lab) || 0) + item.productCostSnapshot);
        }
    }
    return porLab;
}

/**
 * Deja el mes con la lista fija completa y los automáticos al día, y devuelve
 * todos los gastos del mes listos para mostrar.
 */
export async function listarGastosDelMes(month: number, year: number): Promise<GastoDelMes[]> {
    const existentes = await prisma.fixedCost.findMany({
        where: { month, year },
        orderBy: { createdAt: 'asc' },
    });
    const porClave = new Map(existentes.filter((e) => e.clave).map((e) => [e.clave as string, e]));

    // Filas de antes de que los conceptos tuvieran clave (las creaba la
    // plantilla de la pantalla). Se ADOPTAN por nombre: crear una fila nueva
    // al lado dejaba el mes con "Meta Ads" dos veces y el reporte sumaba la
    // publicidad duplicada.
    const sinClavePorNombre = new Map<string, (typeof existentes)[number]>();
    for (const e of existentes) {
        if (!e.clave) sinClavePorNombre.set(e.name.trim().toLowerCase(), e);
    }

    function adoptar(concepto: ConceptoGasto) {
        for (const nombre of [concepto.name, ...(concepto.alias || [])]) {
            const fila = sinClavePorNombre.get(nombre.trim().toLowerCase());
            if (fila) {
                sinClavePorNombre.delete(nombre.trim().toLowerCase());
                return fila;
            }
        }
        return undefined;
    }

    const avisos = new Map<string, string>();

    // ── 1. Reconciliar la lista fija ──────────────────────────────────────
    for (const concepto of CONCEPTOS_GASTO) {
        const fila = porClave.get(concepto.clave) ?? adoptar(concepto);
        const automatico = esAutomatico(concepto.fuente);
        const importe = automatico ? await importeAutomatico(concepto, month, year) : null;

        if (automatico && importe === null) {
            avisos.set(
                concepto.clave,
                concepto.fuente === 'usd-fijo'
                    ? 'No se pudo obtener la cotización del dólar.'
                    : 'No se pudo leer el gasto de la plataforma.',
            );
        }

        if (!fila) {
            const creada = await prisma.fixedCost.create({
                data: {
                    clave: concepto.clave,
                    name: concepto.name,
                    amount: importe ?? 0,
                    category: concepto.category,
                    type: concepto.type,
                    fuente: concepto.fuente,
                    obligatorio: true,
                    month,
                    year,
                },
            });
            porClave.set(concepto.clave, creada);
            continue;
        }

        // El nombre, la sección y la fuente los manda la constante: si el
        // concepto se renombra, los meses viejos acompañan. El importe manual
        // NO se toca nunca acá.
        const cambios: Record<string, unknown> = {};
        if (fila.clave !== concepto.clave) cambios.clave = concepto.clave;
        if (fila.name !== concepto.name) cambios.name = concepto.name;
        if (fila.type !== concepto.type) cambios.type = concepto.type;
        if (fila.category !== concepto.category) cambios.category = concepto.category;
        if (fila.fuente !== concepto.fuente) cambios.fuente = concepto.fuente;
        if (!fila.obligatorio) cambios.obligatorio = true;
        if (automatico && importe !== null && importe !== fila.amount) cambios.amount = importe;

        if (Object.keys(cambios).length > 0) {
            const actualizada = await prisma.fixedCost.update({ where: { id: fila.id }, data: cambios });
            porClave.set(concepto.clave, actualizada);
        }
    }

    // ── 2. Laboratorios: se descubren de las ventas, no de la lista fija ──
    const labs = await costosDeLaboratorio(month, year);
    for (const [lab, monto] of labs) {
        const clave = `lab-${lab.toLowerCase().replace(/\s+/g, '-')}`;
        const name = lab.toLowerCase().includes('laboratorio') ? lab : `Laboratorio ${lab}`;
        const fila =
            porClave.get(clave) ??
            sinClavePorNombre.get(name.trim().toLowerCase()) ??
            sinClavePorNombre.get(lab.trim().toLowerCase());
        if (fila) sinClavePorNombre.delete(fila.name.trim().toLowerCase());
        if (!fila) {
            const creada = await prisma.fixedCost.create({
                data: {
                    clave,
                    name,
                    amount: monto,
                    category: 'PROVEEDOR',
                    type: 'PROVEEDOR',
                    fuente: 'laboratorio',
                    obligatorio: false,
                    month,
                    year,
                },
            });
            porClave.set(clave, creada);
        } else if (fila.amount !== monto || fila.fuente !== 'laboratorio' || fila.clave !== clave) {
            const actualizada = await prisma.fixedCost.update({
                where: { id: fila.id },
                data: { amount: monto, fuente: 'laboratorio', name, clave },
            });
            porClave.set(clave, actualizada);
        }
    }

    // ── 3. Devolver el mes entero (lo reconciliado + los gastos sueltos) ──
    const todas = await prisma.fixedCost.findMany({
        where: { month, year },
        orderBy: { createdAt: 'asc' },
    });

    // Los renglones manuales de laboratorio que quedaron en $0 sobran: el
    // importe real ahora lo pone el cruce con las ventas.
    const duplicadosDeLab = new Set(['Laboratorio Optovision', 'Laboratorio Grupo Óptico', 'Cristaldo']);

    return todas
        .filter((g) => !(g.fuente === 'manual' && g.amount === 0 && duplicadosDeLab.has(g.name)))
        .map((g) => ({
            id: g.id,
            name: g.name,
            amount: g.amount,
            category: g.category,
            type: g.type,
            month: g.month,
            year: g.year,
            notes: g.notes,
            clave: g.clave,
            fuente: g.fuente,
            obligatorio: g.obligatorio,
            isCalculated: esAutomatico(g.fuente),
            aviso: g.clave ? avisos.get(g.clave) : undefined,
        }));
}

/**
 * Estado de carga del mes, para la pantalla y para el cierre.
 *
 * Un renglón en $0 cuenta como cargado (decisión de Ishtar, 8/9/2026): sin un
 * "confirmar en $0" explícito no hay forma de distinguir un gasto que de
 * verdad fue cero de uno que se olvidó, y frenar el cierre por un cero
 * legítimo dejaría el mes sin poder cerrarse nunca. Lo que SÍ frena el cierre
 * es un automático ilegible: ahí el número existe, está en Meta o en Google, y
 * cerrar el mes sin él es informar una ganancia más alta que la real.
 */
export async function estadoDeCarga(month: number, year: number): Promise<EstadoDeCarga> {
    return calcularEstado(await listarGastosDelMes(month, year));
}

/**
 * La misma cuenta, sobre gastos ya leídos. Existe para que quien acaba de
 * llamar a `listarGastosDelMes` no vuelva a reconciliar el mes entero: la
 * pantalla pide las dos cosas de una y eran ~44 consultas para el mismo dato.
 */
export function calcularEstado(gastos: GastoDelMes[]): EstadoDeCarga {
    const obligatorios = gastos.filter((g) => g.obligatorio);

    const enCero = obligatorios.filter((g) => (g.amount || 0) === 0 && !g.aviso).map((g) => g.name);
    const ilegibles = obligatorios.filter((g) => g.aviso).map((g) => `${g.name}: ${g.aviso}`);

    return {
        total: obligatorios.length,
        cargados: obligatorios.length - enCero.length - ilegibles.length,
        enCero,
        ilegibles,
        listoParaCerrar: ilegibles.length === 0,
    };
}
