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
 *
 * Los LABORATORIOS son la excepción y NO se guardan: son una vista derivada de
 * las ventas del mes y el resultado del negocio ya los tiene por otro lado
 * (`totalCostLenses`). Guardarlos hacía que el mail del cierre mostrara la
 * misma plata dos veces —una como "Laboratorio (costo de cristales)" y otra
 * como tres renglones de "Gastos del mes"— y encima con dos importes
 * distintos, porque cada lado la calculaba a su manera. El número que se
 * muestra sale de `costoPorLaboratorioDeVenta`, la misma regla del cruce
 * (medio par, cantidad, y el segundo par del 2x1 en cero).
 */
import { prisma } from '@/lib/db';
import { CONCEPTOS_GASTO, esAutomatico, type ConceptoGasto } from '@/lib/constants/gastos-fijos';
import { fetchGastoMensualArs, cotizacionDolarONull, metaAdsConfigured } from '@/lib/ads/meta-insights';
import { costoPorLaboratorioDeVenta } from '@/services/lab-recon/cost-matching';
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
    /** Automáticos que quedaron SIN importe: son los que frenan el cierre. */
    ilegibles: string[];
    /** Automáticos que no se pudieron actualizar pero conservan el importe anterior. */
    desactualizados: string[];
    /** Gastos sueltos que parecen el gemelo de un concepto fijo: se cuentan dos veces. */
    repetidos: string[];
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
            // Sin credenciales no hay nada que leer, y eso NO es lo mismo que
            // "Meta no contestó": se arregla en otro lado (las variables de
            // entorno) y conviene que el aviso lo diga, si no se pierde tiempo
            // mirando si la plataforma está caída.
            if (!metaAdsConfigured()) return null;
            return conCache(clave, () => fetchGastoMensualArs(month, year));
        case 'google-ads':
            return conCache(clave, () => GoogleAdsService.getGastoMensualArs(month, year));
        case 'usd-fijo': {
            if (!concepto.usdMensual) return null;
            const cotizacion = await conCache(`dolar-${year}-${month}`, cotizacionDolarONull);
            return cotizacion ? Math.round(concepto.usdMensual * cotizacion) : null;
        }
        default:
            return null;
    }
}

/**
 * Costo esperado de cada laboratorio según las ventas enviadas a fábrica en el
 * mes. La regla NO vive acá: sale de `costoPorLaboratorioDeVenta`, la misma
 * que usa el cruce de facturas (medio par, cantidad, y el segundo par de un
 * 2x1 en cero). Esta función solo elige qué ventas mirar y suma.
 *
 * Antes tenía su propia cuenta —deduplicar por productId y sumar el snapshot
 * crudo— que no aplicaba ninguna de esas tres reglas: el importe salía más
 * alto que lo que el laboratorio va a facturar.
 */
async function costosDeLaboratorio(month: number, year: number): Promise<Map<string, number>> {
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
            appliedPromoName: true,
            items: {
                select: {
                    eye: true,
                    price: true,
                    quantity: true,
                    productCostSnapshot: true,
                    productCategorySnapshot: true,
                    laboratorySnapshot: true,
                    product: { select: { cost: true, category: true, laboratory: true } },
                },
            },
        },
    });

    const porLab = new Map<string, number>();
    for (const order of orders) {
        for (const [lab, costo] of costoPorLaboratorioDeVenta(order)) {
            porLab.set(lab, (porLab.get(lab) || 0) + costo);
        }
    }
    return porLab;
}

/**
 * ESCRIBE: deja el mes con la lista fija completa y los importes automáticos al
 * día, y devuelve todos los gastos listos para mostrar.
 *
 * Se llama `sincronizar` y no `listar` porque hace hasta 26 upserts: estaba
 * colgada del GET de /api/expenses, así que mirar la pantalla mutaba la base.
 * Ahora la escritura se pide explícitamente (POST /api/expenses/sincronizar) y
 * el GET solo lee.
 */
