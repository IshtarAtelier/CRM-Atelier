#!/usr/bin/env node
/**
 * Carga UN armazón de Kazwini en el CRM y en la tienda, por la MISMA puerta que
 * el formulario del CRM: la API del dev server, con sesión firmada del admin.
 * Así pasa por middleware → getActor → logAudit → ProductService → la ficha
 * web la crea web-product.service (el único que puede). Nada de prisma para
 * el producto ni la ficha.
 *
 * La única escritura directa es `imagenesCatalogo` / `rawImageUrls` del
 * producto: la API no tiene camino para fotos que ya viven en
 * `public/assets/products/` (el suyo es /api/ai/process-image, que sube y
 * procesa), y los hermanos cargados a mano (Teseo, Rhea, Frida) las tienen.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/cargar-armazon-kazwini.mjs <spec.json>              (simula)
 *   node --env-file=.env scripts/maintenance/cargar-armazon-kazwini.mjs <spec.json> --aplicar
 *   ... --base http://localhost:3005   (dev server; por defecto ese)
 *
 * Contra qué base escribe: la del dev server al que apunta --base (la de su
 * .env). Para producción hay que apuntar --base al sitio de producción, y eso
 * SOLO con OK explícito de Ishtar.
 *
 * spec.json: ver scripts/maintenance/kazwini/README.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const base = (args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:3005').replace(/\/$/, '');
const specPath = args.find((a) => a.endsWith('.json'));
if (!specPath) { console.error('Falta el spec.json'); process.exit(1); }
const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const prisma = new PrismaClient();

async function cookieAdmin() {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, name: true, role: true }, orderBy: { createdAt: 'asc' } });
    if (!admin) throw new Error('No hay usuario ADMIN en la base');
    const token = await new SignJWT({ id: admin.id, name: admin.name, role: admin.role })
        .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { cookie: `session=${token}`, admin };
}

async function api(method, path, body, cookie) {
    const r = await fetch(base + path, {
        method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await r.text();
    let json; try { json = JSON.parse(txt); } catch { json = { raw: txt.slice(0, 300) }; }
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(json).slice(0, 400)}`);
    return json;
}

async function main() {
    const dbHost = (process.env.DATABASE_URL || '').match(/@([^:/]+)/)?.[1] || '???';
    console.log(`Servidor: ${base} · base del script: ${dbHost} · modo: ${APLICAR ? 'APLICAR' : 'SIMULACIÓN'}\n`);

    for (const f of spec.fotos) {
        if (!existsSync('public' + f)) throw new Error(`Falta la foto public${f}`);
    }
    const yaExiste = await prisma.product.findFirst({ where: { OR: [{ model: spec.model }, { name: spec.name }] }, select: { id: true, name: true, model: true } });
    if (yaExiste) { console.log(`YA EXISTE: ${yaExiste.name} (${yaExiste.model}, id ${yaExiste.id}) — no se toca.`); return; }

    const crear = {
        name: spec.name, brand: spec.brand, model: spec.model, type: spec.category, category: spec.category,
        price: spec.price, cost: spec.cost, wholesalePrice: spec.wholesalePrice, stock: spec.stock,
        unitType: 'UNIDAD', publishToWeb: true, publishToWholesale: spec.publishToWholesale ?? true,
        seoTitle: spec.seoTitle, seoDescription: spec.seoDescription, seoTags: spec.seoTags,
        gender: spec.gender, ageGroup: spec.ageGroup ?? 'Adulto',
        // Sin esto la ficha nace como "atelier-1111-c3-xxxx"; la tienda usa el
        // nombre ("teseo-c1", "iris-c3"). El service lo normaliza.
        customSlug: spec.slug ?? spec.name,
    };
    const medidas = { lensWidth: spec.lensWidth, bridgeWidth: spec.bridgeWidth, templeLength: spec.templeLength };
    const ficha = { description: spec.description, images: spec.fotos, imageAlts: spec.alts, isFeatured: spec.isFeatured ?? false };

    console.log('1) POST /api/products', JSON.stringify(crear, null, 1));
    console.log('2) PUT  /api/products/<id>', JSON.stringify(medidas));
    console.log('3) PATCH /api/admin/web-products', JSON.stringify(ficha, null, 1));
    console.log('4) prisma: imagenesCatalogo/rawImageUrls =', spec.fotos);
    if (!APLICAR) { console.log('\nSimulación terminada — nada se escribió.'); return; }

    const { cookie, admin } = await cookieAdmin();
    console.log(`\nFirmado como ${admin.name} (${admin.role})`);
    const producto = await api('POST', '/api/products', crear, cookie);
    console.log(`✔ producto ${producto.id}`);
    await api('PUT', `/api/products/${producto.id}`, medidas, cookie);
    console.log('✔ medidas');
    const web = await prisma.webProduct.findFirst({ where: { productId: producto.id }, select: { id: true, slug: true } });
    if (!web) throw new Error('El service no creó la ficha web');
    await api('PATCH', '/api/admin/web-products', { id: web.id, ...ficha }, cookie);
    console.log(`✔ ficha ${web.slug}`);
    // select explícito: contra producción el schema local va adelantado y
    // devolver la fila entera revienta (CLAUDE.md, "Trampas conocidas").
    await prisma.product.update({ where: { id: producto.id }, data: { imagenesCatalogo: spec.fotos, rawImageUrls: spec.fotos }, select: { id: true } });
    console.log('✔ fotos del producto');

    const final = await prisma.webProduct.findUnique({
        where: { id: web.id },
        select: {
            id: true, slug: true, name: true, isActive: true, category: true, images: true, imageAlts: true, description: true,
            product: { select: { name: true, model: true, stock: true, price: true, imagenesCatalogo: true, lensWidth: true, bridgeWidth: true, templeLength: true } },
        },
    });
    console.log('\nResultado:', JSON.stringify(final, null, 1));
    console.log(`\nFicha: ${base}/producto/${final.slug}`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
