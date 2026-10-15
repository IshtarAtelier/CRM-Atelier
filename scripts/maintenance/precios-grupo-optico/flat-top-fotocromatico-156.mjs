/**
 * Renombra "Bifocal Flat Top · Orgánico Fotocromático 1.49" → "… 1.56" (índice 1.56).
 *
 * Por qué: la lista de precios de Grupo Óptico (agosto 2026, pág. 6) dice
 * "Organico Fotocromatico" sin índice para Flat Top, y el portal SmartLab solo
 * arma el Flat Top fotocromático en ORG FOTO 1.56 (no existe foto 1.49 para
 * bifocal). Con "1.49" en el nombre el robot no encontraba equivalencia.
 * OK de Ishtar del 15/10/2026.
 *
 * Pega contra la base que diga DATABASE_URL. Dry-run por defecto; `--aplicar`
 * escribe. Para producción: DATABASE_URL="$PROD_DATABASE_URL" (con OK explícito).
 *
 *   node scripts/maintenance/precios-grupo-optico/flat-top-fotocromatico-156.mjs [--aplicar]
 */
import { PrismaClient } from '@prisma/client';

const aplicar = process.argv.includes('--aplicar');
const DE = 'Bifocal Flat Top · Orgánico Fotocromático 1.49';
const A = 'Bifocal Flat Top · Orgánico Fotocromático 1.56';
const prisma = new PrismaClient();
const p = await prisma.product.findFirst({ where: { name: DE }, select: { id: true, name: true, model: true, lensIndex: true, laboratory: true, price: true } });
const yaEsta = await prisma.product.findFirst({ where: { name: A }, select: { id: true } });
if (!p) { console.log(yaEsta ? `Ya está renombrado (${yaEsta.id}).` : `No existe "${DE}".`); await prisma.$disconnect(); process.exit(0); }
if (yaEsta) { console.log(`Ya existe un producto "${A}" (${yaEsta.id}): no se renombra para no duplicar.`); await prisma.$disconnect(); process.exit(1); }
console.log(`${aplicar ? 'APLICANDO' : 'DRY-RUN'} · ${p.id} · "${p.name}" (model "${p.model}", índice ${p.lensIndex}, ${p.laboratory}, $${p.price})`);
console.log(`  → name/model "${A}", lensIndex 1.56`);
if (aplicar) {
    await prisma.product.update({ where: { id: p.id }, data: { name: A, model: p.model === DE ? A : p.model, lensIndex: '1.56' }, select: { id: true } });
    console.log('✅ Renombrado.');
}
await prisma.$disconnect();
