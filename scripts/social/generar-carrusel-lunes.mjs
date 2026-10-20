#!/usr/bin/env node
/**
 * El carrusel GRANDE del lunes: varios modelos en una sola publicación, cada
 * uno con su foto de frente, de perfil y la foto de PRODUCTO del catálogo.
 *
 *   node --env-file=.env scripts/social/generar-carrusel-lunes.mjs --fecha 2026-10-26
 *   ... --modelos 3          # cuántos modelos entran (3 × 3 fotos = 9 slides; tope 10)
 *   ... --vista /tmp/lunes   # hoja de vista previa para mostrar ANTES de programar
 *
 * POR QUÉ (Ishtar, 19/10/2026): "asegurate que los carruseles tengan bastantes
 * fotos, así aprovechamos y mostramos más modelos, y fijate si podés incluir la
 * foto del modelo y la foto producto también". El modelo del día era UN modelo
 * con 2 fotos; esto arma el mismo lunes con varios.
 *
 * QUÉ MODELOS: los que siguen en el carril de ese lunes (Agostina o Massaru,
 * según modelo-del-dia.ts), empezando por el que hubiera salido solo. Las
 * placas de frente y perfil son las YA renderizadas del feed de modelos
 * (public/social/feed-<modelo>/01 y 02.jpg: cabezas alineadas): no se vuelven a tocar.
 * La de producto se arma acá con la foto de catálogo de la ficha
 * (`imagenesCatalogo`, recortada por fotos-producto.mjs) sobre fondo claro,
 * con el mismo nombre y leyenda. Sin precio: no vence (R6 no aplica).
 *
 * LEE la base (PROD_DATABASE_URL si está; si no, la local) SOLO para saber la
 * foto de catálogo de cada modelo. Un modelo sin foto de catálogo usable va
 * igual con sus dos fotos de modelo.
 *
 * SALIDA: public/social/carrusel-lunes-<fecha>/NN.jpg y
 * social/contenido/carrusel-lunes-<fecha>.json. NO publica ni programa nada:
 * se agrega a social/feed-programacion.json con su fecha.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { fotoLocal } from './generar-producto.mjs';
import { fotoDeCatalogo } from './fotos-producto.mjs';
import { cargarLogo, LEYENDA, CONDICIONES, titulo } from './feed-modelos-comun.mjs';
import { modeloDelDia } from '../../src/lib/social/modelo-del-dia.ts';

const sharp = createRequire(import.meta.url)('sharp');
const args = process.argv.slice(2);
const valor = (op) => (args.includes(op) ? args[args.indexOf(op) + 1] : null);
const FECHA = valor('--fecha');
const MODELOS = Number(valor('--modelos')) || 3;
const VISTA = valor('--vista');
const TOPE_SLIDES_INSTAGRAM = 10;
if (!FECHA || !/^\d{4}-\d{2}-\d{2}$/.test(FECHA)) { console.error('Falta --fecha AAAA-MM-DD (un lunes).'); process.exit(1); }
if (MODELOS * 3 > TOPE_SLIDES_INSTAGRAM) { console.error(`${MODELOS} modelos × 3 fotos pasan las ${TOPE_SLIDES_INSTAGRAM} slides de Instagram.`); process.exit(1); }

const { carriles } = JSON.parse(readFileSync(path.join(RAIZ, 'social', 'feed-modelos.json'), 'utf-8'));
const dia = Math.round((Date.parse(`${FECHA}T00:00:00Z`) - Date.UTC(2026, 0, 1)) / 86400e3);
const primero = modeloDelDia(carriles, dia);
if (!primero) { console.error('El carril de modelos está vacío.'); process.exit(1); }
const lista = carriles[primero.carril];
const desde = lista.findIndex(m => m.id === primero.id);
const elegidos = Array.from({ length: Math.min(MODELOS, lista.length) }, (_, k) => lista[(desde + k) % lista.length].id);
const MARCA = { agostina: 'Cápsula Escarlata', massaru: 'Atelier Óptica' };

// La foto de catálogo de cada modelo, desde la base (solo lectura).
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } } });
const slugDe = (id) => id.replace(/^feed-(agos|massaru)-/, '');
// Muchas fichas no tienen `customSlug` cargado: se busca por slug Y por nombre
// ("Orfeo C3"), que es el mismo texto que lleva la placa.
const piezas = Object.fromEntries(elegidos.map(id => [id, JSON.parse(readFileSync(path.join(RAIZ, 'social', 'contenido', `${id}.json`), 'utf-8'))]));
const nombres = elegidos.map(id => titulo(piezas[id].producto));
const fichas = await prisma.product.findMany({
    where: { OR: [{ customSlug: { in: elegidos.map(slugDe) } }, { name: { in: nombres, mode: 'insensitive' } }] },
    select: { customSlug: true, name: true, imagenesCatalogo: true },
});
await prisma.$disconnect();
const catalogo = {};
for (const f of fichas) { const foto = (f.imagenesCatalogo || [])[0] || null; if (f.customSlug) catalogo[f.customSlug] = foto; catalogo[f.name.toLowerCase()] = foto; }
const fotoCatalogoDe = (feedId) => catalogo[slugDe(feedId)] || catalogo[titulo(piezas[feedId].producto).toLowerCase()] || null;

const id = await cargarIdentidad();
const logo = cargarLogo(id);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

/** La placa de producto: el anteojo del catálogo sobre fondo claro, nombre y leyenda como en las de modelo. */
async function placaProducto({ fotoJpg, leyenda, nombre, color, destino }) {
    const oro = id.colores.marca;
    const img = fotoJpg.toString('base64');
    await page.setContent(`<html><head><link href="${id.googleFonts}" rel="stylesheet"><style>
body{margin:0;width:1080px;height:1350px;overflow:hidden;position:relative;background:#ffffff;font-family:${id.fuentes.titulo}}
.f{position:absolute;left:60px;right:60px;top:150px;height:740px;background:url(data:image/jpeg;base64,${img}) center/contain no-repeat}
.t{position:absolute;left:0;right:0;bottom:118px;text-align:center;color:${id.oscuro}}
.k{font-size:24px;letter-spacing:8px;color:${oro};text-transform:uppercase;margin-bottom:8px}
.n{font-size:96px;font-weight:700;letter-spacing:3px;line-height:1}
.c{font-size:32px;color:${oro};letter-spacing:5px;margin-top:6px}
.l{position:absolute;bottom:44px;left:50%;transform:translateX(-50%);height:42px}
</style></head><body><div class="f"></div>
<div class="t"><div class="k">${leyenda}</div><div class="n">${nombre}</div>${color ? `<div class="c">${color}</div>` : ''}</div>
<img class="l" src="${logo}"></body></html>`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: destino, type: 'jpeg', quality: 88 });
}

