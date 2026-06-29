const { PrismaClient } = require('@prisma/client');

const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

function getMaterial(modelName) {
  const modelUpper = (modelName || '').toUpperCase().trim();
  if (modelUpper.includes('TG') || modelUpper.includes('TITANIUM') || modelUpper.includes('TITANIO')) {
    return 'Titanio';
  }
  const acetateCodes = [
    "57201LJH", "57202LJH", "BC3059", "FD88810", "FD88821", 
    "P5783", "P5786", "P5787", "Q5005", "Q5205", "Q6013", 
    "Q8013", "YF3090", "BC3063", "JYB238015"
  ];
  if (acetateCodes.some(code => modelUpper.includes(code))) {
    return 'Acetato';
  }
  return 'Metal';
}

function generateCopy(model, material, lensWidth, bridgeWidth, templeLength, category) {
  const isSol = category.toLowerCase().includes('sol') || category.toLowerCase().includes('sun');
  const measurementsText = (lensWidth && bridgeWidth && templeLength)
    ? `Medidas: calibre ${lensWidth}mm, puente ${bridgeWidth}mm, patillas ${templeLength}mm.`
    : "";

  if (material === 'Acetato') {
    return `Elaborado artesanalmente en acetato de celulosa premium de alta densidad, el modelo ${model} destaca por su cuerpo pulido a mano que otorga un brillo excepcional y una suavidad única al tacto. Su estructura robusta y alma metálica interna en las patillas garantizan una durabilidad prolongada y un ajuste óptimo a la forma de tu rostro. Una pieza de diseño clásico y sofisticado que resalta por su calidad premium de nivel óptico. ${measurementsText}`;
  } else if (material === 'Titanio') {
    return `Fabricado en titanio puro de grado quirúrgico, el modelo ${model} representa el pináculo de la ligereza y la resistencia. Su estructura es extraordinariamente liviana, flexible y 100% hipoalergénica, ofreciendo una sensación de confort inigualable durante todo el día. Con un acabado satinado elegante y bisagras reforzadas de alta precisión, es la elección ideal para quienes buscan tecnología avanzada, durabilidad eterna y estilo de vanguardia premium. ${measurementsText}`;
  } else {
    return `Diseñado con una estructura de aleación metálica ultraliviana y de alta resistencia a la corrosión, el modelo ${model} encarna el minimalismo moderno y la finura estética. Cuenta con almohadillas nasales de silicona hipoalergénica ajustables y terminales de acetato suave en las patillas que garantizan un calce ergonómico y libre de presiones. Una pieza con acabados metálicos pulidos y un diseño premium impecable que combina elegancia atemporal y comodidad absoluta. ${measurementsText}`;
  }
}

async function main() {
  console.log("Connecting to production DB...");
  const webProducts = await prodPrisma.webProduct.findMany({
    where: {
      product: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    },
    include: {
      product: true
    }
  });

  console.log(`Found ${webProducts.length} Atelier web products in production.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < webProducts.length; i++) {
    const wp = webProducts[i];
    try {
      const model = wp.product.model || wp.name || '';
      const material = getMaterial(model);
      const copy = generateCopy(
        model,
        material,
        wp.product.lensWidth,
        wp.product.bridgeWidth,
        wp.product.templeLength,
        wp.category || ''
      );

      // Update WebProduct description
      await prodPrisma.webProduct.update({
        where: { id: wp.id },
        data: { description: copy }
      });

      // Update Product's seoDescription
      await prodPrisma.product.update({
        where: { id: wp.product.id },
        data: { seoDescription: copy }
      });

      successCount++;
    } catch (err) {
      console.error(`Error on product index ${i} (ID: ${wp.id}):`, err.message);
      failCount++;
    }
  }

  console.log(`\nProduction update finished:`);
  console.log(`- Success: ${successCount}`);
  console.log(`- Failed: ${failCount}`);

  await prodPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await prodPrisma.$disconnect();
});
