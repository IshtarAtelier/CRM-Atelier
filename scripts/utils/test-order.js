const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }});
  
  const client = await prisma.client.create({
    data: {
      name: 'Cliente Test Forma Armazon',
      phone: '1122334455',
      prescriptions: {
        create: [{
          sphereOD: 1.00, cylinderOD: -0.50, axisOD: 180,
          sphereOI: 1.25, cylinderOI: -0.25, axisOI: 90,
          prescriptionType: 'MULTIFOCAL'
        }]
      }
    }
  });

  const rx = await prisma.prescription.findFirst({ where: { clientId: client.id } });

  await prisma.order.create({
    data: {
      clientId: client.id,
      userId: admin.id,
      status: 'PENDING',
      orderType: 'SALE',
      total: 150000,
      paid: 150000,
      lensType: 'MULTIFOCAL',
      prescriptionId: rx.id,
      items: {
        create: [{
          quantity: 1,
          price: 150000,
          productNameSnapshot: 'Cristal Multifocal Premium'
        }]
      },
      payments: {
        create: [{
          amount: 150000,
          method: 'CASH'
        }]
      }
    }
  });

  console.log("Pedido creado exitosamente!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
