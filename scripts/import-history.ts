import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const file1Path = path.join('C:\\Users\\pisan\\Downloads', 'ATELIER 1.xlsx');
  const file2Path = path.join('C:\\Users\\pisan\\Downloads', 'ATELIER 2.xlsx');

  console.log('Leyendo archivos desde:', file1Path);
  
  let wb1, wb2;
  try {
    wb1 = xlsx.readFile(file1Path);
    wb2 = xlsx.readFile(file2Path);
  } catch (err) {
    console.error('Error al leer los archivos. Asegúrate de que los archivos se llaman exactamente "ATELIER 1.xlsx" y "ATELIER 2.xlsx" en la carpeta de Descargas.');
    process.exit(1);
  }

  const sheet1 = wb1.Sheets[wb1.SheetNames[0]];
  const rows1: any[] = xlsx.utils.sheet_to_json(sheet1, { header: 1 });

  const sheet2 = wb2.Sheets[wb2.SheetNames[0]];
  const rows2: any[] = xlsx.utils.sheet_to_json(sheet2, { header: 1 });

  const clientsMap = new Map<number, string>();
  for (const row of rows1) {
    if (row && row.length >= 2 && !isNaN(Number(row[0]))) {
      clientsMap.set(Number(row[0]), String(row[1]).trim());
    }
  }

  const detailsMap = new Map<number, any[]>();
  for (const row of rows2) {
    if (row && row.length >= 1) {
      if (String(row[0]).toLowerCase() === 'venta') continue; // Ignorar encabezado
      
      const ventaId = Number(row[0]);
      if (isNaN(ventaId)) continue;

      if (!detailsMap.has(ventaId)) {
        detailsMap.set(ventaId, []);
      }
      
      const esfRaw = row[3];
      const cilRaw = row[4];
      const ejeRaw = row[5];
      
      const isNullish = (val: any) => val === undefined || val === null || val === 'NULL' || String(val).trim() === '';

      detailsMap.get(ventaId)!.push({
        ojo: !isNullish(row[1]) ? String(row[1]).trim() : null,
        articulo: !isNullish(row[2]) ? String(row[2]).trim() : null,
        esf: !isNullish(esfRaw) ? esfRaw : null,
        cil: !isNullish(cilRaw) ? cilRaw : null,
        eje: !isNullish(ejeRaw) ? ejeRaw : null,
      });
    }
  }

  let foundCount = 0;
  let notFoundCount = 0;

  console.log(`Se encontraron ${clientsMap.size} clientes en el Excel y ${detailsMap.size} ventas con detalles.`);

  for (const [ventaId, clientName] of clientsMap.entries()) {
    const details = detailsMap.get(ventaId) || [];
    if (details.length === 0) continue;

    // Buscar en la BD: Primero exacto o 'contains' completo
    let client = await prisma.client.findFirst({
      where: {
        name: {
          contains: clientName,
          mode: 'insensitive'
        }
      }
    });

    // Si no lo encuentra, intentamos con las primeras dos palabras (Nombre y Apellido)
    if (!client) {
      const parts = clientName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
         const shortName = `${parts[0]} ${parts[1]}`;
         client = await prisma.client.findFirst({
          where: {
            name: {
              contains: shortName,
              mode: 'insensitive'
            }
          }
        });
      }
    }

    if (!client) {
      console.log(`⚠️ No se encontró al cliente: "${clientName}" (ID Venta: ${ventaId})`);
      notFoundCount++;
      continue;
    }

    foundCount++;
    console.log(`✅ Cliente encontrado: ${client.name} (Mapeado desde: ${clientName})`);

    let noteText = '📌 **Historial Importado de Sistema Anterior**\n\n';
    
    for (const d of details) {
      let ojoLabel = '';
      if (d.ojo === 'OD') ojoLabel = '[OD] Ojo Derecho:';
      else if (d.ojo === 'OI') ojoLabel = '[OI] Ojo Izquierdo:';
      else if (d.ojo === 'AO') ojoLabel = '[AO] Ambos Ojos / Adicional:';
      else ojoLabel = '[No especificado]';

      noteText += `**${ojoLabel}**\n`;
      
      const hasGrad = d.esf !== null || d.cil !== null || d.eje !== null;
      if (hasGrad) {
         let gradText = '**Graduación:** ';
         if (d.esf !== null) {
            const numEsf = Number(d.esf);
            gradText += `Esfera: ${numEsf > 0 ? '+' : ''}${d.esf} | `;
         }
         if (d.cil !== null) gradText += `Cilindro: ${d.cil} | `;
         if (d.eje !== null) gradText += `Eje: ${d.eje}°`;
         noteText += gradText.replace(/ \| $/, '') + '\n';
      }
      
      if (d.articulo && d.articulo !== 'NULL') {
        noteText += `**Artículo:** ${d.articulo}\n`;
      } else {
        noteText += `*(Sin artículo especificado)*\n`;
      }
      
      if (!hasGrad) {
        noteText += `*(Sin datos de graduación)*\n`;
      }

      noteText += '\n';
    }

    // Guardar la nota en la DB
    await prisma.interaction.create({
      data: {
        clientId: client.id,
        type: 'NOTE',
        content: noteText.trim()
      }
    });
  }

  console.log('\n=======================================');
  console.log(`Importación finalizada.`);
  console.log(`✅ Notas agregadas: ${foundCount}`);
  console.log(`❌ Clientes no encontrados en el CRM: ${notFoundCount}`);
  console.log('=======================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
