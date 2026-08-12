// ────────────────────────────────────────────────────────────────────────────
// Consolida las 397 etiquetas que fabricó la IA antes del saneo del 12/8/2026
// (addTagToClient creaba una etiqueta nueva con CUALQUIER texto, incluidas
// oraciones enteras). Tres pasadas:
//   1. BORRA etiquetas-oración (nombre > 40 chars): son resúmenes, no etiquetas.
//   2. FUSIONA duplicados que solo difieren en mayúsculas ("Clipones"/"clipones")
//      en la variante con más clientes.
//   3. FUSIONA sinónimos evidentes vía mapa explícito y conservador (singular/
//      plural y familia Clip-On). Nada de fusiones "inteligentes".
// En todos los casos: los vínculos cliente-etiqueta se mueven a la etiqueta
// destino y los chatLabels de los chats se reescriben para que los chips del
// panel muestren lo mismo que la ficha.
//
// ⚠️ ESCRIBE en la base que diga ETIQUETAS_DB_URL (o DATABASE_URL). Por defecto
// SIMULA; solo ejecuta con --aplicar.
//
//   ETIQUETAS_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//     scripts/maintenance/consolidar-etiquetas.mjs [--aplicar]
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.ETIQUETAS_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const aplicar = process.argv.includes('--aplicar');
const prisma = new PrismaClient({ datasources: { db: { url } } });

console.log(`\n— Consolidación de etiquetas (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}) —\n`);

// Etiquetas operativas que NO se tocan pase lo que pase (automatizaciones,
// atribución de campañas, flujo del bot).
const INTOCABLES = new Set(['Ocusis', 'Meta Ads', 'Google Ads', 'Ya es cliente', 'Bot Lead',
    'Sin Seguimiento', 'Factura', 'Calle', 'Seguimiento 1'].map(n => n.toLowerCase()));
const esIntocable = (n) => INTOCABLES.has(n.toLowerCase()) || n.toLowerCase().startsWith('meta ·');

// Sinónimos evidentes → canónica. Solo lo indiscutible.
const SINONIMOS = new Map(Object.entries({
    'multifocal': 'Multifocales',
    'lentes multifocales': 'Multifocales',
    'armazón': 'Armazones',
    'armazon': 'Armazones',
    'monofocal': 'Monofocales',
    'bifocal': 'Bifocales',
    'lentes bifocales': 'Bifocales',
    'clipones': 'Clip-On',
    'anteojos clipones': 'Clip-On',
    'anteojos clip-on': 'Clip-On',
    'clip on': 'Clip-On',
    'clip-on': 'Clip-On',
    'lentes clip on': 'Clip-On',
    'lentes clip-on': 'Clip-On',
}));

const tags = await prisma.tag.findMany({
    select: { id: true, name: true, _count: { select: { clients: true } } },
});
const clientes = (t) => t._count.clients;

// destinoDe: id de etiqueta → { id, name } destino (o null = borrar sin destino)
const acciones = []; // { srcId, srcName, destId?, destName?, motivo }
const porNombre = new Map(tags.map(t => [t.name, t]));

// Paso 1: oraciones
for (const t of tags) {
    if (esIntocable(t.name)) continue;
    if (t.name.length > 40) acciones.push({ srcId: t.id, srcName: t.name, motivo: 'oración' });
}

// Paso 2: colisiones case-insensitive → gana la de más clientes
const porLower = new Map();
for (const t of tags) {
    if (t.name.length > 40) continue;
    const k = t.name.toLowerCase();
    if (!porLower.has(k)) porLower.set(k, []);
    porLower.get(k).push(t);
}
for (const grupo of porLower.values()) {
    if (grupo.length < 2) continue;
    const [ganadora, ...resto] = grupo.slice().sort((a, b) => clientes(b) - clientes(a));
    for (const t of resto) {
        if (esIntocable(t.name)) continue;
        acciones.push({ srcId: t.id, srcName: t.name, destId: ganadora.id, destName: ganadora.name, motivo: 'mayúsculas' });
    }
}

// Paso 3: sinónimos explícitos
const yaMovidas = new Set(acciones.map(a => a.srcId));
for (const t of tags) {
    if (yaMovidas.has(t.id) || esIntocable(t.name)) continue;
    const canonica = SINONIMOS.get(t.name.toLowerCase());
    if (!canonica || canonica.toLowerCase() === t.name.toLowerCase()) continue;
    let dest = porNombre.get(canonica);
    if (!dest) continue; // la canónica no existe: no inventamos etiquetas acá
    acciones.push({ srcId: t.id, srcName: t.name, destId: dest.id, destName: dest.name, motivo: 'sinónimo' });
}

const borrarSolas = acciones.filter(a => !a.destId);
const fusiones = acciones.filter(a => a.destId);
console.log(`Etiquetas-oración a borrar: ${borrarSolas.length}`);
console.log(`Fusiones (variante → canónica): ${fusiones.length}`);
for (const a of fusiones.slice(0, 20)) console.log(`  "${a.srcName}" → "${a.destName}" (${a.motivo})`);
if (fusiones.length > 20) console.log(`  … y ${fusiones.length - 20} más`);
console.log(`\nQuedarían: ${tags.length - acciones.length} etiquetas (hoy: ${tags.length})`);

if (aplicar) {
    // Mapa nombreViejo → nombreNuevo (o null) para reescribir chatLabels.
    // Resuelto TRANSITIVAMENTE: "Lentes Bifocales" → "Lentes bifocales" (por
    // mayúsculas) y esa a su vez → "Bifocales" (sinónimo); sin seguir la
    // cadena, el chip quedaría apuntando a un nombre recién borrado.
    const renombres = new Map();
    for (const a of acciones) renombres.set(a.srcName, a.destName ?? null);
    for (const [viejo] of renombres) {
        let destino = renombres.get(viejo);
        const visitados = new Set([viejo]);
        while (destino !== null && renombres.has(destino) && !visitados.has(destino)) {
            visitados.add(destino);
            destino = renombres.get(destino);
        }
        renombres.set(viejo, destino);
    }

    for (const a of acciones) {
        if (a.destId) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "_ClientToTag" ("A","B") SELECT "A", $1 FROM "_ClientToTag" WHERE "B" = $2 ON CONFLICT DO NOTHING`
                    .replace('$1', `'${a.destId}'`).replace('$2', `'${a.srcId}'`)
            );
        }
        await prisma.$executeRawUnsafe(`DELETE FROM "_ClientToTag" WHERE "B" = '${a.srcId}'`);
        await prisma.tag.delete({ where: { id: a.srcId } }).catch(() => {});
    }

    // chatLabels: reescribir los chips que muestran el panel
    const chats = await prisma.whatsAppChat.findMany({
        where: { chatLabels: { hasSome: [...renombres.keys()] } },
        select: { id: true, chatLabels: true },
    });
    for (const c of chats) {
        const nuevo = [...new Set((c.chatLabels || [])
            .map(l => renombres.has(l) ? renombres.get(l) : l)
            .filter(Boolean))];
        await prisma.whatsAppChat.update({ where: { id: c.id }, data: { chatLabels: nuevo } });
    }
    console.log(`\n✅ Aplicado: ${borrarSolas.length} borradas, ${fusiones.length} fusionadas, ${chats.length} chats reescritos.`);
} else {
    console.log('\n(simulacro: nada se tocó — correr con --aplicar para ejecutar)');
}
await prisma.$disconnect();
console.log('');
