/**
 * Cierra los huérfanos de Optovisión detectados en la auditoría del 7/9/2026.
 *
 * Hace DOS cosas, las dos verificadas contra el resumen de cuenta y la ficha:
 *
 *  1) ASIGNA dos facturas que llegaron sin nº de pedido en el papel:
 *     - 3008-00075115 → 610111 (Silvia Herrera). Ishtar lo confirmó en la ficha:
 *       la venta lleva "610111 - 610126". Era además la única venta de Optovisión
 *       sin factura cruzada enviada ANTES de la fecha de esa factura.
 *     - 3008-00073418 → 606136 (Euge Lozano), venta " 606136-606149".
 *
 *  2) BORRA las filas FANTASMA: facturas que ya están asignadas a su pedido real
 *     y que el escaneo IMAP volvió a registrar con la clave inventada
 *     "S/PEDIDO 3008-000XXXXX". Son la MISMA plata contada dos veces, y por eso
 *     el tablero mostraba huérfanos que no existían. Antes de borrar cada una se
 *     verifica que la hermana con el nº real exista Y tenga venta: si no, no se
 *     borra nada.
 *
 * ESCRIBE EN LA BASE DE PRODUCCIÓN. Por defecto solo muestra qué haría:
 *   node scripts/maintenance/optovision-huerfanos-sep2026.mjs
 *   node scripts/maintenance/optovision-huerfanos-sep2026.mjs --aplicar
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
const APLICAR = process.argv.includes('--aplicar');
const LAB = 'OPTOVISION';
const FIRMA = 'Ishtar (asignación manual de facturas de Optovisión)';
const HOY = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * `importe` es el TOTAL con IVA: Atelier es monotributo y no recupera el IVA.
 *
 * `postventa` marca los REPROCESOS. Su nº de pedido no vive en ninguna venta
 * (está en PostSaleCase.newOrderNumber), así que la venta a la que se cuelga la
 * entrada se busca por `ventaPorNumero` — el pedido ORIGINAL. Un reproceso queda
 * fuera del cruce de costo, igual que hace cost-matching.ts: con importe cargado
 * el estado es OK, no OVERCOST/UNDERCOST.
 */
const ASIGNACIONES = [
    { factura: '3008-00075115', pedido: '610111', importe: 578623.09, fuente: 'confirmado en la ficha por Ishtar (venta 610111 - 610126)' },
    { factura: '3008-00073418', pedido: '606136', importe: 473417.82, fuente: 'planilla física' },
    {
        factura: '3008-00067549', pedido: '596770', importe: 17173.72,
        fuente: 'planilla física — reproceso PSI, cambio de RP del pedido 580844 (alias de planilla 7101095)',
        postventa: true, ventaPorNumero: '580844',
        notaPostventa: 'Pedido de POSTVENTA (caso Cambio de receta, cobertura: Con cargo).',
    },
];

/** Filas duplicadas a borrar: clave fantasma → pedido real que ya la cubre. */
const FANTASMAS = [
    { fantasma: 'S/PEDIDO 3008-00069150', real: '595000' },
    { fantasma: 'S/PEDIDO 3008-00072463', real: '598454' },
    { fantasma: '3025', real: '3578631' },
];

/**
 * Filas duplicadas de la MISMA factura donde NINGUNA tiene venta todavía: se
 * queda la de clave explícita y se borra la de serie pelada. La serie pelada es
 * un casillero único por laboratorio (la unicidad es [lab, labOrderNumber]), así
 * que cada factura nueva sin nº de pedido PISA a la anterior — el 5/9 esa fila
 * era la factura 70740 por $220.850,72 y el 7/9 ya era la 76510 por $30,24.
 * Borrarla evita que se siga comiendo facturas en silencio.
 */
const DUPLICADOS_SIN_VENTA = [
    { borrar: '3008', conservar: 'S/PEDIDO 3008-00076510' },
];

/**
 * ANOTACIONES sobre los huérfanos VIEJOS, de la época del sistema anterior.
 * No cambian estado ni plata: dejan escrito adónde se rastreó cada uno el
 * 7/9/2026, para que nadie los vuelva a perseguir como si fueran ventas que
 * faltan cargar. Los siete primeros aparecen en la ficha del cliente (en las
 * interacciones), no como venta del CRM; los cinco últimos no aparecen en
 * ningún lado.
 */
