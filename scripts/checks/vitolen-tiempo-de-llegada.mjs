// ────────────────────────────────────────────────────────────────────────────
// VITOLEN: CUÁNTO TARDA UN PEDIDO EN LLEGAR AL LOCAL. Solo lee.
//
// Para decidir si el aviso automático de retiro (24 h después de "terminado",
// como con Grupo Óptico) se prende para Vitolen hace falta medirlo (Ishtar,
// 3/10/2026: "lo desactivamos hasta que podamos medir"). Este script compara,
// pedido por pedido, cuándo el portal lo mostró "Despachado" / "En Oficina"
// (espejo LabPortalOrder) con cuándo alguien marcó la venta "Listo p/ Retirar"
// (AuditLog), y saca la mediana y el máximo.
//
//   node scripts/checks/vitolen-tiempo-de-llegada.mjs          (base local)
//   node scripts/checks/vitolen-tiempo-de-llegada.mjs --prod   (producción, solo lee)
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const usarProd = process.argv.includes('--prod');
const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/\r$/, '').replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`); process.exit(1); }
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})\n`);
const prisma = new PrismaClient({ datasourceUrl: url });

const fecha = (d) => d ? d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const dias = (ms) => Math.round((ms / 86400000) * 10) / 10;

const terminados = await prisma.labPortalOrder.findMany({
    where: { lab: 'VITOLEN', orderId: { not: null }, status: { in: ['TERMINADO', 'DESPACHADO'] } },
    select: { portalNumber: true, statusRaw: true, status: true, lastChangeAt: true, estimatedAt: true, orderId: true, order: { select: { labStatus: true, client: { select: { name: true } } } } },
    orderBy: { lastChangeAt: 'asc' },
});

const filas = [];
for (const p of terminados) {
    const listo = await prisma.auditLog.findFirst({
        where: { entityType: 'ORDER', entityId: p.orderId, action: 'STATUS_CHANGE', createdAt: { gte: p.lastChangeAt }, details: { path: ['to', 'labStatus'], equals: 'READY' } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, userName: true },
    });
    filas.push({
        pedido: p.portalNumber, cliente: p.order?.client?.name || '', portal: p.statusRaw, portalEl: p.lastChangeAt, prometido: p.estimatedAt,
        listoEl: listo?.createdAt ?? null, quien: listo?.userName ?? null, ventaHoy: p.order?.labStatus,
        dias: listo ? dias(listo.createdAt.getTime() - p.lastChangeAt.getTime()) : null,
    });
}

if (filas.length === 0) {
    console.log('Todavía no hay pedidos de Vitolen vinculados a una venta que el portal muestre terminados o despachados.');
} else {
    console.log('Pedido      Cliente                    Portal          Visto el      Listo p/ retirar   Días   Quién');
    for (const f of filas) {
        console.log(`${f.pedido.padEnd(11)} ${f.cliente.slice(0, 26).padEnd(26)} ${String(f.portal).slice(0, 15).padEnd(15)} ${fecha(f.portalEl).padEnd(13)} ${(f.listoEl ? fecha(f.listoEl) : `(aún ${f.ventaHoy})`).padEnd(18)} ${f.dias === null ? '  —' : String(f.dias).padStart(4)}   ${f.quien ?? ''}`);
    }
    const medidos = filas.filter(f => f.dias !== null).map(f => f.dias).sort((a, b) => a - b);
    if (medidos.length) {
        const mediana = medidos[Math.floor(medidos.length / 2)];
        console.log(`\n${medidos.length} pedido(s) medidos · mediana ${mediana} día(s) · máximo ${medidos[medidos.length - 1]} · mínimo ${medidos[0]}`);
        console.log(mediana <= 1
            ? 'Con una mediana de hasta 1 día, el aviso automático a las 24 h (avisoDeRetiroAutomatico: true en vitolen/modulo.ts) no le mentiría al cliente.'
            : 'Con más de 1 día de mediana, el aviso a las 24 h llegaría antes que el pedido: dejarlo apagado o ajustar el plazo.');
    } else {
        console.log('\nNingún pedido terminado fue marcado todavía "Listo p/ Retirar": no hay nada que medir aún.');
    }
}
await prisma.$disconnect();
