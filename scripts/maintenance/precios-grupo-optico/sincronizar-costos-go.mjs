/**
 * Escribe en los cristales de GRUPO ÓPTICO el costo que sale de su lista.
 *
 * POR QUÉ URGE: de las 377 facturas de Grupo Óptico cruzadas en el sistema,
 * SOLO 9 dan OK. 133 figuran como sobrecosto y 132 como subcosto, con $6,1M y
 * $3,1M de diferencia acumulada. Los costos vienen de una lista vieja y ni
 * siquiera siguen una fórmula: contra la lista de agosto las diferencias son
 * $27, $270, $2.576, $5.007 — números sin patrón, o sea cargados a mano en
 * distintos momentos.
 *
 * LA FÓRMULA, distinta a la de Optovisión:
 *     costo = precio de lista + calibrado          (NO lleva IVA)
 *
 * · SIN IVA. Verificado contra las 377 facturas: en todas billedTotal ==
 *   billedNet, ratio 1.0000. Confirmado por Ishtar: "no, sólo calibrado".
 * · CALIBRADO $15.532. Regla de Ishtar: un solo número por laboratorio, el de
 *   MAYOR valor —así el costo nunca queda corto—. En Grupo Óptico el más caro
 *   es el orgánico de laboratorio perforado: $15.532. El sistema tenía $7.000,
 *   que es menos de la mitad; ese error va en la dirección peligrosa, porque un
 *   costo corto hace ver márgenes mejores que los reales.
 *
 * QUÉ TOCA: `baseCost` (el pelado de la lista) y `cost`. NUNCA `price`.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-grupo-optico/sincronizar-costos-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/sincronizar-costos-go.mjs --aplicar
 *   node scripts/maintenance/precios-grupo-optico/sincronizar-costos-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar, datos } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (costos desde la lista de Grupo Óptico)';

/** El más caro de los 15 calibrados de la lista: orgánico laboratorio perforado. */
export const CALIBRADO_GO = 15532;
/** Grupo Óptico NO factura IVA. Verificado contra 377 facturas. */
export const IVA_GO = 0;
export const costoGO = lista => Math.round(lista + CALIBRADO_GO);

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}`);
    console.log(`Fórmula: lista + $${CALIBRADO_GO.toLocaleString('es-AR')} de calibrado · SIN IVA\n`);

    const productos = await prisma.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1, "lensIndex", origin
        from "Product"
        where category = 'Cristal' and laboratory = 'GRUPO OPTICO'
        order by name`;
    const { ok, sinResolver } = emparejar(productos);

    const cambian = ok.map(p => ({ ...p, costoNuevo: costoGO(p.lista) }))
        .filter(p => Math.round(p.cost || 0) !== p.costoNuevo || Math.round(p.baseCost || 0) !== Math.round(p.lista));

    console.log(`${productos.length} cristales · ${ok.length} emparejados · ${sinResolver.length} sin resolver`);
    console.log(`  ya estaban bien: ${ok.length - cambian.length} · a actualizar: ${cambian.length}\n`);

    if (cambian.length) {
        console.log(`  ${'Producto'.slice(0, 44).padEnd(46)}${'costo hoy'.padStart(12)}${'costo nuevo'.padStart(13)}${'markup hoy'.padStart(12)}${'markup nuevo'.padStart(13)}`);
        for (const p of cambian.sort((a, b) => (b.costoNuevo - b.cost) - (a.costoNuevo - a.cost))) {
            const mkH = p.cost > 0 ? p.price / p.cost : null;
            const mkN = p.costoNuevo > 0 ? p.price / p.costoNuevo : null;
            const alerta = mkN != null && mkN < 2.5 ? '  ← queda bajo ×2,5' : '';
            console.log(`  ${String(p.name).slice(0, 44).padEnd(46)}${pesos(p.cost).padStart(12)}${pesos(p.costoNuevo).padStart(13)}` +
                `${(mkH ? '×' + mkH.toFixed(2) : '—').padStart(12)}${(mkN ? '×' + mkN.toFixed(2) : '—').padStart(13)}${alerta}`);
        }
    }
    if (sinResolver.length) {
        console.log(`\n  ⚠️  ${sinResolver.length} que no se pudieron emparejar (no se tocan):`);
        sinResolver.forEach(p => console.log(`     ${String(p.name).slice(0, 52).padEnd(54)}${p.motivo}`));
    }

    const bajos = cambian.filter(p => p.price / p.costoNuevo < 2.5);
    if (bajos.length) console.log(`\n  ${bajos.length} quedarían por debajo de ×2,5: los levanta piso-de-margen después.`);

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const p of cambian) {
        await prisma.$executeRaw`
            update "Product" set cost = ${p.costoNuevo}, "baseCost" = ${Math.round(p.lista)}, "updatedAt" = now()
            where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ producto: p.name, costoDe: p.cost, costoA: p.costoNuevo, listaPelada: Math.round(p.lista),
                    renglon: `${p.seccion} · ${p.renglon}`, calibrado: CALIBRADO_GO, iva: IVA_GO })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambian.length} costo(s) actualizados. El precio de venta no se tocó.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