const MARCA_REVISION = '[Revisado 7/9/2026]';
const ANOTACIONES = [
    { pedido: '574011', nota: 'Sistema anterior: figura en la ficha de Ramiro Gomez. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '567417', nota: 'Sistema anterior: figura en la ficha de Sardeni Teofilia. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '578082', nota: 'Sistema anterior: figura en la ficha de Carlos Cuomo. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '578085', nota: 'Sistema anterior: figura en la ficha de Carlos Cuomo. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '565423', nota: 'Sistema anterior: figura en la ficha de Claudio Busico. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '575961', nota: 'Sistema anterior: figura en la ficha de Claudio Busico. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '575971', nota: 'Sistema anterior: figura en la ficha de Claudio Busico. Sin venta en el CRM nuevo; no es un pedido perdido.' },
    { pedido: '567420', nota: 'Sistema anterior: buscado en ventas, postventas y fichas — no aparece en ningún lado. Pedir el nombre del cliente a Optovisión.' },
    { pedido: '566040', nota: 'Sistema anterior: buscado en ventas, postventas y fichas — no aparece en ningún lado. Pedir el nombre del cliente a Optovisión.' },
    { pedido: '566048', nota: 'Sistema anterior: buscado en ventas, postventas y fichas — no aparece en ningún lado. Pedir el nombre del cliente a Optovisión.' },
    { pedido: '577396', nota: 'Sistema anterior: buscado en ventas, postventas y fichas — no aparece en ningún lado. Pedir el nombre del cliente a Optovisión.' },
    { pedido: '577397', nota: 'Sistema anterior: buscado en ventas, postventas y fichas — no aparece en ningún lado. Pedir el nombre del cliente a Optovisión.' },
];