export async function sincronizarMesDeGastos(month: number, year: number): Promise<GastoDelMes[]> {
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

    // Los importes automáticos se piden TODOS JUNTOS antes del bucle: Meta
    // pagina y Google hace OAuth, y encadenados uno detrás del otro dentro del
    // recorrido de conceptos sumaban su latencia a la del mes entero.
    const automaticos = CONCEPTOS_GASTO.filter((c) => esAutomatico(c.fuente));
    const importes = new Map<string, number | null>(
        await Promise.all(
            automaticos.map(
                async (c) => [c.clave, await importeAutomatico(c, month, year)] as [string, number | null],
            ),
        ),
    );

    // ── 1. Reconciliar la lista fija ──────────────────────────────────────
    for (const concepto of CONCEPTOS_GASTO) {
        const fila = porClave.get(concepto.clave) ?? adoptar(concepto);
        const automatico = esAutomatico(concepto.fuente);
        const importe = automatico ? importes.get(concepto.clave) ?? null : null;

        // Un automático que no se pudo leer PERO que ya tiene importe guardado
        // de una lectura anterior no es "ilegible": el número está y entra al
        // resultado. Marcarlo como tal mostraba "$314.000" y "sin datos" en el
        // mismo renglón, y frenaba el cierre del mes entero porque la API de
        // la cotización no contestó un rato. Solo frena si NO hay importe.
        if (automatico && importe === null) {
            const importeViejo = fila?.amount ?? 0;
            const sinConfigurar = concepto.fuente === 'meta-ads' && !metaAdsConfigured();
            const queNoSePudo =
                concepto.fuente === 'usd-fijo'
                    ? 'la cotización del dólar'
                    : 'el gasto de la plataforma';
            avisos.set(
                concepto.clave,
                sinConfigurar
                    ? 'La integración con Meta no está configurada en este servidor.'
                    : importeViejo > 0
                        ? `No se pudo actualizar ${queNoSePudo}: este es el importe de la última lectura.`
                        : `No se pudo leer ${queNoSePudo}.`,
            );
        }

        if (!fila) {
            // upsert y no create: dos lecturas del mismo mes a la vez —la
            // pantalla y el cron, o dos pestañas— veían las dos el mes vacío y
            // la segunda chocaba contra el índice único [clave, month, year].
            // Prisma tiraba P2002, la ruta devolvía 500 y la pantalla quedaba
            // en blanco sin decir por qué.
            const creada = await prisma.fixedCost.upsert({
                where: { clave_month_year: { clave: concepto.clave, month, year } },
                create: {
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
                // Si la ganó la otra request, no se le pisa el importe.
                update: {
                    name: concepto.name,
                    category: concepto.category,
                    type: concepto.type,
                    fuente: concepto.fuente,
                    obligatorio: true,
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
            try {
                const actualizada = await prisma.fixedCost.update({ where: { id: fila.id }, data: cambios });
                porClave.set(concepto.clave, actualizada);
            } catch (e: any) {
                // Adoptar una fila vieja le ESCRIBE la clave, así que también
                // puede chocar contra [clave, month, year]: si otra request
                // creó la fila del concepto mientras esta adoptaba la de la
                // plantilla vieja, la segunda explota. Pasa una sola vez por
                // mes (la primera sincronización de los meses ya cargados),
                // pero justo ahí es cuando dos pestañas abiertas se pisan.
                if (e?.code !== 'P2002') throw e;
                const ganadora = await prisma.fixedCost.findFirst({
                    where: { clave: concepto.clave, month, year },
                });
                if (ganadora) porClave.set(concepto.clave, ganadora);
            }
        }
    }

    // ── 2. Conceptos RETIRADOS ────────────────────────────────────────────
    //
    // Una fila con clave que ya no está en la lista es un concepto que se dejó
    // de usar (la gestión de campañas de Uriel, por ejemplo). Quedaba marcada
    // `obligatorio` para siempre: la pantalla le escondía el tacho y la API se
    // negaba a borrarla, así que pedía ese renglón en $0 todos los meses y no
    // había forma de sacarlo. Se degrada a gasto suelto: conserva su importe
    // histórico y vuelve a ser borrable.
    const clavesVigentes = new Set(CONCEPTOS_GASTO.map((c) => c.clave));
    const retiradas = existentes.filter(
        (e) => e.clave && e.obligatorio && !clavesVigentes.has(e.clave),
    );
    for (const fila of retiradas) {
        await prisma.fixedCost.update({
            where: { id: fila.id },
            data: { obligatorio: false, fuente: 'manual' },
        });
    }

    // ── 3. Gemelos sin adoptar ────────────────────────────────────────────
    //
    // Una fila sin clave cuyo nombre es el de un concepto que YA tiene su fila
    // no se puede adoptar: la clave es única por mes. Pasa cuando a un concepto
    // se le agrega un alias DESPUÉS de que el mes ya se sincronizó — el gemelo
    // queda de gasto suelto y su importe se suma aparte, así que la publicidad
    // (o lo que sea) se cuenta dos veces sin que nadie lo note.
    //
    // No se borra ni se fusiona solo: los dos tienen importe y elegir cuál vale
    // es una decisión de quien lleva los números. Se MARCA, para que se vea.
    const conceptoPorNombre = new Map<string, ConceptoGasto>();
    for (const c of CONCEPTOS_GASTO) {
        for (const n of [c.name, ...(c.alias || [])]) conceptoPorNombre.set(n.trim().toLowerCase(), c);
    }
    const avisosPorId = new Map<string, string>();
    for (const [nombre, fila] of sinClavePorNombre) {
        const concepto = conceptoPorNombre.get(nombre);
        if (concepto && porClave.has(concepto.clave)) {
            avisosPorId.set(
                fila.id,
                `Parece el mismo gasto que "${concepto.name}", que ya está más arriba. Revisá cuál vale y borrá el que sobre: mientras estén los dos, se cuenta dos veces.`,
            );
        }
    }

    return armarGastosDelMes(month, year, avisos, avisosPorId);
}

/**
 * Arma la lista que ve la pantalla: lo guardado en la base más los
 * laboratorios, que son filas VIRTUALES —una vista derivada de las ventas—.
 * No escribe nada: la usan tanto la sincronización como la lectura pura.
 */
async function armarGastosDelMes(
    month: number,
    year: number,
    avisos: Map<string, string>,
    avisosPorId: Map<string, string> = new Map(),
): Promise<GastoDelMes[]> {
    const labs = await costosDeLaboratorio(month, year);
    const filasDeLab: GastoDelMes[] = [...labs.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([lab, monto]) => ({
            id: `lab-${lab.toLowerCase().replace(/\s+/g, '-')}-${year}-${month}`,
            name: lab.toLowerCase().includes('laboratorio') ? lab : `Laboratorio ${lab}`,
            amount: monto,
            category: 'PROVEEDOR',
            type: 'PROVEEDOR',
            month,
            year,
            notes: null,
            clave: null,
            fuente: 'laboratorio',
            obligatorio: false,
            isCalculated: true,
        }));

    // Reprocesos de post-venta: también VIRTUAL y por el mismo motivo que los
    // laboratorios — el resultado del negocio ya los tiene (`totalPostSaleCosts`
    // en report.service), así que guardarlos contaría la misma plata dos veces.
    const postVenta = await costosDePostVenta(month, year);
    if (postVenta.total > 0) {
        filasDeLab.push({
            id: `postventa-${year}-${month}`,
            name: `Post-venta (${postVenta.casos} ${postVenta.casos === 1 ? 'reproceso facturado' : 'reprocesos facturados'})`,
            amount: postVenta.total,
            category: 'PROVEEDOR',
            type: 'PROVEEDOR',
            month,
            year,
            notes: null,
            clave: null,
            fuente: 'postventa',
            obligatorio: false,
            isCalculated: true,
        });
    }

    const todas = await prisma.fixedCost.findMany({
        where: { month, year },
        orderBy: { createdAt: 'asc' },
    });

    // Los renglones manuales de laboratorio que quedaron en $0 sobran: el
    // importe real lo pone el cruce con las ventas.
    const duplicadosDeLab = new Set(['laboratorio optovision', 'laboratorio grupo óptico', 'cristaldo']);

    const guardadas = todas
        .filter((g) => !(g.fuente === 'manual' && g.amount === 0 && duplicadosDeLab.has(g.name.trim().toLowerCase())))
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
            aviso: (g.clave ? avisos.get(g.clave) : undefined) ?? avisosPorId.get(g.id),
        }));

    return [...guardadas, ...filasDeLab];
}

/**
 * Costo de los reprocesos de post-venta facturados en el mes.
 *
 * Se cuentan SOLO los casos con el costo cerrado por el laboratorio
 * (`costSource: 'LAB'`) y corroborado por el administrador
 * (`costConfirmedAt`), que es exactamente lo que el schema exige para imputar
 * un caso a caja: lo que estima el vendedor al abrir el caso puede no coincidir
 * con lo que después factura el lab, y un gasto no se informa con una
 * estimación.
 *
 * El mes es el de la CORROBORACIÓN, no el de la venta que originó el reproceso.
 * Es a propósito y difiere del resultado del negocio: `report.service` imputa
 * el costo de post-venta al mes de la venta original (`totalPostSaleCosts`),
 * porque ahí se mide cuánto dejó esa venta. Acá la pregunta es otra —cuánta
 * plata sale este mes— y un reproceso de una venta de junio que el lab facturó
 * en agosto es plata de agosto.
 */
async function costosDePostVenta(month: number, year: number): Promise<{ total: number; casos: number }> {
    const casos = await prisma.postSaleCase.findMany({
        where: {
            costSource: 'LAB',
            cost: { gt: 0 },
            costConfirmedAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) },
        },
        select: { cost: true },
    });
    return { total: casos.reduce((a, c) => a + c.cost, 0), casos: casos.length };
}

