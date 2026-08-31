/**
 * EMPAREJA LOS NOMBRES de los cristales de Optovisión y deja dicho qué
 * antirreflejo llevan.
 *
 * POR QUÉ (Ishtar, 31/8/2026): "emparejá los nombres y agregale que diga
 * Crizal". Hoy el catálogo tiene tres formas de nombrar el mismo tipo de
 * producto y ninguna dice el tratamiento con claridad:
 *
 *     KODAK UNIQUE DRO - ORMA 2x1                    ← lleva Prevencia, no lo dice
 *     COMFORT - ORMA + CRIZAL 2x1                    ← dice "CRIZAL", no cuál
 *     XR DESIGN -  ORMA   + CRIZAL  2x1              ← dobles espacios
 *     PHYSIO 3.0 - ORMA TRANSITIONS GEN S + CRIZAL (fotocromaticos 8) 2x1
 *
 * Que el nombre no diga el Crizal no es cosmético: el costo se calcula CON el
 * Crizal más caro, así que un vendedor que lee "KODAK UNIQUE DRO - ORMA 2x1"
 * no tiene forma de saber que ese precio ya incluye el mejor antirreflejo.
 *
 * EL FORMATO, uno solo para todos:
 *     FAMILIA - MATERIAL + TRATAMIENTO [2x1]
 *     KODAK UNIQUE DRO - ORMA + CRIZAL PREVENCIA 2x1
 *     VARILUX COMFORT - ORMA TRANSITIONS GEN S + CRIZAL PREVENCIA 2x1
 *     SYGNUS BIFOCAL - Orma + AR NUMAX
 *     BLUE UV FILTER SYSTEM - ORMA — SIN ANTIRREFLEJO
 *
 * El nombre sale del EMPAREJADOR, o sea del renglón real de la lista: familia,
 * material y tratamiento con el que se costeó. Así el nombre y el costo no
 * pueden contarse historias distintas.
 *
 * NO TOCA las ventas ya hechas: cada OrderItem guarda su propio
 * `productNameSnapshot`, congelado el día de la venta.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/normalizar-nombres.mjs
 *   node scripts/maintenance/precios-optovision/normalizar-nombres.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/normalizar-nombres.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (nombres emparejados, con el Crizal a la vista)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

/** El prefijo con el que se muestra cada familia de la lista. */
const PREFIJO = {
    'Varilux XR design': 'VARILUX XR DESIGN', 'Varilux XR pro': 'VARILUX XR PRO',
    'Varilux Physio 3.0': 'VARILUX PHYSIO 3.0', 'Varilux Comfort Max': 'VARILUX COMFORT MAX',
    'Varilux Liberty 3.0': 'VARILUX LIBERTY 3.0', 'Varilux Digitime': 'VARILUX DIGITIME',
    'Varilux Physio': 'VARILUX PHYSIO', 'Varilux Comfort': 'VARILUX COMFORT',
    'Kodak Unique DRO': 'KODAK UNIQUE DRO', 'Kodak Precise Next': 'KODAK PRECISE',
    'Kodak Softwear': 'KODAK SOFTWEAR', 'Kodak SV Digital': 'KODAK SV DIGITAL',
    'Eyezen Boost': 'EYEZEN BOOST', 'Eyezen Start': 'EYEZEN START', 'Eyezen Kids': 'EYEZEN KIDS',
    'Myopilux Kids Lite': 'MYOPILUX KIDS LITE', 'Myopilux Kids Plus': 'MYOPILUX KIDS PLUS',
    'Essilor Interview': 'INTERVIEW', 'Espace Plus Digital': 'ESPACE PLUS DIGITAL',
    'BlueUV Filter System': 'BLUE UV FILTER SYSTEM', 'Transitions Gen S': 'TRANSITIONS GEN S',
    'Transitions XTRActive': 'TRANSITIONS XTRACTIVE', 'Acclimates': 'ACCLIMATES', 'Xperio': 'XPERIO',
    'Otros monofocales de laboratorio': 'MONOFOCAL DE LABORATORIO', 'Monofocal de stock': 'MONOFOCAL DE STOCK',
    'Sygnus NEW EDITION': 'ESSILOR NEW EDITIONS', 'Sygnus Monofocal Digital ONE': 'SYGNUS MONOFOCAL ONE',
    'Sygnus Bifocal': 'SYGNUS BIFOCAL', 'Sygnus Driver': 'SYGNUS DRIVER',
    'Lente de stock (pág. 22)': 'LENTE DE STOCK',
};

/**
 * Cómo se escribe el tratamiento en el nombre.
 *
 * EL CRIZAL VA GENÉRICO, A PROPÓSITO. El nombre dice "+ CRIZAL" y nunca cuál:
 * el costo se calcula con el MÁS CARO (así el margen nunca queda corto) pero el
 * que realmente lleva el par lo elige el vendedor en la venta, en el selector de
 * Crizal —puede ser Prevencia, Sapphire o Forte UV—. Escribir "+ CRIZAL
 * PREVENCIA" en el nombre haría creer que está fijo y que no se puede cambiar.
 *
 * Los "SIN ANTIRREFLEJO" sí se nombran distinto: ahí no hay nada que elegir, y
 * la diferencia de precio contra el mismo cristal con Crizal es enorme.
 */
