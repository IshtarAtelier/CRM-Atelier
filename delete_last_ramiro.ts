import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Conectado a la base de datos de producción...');
  
  // Buscar el contacto exacto indicado por el número de teléfono
  const exactPhone = "54 9 11 4029-2565";
  const nameQuery = "Ramiro gomez";

  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { phone: exactPhone },
        { phone: "5491140292565" },
        { name: { contains: "ramiro", mode: 'insensitive' } }
      ]
    }
  });

  const exactMatch = clients.find(c => c.phone === exactPhone || c.phone?.replace(/\s+/g, '') === exactPhone.replace(/\s+/g, ''));

  if (!exactMatch) {
    console.log(`No se encontró el contacto exacto con el teléfono ${exactPhone}.`);
    console.log("Contactos encontrados con 'ramiro':", clients);
    return;
  }

  console.log("\nSe encontró el contacto exacto a eliminar:");
  console.log(` -> Nombre: ${exactMatch.name}`);
  console.log(` -> Tel: ${exactMatch.phone}`);
  console.log(` -> ID: ${exactMatch.id}`);

  // Confirmar eliminación
  await prisma.client.delete({
    where: { id: exactMatch.id }
  });

  console.log("\n✅ Contacto eliminado de la base de datos de producción exitosamente.");
}

main()
  .catch(e => {
    console.error('Error durante la ejecución:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
