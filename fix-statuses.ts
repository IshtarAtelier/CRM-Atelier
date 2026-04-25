import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Read .env manually
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlMatch = envContent.match(/PROD_DATABASE_URL="?([^"\n]+)"?/);
    if (dbUrlMatch) {
        process.env.DATABASE_URL = dbUrlMatch[1];
    }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
    console.log('Usando DB:', process.env.DATABASE_URL?.split('@')[1]);
    console.log('Buscando contactos con ventas pero estado incorrecto...');
    
    const contactsToFix = await prisma.client.findMany({
        where: {
            status: { in: ['CONTACT', 'CONFIRMED'] },
            orders: { some: { orderType: 'SALE', isDeleted: false } }
        },
        select: { id: true, name: true, status: true }
    });
    
    console.log(`Encontrados ${contactsToFix.length} contactos para corregir:`);
    console.log(contactsToFix);

    if (contactsToFix.length > 0) {
        console.log('Actualizando estado a CLIENT...');
        let count = 0;
        for (const c of contactsToFix) {
            await prisma.client.update({
                where: { id: c.id },
                data: { status: 'CLIENT' }
            });
            count++;
        }
        console.log(`Se actualizaron ${count} contactos.`);
    } else {
        console.log('No hay contactos para corregir.');
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
