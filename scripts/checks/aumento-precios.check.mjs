/**
 * ¿Quedó aplicado el aumento de precios en producción?
 *
 * El script que sube precios (`scripts/maintenance/aumento-essilor-7pct.mjs`)
 * no deja rastro en el AuditLog, así que la única evidencia es CUÁNDO se tocó
 * cada producto: si el aumento corrió, los cristales de ese laboratorio tienen
 * todos el mismo `updatedAt`, el del día que se aplicó.
 *
 * SOLO LEE la base de producción.
 *   node scripts/checks/aumento-precios.check.mjs
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const url = process.env.PROD_DATABASE_URL;
if (!url) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
const dia = d => d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' }) : '—';

/**
 * EL HISTORIAL DE AUMENTOS. Cada cambio de precio queda firmado en el AuditLog
 * (PRICE_OVERRIDE sobre PRODUCT) con el precio viejo, el nuevo y el porcentaje.
 * Esto lo lee de vuelta y lo muestra como lo que es: una lista de aumentos con
 * su fecha, quién lo hizo y a cuántos productos les pegó.
 */
async function historial() {
    const filas = await prisma.$queryRaw`
        select "createdAt", "userName", details
        from "AuditLog"
        where action = 'PRICE_OVERRIDE' and "entityType" = 'PRODUCT'
        order by "createdAt" desc
        limit 2000`;

    console.log('\n═══ HISTORIAL DE AUMENTOS DE PRECIO ═══');
    if (!filas.length) {
        console.log('\n  No hay ningún aumento registrado todavía.');
        console.log('  (Los aumentos hechos antes del 25/8/2026 no dejaban rastro: no se pueden reconstruir.)');
        return;
    }
    // Un aumento es una corrida: misma fecha+hora al minuto, mismo lab, mismo %.
    const corridas = new Map();
    for (const f of filas) {
        const min = new Date(f.createdAt).toISOString().slice(0, 16);
        const k = `${min}|${f.details?.lab || '—'}|${f.details?.pct ?? '—'}`;
        if (!corridas.has(k)) corridas.set(k, { fecha: f.createdAt, quien: f.userName, lab: f.details?.lab, pct: f.details?.pct, n: 0, de: 0, a: 0 });
        const c = corridas.get(k);
        c.n++; c.de += f.details?.de || 0; c.a += f.details?.a || 0;
    }
    for (const c of corridas.values()) {
        console.log(`\n  ${dia(c.fecha)}  ·  ${c.lab}  ·  +${c.pct}%`);
        console.log(`     ${c.n} producto(s) · la lista pasó de ${pesos(c.de)} a ${pesos(c.a)} en total`);
        console.log(`     lo hizo: ${c.quien}`);
    }
}

async function main() {
    await historial();

    const labs = await prisma.$queryRaw`
        select coalesce(laboratory, '(sin laboratorio)') as lab, count(*)::int as productos
        from "Product" where category = 'Cristal'
        group by 1 order by 2 desc`;
    console.log('\nCRISTALES ACTIVOS POR LABORATORIO');
    for (const l of labs) console.log(`  ${String(l.lab).padEnd(24)}${l.productos}`);

    for (const l of labs) {
        const prods = await prisma.$queryRaw`
            select name, brand, price, "wholesalePrice", cost, "updatedAt"
            from "Product"
            where category = 'Cristal'
              and coalesce(laboratory, '(sin laboratorio)') = ${l.lab}
            order by "updatedAt" desc`;
        // Si el aumento corrió, todos comparten el día de la corrida.
        const porDia = {};
        for (const p of prods) porDia[dia(p.updatedAt)] = (porDia[dia(p.updatedAt)] || 0) + 1;
        const dias = Object.entries(porDia).sort((a, b) => b[1] - a[1]);
        console.log(`\n${l.lab} — ${prods.length} cristales · última modificación por día:`);
        for (const [d, n] of dias.slice(0, 5)) console.log(`   ${d.padEnd(14)}${n} producto(s)`);
        console.log(`   ejemplos (los 5 tocados más recientemente):`);
        for (const p of prods.slice(0, 5)) {
            console.log(`     ${dia(p.updatedAt).padEnd(12)}${pesos(p.price).padStart(12)} lista · ` +
                `${pesos(p.wholesalePrice).padStart(11)} mayorista · ${pesos(p.cost).padStart(11)} costo   ` +
                `${String(p.brand || '')} ${String(p.name || '').slice(0, 34)}`);
        }
    }
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
