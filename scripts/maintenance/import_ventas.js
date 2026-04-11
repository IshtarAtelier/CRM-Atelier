const { PrismaClient } = require('./prisma/generated/client');
const fs = require('fs');
const prisma = new PrismaClient();

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toFloat(val) {
  if (!val || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toInt(val) {
  if (!val || val === '') return null;
  const n = parseInt(val);
  return isNaN(n) ? null : n;
}

async function main() {
  const csvPath = process.argv[2] || './plantilla_ventas.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text);
  
  console.log(`Found ${rows.length} sales to import from: ${csvPath}`);

  let defaultUser = await prisma.user.findFirst();
  if (!defaultUser) {
    console.error('No users found in DB. Create at least one user first.');
    process.exit(1);
  }
  console.log(`Using seller: ${defaultUser.name} (${defaultUser.id})`);

  let created = 0, skipped = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const clientName = row['CLIENTE'];
      if (!clientName) { skipped++; continue; }

      const client = await prisma.client.findFirst({ where: { name: clientName } });
      if (!client) {
        console.error(`  Row ${i + 2}: Client "${clientName}" not found - SKIPPED`);
        skipped++;
        continue;
      }

      const total = parseFloat(row['TOTAL']) || 0;
      const paid = parseFloat(row['ABONADO']) || 0;
      const date = parseDate(row['FECHA']);
      const obs = row['OBSERVACIONES'] || '';
      const producto = row['PRODUCTO'] || '';
      const armazon = row['ARMAZON'] || '';
      const metodo = (row['METODO_PAGO'] || 'EFECTIVO').toUpperCase();

      // Map payment method
      let paymentMethod = 'CASH';
      if (metodo.includes('TRANSF')) paymentMethod = 'TRANSFER';
      else if (metodo.includes('TARJETA') || metodo.includes('CUOTA') || metodo.includes('CREDIT')) paymentMethod = 'CREDIT';
      else if (metodo.includes('DEBIT')) paymentMethod = 'DEBIT';

      const status = paid >= total ? 'COMPLETED' : 'CONFIRMED';
      const labNotes = [producto, armazon, obs].filter(Boolean).join(' | ');

      // Check if there's prescription data
      const hasPrescription = toFloat(row['ESF_OD']) !== null || toFloat(row['ESF_OI']) !== null ||
                              toFloat(row['CIL_OD']) !== null || toFloat(row['CIL_OI']) !== null;

      let prescriptionId = null;

      if (hasPrescription) {
        const prescription = await prisma.prescription.create({
          data: {
            clientId: client.id,
            sphereOD: toFloat(row['ESF_OD']),
            cylinderOD: toFloat(row['CIL_OD']),
            axisOD: toInt(row['EJE_OD']),
            additionOD: toFloat(row['ADD_OD']),
            distanceOD: toFloat(row['DNP_OD']),
            sphereOI: toFloat(row['ESF_OI']),
            cylinderOI: toFloat(row['CIL_OI']),
            axisOI: toInt(row['EJE_OI']),
            additionOI: toFloat(row['ADD_OI']),
            distanceOI: toFloat(row['DNP_OI']),
            date: date,
            notes: 'Importada del sistema anterior',
          }
        });
        prescriptionId = prescription.id;
      }

      // Create the order
      const order = await prisma.order.create({
        data: {
          clientId: client.id,
          userId: defaultUser.id,
          status: status,
          orderType: 'SALE',
          total: total,
          paid: paid,
          labNotes: labNotes || null,
          prescriptionId: prescriptionId,
          createdAt: date,
          updatedAt: date,
        }
      });

      // Create payment record
      if (paid > 0) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: paid,
            method: paymentMethod,
            date: date,
            notes: 'Importado del sistema anterior',
          }
        });
      }

      created++;
      if (created % 50 === 0) console.log(`  Progress: ${created} sales imported...`);
    } catch (err) {
      errors++;
      console.error(`  Row ${i + 2} error: ${err.message}`);
    }
  }

  console.log(`\n=== Sales Import Complete ===`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${created + skipped + errors}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