const pesos = n => n == null ? '—' : `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

async function main() {
    console.log(APLICAR ? 'APLICANDO CAMBIOS EN PRODUCCIÓN\n' : 'ENSAYO — no se escribe nada. Para aplicar: --aplicar\n');

    // ── 1) ASIGNACIONES ───────────────────────────────────────────────────
    console.log('═══ ASIGNAR FACTURAS A SU VENTA ═══\n');
    const listas = [];
    for (const a of ASIGNACIONES) {
        const nro = a.factura.split('-')[1].replace(/^0+/, '');
        // Un reproceso se cuelga de la venta del pedido ORIGINAL: su propio nº
        // no figura en ninguna venta.
        const numeroDeVenta = a.ventaPorNumero ?? a.pedido;
        const [venta] = await prisma.$queryRaw`
            select o.id, o."labOrderNumber", c.name as cliente
            from "Order" o left join "Client" c on c.id = o."clientId"
            where o."isDeleted" = false and o."labOrderNumber" like ${'%' + numeroDeVenta + '%'} limit 1`;
        const existentes = await prisma.$queryRaw`
            select id, "labOrderNumber", "billedTotal", status, "orderId", "sourceFile"
            from "LabCostEntry" where lab = ${LAB} and "sourceFile" like ${'%' + nro + '%'}`;

        const problemas = [];
        if (!venta) problemas.push(`ninguna venta tiene el nº ${numeroDeVenta}`);
        if (existentes.length > 1) problemas.push(`hay ${existentes.length} entradas para esa factura: revisar a mano`);
        const yaAsignada = existentes.find(e => e.orderId);
        if (yaAsignada) problemas.push(`ya está asignada (${yaAsignada.labOrderNumber})`);
        // Un reproceso tiene que tener su caso de postventa cargado: si no, la
        // entrada quedaría colgada de la venta sin decir que es un reproceso.
        if (a.postventa) {
            const [caso] = await prisma.$queryRaw`
                select p.id, p."caseType", p.coverage, c.name as cliente
                from "PostSaleCase" p left join "Client" c on c.id = p."clientId"
                where coalesce(p."newOrderNumber", '') like ${'%' + a.pedido + '%'} limit 1`;
            if (!caso) problemas.push(`no hay ningún caso de postventa con el nº ${a.pedido}`);
            else console.log(`   [reproceso de ${caso.cliente}: ${caso.caseType || 's/tipo'}${caso.coverage ? `, ${caso.coverage}` : ''}]`);
        }

        console.log(`${a.factura}  →  pedido ${a.pedido}   ${pesos(a.importe)}   [${a.fuente}]`);
        console.log(`   venta:   ${venta ? `${venta.cliente} (${venta.labOrderNumber})` : 'NINGUNA'}`);
        console.log(`   en base: ${existentes.length ? existentes.map(e => `${e.labOrderNumber} · ${pesos(e.billedTotal)} · ${e.status}`).join(' | ') : 'no hay entrada'}`);
        if (problemas.length) { problemas.forEach(x => console.log(`   AVISO: ${x}`)); }
        else { console.log('   OK: lista para asignar'); listas.push({ ...a, nro, venta, entrada: existentes[0] }); }
        console.log();
    }

    // ── 2) FANTASMAS ──────────────────────────────────────────────────────
    console.log('═══ BORRAR FILAS DUPLICADAS ═══\n');
    const borrables = [];
    for (const g of FANTASMAS) {
        const [f] = await prisma.$queryRaw`
            select id, "labOrderNumber", "billedTotal", status, "orderId", "sourceFile"
            from "LabCostEntry" where lab = ${LAB} and "labOrderNumber" = ${g.fantasma}`;
        const [r] = await prisma.$queryRaw`
            select e.id, e."labOrderNumber", e."billedTotal", e.status, e."orderId", c.name as cliente
            from "LabCostEntry" e
            left join "Order" o on o.id = e."orderId"
            left join "Client" c on c.id = o."clientId"
            where e.lab = ${LAB} and e."labOrderNumber" = ${g.real}`;

        console.log(`fantasma "${g.fantasma}"`);
        console.log(`   existe:   ${f ? `${pesos(f.billedTotal)} · ${f.status} · venta=${f.orderId || 'ninguna'} · ${f.sourceFile}` : 'NO — ya no está'}`);
        console.log(`   hermana:  ${r ? `${r.labOrderNumber} · ${pesos(r.billedTotal)} · ${r.status} · ${r.cliente || 'sin venta'}` : 'NO EXISTE'}`);
        if (!f) console.log('   AVISO: nada que borrar');
        else if (f.orderId) console.log('   AVISO: esta fila TIENE venta asignada: NO se borra');
        else if (!r || !r.orderId) console.log('   AVISO: la hermana no existe o no tiene venta: NO se borra (se perdería la factura)');
        else { console.log(`   OK: se puede borrar, la factura ya está cubierta por ${r.labOrderNumber} (${r.cliente})`); borrables.push({ ...g, f, r }); }
        console.log();
    }

    // ── 3) DUPLICADOS DE SERIE PELADA (ninguna con venta) ─────────────────
    console.log('═══ BORRAR LA FILA DE SERIE PELADA ═══\n');
    const pelados = [];
    for (const d of DUPLICADOS_SIN_VENTA) {
        const [b] = await prisma.$queryRaw`
            select id, "labOrderNumber", "billedTotal", "orderId", "sourceFile"
            from "LabCostEntry" where lab = ${LAB} and "labOrderNumber" = ${d.borrar}`;
        const [c] = await prisma.$queryRaw`
            select id, "labOrderNumber", "billedTotal", "orderId", "sourceFile"
            from "LabCostEntry" where lab = ${LAB} and "labOrderNumber" = ${d.conservar}`;
        console.log(`serie pelada "${d.borrar}"`);
        console.log(`   borrar:    ${b ? `${pesos(b.billedTotal)} · ${b.sourceFile} · venta=${b.orderId || 'ninguna'}` : 'NO existe'}`);
        console.log(`   conservar: ${c ? `${pesos(c.billedTotal)} · ${c.sourceFile} · venta=${c.orderId || 'ninguna'}` : 'NO existe'}`);
        if (!b || !c) console.log('   AVISO: falta una de las dos, no se toca nada');
        else if (b.orderId) console.log('   AVISO: la fila a borrar TIENE venta asignada, no se toca');
        else if (b.sourceFile !== c.sourceFile) console.log('   AVISO: no son la misma factura, no se toca');
        else { console.log('   OK: misma factura, ninguna asignada; se borra la de serie pelada'); pelados.push({ ...d, b, c }); }
        console.log();
    }

    // ── 4) ANOTACIONES sobre los viejos ───────────────────────────────────
    console.log('═══ ANOTAR LOS HUÉRFANOS VIEJOS ═══\n');
    const anotar = [];
    for (const a of ANOTACIONES) {
        const [e] = await prisma.$queryRaw`
            select id, "labOrderNumber", notes, "billedTotal", status
            from "LabCostEntry" where lab = ${LAB} and "labOrderNumber" = ${a.pedido}`;
        if (!e) { console.log(`  ${a.pedido.padEnd(9)} AVISO: ya no existe esa entrada`); continue; }
        if ((e.notes || '').includes(MARCA_REVISION)) { console.log(`  ${a.pedido.padEnd(9)} ya estaba anotado`); continue; }
        console.log(`  ${a.pedido.padEnd(9)} ${pesos(e.billedTotal).padStart(12)} [${e.status}] → "${a.nota.slice(0, 70)}…"`);
        anotar.push({ ...a, entrada: e });
    }
    console.log();

    console.log(`RESUMEN: ${listas.length} factura(s) a asignar · ${borrables.length} duplicada(s) a borrar · ${pelados.length} serie pelada a borrar · ${anotar.length} anotación(es)\n`);
    if (!APLICAR) { console.log('Ensayo terminado. Nada se escribió.'); return; }

    for (const p of listas) {
        // Un reproceso no entra al cruce de costo: con importe cargado va OK,
        // igual que decide cost-matching.ts. El resto queda PENDING para que la
        // conciliación le calcule la diferencia en la próxima pasada.
        const estado = p.postventa ? 'OK' : 'PENDING';
        const nota = [p.notaPostventa, `Pedido asignado a mano el ${HOY} (${p.fuente}). ${FIRMA}.`]
            .filter(Boolean).join(' ');
        if (p.entrada) {
            await prisma.$executeRaw`
                update "LabCostEntry"
                set "labOrderNumber" = ${p.pedido}, "orderId" = ${p.venta.id},
                    "billedTotal" = ${p.importe}, "sourceFile" = ${`FA_${p.factura}.pdf`},
                    notes = ${nota}, status = ${estado}, "updatedAt" = now()
                where id = ${p.entrada.id}`;
        } else {
            await prisma.$executeRaw`
                insert into "LabCostEntry" (id, lab, "labOrderNumber", "orderId", "billedTotal",
                    source, "sourceFile", status, notes, "createdAt", "updatedAt")
                values (gen_random_uuid()::text, ${LAB}, ${p.pedido}, ${p.venta.id}, ${p.importe},
                    'MANUAL', ${`FA_${p.factura}.pdf`}, ${estado}, ${nota}, now(), now())`;
        }
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'ORDER', ${p.venta.id},
                ${JSON.stringify({ factura: p.factura, pedido: p.pedido, importe: p.importe, fuente: p.fuente })}::jsonb, now())`;
        console.log(`  asignada ${p.factura} → ${p.pedido} (${p.venta.cliente})`);
    }

    for (const b of borrables) {
        await prisma.$executeRaw`delete from "LabCostEntry" where id = ${b.f.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'DELETE', 'ORDER', ${b.r.orderId},
                ${JSON.stringify({ borrada: b.fantasma, motivo: 'duplicado de la factura ya asignada', cubiertaPor: b.real })}::jsonb, now())`;
        console.log(`  borrada la fila duplicada "${b.fantasma}" (la cubre ${b.real})`);
    }

    for (const d of pelados) {
        await prisma.$executeRaw`delete from "LabCostEntry" where id = ${d.b.id}`;
        console.log(`  borrada la fila de serie pelada "${d.borrar}" (queda "${d.conservar}", misma factura)`);
    }

    for (const a of anotar) {
        const nueva = [a.entrada.notes, `${MARCA_REVISION} ${a.nota}`].filter(Boolean).join(' ');
        await prisma.$executeRaw`
            update "LabCostEntry" set notes = ${nueva}, "updatedAt" = now() where id = ${a.entrada.id}`;
        console.log(`  anotado el pedido ${a.pedido}`);
    }

    console.log('\nListo.');
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
