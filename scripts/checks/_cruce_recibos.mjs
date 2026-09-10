import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
const ars = n => n==null?'—':'$'+Math.round(n).toLocaleString('es-AR');
const f = d => d ? new Date(d).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}).slice(0,10) : '—';

// Lo que dicen los 4 recibos de Grupo Óptico (comprobante → importe real, leído del PDF)
const LEDGER = {
  '00349127': null, // no aparece en ninguno de los 4 recibos (falta esa hoja)
  '00349065': 4654,
  '00346394': null,
  '00346124': null,
  '00351080': null, // más allá del rango cubierto (max 00350542)
  '00350736': null, // idem
  '00349999': 13386,
  '00350080': 184023,
};
const DISPUTADOS = [
  ['80532699', '00349127', 'Alejandra Cardozo'],
  ['80532689', '00349065', 'Alejandra Cardozo'],
  ['80525166', '00346394', 'Ender Romero'],
  ['80525215', '00346124', 'Ender Romero'],
  ['80536021', '00351080', 'Paolo Taliente'],
  ['80536028', '00350736', 'Paolo Taliente'],
  ['80535525', '00349999', 'Ramon Barroso'],
  ['80535521', '00350080', 'Ramon Barroso'],
];

async function main() {
  console.log('CRUCE: nuestro sistema vs. el estado de cuenta real de Grupo Óptico\n');
  for (const [pedido, comp, nombre] of DISPUTADOS) {
    const e = await prisma.labCostEntry.findFirst({
      where: { labOrderNumber: pedido },
      select: { billedNet: true, billedTotal: true, systemCost: true, difference: true, status: true, invoiceDate: true, sourceFile: true, notes: true },
    });
    const real = LEDGER[comp];
    const nuestro = e?.billedNet ?? e?.billedTotal ?? null;
    console.log(`${pedido} · ${nombre} · comprobante ${comp}`);
    console.log(`   NUESTRO SISTEMA: facturado=${ars(nuestro)}  sistema=${ars(e?.systemCost)}  diferencia=${ars(e?.difference)} [${e?.status}]`);
    console.log(`   sourceFile: ${e?.sourceFile || '—'}  fecha factura: ${f(e?.invoiceDate)}`);
    console.log(`   ESTADO DE CUENTA REAL (recibos): ${real == null ? 'no aparece en los 4 recibos leídos' : ars(real)}`);
    if (real != null && nuestro != null) {
      const dif = Math.abs(real - nuestro);
      console.log(`   ${dif < 100 ? '✅ COINCIDE' : `❌ NO COINCIDE — diferencia de ${ars(dif)}`}`);
    }
    console.log();
  }
}
main().catch(e=>console.error('DB:', String(e.message).split('\n')[0])).finally(()=>prisma.$disconnect());
