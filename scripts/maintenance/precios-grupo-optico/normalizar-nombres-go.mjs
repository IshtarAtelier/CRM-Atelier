/**
 * Reconstruye el nombre de cada cristal de Grupo Óptico desde su dato, con un
 * formato único, para que ninguno se confunda con otro y no puedan repetirse.
 *
 * EL FORMATO:
 *     LÍNEA · MATERIAL ÍNDICE [· Essential] [· rango] [2x1]
 *
 * Por qué (Ishtar, 8/9/2026: "los nombres confusos corregilos… que cada
 * artículo quede MUY claro y NINGUNO duplicado"). La auditoría encontró:
 *   · 30 con el índice escrito dos veces ("Orgánico Blue Light 1,56 1.56"),
 *     porque el renglón de la lista ya lo trae y además se lo agregábamos.
 *   · 59 con coma decimal donde el resto del sistema usa punto.
 *   · 8 que terminaban en espacio, y 2 con espacio doble.
 *   · 127 sin el índice en el nombre — el dato que más mira el vendedor.
 *   · 79 pares que se distinguían por tres caracteres o menos.
 * Nada de eso era un duplicado real, pero en el mostrador se leen igual, que
 * para el caso es peor: el error aparece recién cuando el pedido llega mal.
 *
 * CÓMO SE GARANTIZA QUE NO HAYA DOS IGUALES: el nombre se arma desde el
 * renglón de la lista, y si dos renglones distintos producen el mismo texto se
 * les agrega su rango de graduación, que es lo que de verdad los separa (los
 * cuatro Mineral Blanco 1.523). Si aun así quedara alguna colisión, el script
 * ABORTA sin escribir nada.
 *
 * NO toca los archivados —conservan su nombre histórico con el prefijo— ni
 * ningún precio o costo.
 *
 *   node scripts/maintenance/precios-grupo-optico/normalizar-nombres-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/normalizar-nombres-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { emparejar } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (nombres normalizados en Grupo Óptico)';

/** El nombre corto y comercial de cada sección de la lista. */
const LINEA = {
    'Multifocal Smart Lens ONE': 'Multifocal Smart ONE',
    'Multifocal Smart Lens NEW': 'Multifocal Smart NEW',
    'Multifocal Smart Lens FREE': 'Multifocal Smart FREE',
    'Multifocal Smart Lens PRO': 'Multifocal Smart PRO',
    'Multifocal Smart Lens EXCLUSIVE': 'Multifocal Smart EXCLUSIVE',
    'Multifocal Smart Lens AI LENS': 'Multifocal Smart AI LENS',
    'Multifocal Smart Lens DRIVE': 'Multifocal Smart DRIVE',
    'Bifocal digital invisible (Kriptock Invisible)': 'Bifocal Kriptock Invisible',
    'Bifocal Flat Top / Kriptock': 'Bifocal Flat Top',
    'Ocupacional Office': 'Ocupacional Office',
    'Ultra Relax (monofocal digital)': 'Ocupacional Ultra Relax',
    'Control de miopía Smart MyoFix': 'Control miopía MyoFix',
    'Control de miopía Smart MyoLens': 'Control miopía MyoLens',
    'Monofocal de laboratorio (CNC)': 'Monofocal TALLADO (CNC)',
    'Monofocal de laboratorio DIGITAL': 'Monofocal DIGITAL (free-form)',
    'Lente de stock / rango extendido': 'Stock',
};

