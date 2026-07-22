/**
 * "Importado" no es un canal de captación: son los clientes que entraron con la
 * migración del sistema anterior, o sea que YA eran clientes. Figurando como un
 * origen aparte ensuciaban el gráfico de desempeño por etiqueta del dashboard
 * (que agrupa por `Client.contactSource`), inventando un canal que nunca existió.
 *
 * Este script los pasa a "Ya es Cliente", el valor canónico que ya devuelve
 * `normalizeContactSource()`. No toca etiquetas: los 495 clientes "Importado"
 * ya tienen conectada la etiqueta "Ya es cliente".
 *
 * Antes de escribir guarda un archivo de reversa con los IDs y el valor viejo,
 * así el cambio se puede deshacer tal cual estaba.
 *
 *   DRY RUN:  node scripts/maintenance/importado-a-ya-es-cliente.js --prod
 *   APLICAR:  node scripts/maintenance/importado-a-ya-es-cliente.js --prod --commit
 *   DESHACER: node scripts/maintenance/importado-a-ya-es-cliente.js --prod --revertir <archivo.json>
 *
 * Sin --prod corre contra la base local. --prod toma PROD_DATABASE_URL del .env
 * (nunca hace falta pasar la credencial por línea de comandos).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const COMMIT = process.argv.includes('--commit');
const PROD = process.argv.includes('--prod');
const REVERTIR = process.argv.includes('--revertir')
    ? process.argv[process.argv.indexOf('--revertir') + 1]
    : null;

if (PROD && !process.env.PROD_DATABASE_URL) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}
const prisma = PROD
    ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
    : new PrismaClient();

const DESTINO = 'Ya es Cliente';
// Las variantes con las que quedó cargado el origen en la migración.
const ORIGENES = ['Importado', 'importado', 'IMPORTADO', 'Importados', 'importados'];

async function revertir(archivo) {
    const ruta = path.resolve(archivo);
    if (!fs.existsSync(ruta)) {
        console.error(`No existe el archivo de reversa: ${ruta}`);
        process.exit(1);
    }
    const backup = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    console.log(`Base: ${PROD ? 'PRODUCCIÓN' : 'local'} · ${backup.clientes.length} clientes a restaurar`);
    if (!COMMIT) {
        console.log('DRY RUN — agregá --commit para escribir.');
        return;
    }
    let hechos = 0;
    for (const c of backup.clientes) {
        await prisma.client.update({
            where: { id: c.id },
            data: { contactSource: c.contactSourceAnterior },
        });
        hechos++;
    }
    console.log(`Restaurados: ${hechos}`);
}

async function main() {
    if (REVERTIR) return revertir(REVERTIR);

    console.log(`Base: ${PROD ? '🔴 PRODUCCIÓN' : 'local'}`);

    const clientes = await prisma.client.findMany({
        where: { contactSource: { in: ORIGENES } },
        select: { id: true, name: true, contactSource: true },
    });

    if (clientes.length === 0) {
        console.log('No quedan clientes con origen "Importado". Nada que hacer.');
        return;
    }

    const porValor = {};
    for (const c of clientes) {
        porValor[c.contactSource] = (porValor[c.contactSource] || 0) + 1;
    }
    console.log(`\n${clientes.length} clientes a pasar a "${DESTINO}":`);
    for (const [valor, cantidad] of Object.entries(porValor)) {
        console.log(`  "${valor}" → "${DESTINO}"  (${cantidad})`);
    }
    console.log(`\nEjemplos: ${clientes.slice(0, 5).map(c => c.name).join(' · ')}`);

    if (!COMMIT) {
        console.log('\nDRY RUN — no se escribió nada. Agregá --commit para aplicar.');
        return;
    }

    const archivo = path.resolve(
        __dirname,
        `reversa-importado-${PROD ? 'prod' : 'local'}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`
    );
    fs.writeFileSync(archivo, JSON.stringify({
        fecha: new Date().toISOString(),
        base: PROD ? 'produccion' : 'local',
        clientes: clientes.map(c => ({ id: c.id, contactSourceAnterior: c.contactSource })),
    }, null, 2));
    console.log(`\nReversa guardada en: ${archivo}`);

    const res = await prisma.client.updateMany({
        where: { contactSource: { in: ORIGENES } },
        data: { contactSource: DESTINO },
    });
    console.log(`Actualizados: ${res.count}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
