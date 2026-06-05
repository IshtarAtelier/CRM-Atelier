import { prisma } from './src/lib/db';

async function findDuplicates() {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, phone: true, dni: true, email: true, createdAt: true }
  });

  const duplicateGroups: Record<string, any[]> = {};
  
  // Let's identify matches by: 
  // 1) Last 8 digits of phone
  // 2) Exact DNI (if not null)
  // 3) Exact Email (if not null)
  
  clients.forEach(c => {
    let key = null;
    if (c.phone && c.phone.length >= 8) {
      key = 'phone_' + c.phone.slice(-8);
    } else if (c.dni && c.dni.trim().length > 0) {
      key = 'dni_' + c.dni.trim();
    } else if (c.email && c.email.trim().length > 0) {
      key = 'email_' + c.email.trim().toLowerCase();
    } else {
      // maybe by name? 
      key = 'name_' + c.name.trim().toLowerCase();
    }
    
    if (key) {
      if (!duplicateGroups[key]) duplicateGroups[key] = [];
      duplicateGroups[key].push(c);
    }
  });

  const exactDuplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
  
  console.log(`Found ${exactDuplicates.length} groups of duplicates.`);
  let totalDuplicateRecords = 0;
  
  exactDuplicates.forEach((g, index) => {
    totalDuplicateRecords += (g.length - 1);
    if (index < 5) { // Print first 5 for review
       console.log(`\nGroup ${index + 1}:`);
       g.forEach(c => console.log(` - [${c.id}] ${c.name} | Phone: ${c.phone} | Created: ${c.createdAt}`));
    }
  });
  
  console.log(`\nTotal duplicate records that could be merged: ${totalDuplicateRecords}`);
}

findDuplicates().catch(console.error).finally(() => prisma.$disconnect());
