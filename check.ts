import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
    }
  }
})
async function main() {
  const result = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Order';`
  console.log(result)
}
main()
