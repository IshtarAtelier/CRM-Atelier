import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { LAB_ITEM_PATTERNS } from '../../lab-recon/types';
import { registerPortalOrphans } from '../../lab-recon/cost-matching';
import type { EstadoEnPortal, LabModule, OpcionesCorrida, PedidoEnPortal, ResultadoSeguimiento } from '../contrato';
import { reflejar, ventasActivasDelLab, ventasSinPedidoEnPortal } from '../espejo';
import { aplicarEstadoEnVenta } from '../estados';
import {
    detalleDeFila, diasDesde, esTrabado, fechaDelPortal, normalizarPedido, numeroDeFila, numerosActivosDeVenta,
    numerosNoEncontrados, progresoDeFila, resumenTracker, type DetalleTracker, type FilaApiSmartLab,
} from './pedidos';
import { conSesionSmartLab, LAB_GRUPO_OPTICO, leerPedidosApi, NOMBRE_GRUPO_OPTICO, ROBOT_GRUPO_OPTICO } from './portal';

/**
 * EL MÓDULO DE GRUPO ÓPTICO (portal SmartLab). Reemplaza al seguimiento de
 * smartlab.service.ts (3/10/2026) dentro del marco: una entrada al portal por
 * corrida, la API JSON del portal en vez de la tabla HTML, el espejo
 * (LabPortalOrder), la única función que mueve ventas (aplicarEstadoEnVenta) y
 * los avisos de salud de corrida.ts. Lo que cambió respecto del servicio viejo:
 *
 *  · se lee la API paginada (todo lo de la ventana en una pasada) en vez de
 *    raspar la tabla y buscar cada nº del CRM con el buscador, 7 s por pedido;
 *  · los "trabados" y los números que el portal no tiene ya no mandan mail
 *    propio: van a los hallazgos y salen en el reporte semanal;
 *  · un nº tipeado mal deja "NO ENCONTRADO EN EL PORTAL" en la ficha en vez
 *    de una venta muda para siempre;
 *  · la credencial sale SOLO del entorno (sin clave de respaldo en el código).
 *
 * Los COSTOS siguen en lab-providers/grupo-optico.provider.ts (vía
 * LAB_PROVIDERS): el módulo declara `costos: false`. La carga asistida la
 * prende otra tarea.
 *
 * OJO con los imports: `registerPortalOrphans` se importa de cost-matching y
 * NO del fachada LabCostReconciliationService, porque esa fachada arrastra
 * reports.ts → registro.ts → este módulo: un ciclo que dejaba
 * MODULO_GRUPO_OPTICO sin inicializar dentro de REGISTRO_MODULOS.
 */

const PATRON_GRUPO_OPTICO = LAB_ITEM_PATTERNS.GRUPO_OPTICO;
/** La pasada completa mira 120 días: cubre cualquier pedido vivo de la era CRM. */
export const VENTANA_COMPLETA_DIAS = 120;

