/**
 * Deja el catálogo de etiquetas en las ~25 que usa el negocio: fusiona las
 * variantes de una misma cosa y borra la cola que inventó la IA.
 *
 *   node scripts/maintenance/etiquetas-limpieza/limpiar-etiquetas.mjs                 # dry-run local
 *   node scripts/maintenance/etiquetas-limpieza/limpiar-etiquetas.mjs --prod          # dry-run PRODUCCIÓN
 *   node scripts/maintenance/etiquetas-limpieza/limpiar-etiquetas.mjs --prod --apply  # aplica
 *
 * Sin `--apply` no escribe una sola fila: imprime exactamente qué haría.
 *
 * POR QUÉ hizo falta: la herramienta `addTagToClient` del bot dejaba a la IA
 * crear etiquetas con nombre libre. 407 etiquetas, de las cuales ~330 tenían UN
 * solo cliente y eran la descripción de una charla ("Armazones - Cat Eye,
 * Acetato"), no una categoría. El agujero se cerró en `wa-service/tools.js`:
 * ahora la IA solo puede CONECTAR etiquetas que ya existen.
 *
 * ── Fusionar no es borrar ────────────────────────────────────────────────────
 * Un alias no se elimina y ya: primero se conectan TODOS sus clientes y ventas
 * a la etiqueta canónica, y recién cuando no le cuelga nadie se borra la fila.
 * Ningún cliente pierde su marca; la ve escrita de una sola forma.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PROD = process.argv.includes('--prod');
const APPLY = process.argv.includes('--apply');
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PROD ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env.`); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Etiqueta canónica → las formas en que quedó escrita en la base.
 * La clave se conserva (si no existe, se crea); los alias se vacían y se borran.
 */
const FUSIONES = {
    'Multifocales': ['Multifocal', 'Lentes Multifocales', 'Multifocales [metaishvarilux]', 'Lentes Multifocales [metaishvarilux]', 'lentes Multifocales [metaishvarilux]', 'Adaptación Multifocales', 'Presupuesto Multifocal', 'Presupuesto Multifocales', 'Multifocal 2x1'],
    'Monofocales': ['Monofocal'],
    'Bifocales': ['Bifocal'],
    'Varilux': ['Multifocales Varilux', 'Lentes Multifocales (Varilux)'],
    'Clipones': ['Clip-on', 'ClipOn', 'Clip On', 'Clipons', 'Anteojos Clipones', 'Anteojos clipones', 'Lentes Clip-on', 'Clip-on Classic', 'MetaClip'],
    'Armazones': ['Armazón', 'Marcos'],
    'Anteojos de sol': ['Lentes de sol', 'Sol', 'Anteojos de Sol Recetados', 'Anteojos de sol sin aumento'],
    'Obra Social': ['Apross', 'APROSS'],
    'Receta': ['Consulta Receta', 'Presupuesto Receta', 'Lentes Receta', 'Lentes Recetados', 'Anteojos Receta', 'Anteojos Recetados'],
    'Reclamo y post venta': ['Post-venta', 'Reparación', 'Ajuste de lentes', 'Ajuste de Lentes', 'Ajuste de graduación'],
    'Seguimiento de pedido': ['Seguimiento de Pedido'],
    'visita showroom': ['visita showroom '], // con espacio al final: duplicado histórico
};

/** Se quedan tal cual, sin fusionar. */
const CONSERVAR = [
    'Ocusis', 'Meta Ads', 'Ya es cliente', 'Calle', 'Proveedor', 'VIP', 'Referido',
    'Cristales', 'Filtro Azul', 'Fotocromáticos', 'Multifocal SMART FREE',
    'Lentes de Contacto', 'Niños', 'Control Miopía', 'Ocupacional',
    'Factura', 'Presupuesto', 'Seguimiento 1', 'Seguimiento 4',
];

/** Las escribe el código, no una persona: intocables. */
const DEL_SISTEMA = ['Cancelar Bot', 'Sin Seguimiento', 'Bot Lead', 'Carrito Web', 'Google Ads', 'Google Orgánico', 'Google Maps', 'Meta', 'Instagram', 'Facebook', 'Ya es Cliente', 'Presencial', 'Recomendado', 'Tienda Online'];
const PREFIJOS_SISTEMA = ['Meta · ', 'Google · '];

const esDelSistema = (n) => DEL_SISTEMA.includes(n) || PREFIJOS_SISTEMA.some((p) => n.startsWith(p));