/**
 * Los gastos del mes SIN tocar la base. Es lo que responde el GET: mirar no
 * debería escribir. Si el mes todavía no se sincronizó, la lista fija puede
 * venir incompleta — para eso está `sincronizarMesDeGastos`, que es la
 * operación de escritura y se pide explícitamente.
 */
export async function leerGastosDelMes(month: number, year: number): Promise<GastoDelMes[]> {
    return armarGastosDelMes(month, year, new Map());
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
    return calcularEstado(await sincronizarMesDeGastos(month, year));
}

/**
 * La misma cuenta, sobre gastos ya leídos. Existe para que quien acaba de
 * sincronizar el mes no lo vuelva a reconciliar entero: la pantalla pide las
 * dos cosas de una y eran ~44 consultas para el mismo dato.
 */
export function calcularEstado(gastos: GastoDelMes[]): EstadoDeCarga {
    const obligatorios = gastos.filter((g) => g.obligatorio);

    // Solo frena el cierre el automático que quedó SIN importe. Uno con el
    // valor de la lectura anterior avisa, pero el número está y se puede cerrar.
    const ilegibles = obligatorios
        .filter((g) => g.isCalculated && g.aviso && (g.amount || 0) === 0)
        .map((g) => `${g.name}: ${g.aviso}`);
    const desactualizados = obligatorios
        .filter((g) => g.isCalculated && g.aviso && (g.amount || 0) > 0)
        .map((g) => `${g.name}: ${g.aviso}`);

    // Los gemelos son gastos sueltos (no obligatorios), así que se buscan en la
    // lista entera: si no, un renglón duplicado no lo veía nadie.
    const repetidos = gastos
        .filter((g) => !g.isCalculated && g.aviso)
        .map((g) => `${g.name}: ${g.aviso}`);
    // Los automáticos quedan fuera de "en cero": un mes sin pauta hace que Meta
    // devuelva 0, y ese 0 es un dato, no un olvido. Listarlo en el mail del
    // cierre como gasto sin cargar mandaba a buscar un importe que no existe.
    const enCero = obligatorios
        .filter((g) => !g.isCalculated && (g.amount || 0) === 0 && !g.aviso)
        .map((g) => g.name);

    return {
        total: obligatorios.length,
        cargados: obligatorios.length - enCero.length - ilegibles.length,
        enCero,
        ilegibles,
        desactualizados,
        repetidos,
        listoParaCerrar: ilegibles.length === 0,
    };
}
