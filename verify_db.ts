import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Verificando columnas en la base de datos...')
  try {
    const contact = await prisma.client.findFirst({
      include: {
        orders: {
          take: 1,
          select: {
            id: true,
            labPrismOD: true, // Una de las columnas posiblemente faltantes
          }
        }
      }
    })
    console.log('Conexión y consulta exitosa. La columna labPrismOD existe.')
  } catch (e: any) {
    if (e.code === 'P2025' || e.message.includes('column') || e.message.includes('does not exist')) {
      console.error('Error: La columna labPrismOD NO existe en la base de datos.')
    } else {
      console.error('Error inesperado:', e.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
