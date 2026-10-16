/**
 * Retira del catálogo los 3 cristales de Grupo Óptico que el portal SmartLab
 * NO arma (verificado contra el portal real el 15/10/2026 con
 * `npm run check:go-equivalencias -- --portal`):
 *  · Bifocal Kriptock Invisible · Orgánico Blue Light 1.67 — para bifocal, el
 *    material ORG BLUE ALTO ÍNDICE 1.67 no tiene colores ni artículos.
 *  · Multifocal Smart AI LENS · Policarbonato Fotocromático Grey 1.59 — en
 *    POLI FOTO el portal ofrece ONE/NEW/FREE/PRO/EXCLUSIVE/DRIVE, no AI LENS.
 *  · Multifocal Smart DRIVE · Orgánico Polarizado Gris / Brown 1.49 — en
 *    POLARIZADO GRIS ofrece FREE/ONE/NEW/PRO/EXCLUSIVE/AI LENS, no DRIVE.
 * Decisión de Ishtar del 15/10/2026 ("retiralos de nuestro sistema"). Ninguno
 * tiene ventas, ficha web ni opción de "Arma tus lentes" (verificado en prod).
 *
 * Se borran de verdad (no hay baja lógica en Product). El script se niega si
 * alguno tiene un OrderItem, WebProduct o WebLensOption apuntándole.
 *
 * Pega contra la base que diga DATABASE_URL. Dry-run por defecto; `--aplicar`
 * escribe. Para producción: DATABASE_URL="$PROD_DATABASE_URL" (con OK explícito).
 *
 *   node scripts/maintenance/precios-grupo-optico/retirar-sin-equivalencia-en-portal.mjs [--aplicar]
 */
import { PrismaClient } from '@prisma/client';

const aplicar = process.argv.includes('--aplicar');
const NOMBRES = [
    'Bifocal Kriptock Invisible · Orgánico Blue Light 1.67',
    'Multifocal Smart AI LENS · Policarbonato Fotocromático Grey 1.59',
    'Multifocal Smart DRIVE · Orgánico Polarizado Gris / Brown 1.49',
];
const prisma = new PrismaClient();
const productos = await prisma.product.findMany({ where: { name: { in: NOMBRES } }, select: { id: true, name: true, price: true, laboratory: true } });
for (const n of NOMBRES) if (!productos.some(p => p.name === n)) console.log(`· "${n}": no existe (ya retirado).`);

let frenar = false;
for (const p of productos) {
    const [items, web, opciones] = await Promise.all([
        prisma.orderItem.count({ where: { productId: p.id } }),
        prisma.webProduct.count({ where: { productId: p.id } }),
        prisma.webLensOption.count({ where: { productId: p.id } }),
    ]);
    const usos = items + web + opciones;
    console.log(`${aplicar ? 'RETIRAR' : 'DRY-RUN'} · ${p.id} · "${p.name}" (${p.laboratory}, $${p.price}) · ventas ${items}, ficha web ${web}, opción web ${opciones}`);
    if (usos) { frenar = true; console.log('   ⛔ tiene usos: NO se borra.'); }
}
if (frenar) { await prisma.$disconnect(); process.exit(1); }
if (aplicar && productos.length) {
    const r = await prisma.product.deleteMany({ where: { id: { in: productos.map(p => p.id) } } });
    console.log(`✅ Retirados ${r.count}.`);
}
await prisma.$disconnect();