async function seguirPedidos(opts: OpcionesCorrida = {}): Promise<ResultadoSeguimiento> {
    const ahora = new Date();
    const ventanaDias = opts.sinceDays ?? VENTANA_COMPLETA_DIAS;
    const desde = new Date(ahora.getTime() - ventanaDias * 86400000);

    const ventas = await ventasActivasDelLab(PATRON_GRUPO_OPTICO);
    const numerosDe = new Map(ventas.map(v => [v.id, numerosActivosDeVenta(v)]));
    const activos = [...new Set([...numerosDe.values()].flat())];
    console.log(`[Grupo Óptico] ${ventas.length} ventas activas, ${activos.length} nº de pedido a seguir; ventana de ${ventanaDias} días.`);

    const lectura = await conSesionSmartLab(page => leerPedidosApi(page, desde));
    // Una API que no devuelve ni un pedido no es "no hay pedidos": el portal
    // siempre tiene historial. Es la sesión que no entró o la API que cambió,
    // y sobre eso no se afirma nada (si se siguiera, TODO saldría "no encontrado").
    if (lectura.rows.length === 0) throw new Error(`La API de ${NOMBRE_GRUPO_OPTICO} no devolvió ningún pedido: la sesión no entró o cambió la API del portal.`);
    if (lectura.truncada) console.warn(`[Grupo Óptico] Se leyeron ${lectura.paginasLeidas} páginas (el tope) y la ventana de ${ventanaDias} días no se cubrió entera.`);

    // La misma fila puede repetirse entre páginas si el portal insertó un
    // pedido mientras se leía: se queda la primera (la más nueva).
    const filaDe = new Map<string, FilaApiSmartLab>();
    for (const row of lectura.rows) {
        const num = numeroDeFila(row);
        if (num && !filaDe.has(num)) filaDe.set(num, row);
    }
    const pedidos = [...filaDe.values()].map(normalizarPedido).filter((p): p is PedidoEnPortal => !!p);
    console.log(`[Grupo Óptico] ${pedidos.length} pedidos en ${lectura.paginasLeidas} página(s) de la API.`);

    const { cambios, nuevos, vinculados } = await reflejar(LAB_GRUPO_OPTICO, pedidos, ventas);

    await registrarHuerfanos([...filaDe.values()]);

    // Se aplica el estado a TODA venta activa con pedidos en el espejo, no solo
    // a las que cambiaron: `aplicarEstadoEnVenta` no hace nada si no hay nada
    // que mover, y así una venta vinculada tarde se pone al día. Igual que Vitolen.
    let avanzados = 0, terminados = 0;
    const espejo = await prisma.labPortalOrder.findMany({
        where: { lab: LAB_GRUPO_OPTICO, orderId: { in: ventas.map(v => v.id) } },
        select: { orderId: true, portalNumber: true, status: true, statusRaw: true },
    });
    const porVenta = new Map<string, { portalNumber: string; status: EstadoEnPortal; statusRaw: string }[]>();
    for (const p of espejo) {
        if (!p.orderId) continue;
        porVenta.set(p.orderId, [...(porVenta.get(p.orderId) ?? []), { portalNumber: p.portalNumber, status: p.status as EstadoEnPortal, statusRaw: p.statusRaw ?? '' }]);
    }
    for (const [orderId, pedidosDeVenta] of porVenta) {
        const venta = ventas.find(v => v.id === orderId);
        const r = await aplicarEstadoEnVenta({ orderId, lab: LAB_GRUPO_OPTICO, nombreLab: NOMBRE_GRUPO_OPTICO, robot: ROBOT_GRUPO_OPTICO, pedidos: pedidosDeVenta });
        if (r.labStatus !== venta?.labStatus) {
            avanzados++;
            if (r.labStatus === 'FINISHED') terminados++;
        }
    }

    // Números del CRM que el portal no tiene: ni en esta lectura ni en el
    // espejo (una lectura corta no trae lo viejo, pero el espejo lo guarda).
    const enEspejo = activos.length
        ? await prisma.labPortalOrder.findMany({ where: { lab: LAB_GRUPO_OPTICO, portalNumber: { in: activos } }, select: { portalNumber: true } })
        : [];
    const faltantes = new Set(numerosNoEncontrados(activos, filaDe.keys(), enEspejo.map(e => e.portalNumber)));

    // El tracker de la ficha (sector, progreso, días): lo mismo que escribía el
    // servicio viejo, con el nº no encontrado a la vista. Solo para las ventas
    // con pedidos en esta lectura (o con un nº que no está): las que quedaron
    // fuera de la ventana conservan el último tracker hasta la pasada completa.
    const noEncontrados: { orderId: string; cliente: string; numero: string }[] = [];
    for (const v of ventas) {
        const numeros = numerosDe.get(v.id) ?? [];
        const detalles = numeros
            .map(n => filaDe.get(n))
            .map(row => (row ? detalleDeFila(row, ahora) : null))
            .filter((d): d is DetalleTracker => !!d);
        const faltan = numeros.filter(n => faltantes.has(n));
        for (const numero of faltan) noEncontrados.push({ orderId: v.id, cliente: v.clientName, numero });
        if (detalles.length === 0 && faltan.length === 0) continue;
        try {
            // Prisma contra producción exige `select`: el schema local va adelantado.
            await prisma.order.update({ where: { id: v.id }, data: resumenTracker(detalles, faltan, ahora), select: { id: true } });
        } catch (err) {
            console.error(`[Grupo Óptico] No se pudo escribir el tracker de la venta ${v.id} (${v.clientName}):`, err);
        }
    }
    if (noEncontrados.length) console.log(`[Grupo Óptico] ${noEncontrados.length} nº de pedido que el portal no tiene: ${noEncontrados.map(n => n.numero).join(', ')}`);

    const trabados = [...filaDe.values()]
        .filter(row => esTrabado(row, ahora))
        .map(row => ({
            portalNumber: numeroDeFila(row)!,
            cliente: String(row.CodigoOptica || '').trim() || 'Sin especificar',
            sector: String(row.sector || '').trim(),
            progreso: progresoDeFila(row),
            dias: diasDesde(fechaDelPortal(row.FechaRegistro), ahora),
        }));

    // Una venta cuyo nº el portal no tiene ya está en `noEncontrados` (es más
    // preciso que "sin pedido en el portal"): no se avisa dos veces.
    const conNumeroNoEncontrado = new Set(noEncontrados.map(n => n.orderId));
    const enPortal = new Set(porVenta.keys());
    return {
        vistos: pedidos.length,
        nuevos,
        cambiados: cambios.length,
        vinculados,
        avanzados,
        terminados,
        sinPedidoEnPortal: ventasSinPedidoEnPortal(ventas.filter(v => !conNumeroNoEncontrado.has(v.id)), enPortal, ahora),
        // La API no promete fecha de entrega (FechaFinEstimada es la de registro): no hay atrasos que medir.
        atrasados: [],
        trabados,
        noEncontrados,
    };
}

