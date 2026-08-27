// PRODUCCIÓN — Alta de la familia Bifocal Digital Invisible «Kriptock Invisible»
// de Grupo Óptico (lista 10/8/2026, precios POR PAR sin IVA = costo del CRM).
// Markup definido por Ishtar 27/8: fotocromático gris $98.715 → $311.000
// (factor 3,1505...). Mismo factor para toda la familia, redondeado al millar
// (el de referencia queda exacto en $311.000).
// Uso: node alta-bifocales-invisibles.mjs [--aplicar]
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('/Users/ishtarpissano/proyectos/atelier/package.json')
const { PrismaClient } = require('@prisma/client')
const m = readFileSync('/Users/ishtarpissano/proyectos/atelier/.env', 'utf8').match(/^PROD_DATABASE_URL=["']?([^"'\n]+)/m)
const prisma = new PrismaClient({ datasources: { db: { url: m[1] } } })
const aplicar = process.argv.includes('--aplicar')

const FACTOR = 311000 / 98715

const familia = [
  { nombre: 'Orgánico Blanco 1.49', indice: '1.49', costo: 62687 },
  { nombre: 'Orgánico Blanco 1.49 con AR Essential', indice: '1.49', costo: 84968 },
  { nombre: 'Orgánico Blanco Alto Índice 1.60', indice: '1.60', costo: 80069 },
  { nombre: 'Orgánico Blanco Alto Índice 1.60 con AR Essential', indice: '1.60', costo: 102350 },
  { nombre: 'Orgánico Alto Índice 1.67', indice: '1.67', costo: 122934 },
  { nombre: 'Orgánico Blue Light 1.56', indice: '1.56', costo: 72959 },
  { nombre: 'Orgánico Blue Light 1.56 con AR Essential', indice: '1.56', costo: 95240 },
  { nombre: 'Orgánico Super Blue Light 1.60', indice: '1.60', costo: 140604 },
  { nombre: 'Orgánico Super Blue Light 1.60 con AR Essential', indice: '1.60', costo: 162885 },
  { nombre: 'Orgánico Blue Light 1.67', indice: '1.67', costo: 180504 },
  { nombre: 'Orgánico Fotocromático Gris 1.56', indice: '1.56', costo: 98715, precioFijo: 311000 },
  { nombre: 'Orgánico Fotocromático Gris 1.56 con AR Essential', indice: '1.56', costo: 120996 },
  { nombre: 'Orgánico Fotocromático Blue Light Grey 1.56', indice: '1.56', costo: 138204 },
  { nombre: 'Orgánico Fotocromático Blue Light 1.56 con AR Essential', indice: '1.56', costo: 160485 },
  { nombre: 'Policarbonato Blanco 1.59', indice: '1.59', costo: 88814 },
  { nombre: 'Policarbonato Blue Light 1.59', indice: '1.59', costo: 157440 },
  { nombre: 'Policarbonato Fotocromático 1.59', indice: '1.59', costo: 185130 },
]

const rand = n => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

let creados = 0, salteados = 0
for (const f of familia) {
  const nombreCompleto = `Bifocal Invisible Kriptock - ${f.nombre}`
  const precio = f.precioFijo ?? Math.round((f.costo * FACTOR) / 1000) * 1000

  const existe = await prisma.$queryRawUnsafe(
    `SELECT id, price, cost FROM "Product" WHERE name = $1 AND category = 'Cristal' LIMIT 1`, nombreCompleto)
  if (existe.length > 0) {
    console.log(`= ya existe: ${nombreCompleto} (precio actual $${existe[0].price.toLocaleString('es-AR')})`)
    salteados++
    continue
  }

  console.log(`${aplicar ? 'ALTA' : '[simulación] alta'}: ${nombreCompleto} — costo $${f.costo.toLocaleString('es-AR')} → precio $${precio.toLocaleString('es-AR')}`)
  if (!aplicar) continue

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Product"
       (id, name, category, type, laboratory, "lensIndex", "unitType", cost, price,
        "additionMin", "additionMax", "publishToWeb", "publishToWholesale", "wholesalePrice", "updatedAt")
     VALUES ($1, $2, 'Cristal', 'Cristal Bifocal', 'GRUPO OPTICO', $3, 'PAR', $4, $5,
        0.75, 3.5, false, false, 0, NOW())`,
    'cm' + rand(23), nombreCompleto, f.indice, f.costo, precio)
  creados++
}

console.log(`\n${aplicar ? 'Creados' : 'Para crear'}: ${familia.length - salteados} · ya existentes: ${salteados}`)
console.log(`Factor aplicado: ${FACTOR.toFixed(4)} (311.000 / 98.715)`)
await prisma.$disconnect()
