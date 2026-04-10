const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando eliminación de clientes ---');
    
    // Buscar clientes por nombre aproximado o exacto
    const targets = ['ishtar', 'test'];
    
    for (const name of targets) {
        // En SQLite no hay mode: insensitive en Prisma, así que buscamos exacto o convertimos a minúsculas en la query si fuera necesario, 
        // pero aquí buscaremos los que coincidan.
        const clients = await prisma.client.findMany({
            where: {
                name: {
                    contains: name
                }
            }
        });
        
        console.log(`Encontrados ${clients.length} clientes que coinciden con "${name}"`);
        
        for (const client of clients) {
            console.log(`Eliminando cliente: ${client.name} (ID: ${client.id})`);
            await prisma.client.delete({
                where: { id: client.id }
            });
            console.log(`✓ Cliente ${client.name} eliminado.`);
        }
    }
}

main()
    .catch((e) => {
        console.error('Error durante la eliminación:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
