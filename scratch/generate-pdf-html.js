const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
    }
  }
});

async function main() {
  try {
    console.log("Fetching crystals from production database...");
    const products = await prisma.product.findMany({
      where: {
        category: 'Cristal'
      },
      select: {
        id: true,
        name: true,
        category: true,
        type: true,
        brand: true,
        model: true,
        price: true,
        cost: true,
        lensIndex: true,
        laboratory: true
      },
      orderBy: [
        { type: 'asc' },
        { brand: 'asc' },
        { price: 'asc' }
      ]
    });

    console.log(`Found ${products.length} crystals.`);
    
    // Group crystals by Type
    const grouped = {};
    products.forEach(p => {
      const type = p.type || 'Otros Cristales';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(p);
    });

    // Generate HTML content
    const brandBeige = '#D4C3B5';
    const brandSand = '#A68B7C';
    
    let htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Lista de Precios - Cristales - Atelier Óptica</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter','Segoe UI',sans-serif; }
        body { padding: 40px 50px; color: #1c1917; font-size: 12px; line-height: 1.4; background: white; }
        
        .letterhead { display:flex; justify-content:space-between; align-items:center; padding-bottom:20px; border-bottom:2px solid ${brandBeige}; margin-bottom: 20px; }
        .letterhead-logo { height:50px; }
        .letterhead-right { text-align:right; font-size:10px; color:#78716c; font-weight: 500; }
        .address-bold { font-weight:800; color:${brandSand}; text-transform: uppercase; letter-spacing: 1px; }
        
        .title-container { margin-bottom: 30px; text-align: center; }
        .doc-title { font-size: 24px; font-weight: 900; text-transform: uppercase; color: #1c1917; letter-spacing: 2px; margin-bottom: 5px; }
        .doc-subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: ${brandSand}; font-weight: 800; }
        
        .section-title { font-size: 16px; font-weight: 900; text-transform: uppercase; color: ${brandSand}; border-bottom: 2px solid ${brandBeige}; padding-bottom: 6px; margin: 30px 0 15px 0; letter-spacing: 1px; page-break-after: avoid; }
        
        table { width:100%; border-collapse:collapse; margin-bottom:20px; border: 1px solid #e5e5e4; page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        th { background: #fdfbfc; color: #1c1917; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid ${brandBeige}; }
        td { padding: 10px 12px; border-bottom: 1px solid #f5f5f4; font-size: 11px; }
        tr:nth-child(even) { background: #fffcf9; }
        
        .crystal-name { font-weight: 700; color: #1c1917; }
        .crystal-meta { font-size: 9px; color: #78716c; margin-top: 2px; }
        .price-cell { text-align: right; font-weight: 800; font-size: 12px; color: #1c1917; }
        .index-cell { text-align: center; font-weight: 600; color: #78716c; }
        .lab-cell { color: #78716c; font-style: italic; }
        
        .footer { margin-top: 50px; text-align: center; border-top: 1px solid ${brandBeige}; padding-top: 20px; font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; page-break-inside: avoid; }
    </style>
</head>
<body>
    <div class='letterhead'>
        <h1 style="font-family: Georgia, serif; font-size: 32px; font-weight: normal; margin: 0; letter-spacing: 2px;">ATELIER</h1>
        <div class='letterhead-right'>
            <div class='address-bold'>Atelier Óptica SAS</div>
            <div>José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba</div>
            <div>Lista Oficial de Cristales</div>
        </div>
    </div>
    
    <div class="title-container">
        <h2 class="doc-title">Lista de Precios de Cristales</h2>
        <div class="doc-subtitle">Actualizado al ${new Date().toLocaleDateString('es-AR')}</div>
    </div>
    `;

    for (const [type, items] of Object.entries(grouped)) {
      htmlContent += `
    <h3 class="section-title">${type}</h3>
    <table>
        <thead>
            <tr>
                <th style="width: 50%">Nombre / Modelo</th>
                <th style="width: 15%; text-align: center">Índice</th>
                <th style="width: 15%">Laboratorio</th>
                <th style="width: 20%; text-align: right">Precio Público</th>
            </tr>
        </thead>
        <tbody>
      `;

      items.forEach(item => {
        const formattedPrice = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(item.price);
        htmlContent += `
            <tr>
                <td>
                    <span class="crystal-name">${item.name}</span>
                    <div class="crystal-meta">Marca: ${item.brand || '-'} | Modelo: ${item.model || '-'}</div>
                </td>
                <td class="index-cell">${item.lensIndex || '-'}</td>
                <td class="lab-cell">${item.laboratory || '-'}</td>
                <td class="price-cell">${formattedPrice}</td>
            </tr>
        `;
      });

      htmlContent += `
        </tbody>
    </table>
      `;
    }

    htmlContent += `
    <div class='footer'>Atelier Óptica · Profesionalismo Ética y Diseño · ${new Date().getFullYear()}</div>
</body>
</html>
    `;

    const htmlPath = '/Users/ishtarpissano/proyectos/atelier/scratch/lista-precios.html';
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`HTML generated at ${htmlPath}`);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
