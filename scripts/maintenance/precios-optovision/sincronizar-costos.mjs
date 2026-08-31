/**
 * Escribe en los cristales de Optovisión el costo que sale de la lista del
 * laboratorio. Solo los que EMPAREJAN (la equivalencia la resuelve
 * `emparejador.mjs`, que comparten este script y el informe).
 *
 * QUÉ TOCA Y QUÉ NO:
 *   · `baseCost` ← el precio de lista pelado del laboratorio.
 *   · `cost`     ← (lista + calibrado) × IVA. Es el costo final que usan
 *                  reportes, ventas y el cruce de facturas.
 *   · `price`    ← NO SE TOCA. El precio de venta se maneja aparte, desde
 *                  Stock y Productos → Aumentar Precios. Pisarlo acá borraría
 *                  de un saque cualquier aumento que se haya hecho a mano.
 *
 * Como el precio queda quieto y el costo se mueve, el markup de cada producto
 * cambia: el informe lo muestra ANTES de escribir nada, para que se vea a
 * quién se le achica el margen.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/sincronizar-costos.mjs
 *   node scripts/maintenance/precios-optovision/sincronizar-costos.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/sincronizar-costos.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar, MARKUP, congeladoSinAr } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (costos desde la lista de Optovisión)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
    console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`);
    process.exit(1);
}
// Candado: sin --produccion, esto NO puede escribir en producción.
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const productos = await prisma.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1
        from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'
        order by name`;
    const { ok, porNombre, sinLista } = emparejar(productos);

    // Solo los que de verdad cambian: reescribir lo idéntico ensucia el
    // updatedAt de medio catálogo y hace imposible saber qué se tocó.
    // También los que tienen el PELADO viejo o incoherente aunque el cost ya
    // coincida (caso real: Saphire HR con baseCost de otra época): dejarlo
    // pasar deja una bomba para el próximo recálculo desde el pelado.
    const cambian = ok.filter(p => !congeladoSinAr(p.name)
        && (Math.round(p.cost || 0) !== p.costoNuevo
            || Math.round(p.baseCost || 0) !== Math.round(p.lista)));
    const iguales = ok.length - cambian.length;
    // Se listan: un congelado invisible es indistinguible de un producto que
    // el emparejador no encontró.
    const congelados = ok.filter(p => congeladoSinAr(p.name));

    console.log(`${productos.length} cristales · ${ok.length} emparejados` +
        ` (${sinLista.length} sin lista, ${porNombre.length} por el nombre)`);
    console.log(`  ya estaban bien: ${iguales} · a actualizar: ${cambian.length}\n`);

    if (cambian.length) {
        console.log(`  ${'Producto'.slice(0, 40).padEnd(42)}${'costo hoy'.padStart(12)}${'costo nuevo'.padStart(13)}` +
            `${'markup hoy'.padStart(12)}${'markup nuevo'.padStart(13)}`);
        for (const p of cambian) {
            const mkHoy = p.cost > 0 ? p.price / p.cost : null;
            const mkNuevo = p.costoNuevo > 0 ? p.price / p.costoNuevo : null;
            const alerta = mkNuevo != null && mkNuevo < MARKUP - 0.05 ? '  ← margen bajo' : '';
            console.log(`  ${String(p.name).slice(0, 40).padEnd(42)}${pesos(p.cost).padStart(12)}${pesos(p.costoNuevo).padStart(13)}` +
                `${(mkHoy ? '×' + mkHoy.toFixed(2) : '—').padStart(12)}${(mkNuevo ? '×' + mkNuevo.toFixed(2) : '—').padStart(13)}${alerta}`);
        }
    }

    if (congelados.length) {
        console.log(`\n  🔒 ${congelados.length} CONGELADO(S) — dicen "sin AR/sin Crizal" en el nombre, no se tocan:`);
        for (const p of congelados) {
            console.log(`     ${String(p.name).slice(0, 50).padEnd(52)}costo queda en ${pesos(p.cost)}` +
                `  (la lista daría ${pesos(p.costoNuevo)})`);
        }
    }

    const asumidos = cambian.filter(p => p.seguro === false);
    if (asumidos.length) {
        console.log(`\n  ⚠️  ${asumidos.length} de estos no entran en la política del más caro`);
        console.log(`     (renglón sin columnas Crizal): revisar el renglón elegido antes de aplicar.`);
    }

    if (!APLICAR) {
        console.log(`\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar`);
        return;
    }

    for (const p of cambian) {
        await prisma.$executeRaw`
            update "Product"
            set cost = ${p.costoNuevo}, "baseCost" = ${Math.round(p.lista)}, "updatedAt" = now()
            where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({
            costoDe: p.cost, costoA: p.costoNuevo, listaPelada: Math.round(p.lista),
            renglon: `${p.familia} · ${p.material} · ${p.tratamiento}`,
            tratamientoAsumido: p.seguro === false,
        })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambian.length} costo(s) actualizados. El precio de venta no se tocó.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
