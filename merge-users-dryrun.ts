import { PrismaClient } from '@prisma/client';

const DUPLICATE_ID = 'cmmwlfha70001rpd40a903w54';  // "Matías" (duplicado)
const KEEP_ID      = 'cmmukkygj003vgc7t33nkx0vi';  // "Matias Turchi" (correcto)
const YANI_ID      = 'cmo3qhsxi0000xhdpb99yafoj';  // "Yani" (a eliminar)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
    }
  }
});

async function main() {
    // 1. Count records to transfer
    const dupOrders = await prisma.order.count({ where: { userId: DUPLICATE_ID } });
    const dupCashMovements = await prisma.cashMovement.count({ where: { userId: DUPLICATE_ID } });
    const dupAuditLogs = await prisma.auditLog.count({ where: { userId: DUPLICATE_ID } });

    console.log(`\n=== RECORDS TO TRANSFER (Matías → Matias Turchi) ===`);
    console.log(`  Orders:         ${dupOrders}`);
    console.log(`  CashMovements:  ${dupCashMovements}`);
    console.log(`  AuditLogs:      ${dupAuditLogs}`);

    // Check Yani records
    const yaniOrders = await prisma.order.count({ where: { userId: YANI_ID } });
    const yaniCashMovements = await prisma.cashMovement.count({ where: { userId: YANI_ID } });
    const yaniAuditLogs = await prisma.auditLog.count({ where: { userId: YANI_ID } });

    console.log(`\n=== YANI RECORDS ===`);
    console.log(`  Orders:         ${yaniOrders}`);
    console.log(`  CashMovements:  ${yaniCashMovements}`);
    console.log(`  AuditLogs:      ${yaniAuditLogs}`);

    if (yaniOrders > 0 || yaniCashMovements > 0) {
        console.log(`\n⚠️  Yani has records! Cannot delete without transferring.`);
    }

    // Show all users before
    const usersBefore = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
    console.log(`\n=== USERS BEFORE ===`);
    usersBefore.forEach(u => console.log(`  ${u.name} (${u.email}) - ${u.id}`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
