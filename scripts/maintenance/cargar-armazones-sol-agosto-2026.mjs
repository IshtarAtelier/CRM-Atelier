// Carga masiva de armazones de sol (agosto 2026).
// Crea un producto genérico por marca (patrón "Lentes de sol las oreiro"):
// category "Lentes de Sol", publishToWeb false, stock agrupado por marca.
//
// Uso:
//   node scripts/maintenance/cargar-armazones-sol-agosto-2026.mjs            → dry-run (no escribe)
//   node scripts/maintenance/cargar-armazones-sol-agosto-2026.mjs --apply    → escribe contra DATABASE_URL (base LOCAL)
//   DATABASE_URL="$PROD_DATABASE_URL" node ... --apply                       → escribe contra producción (solo con OK explícito)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const ITEMS = [
  { brand: 'Reef', stock: 12, price: 180000, cost: 40000 },
  { brand: 'Mormai', stock: 2, price: 160000, cost: 40000 },
  { brand: 'Pr Desing', stock: 2, price: 180000, cost: 40000 },
  { brand: 'Philippe R', stock: 2, price: 180000, cost: 40000 },
  { brand: 'Pierre Cardin', stock: 1, price: 170000, cost: 40000 },
  { brand: 'Karun', stock: 1, price: 260000, cost: 40000 },
  { brand: 'Mistral', stock: 3, price: 180000, cost: 40000 },
  { brand: 'Cima', stock: 2, price: 150000, cost: 40000 },
  { brand: 'Mito', stock: 1, price: 140000, cost: 40000 },
  { brand: 'Hannover', stock: 1, price: 150000, cost: 40000 },
  { brand: 'Usual', stock: 6, price: 90000, cost: 40000 },
  { brand: 'Atelier', stock: 19, price: 90000, cost: 40000 },
  { brand: 'Up', stock: 6, price: 180000, cost: 40000 },
  { brand: 'Tiffany', stock: 4, price: 220000, cost: 40000 },
]

async function main() {
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^:/]+)/)?.[1] || '???'
  console.log(`Base destino: ${dbHost} — modo: ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo muestra)'}\n`)

  for (const item of ITEMS) {
    const name = `Lentes de sol ${item.brand}`
    // No duplicar si ya existe un genérico igual (mismo nombre, misma categoría)
    const existing = await prisma.product.findFirst({
      where: { name, category: 'Lentes de Sol' },
      select: { id: true, stock: true, price: true, cost: true },
    })
    if (existing) {
      console.log(`YA EXISTE  ${name} (id ${existing.id}, stock ${existing.stock}) — no se toca`)
      continue
    }
    console.log(
      `CREAR      ${name.padEnd(30)} stock ${String(item.stock).padStart(2)}  $${item.price.toLocaleString('es-AR')}  costo $${item.cost.toLocaleString('es-AR')}`
    )
    if (APPLY) {
      await prisma.product.create({
        data: {
          name,
          brand: item.brand,
          model: 'Sol',
          category: 'Lentes de Sol',
          type: 'Lentes de Sol',
          stock: item.stock,
          price: item.price,
          cost: item.cost,
          unitType: 'UNIDAD',
          publishToWeb: false,
          publishToWholesale: false,
          wholesalePrice: 0,
        },
        select: { id: true },
      })
    }
  }
  console.log(`\n${APPLY ? 'Listo.' : 'Dry-run terminado — nada se escribió.'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