const piezaId = `carrusel-lunes-${FECHA}`;
const salida = path.join(RAIZ, 'public', 'social', piezaId);
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });
const slides = [];
const nn = () => String(slides.length + 1).padStart(2, '0');
for (const feedId of elegidos) {
    const pieza = piezas[feedId];
    const p = pieza.producto;
    for (const s of pieza.slides) {
        const origen = path.join(RAIZ, 'public', s.image);
        if (!existsSync(origen)) { console.warn(`  · ${feedId}: falta ${s.image}`); continue; }
        const destino = `${nn()}.jpg`;
        copyFileSync(origen, path.join(salida, destino));
        slides.push({ type: 'foto', role: s.role, image: `social/${piezaId}/${destino}`, alt: s.alt });
    }
    const slug = slugDe(feedId);
    let recorte = null;
    const fotoCatalogo = fotoCatalogoDe(feedId);
    try { if (fotoCatalogo) recorte = await fotoDeCatalogo(await fotoLocal(fotoCatalogo, slug), slug); } catch (e) { console.warn(`  · ${slug}: ${e.message}`); }
    if (!recorte) { console.warn(`  · ${slug}: sin foto de catálogo usable — va solo con las de modelo`); continue; }
    const destino = `${nn()}.jpg`;
    const fotoJpg = await sharp(recorte).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
    await placaProducto({ fotoJpg, leyenda: LEYENDA[p.familia], nombre: p.nombre, color: p.color, destino: path.join(salida, destino) });
    slides.push({ type: 'producto', role: 'producto', image: `social/${piezaId}/${destino}`, alt: `${titulo(p)}, ${LEYENDA[p.familia].toLowerCase()}, foto de producto · ${MARCA[primero.carril]}` });
    console.log(`✅ ${feedId}: modelo + producto`);
}
await browser.close();

writeFileSync(path.join(RAIZ, 'social', 'contenido', `${piezaId}.json`), JSON.stringify({
    id: piezaId,
    format: '4:5',
    theme: 'dark',
    pilar: primero.carril,
    fuente: `fotos-${primero.carril}`,   // sin precio adentro: no vence (R6 no aplica)
    temas: ['armazones'],
    producto: { nombre: nombres.join(', '), color: '', familia: 'receta' },
    caption: `${nombres.join(' · ')} · ${MARCA[primero.carril]}\n${CONDICIONES}`,
    slides,
}, null, 2) + '\n');
console.log(`📦 ${piezaId}: ${slides.length} slides (${elegidos.length} modelos, carril ${primero.carril})`);

if (VISTA) {
    const celdas = [];
    for (const [i, s] of slides.entries()) celdas.push({ input: await sharp(path.join(RAIZ, 'public', s.image)).resize(270, 338).toBuffer(), left: (i % 5) * 280, top: Math.floor(i / 5) * 348 });
    await sharp({ create: { width: 5 * 280, height: Math.ceil(slides.length / 5) * 348, channels: 3, background: '#fff' } }).composite(celdas).jpeg({ quality: 82 }).toFile(`${VISTA}.jpg`);
    console.log(`🖼  vista previa en ${VISTA}.jpg`);
}