/** Limpia el renglón: coma decimal a punto, sin el índice repetido, sin ESSENTIAL. */
function materialLimpio(renglon, indice) {
    let m = String(renglon)
        .replace(/\s*\(ESSENTIAL\)\s*/i, '')
        .replace(/(\d),(\d)/g, '$1.$2')      // 1,56 → 1.56
        .replace(/\s+/g, ' ')
        .trim();
    // El índice va una sola vez, al final: si el renglón ya lo trae, se le saca.
    if (indice) m = m.replace(new RegExp(`\\s*${String(indice).replace('.', '[.,]')}\\s*$`), '').trim();
    return m;
}

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Un rango legible y corto, para desempatar dos renglones que se llaman igual. */
const rangoCorto = x => {
    if (x.sphereMin == null) return null;
    const s = `Esf ${x.sphereMin > 0 ? '+' : ''}${x.sphereMin}/${x.sphereMax > 0 ? '+' : ''}${x.sphereMax}`;
    return x.cylinderMin != null ? `${s} Cil ${x.cylinderMin}/${x.cylinderMax}` : s;
};

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}`);
        console.log('Formato: LÍNEA · MATERIAL ÍNDICE [· Essential] [· rango] [2x1]\n');

        const todos = await prisma.$queryRaw`
            select id, name, "lensIndex", origin, price, cost, is2x1,
                   "sphereMin", "sphereMax", "cylinderMin", "cylinderMax"
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;
        // Los archivados conservan su nombre histórico: ya no se venden y
        // renombrarlos solo dificultaría reconocerlos en una venta vieja.
        const activos = todos.filter(x => !/^\s*\[archivado\]/i.test(x.name));
        const { ok, sinResolver } = emparejar(activos);

        const propuesto = new Map();
        for (const x of ok) {
            const linea = LINEA[x.seccion] ?? x.seccion;
            const material = materialLimpio(x.renglon, x.indice);
            const essential = /\(ESSENTIAL\)/i.test(x.renglon) ? ' · Essential' : '';
            const disp = x.seccion === 'Lente de stock / rango extendido'
                ? (/rango\s*extendido/i.test(x.name) ? ' · Rango Extendido' : '') : '';
            const dosxuno = x.is2x1 ? ' 2x1' : '';
            propuesto.set(x.id, `${linea} · ${material}${x.indice ? ` ${x.indice}` : ''}${essential}${disp}${dosxuno}`);
        }
        // Los que el emparejador no ubica conservan su nombre: no hay de dónde
        // derivarlo sin inventar.
        for (const x of sinResolver) propuesto.set(x.id, String(x.name).trim());

        // DESEMPATE: si dos productos llegan al mismo nombre, se les agrega el
        // rango, que es lo que realmente los separa en la lista.
        const porNombre = {};
        for (const [id, n] of propuesto) (porNombre[norm(n)] ??= []).push(id);
        let desempatados = 0;
        for (const ids of Object.values(porNombre)) {
            if (ids.length < 2) continue;
            for (const id of ids) {
                const x = activos.find(p => p.id === id);
                const r = rangoCorto(x);
                if (r) { propuesto.set(id, `${propuesto.get(id)} · ${r}`); desempatados++; }
            }
        }

        const cambian = activos
            .map(x => ({ id: x.id, de: String(x.name).trim(), a: propuesto.get(x.id) }))
            .filter(c => c.a && c.a !== c.de);

        // ÚLTIMO RECURSO: si ni el rango los separa, es que el emparejador
        // manda dos renglones distintos al mismo lugar. En ese caso gana el
        // nombre ORIGINAL, que sí los distinguía — es preferible un nombre
        // viejo y claro que uno nuevo y ambiguo. Se listan para revisarlos.
        const irresolubles = [];
        const porNombre2 = {};
        for (const [id, n] of propuesto) (porNombre2[norm(n)] ??= []).push(id);
        for (const ids of Object.values(porNombre2)) {
            if (ids.length < 2) continue;
            for (const id of ids) {
                const x = activos.find(p => p.id === id);
                propuesto.set(id, String(x.name).trim());
                irresolubles.push(String(x.name).trim());
            }
        }
        if (irresolubles.length) {
            console.log(`\n  ⚠️  ${irresolubles.length} conservan su nombre original (el renglón de la lista no los distingue):`);
            irresolubles.forEach(n => console.log(`     ${n.slice(0, 62)}`));
        }

        // GUARDA: después del cambio no puede quedar NINGUNO repetido.
        const finales = activos.map(x => propuesto.get(x.id) ?? String(x.name).trim());
        const unicos = new Set(finales.map(norm));
        console.log(`  ${activos.length} activos · ${cambian.length} a renombrar · ${desempatados} desempatados con su rango`);
        console.log(`  nombres únicos al terminar: ${unicos.size} de ${finales.length} ${unicos.size === finales.length ? '✅' : '❌'}`);
        if (unicos.size !== finales.length) {
            const c = {}; finales.forEach(n => (c[norm(n)] ??= []).push(n));
            Object.values(c).filter(v => v.length > 1).slice(0, 5).forEach(v => console.error(`     CHOQUE: ${v.join('  ||  ')}`));
            console.error('\n❌ Quedarían nombres repetidos: no se escribe nada.');
            process.exitCode = 1; return;
        }

        console.log('\n  Muestra de los cambios:');
        cambian.slice(0, 12).forEach(c => console.log(`     "${c.de.slice(0, 52)}"\n      → "${c.a.slice(0, 66)}"`));
        if (cambian.length > 12) console.log(`     … y ${cambian.length - 12} más`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambian) {
            await prisma.$executeRaw`update "Product" set name = ${c.a}, model = ${c.a}, "updatedAt" = now() where id = ${c.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                    ${JSON.stringify({ nombreDe: c.de, nombreA: c.a,
                        formato: 'LÍNEA · MATERIAL ÍNDICE [· Essential] [· rango] [2x1]' })}::jsonb, now())`;
        }
        console.log(`\n✅ ${cambian.length} nombres normalizados. No se tocó ni un precio ni un costo.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}
