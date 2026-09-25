/**
 * Qué producto del sistema vende cada opción de "Arma tus lentes", y si está
 * bien vinculado.
 *
 * SOLO LECTURA. Lista cada opción del configurador con el producto vinculado,
 * su precio, costo, margen y laboratorio, y FALLA (exit 1) si alguna opción
 * activa no se puede vender (sin producto, archivado, a $0) o si el vínculo
 * tiene un problema que cuesta plata: sin costo o sin laboratorio (el cruce
 * con el lab no la controla), un "Mi primer" publicado como multifocal, o un
 * Varilux que no es 2x1 (la tienda regalaría un par que el lab cobra).
 *
 * Usa el MISMO service que la tienda y el checkout: lo que dice acá es lo que
 * la web publica y cobra.
 *
 * Uso:
 *   npm run check:cristales-vinculos              (base del .env)
 *   npm run check:cristales-vinculos -- --prod    (producción, solo lee)
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolverOpcionesDeCristal } from '../../src/services/cristales-web.service.ts';
import { CLAVES_OPCION, avisosDeVinculo } from '../../src/lib/cristales-web/claves.ts';
import { motivoLegible } from '../../src/lib/cristales-web/calculo.ts';
import { precioConSigno } from '../../src/lib/format-precio.ts';

const usarProd = process.argv.includes('--prod');

// El .env no se parsea con dotenv a propósito: solo se saca la URL que hace
// falta y nunca se imprime.
const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) {
    console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`);
    process.exit(1);
}
console.log(`Base: ${usarProd ? 'PRODUCCIÓN (solo lectura)' : 'la del .env'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})\n`);

const prisma = new PrismaClient({ datasourceUrl: url });
const problemas = [];

try {
    const opciones = await resolverOpcionesDeCristal(prisma);
    const presentes = new Set(opciones.map(o => o.clave));
    for (const clave of CLAVES_OPCION) {
        if (!presentes.has(clave)) problemas.push(`${clave}: falta la fila en WebLensOption (¿no corrió la migración?)`);
    }

    let grupo = '';
    for (const o of opciones) {
        if (o.grupo !== grupo) {
            grupo = o.grupo;
            console.log(`\n${grupo}`);
        }
        const p = o.producto;
        const margen = p && p.cost > 0 && o.precio ? ` · ×${(o.precio / p.cost).toFixed(1)}` : '';
        const estado = o.disponible ? `✅ ${precioConSigno(o.precio)}` : `❌ ${motivoLegible(o.motivo)}`;
        console.log(`  ${o.etiqueta.padEnd(28)} ${estado}`);
        if (p) console.log(`      ← ${p.name?.trim()} · ${p.laboratory || 'sin lab'} · costo ${precioConSigno(p.cost)}${margen}${p.is2x1 ? ' · 2x1' : ''}`);
        if (o.activa && !o.disponible) problemas.push(`${o.etiqueta} (${o.clave}): no se vende — ${motivoLegible(o.motivo)}`);
        for (const a of avisosDeVinculo(o.clave, p)) {
            console.log(`      ⚠ ${a}`);
            problemas.push(`${o.etiqueta} (${o.clave}): ${a}`);
        }
    }
} finally {
    await prisma.$disconnect();
}

if (problemas.length) {
    console.log(`\n${problemas.length} problema(s):`);
    for (const p of problemas) console.log(`  · ${p}`);
    console.log('\nSe corrige en /admin/web → Cristales de Arma tus lentes.');
    process.exitCode = 1;
} else {
    console.log('\nTodas las opciones activas se venden con un producto válido.');
}
