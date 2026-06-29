const { PrismaClient } = require('@prisma/client');

// Local DB Client
const localPrisma = new PrismaClient();

// Prod DB Client
const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

// Helper to determine material based on model code
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

// Helper to create the copy highlighting premium features
function generateCopy(model, material, lensWidth, bridgeWidth, templeLength, category) {
  const isSol = category.toLowerCase().includes('sol') || category.toLowerCase().includes('sun');
  const typeText = isSol ? "de sol" : "de receta";
  const measurementsText = (lensWidth && bridgeWidth && templeLength)
    ? `Medidas: calibre ${lensWidth}mm, puente ${bridgeWidth}mm, patillas ${templeLength}mm.`
    : "";

  let copy = "";

  if (material === 'Acetato') {
    copy = `Elaborado artesanalmente en acetato de celulosa premium de alta densidad, el modelo ${model} destaca por su cuerpo pulido a mano que otorga un brillo excepcional y una suavidad única al tacto. Su estructura robusta y alma metálica interna en las patillas garantizan una durabilidad prolongada y un ajuste óptimo a la forma de tu rostro. Una pieza de diseño clásico y sofisticado que resalta por su calidad premium de nivel óptico. ${measurementsText}`;
  } else if (material === 'Titanio') {
    copy = `Fabricado en titanio puro de grado quirúrgico, el modelo ${model} representa el pináculo de la ligereza y la resistencia. Su estructura es extraordinariamente liviana, flexible y 100% hipoalergénica, ofreciendo una sensación de confort inigualable durante todo el día. Con un acabado satinado elegante y bisagras reforzadas de alta precisión, es la elección ideal para quienes buscan tecnología avanzada, durabilidad eterna y estilo de vanguardia premium. ${measurementsText}`;
  } else {
    // Metal
    copy = `Diseñado con una estructura de aleación metálica ultraliviana y de alta resistencia a la corrosión, el modelo ${model} encarna el minimalismo moderno y la finura estética. Cuenta con almohadillas nasales de silicona hipoalergénica ajustables y terminales de acetato suave en las patillas que garantizan un calce ergonómico y libre de presiones. Una pieza con acabados metálicos pulidos y un diseño premium impecable que combina elegancia atemporal y comodidad absoluta. ${measurementsText}`;
  }

  return copy;
}

async function updateDb(prismaInstance, dbName) {
  console.log(`\n--- Processing database: ${dbName} ---`);
  
  // Find all Atelier web products with their associated product data
  const webProducts = await prismaInstance.webProduct.findMany({
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

  console.log(`Found ${webProducts.length} Atelier web products in ${dbName}.`);

  let count = 0;
  for (const wp of webProducts) {
    const model = wp.product.model || wp.name || '';
    const material = getMaterial(model);
    
    const lensWidth = wp.product.lensWidth;
    const bridgeWidth = wp.product.bridgeWidth;
    const templeLength = wp.product.templeLength;

    const copy = generateCopy(
      model,
      material,
      lensWidth,
      bridgeWidth,
      templeLength,
      wp.category || ''
    );

    // Update WebProduct description
    await prismaInstance.webProduct.update({
      where: {
        id: wp.id
      },
      data: {
        description: copy
      }
    });

    // Also update Product's seoDescription for SEO schema structure
    await prismaInstance.product.update({
      where: {
        id: wp.product.id
      },
      data: {
        seoDescription: copy
      }
    });

    count++;
  }

  console.log(`Successfully updated ${count} descriptions in ${dbName}.`);
}

async function main() {
  // Update Local DB
  await updateDb(localPrisma, "Local Database");

  // Update Production DB
  await updateDb(prodPrisma, "Production Database");

  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await localPrisma.$disconnect();
  await prodPrisma.$disconnect();
});