/**
 * Pedidos del portal sin venta en el sistema (plata gastada en el lab sin
 * venta que la respalde): a la conciliación, como siempre. Se mira contra
 * TODAS las ventas con nº (no solo las activas): un pedido de una venta ya
 * entregada no es huérfano.
 */
async function registrarHuerfanos(rows: FilaApiSmartLab[]): Promise<void> {
    if (rows.length === 0) return;
    try {
        const conocidas = await prisma.order.findMany({
            where: {
                isDeleted: false,
                OR: [
                    { labOrderNumber: { not: null } },
                    { postSaleCases: { some: { newOrderNumber: { not: null } } } },
                ],
            },
            select: { labOrderNumber: true, postSaleCases: { select: { newOrderNumber: true } } },
        });
        const conocidos = new Set<string>();
        for (const o of conocidas) {
            for (const n of parseLabNumbers(o.labOrderNumber)) conocidos.add(n);
            for (const c of o.postSaleCases) for (const n of parseLabNumbers(c.newOrderNumber)) conocidos.add(n);
        }
        const huerfanos = rows.filter(r => { const n = numeroDeFila(r); return n && !conocidos.has(n); });
        if (huerfanos.length === 0) {
            console.log('[Grupo Óptico] Todos los pedidos leídos del portal tienen venta en el sistema.');
            return;
        }
        const registrados = await registerPortalOrphans(
            LAB_GRUPO_OPTICO,
            huerfanos.map(r => ({ num: numeroDeFila(r)!, client: String(r.CodigoOptica || '').trim(), date: String(r.FechaRegistro || '') })),
        );
        console.log(`[Grupo Óptico] ${registrados} pedidos del portal SIN venta en el sistema (huérfanos) registrados en la conciliación.`);
    } catch (err) {
        console.error('[Grupo Óptico] Error en el control de huérfanos:', err);
    }
}

export const MODULO_GRUPO_OPTICO: LabModule = {
    clave: LAB_GRUPO_OPTICO,
    nombre: NOMBRE_GRUPO_OPTICO,
    patronProducto: PATRON_GRUPO_OPTICO,
    // Costos: GrupoOpticoProvider (lab-providers), por LAB_PROVIDERS. Carga: otra tarea.
    capacidades: { seguimiento: true, costos: false, carga: false },
    // Sin cadencia: cada tick de 10 min, como hizo siempre el sync de SmartLab.
    // El aviso de retiro automático (24 h después de terminado) queda prendido:
    // es el circuito de siempre de Grupo Óptico.
    seguirPedidos,
    recolectarCostos: async () => ({ skipped: true, reason: `los costos de ${NOMBRE_GRUPO_OPTICO} los trae GrupoOpticoProvider (LAB_PROVIDERS)` }),
};
