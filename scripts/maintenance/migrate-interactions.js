const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const interactions = await prisma.interaction.findMany({
    where: {
      OR: [
        { content: { startsWith: '📋 Presupuesto' } },
        { content: { startsWith: '🤖 Presupuesto' } }
      ]
    }
  });

  console.log(`Found ${interactions.length} interactions to process.`);
  let updatedCount = 0;

  for (const inter of interactions) {
    const oldContent = inter.content;
    
    // Skip if already in the new formatted layout
    if (oldContent.includes('\n• ') || oldContent.includes('\nProductos:')) {
      continue;
    }

    let newContent = null;

    // Pattern 1: 📋 Presupuesto #XXXX creado por $YYYY [desc] — Item1 xQty, Item2 xQty
    const quoteRegex = /^(📋 Presupuesto #\w+ creado por \$[0-9.,]+(?:\s*\([^)]+\))*) — (.*)$/;
    const quoteMatch = oldContent.match(quoteRegex);

    if (quoteMatch) {
      const header = quoteMatch[1];
      const itemsListStr = quoteMatch[2];
      const items = itemsListStr.split(',').map(s => s.trim()).filter(Boolean);
      
      const groups = {};
      for (const item of items) {
        const itemMatch = item.match(/^(.*) x(\d+)$/);
        if (itemMatch) {
          const name = itemMatch[1].trim();
          const qty = parseInt(itemMatch[2], 10);
          groups[name] = (groups[name] || 0) + qty;
        } else {
          groups[item] = (groups[item] || 0) + 1;
        }
      }

      const formattedItems = Object.entries(groups)
        .map(([name, qty]) => `${qty}x ${name}`)
        .join('\n• ');

      newContent = `${header}\n\nProductos:\n• ${formattedItems}`;
    }

    // Pattern 2: 🤖 Presupuesto generado automáticamente vía WhatsApp por $XXXX. Productos: Item1, Item2
    const botRegex = /^(🤖 Presupuesto generado automáticamente vía WhatsApp por \$[0-9.,]+)\. Productos: (.*)$/;
    const botMatch = oldContent.match(botRegex);

    if (botMatch) {
      const header = botMatch[1];
      const itemsListStr = botMatch[2];
      const items = itemsListStr.split(',').map(s => s.trim()).filter(Boolean);

      const groups = {};
      for (const item of items) {
        const itemMatch = item.match(/^(.*) x(\d+)$/);
        if (itemMatch) {
          const name = itemMatch[1].trim();
          const qty = parseInt(itemMatch[2], 10);
          groups[name] = (groups[name] || 0) + qty;
        } else {
          groups[item] = (groups[item] || 0) + 1;
        }
      }

      const formattedItems = Object.entries(groups)
        .map(([name, qty]) => `${qty}x ${name}`)
        .join('\n• ');

      newContent = `${header}\n\nProductos:\n• ${formattedItems}`;
    }

    if (newContent && newContent !== oldContent) {
      await prisma.interaction.update({
        where: { id: inter.id },
        data: { content: newContent }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} interactions.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