function sufijoTratamiento(t) {
    const s = String(t || '');
    if (/sin\s*antirreflejo|^sin\s*ar/i.test(s)) return ' — SIN ANTIRREFLEJO';
    if (/numax/i.test(s)) return ' + AR NUMAX';
    if (/lente de stock|incluido/i.test(s)) return ' (Crizal incluido)';
    if (/trio|tr[íi]o/i.test(s)) return ' + TRÍO EASY CLEAN';
    if (/crizal/i.test(s)) return ' + CRIZAL';
    return '';
}

/** La promo del 50% se anuncia adelante, que es como la busca el vendedor. */
const esPromo = n => /mi\s*primer/i.test(n);

function nombreCanonico(p) {
    const fam = PREFIJO[p.familia];
    if (!fam) return null;
    const material = String(p.material).replace(/\s*\+\s*AR Numax\s*$/i, '').trim();
    // Transitions Gen S tiene DOS filas de ORMA con el mismo material y distinto
    // precio: una de stock y una tallada. Lo único que las separa en la lista es
    // el "(stock)" del rango, así que el nombre lo lleva o quedan iguales.
    const esStock = /stock/i.test(String(p.rango || '')) || /\(stock\)/i.test(p.name);
    const marca = /transitions gen s/i.test(p.familia) && /^ORMA$/i.test(material)
        ? (esStock ? ' (stock)' : ' (tallado)') : '';
    const base = `${fam} - ${material}${marca}${sufijoTratamiento(p.tratamiento)}`;
    const conPromo = esPromo(p.name) ? `MI PRIMER ${base}` : base;
    return `${conPromo}${p.is2x1 ? ' 2x1' : ''}`.replace(/\s+/g, ' ').trim();
}

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const productos = await prisma.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1 from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION' order by name`;
    const { ok, porNombre, sinLista } = emparejar(productos);

    const cambios = [], choques = [], sinCanon = [];
    const usados = new Map();   // nombre nuevo → quién lo pidió primero

    for (const p of ok) {
        const nuevo = nombreCanonico(p);
        if (!nuevo) { sinCanon.push(p); continue; }
        if (nuevo === p.name) continue;
        // Un choque significa que dos productos distintos quedarían con el mismo
        // nombre: eso no se resuelve solo, se avisa.
        if (usados.has(nuevo)) { choques.push([p, usados.get(nuevo)]); continue; }
        usados.set(nuevo, p);
        cambios.push({ id: p.id, de: p.name, a: nuevo });
    }
    // También choca si el nombre nuevo ya lo tiene OTRO producto que no cambia.
    const quietos = new Set(productos.filter(p => !cambios.some(c => c.id === p.id)).map(p => p.name));
    const chocaQuieto = cambios.filter(c => quietos.has(c.a));

    console.log(`${productos.length} cristales · ${cambios.length} se renombran\n`);
    for (const c of cambios.slice(0, 200)) console.log(`  "${c.de}"\n   →  "${c.a}"\n`);

    if (chocaQuieto.length) {
        console.log(`  ❌ ${chocaQuieto.length} chocarían con un producto que no cambia:`);
        chocaQuieto.forEach(c => console.log(`     ${c.de} → ${c.a}`));
    }
    if (choques.length) {
        console.log(`  ❌ ${choques.length} pares quedarían con el MISMO nombre:`);
        choques.forEach(([a, b]) => console.log(`     "${a.name}" y "${b.name}" → ambos a "${nombreCanonico(a)}"`));
    }
    if (sinCanon.length) {
        console.log(`\n  ⚠️  ${sinCanon.length} sin nombre canónico (familia sin prefijo definido):`);
        sinCanon.slice(0, 8).forEach(p => console.log(`     ${p.name}  [${p.familia}]`));
    }
    if (sinLista.length || porNombre.length) {
        console.log(`\n  ${sinLista.length + porNombre.length} no emparejan con la lista y NO se tocan:`);
        [...sinLista, ...porNombre].forEach(p => console.log(`     ${p.name}`));
    }

    if (choques.length || chocaQuieto.length) {
        console.log('\n❌ Hay choques de nombre. NO se aplica nada hasta resolverlos.');
        process.exitCode = 1; return;
    }
    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const c of cambios) {
        await prisma.$executeRaw`update "Product" set name = ${c.a}, "updatedAt" = now() where id = ${c.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                ${JSON.stringify({ renombrado: { de: c.de, a: c.a } })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambios.length} nombre(s) emparejados. No se tocó ni un precio ni un costo.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
