/**
 * Inventario de etiquetas: quién creó cada una y cuántos clientes cuelgan.
 * SOLO LEE. No borra ni modifica nada.
 *
 *   node scripts/checks/etiquetas-inventario.check.mjs           # base local
 *   node scripts/checks/etiquetas-inventario.check.mjs --prod    # producción (solo lectura)
 *
 * POR QUÉ existe: la herramienta `addTagToClient` del bot (wa-service/tools.js)
 * dejaba a la IA crear una etiqueta con CUALQUIER nombre libre de hasta 40
 * caracteres. Resultado: cientos de variantes inventadas conviviendo con las
 * pocas que creó la dueña a mano ("Armazones - Cat Eye, Acetato" y compañía).
 *
 * `Tag` no tiene `createdAt` ni `createdBy`, así que el origen se deduce
 * cruzando tres fuentes, en este orden:
 *   1. SISTEMA — nombres que el código escribe fijos (canal de origen, anuncios
 *      con prefijo "Meta · " / "Google · ", y los literales de wa-service).
 *   2. HUMANO  — hay un AuditLog CREATE con ese nombre y un userId que no es
 *      Sistema/Bot: son las que se crearon desde el panel de etiquetas.
 *   3. IA      — todo lo demás. Sin rastro de auditoría y sin ser del sistema,
 *      solo pudo nacer del upsert de nombre libre del bot.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PROD = process.argv.includes('--prod');
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
    console.error(PROD ? 'Falta PROD_DATABASE_URL en el .env.' : 'Falta DATABASE_URL en el .env.');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Literales que escribe el código, no una persona. */
const NOMBRES_DEL_SISTEMA = new Set([
    'Cancelar Bot', 'Sin Seguimiento', 'Bot Lead', 'Carrito Web',
    'Google Ads', 'Google Orgánico', 'Google Maps', 'Meta', 'Instagram',
    'Facebook', 'Ya es Cliente', 'Presencial', 'Recomendado', 'Tienda Online',
]);
const PREFIJOS_DEL_SISTEMA = ['Meta · ', 'Google · '];

const esDelSistema = (n) =>
    NOMBRES_DEL_SISTEMA.has(n) || PREFIJOS_DEL_SISTEMA.some((p) => n.startsWith(p));

async function main() {
    console.log(`Inventario de etiquetas — base ${PROD ? 'PRODUCCIÓN' : 'local'} (solo lectura)\n`);

    const tags = await prisma.tag.findMany({
        select: { id: true, name: true, color: true, _count: { select: { clients: true, orders: true } } },
        orderBy: { name: 'asc' },
    });

    // Auditoría: toda etiqueta creada desde el panel deja una fila CREATE.
    const audit = await prisma.auditLog.findMany({
        where: { action: 'CREATE', entityType: 'OTHER' },
        select: { entityId: true, userName: true, details: true },
    });
    const autorPorNombre = new Map();
    for (const a of audit) {
        const nombre = a.details?.name;
        if (!nombre) continue;
        const quien = a.userName || 'desconocido';
        if (quien === 'Sistema' || quien === 'Bot') continue;
        if (!autorPorNombre.has(nombre)) autorPorNombre.set(nombre, quien);
    }

    const grupos = { SISTEMA: [], HUMANO: [], IA: [] };
    for (const t of tags) {
        const origen = esDelSistema(t.name) ? 'SISTEMA'
            : autorPorNombre.has(t.name) ? 'HUMANO'
            : 'IA';
        grupos[origen].push({ ...t, autor: autorPorNombre.get(t.name) || null });
    }

    const total = tags.length;
    console.log(`Total de etiquetas: ${total}`);
    console.log(`  del SISTEMA: ${grupos.SISTEMA.length}`);
    console.log(`  creadas a mano (con firma en auditoría): ${grupos.HUMANO.length}`);
    console.log(`  sin firma → creadas por la IA: ${grupos.IA.length}\n`);

    for (const [origen, lista] of Object.entries(grupos)) {
        if (!lista.length) continue;
        console.log(`── ${origen} (${lista.length})`);
        for (const t of lista.slice(0, origen === 'IA' ? 40 : lista.length)) {
            const uso = `${t._count.clients} cliente(s)${t._count.orders ? `, ${t._count.orders} venta(s)` : ''}`;
            console.log(`   ${t.name.padEnd(42)} ${uso}${t.autor ? ` · por ${t.autor}` : ''}`);
        }
        if (origen === 'IA' && lista.length > 40) console.log(`   … y ${lista.length - 40} más`);
        console.log();
    }

    const iaSinUso = grupos.IA.filter((t) => t._count.clients === 0 && t._count.orders === 0);
    const iaConUso = grupos.IA.filter((t) => t._count.clients > 0 || t._count.orders > 0);
    console.log(`De las creadas por la IA: ${iaSinUso.length} no las usa nadie, ${iaConUso.length} están puestas en alguna ficha.`);
    console.log('(Borrar una etiqueta no borra el cliente: solo le saca esa marca.)');
}

main()
    .catch((e) => { console.error(e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