async function main() {
    console.log(`Limpieza de etiquetas — base ${PROD ? 'PRODUCCIÓN' : 'local'}${APPLY ? '' : ' · DRY-RUN (no escribe nada)'}\n`);

    const tags = await prisma.tag.findMany({
        select: { id: true, name: true, _count: { select: { clients: true, orders: true } } },
    });
    const porNombre = new Map(tags.map((t) => [t.name, t]));

    const canonicos = new Set([...Object.keys(FUSIONES), ...CONSERVAR]);
    const alias = new Map();
    for (const [canon, lista] of Object.entries(FUSIONES)) for (const a of lista) alias.set(a, canon);

    const aBorrar = tags.filter((t) => !canonicos.has(t.name) && !alias.has(t.name) && !esDelSistema(t.name));
    const clientesTocados = aBorrar.reduce((s, t) => s + t._count.clients, 0);

    console.log(`Hoy hay ${tags.length} etiquetas.`);
    console.log(`  se conservan: ${[...canonicos].filter((n) => porNombre.has(n)).length} canónicas + ${tags.filter((t) => esDelSistema(t.name)).length} del sistema`);
    console.log(`  se fusionan:  ${[...alias.keys()].filter((n) => porNombre.has(n)).length} variantes`);
    console.log(`  se borran:    ${aBorrar.length} (les cuelgan ${clientesTocados} marcas de cliente)\n`);

    // ── Respaldo ─────────────────────────────────────────────────────────────
    // Antes de tocar nada: qué etiqueta tenía cada cliente. Es la única forma de
    // reconstruir el estado previo, porque `Tag` no guarda historia.
    if (APPLY) {
        const foto = await prisma.tag.findMany({
            select: { name: true, color: true, clients: { select: { id: true } }, orders: { select: { id: true } } },
        });
        const archivo = new URL(`./respaldo-${PROD ? 'prod' : 'local'}.json`, import.meta.url);
        await (await import('node:fs/promises')).writeFile(archivo, JSON.stringify(foto, null, 2));
        console.log(`Respaldo guardado: ${archivo.pathname}\n`);
    }

    // ── Fusiones ─────────────────────────────────────────────────────────────
    for (const [canon, lista] of Object.entries(FUSIONES)) {
        const presentes = lista.filter((a) => porNombre.has(a));
        if (!presentes.length && porNombre.has(canon)) continue;
        if (!presentes.length) continue;

        let destino = porNombre.get(canon);
        if (!destino) {
            console.log(`+ crear "${canon}" (no existía; es el nombre canónico)`);
            if (APPLY) destino = await prisma.tag.create({ data: { name: canon, color: '#9e7f65' } });
        }

        for (const nombreAlias of presentes) {
            const origen = porNombre.get(nombreAlias);
            console.log(`~ "${nombreAlias}" (${origen._count.clients} cliente/s) → "${canon}"`);
            if (!APPLY) continue;

            const conClientes = await prisma.tag.findUnique({
                where: { id: origen.id },
                select: { clients: { select: { id: true } }, orders: { select: { id: true } } },
            });
            for (const c of conClientes.clients) {
                await prisma.client.update({ where: { id: c.id }, data: { tags: { connect: { id: destino.id } } } }).catch(() => {});
            }
            for (const o of conClientes.orders) {
                await prisma.order.update({ where: { id: o.id }, data: { tags: { connect: { id: destino.id } } } }).catch(() => {});
            }
            await prisma.tag.delete({ where: { id: origen.id } });
        }
    }

    // ── Borrado de la cola inventada ─────────────────────────────────────────
    console.log(`\n${aBorrar.length} etiquetas a borrar:`);
    for (const t of aBorrar) console.log(`  − ${t.name} (${t._count.clients})`);
    if (APPLY) {
        for (const t of aBorrar) await prisma.tag.delete({ where: { id: t.id } }).catch((e) => console.error(`  ✖ ${t.name}: ${e.message}`));
        await prisma.auditLog.create({
            data: {
                userId: 'sistema', userName: 'Sistema', action: 'DELETE', entityType: 'OTHER', entityId: 'etiquetas',
                details: { descripcion: `Limpieza de etiquetas: ${aBorrar.length} borradas, ${[...alias.keys()].length} fusionadas`, borradas: aBorrar.map((t) => t.name) },
            },
        }).catch(() => {});
        const quedan = await prisma.tag.count();
        console.log(`\n✔ Listo. Quedan ${quedan} etiquetas.`);
    } else {
        console.log('\n(dry-run) Con --apply se aplica.');
    }
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
