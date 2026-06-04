import { prisma } from '../src/lib/db';
import fs from 'fs';

async function listDuplicates() {
  const allClients = await prisma.client.findMany({
    select: { id: true, name: true, phone: true, dni: true, email: true, createdAt: true, orders: { select: { id: true } } }
  });

  const duplicateGroups: Record<string, any[]> = {};
  
  allClients.forEach(c => {
    let key = null;
    if (c.phone && c.phone.replace(/\D/g, '').length >= 8) {
      key = 'phone_' + c.phone.replace(/\D/g, '').slice(-8);
    } else if (c.dni && c.dni.trim().length > 0) {
      key = 'dni_' + c.dni.trim();
    } else if (c.email && c.email.trim().length > 0) {
      key = 'email_' + c.email.trim().toLowerCase();
    } else {
      key = 'name_' + c.name.trim().toLowerCase();
    }
    
    if (key) {
      if (!duplicateGroups[key]) duplicateGroups[key] = [];
      duplicateGroups[key].push(c);
    }
  });

  const exactDuplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
  
  let markdown = `# Listado de Fichas Duplicadas\n\nHay **${exactDuplicates.length}** grupos de fichas que comparten el mismo número de teléfono, DNI o Email.\n\n`;
  
  exactDuplicates.forEach((g, index) => {
    markdown += `### Grupo ${index + 1}\n`;
    g.forEach(c => {
      const date = new Date(c.createdAt).toLocaleDateString('es-AR');
      const sales = c.orders.length;
      markdown += `- **${c.name}**\n  - Teléfono: ${c.phone || 'N/A'} | DNI: ${c.dni || 'N/A'}\n  - Creado el: ${date} | Ventas registradas: ${sales}\n  - Link: [Ver Ficha](http://localhost:3000/admin/contactos/${c.id})\n`;
    });
    markdown += `\n`;
  });

  fs.writeFileSync('../duplicate-clients-list.md', markdown);
  console.log("Done");
}

listDuplicates().catch(console.error).finally(() => prisma.$disconnect());
