// PRODUCCIÓN — Corrección de la familia Kriptock Invisible (27/8):
//  1) El costo cargado era el PELADO de lista: falta el calibrado de Grupo
//     Óptico ($7.000, IVA 0). Regla del sistema (src/lib/lens-cost.ts):
//     cost = (baseCost + calibrado) × (1 + IVA). Se guarda baseCost = pelado
//     y cost = pelado + 7.000.
//  2) Markup real de Ishtar: fotocromático $105.715 (costo final) → $311.000
//     = factor 2,9418 sobre el costo final, para TODA la familia (ref exacta).
//  3) Rename: "Bifocal Kriptock Invisible - ..." (pedido: que diga Kriptock
//     Invisible; el índice ya va en nombre y en lensIndex).
// Uso: node corregir-bifocales-invisibles.mjs [--aplicar]
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('/Users/ishtarpissano/proyectos/atelier/package.json')
const { PrismaClient } = require('@prisma/client')
const m = readFileSync('/Users/ishtarpissano/proyectos/atelier/.env', 'utf8').match(/^PROD_DATABASE_URL=["']?([^"'\n]+)/m)
const prisma = new PrismaClient({ datasources: { db: { url: m[1] } } })
const aplicar = process.argv.includes('--aplicar')

const CALIBRADO = 7000 // LaboratoryConfig GRUPO OPTICO (IVA 0)
const REF_PELADO = 98715
const REF_PRECIO = 311000
const FACTOR = REF_PRECIO / (REF_PELADO + CALIBRADO) // 2.9418...

const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, cost FROM "Product" WHERE name LIKE 'Bifocal Invisible Kriptock%' ORDER BY name`)
console.log(`Filas a corregir: ${rows.length} · factor ${FACTOR.toFixed(4)} sobre costo final (pelado + $${CALIBRADO.toLocaleString('es-AR')})\n`)

for (const r of rows) {
    const pelado = r.cost // lo cargado era el pelado de lista
    const costoFinal = pelado + CALIBRADO
    const precio = pelado === REF_PELADO
        ? REF_PRECIO
        : Math.round((costoFinal * FACTOR) / 1000) * 1000
    const nombreNuevo = r.name.replace('Bifocal Invisible Kriptock', 'Bifocal Kriptock Invisible')

    console.log(`${aplicar ? '✔' : '[sim]'} ${nombreNuevo}`)
    console.log(`      pelado $${pelado.toLocaleString('es-AR')} + calibrado → costo $${costoFinal.toLocaleString('es-AR')} → precio $${precio.toLocaleString('es-AR')}`)
    if (!aplicar) continue

    await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET name = $1, "baseCost" = $2, cost = $3, price = $4, "updatedAt" = NOW() WHERE id = $5`,
        nombreNuevo, pelado, costoFinal, precio, r.id)
}

console.log(aplicar ? '\nListo.' : '\nSimulación — usar --aplicar.')
await prisma.$disconnect()
