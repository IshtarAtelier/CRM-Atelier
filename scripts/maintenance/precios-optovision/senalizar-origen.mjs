/**
 * SEÑALIZA el origen de cada cristal de Optovisión: STOCK o LABORATORIO.
 *
 * El campo `Product.origin` existía pero estaba vacío en 105 de 127. La
 * clasificación sale de la PROPIA lista del laboratorio más una regla de
 * Ishtar (30/8/2026): "todo lo que es progresivo es de laboratorio".
 *
 *   LABORATORIO — progresivos y digitales a medida (Varilux, Kodak, Sygnus,
 *     Eyezen, Myopilux, Stellest, Espace, Interview, packs New Editions) y los
 *     monofocales que la pág. 20 titula "OTROS MONOFOCALES DE LABORATORIO"
 *     (BlueUV, Transitions tallado, Xperio, Acclimates).
 *   STOCK — lo que la lista marca como stock: las lentes de la pág. 22
 *     ("LENTES DE STOCK"), el "Monofocal de stock", y las filas cuyo rango
 *     dice "(stock)" o cuyo nombre lo dice.
 *
 * Solo escribe donde el origen está VACÍO o mal; lo cargado a mano que
 * coincida no se toca. Ensayo por defecto.
 *   node scripts/maintenance/precios-optovision/senalizar-origen.mjs
 *   node scripts/maintenance/precios-optovision/senalizar-origen.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (señalización stock/laboratorio de cristales)';
const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base'); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no es localhost. Para producción: --produccion.'); process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** null = duda honesta: se pregunta, no se adivina. */
function clasificar(p, emparejado) {
    const n = String(p.name || '');
    if (/\(stock\)|de\s*stock/i.test(n)) return 'STOCK';
    if (emparejado?.renglonStock) return 'STOCK';                    // lentes pág. 22
    if (emparejado?.familia === 'Monofocal de stock') return 'STOCK';
    // Progresivos y digitales a medida → laboratorio (regla de Ishtar).
    if (/comfort|physio|xr |liberty|digitime|kodak|eyezen|myopilux|stellest|espace|interview|new edition|sygnus|varilux/i.test(n)) return 'LABORATORIO';
    // Monofocales de la pág. 20: el título de su sección los llama DE LABORATORIO.
    if (emparejado && /BlueUV|Transitions|Acclimates|Xperio|Otros monofocales/i.test(emparejado.familia || '')) return 'LABORATORIO';
    return null;
}

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR' : 'ENSAYO (no escribe)'}\n`);
    const prods = await prisma.$queryRaw`
        select id, name, origin, price, cost, "baseCost", is2x1 from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION' order by name`;
    const { ok } = emparejar(prods);

    const cambios = [], dudas = [], coinciden = [];
    for (const p of prods) {
        const e = ok.find(x => x.id === p.id);
        const destino = clasificar(p, e);
        const actual = (p.origin || '').trim().toUpperCase() || null;
        if (!destino) { dudas.push(p); continue; }
        if (actual === destino) { coinciden.push(p); continue; }
        cambios.push({ ...p, destino, actual });
    }
    console.log(`${prods.length} cristales · ya bien: ${coinciden.length} · a señalizar: ${cambios.length} · dudas: ${dudas.length}\n`);
    const stock = cambios.filter(c => c.destino === 'STOCK');
    console.log(`  → STOCK (${stock.length}):`);
    for (const c of stock) console.log(`     ${String(c.name).slice(0, 56)}${c.actual ? `  (hoy dice ${c.actual})` : ''}`);
    console.log(`  → LABORATORIO (${cambios.length - stock.length})`);
    const pisados = cambios.filter(c => c.actual && c.actual !== c.destino);
    for (const c of pisados) console.log(`     ⚠ cambia ${c.actual} → ${c.destino}: ${String(c.name).slice(0, 50)}`);
    if (dudas.length) {
        console.log(`\n  DUDAS (se preguntan, no se adivinan):`);
        for (const d of dudas) console.log(`     ${String(d.name).slice(0, 56)}`);
    }
    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }
    for (const c of cambios) {
        await prisma.$executeRaw`update "Product" set origin = ${c.destino}, "updatedAt" = now() where id = ${c.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                ${JSON.stringify({ origen: c.destino, previo: c.actual, producto: c.name })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambios.length} cristal(es) señalizados.`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
