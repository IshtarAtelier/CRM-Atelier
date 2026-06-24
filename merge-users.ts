import { PrismaClient } from '@prisma/client';

/**
 * Script de migración: Unificar usuarios duplicados de Matías
 * 
 * Acciones:
 * 1. Transferir TODAS las órdenes de "Matías" → "Matias Turchi"
 * 2. Transferir TODOS los movimientos de caja de "Matías" → "Matias Turchi"  
 * 3. Transferir TODOS los audit logs de "Matías" → "Matias Turchi"
 * 4. Eliminar usuario "Yani" (sin registros asociados)
 * 5. Eliminar usuario "Matías" (duplicado, ya sin registros)
 * 
 * Todo se ejecuta dentro de una transacción interactiva.
 * Si algo falla, se revierte TODO automáticamente.
 */

const DUPLICATE_ID = 'cmmwlfha70001rpd40a903w54';  // "Matías" (duplicado a eliminar)
const KEEP_ID      = 'cmmukkygj003vgc7t33nkx0vi';  // "Matias Turchi" (se conserva)
const YANI_ID      = 'cmo3qhsxi0000xhdpb99yafoj';  // "Yani" (a eliminar)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
    }
  }
});

async function main() {
    console.log('=== INICIO DE MIGRACIÓN ===\n');

    // Pre-check: verify both users exist
    const duplicateUser = await prisma.user.findUnique({ where: { id: DUPLICATE_ID } });
    const keepUser = await prisma.user.findUnique({ where: { id: KEEP_ID } });
    const yaniUser = await prisma.user.findUnique({ where: { id: YANI_ID } });

    if (!duplicateUser) {
        console.error('❌ ERROR: Usuario duplicado "Matías" no encontrado. Abortando.');
        return;
    }
    if (!keepUser) {
        console.error('❌ ERROR: Usuario "Matias Turchi" no encontrado. Abortando.');
        return;
    }

    console.log(`Usuario duplicado: "${duplicateUser.name}" (${DUPLICATE_ID})`);
    console.log(`Usuario destino:   "${keepUser.name}" (${KEEP_ID})`);
    if (yaniUser) console.log(`Usuario a eliminar: "${yaniUser.name}" (${YANI_ID})`);
    console.log('');

    // Execute everything in a single transaction
    await prisma.$transaction(async (tx) => {
        // STEP 1: Transfer Orders
        const ordersResult = await tx.order.updateMany({
            where: { userId: DUPLICATE_ID },
            data: { userId: KEEP_ID }
        });
        console.log(`✅ Órdenes transferidas: ${ordersResult.count}`);

        // STEP 2: Transfer CashMovements
        const cashResult = await tx.cashMovement.updateMany({
            where: { userId: DUPLICATE_ID },
            data: { userId: KEEP_ID }
        });
        console.log(`✅ Movimientos de caja transferidos: ${cashResult.count}`);

        // STEP 3: Transfer AuditLogs
        const auditResult = await tx.auditLog.updateMany({
            where: { userId: DUPLICATE_ID },
            data: { userId: KEEP_ID }
        });
        console.log(`✅ Audit logs transferidos: ${auditResult.count}`);

        // STEP 4: Verify no records remain on duplicate
        const remainingOrders = await tx.order.count({ where: { userId: DUPLICATE_ID } });
        const remainingCash = await tx.cashMovement.count({ where: { userId: DUPLICATE_ID } });
        const remainingAudit = await tx.auditLog.count({ where: { userId: DUPLICATE_ID } });

        if (remainingOrders > 0 || remainingCash > 0 || remainingAudit > 0) {
            throw new Error(
                `❌ ABORTAR: Aún quedan registros en el usuario duplicado: ` +
                `Orders=${remainingOrders}, Cash=${remainingCash}, Audit=${remainingAudit}`
            );
        }
        console.log(`✅ Verificación: 0 registros restantes en usuario duplicado`);

        // STEP 5: Delete Yani (no records)
        if (yaniUser) {
            // Double-check Yani has no records
            const yaniOrders = await tx.order.count({ where: { userId: YANI_ID } });
            const yaniCash = await tx.cashMovement.count({ where: { userId: YANI_ID } });
            if (yaniOrders > 0 || yaniCash > 0) {
                throw new Error(
                    `❌ ABORTAR: Yani tiene registros asociados: Orders=${yaniOrders}, Cash=${yaniCash}`
                );
            }
            // Audit logs for Yani: set userId to null (onDelete: SetNull in schema)
            const yaniAuditResult = await tx.auditLog.updateMany({
                where: { userId: YANI_ID },
                data: { userId: null }
            });
            if (yaniAuditResult.count > 0) {
                console.log(`✅ Audit logs de Yani desvinculados: ${yaniAuditResult.count}`);
            }

            await tx.user.delete({ where: { id: YANI_ID } });
            console.log(`✅ Usuario "Yani" eliminado`);
        }

        // STEP 6: Delete duplicate Matías
        await tx.user.delete({ where: { id: DUPLICATE_ID } });
        console.log(`✅ Usuario duplicado "Matías" eliminado`);

        // STEP 7: Fix email conflict - the duplicate had email "matias" (lowercase)
        // and Matias Turchi has email "Matias" (uppercase). Let's normalize.
        await tx.user.update({
            where: { id: KEEP_ID },
            data: { email: 'matias' }
        });
        console.log(`✅ Email de "Matias Turchi" normalizado a "matias"`);

    }, {
        timeout: 30000, // 30 second timeout for the transaction
    });

    console.log('\n=== MIGRACIÓN COMPLETADA ===\n');

    // Post-migration verification
    const usersAfter = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
    });
    console.log('Usuarios restantes:');
    usersAfter.forEach(u => console.log(`  ✅ ${u.name} (${u.email})`));

    const matiasOrders = await prisma.order.count({ where: { userId: KEEP_ID } });
    console.log(`\nTotal órdenes de Matias Turchi: ${matiasOrders}`);
}

main()
    .catch(e => {
        console.error('\n❌ ERROR EN MIGRACIÓN (todo fue revertido):');
        console.error(e);
    })
    .finally(async () => await prisma.$disconnect());
