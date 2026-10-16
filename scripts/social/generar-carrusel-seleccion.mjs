#!/usr/bin/env node
/**
 * UN carrusel del feed con VARIOS modelos: "todos los Victoria en una publi",
 * "los de acetato con fotos de Agostina" (Ishtar, 16/10/2026).
 *
 *   node scripts/social/generar-carrusel-seleccion.mjs --nombre Victoria
 *   node scripts/social/generar-carrusel-seleccion.mjs --acetato --sesion agos
 *   node scripts/social/generar-carrusel-seleccion.mjs --nombre Victoria --slides frente
 *        [--id <pieza>] [--fotos-agos <carpeta>] [--fotos-massaru <carpeta>]
 *
 * --nombre <Nombre>  todos los colores de ese modelo (en las dos sesiones, o
 *                    solo en --sesion agos|massaru).
 * --acetato          los modelos cuya ficha dice "en acetato" (lo lee de la
 *                    base: PROD_DATABASE_URL si está, si no la local; queda
 *                    anotado en `generadoDesde`). Un armazón sin ficha o sin
 *                    material en el alt no entra: no se afirma un material que
 *                    quizá no es.
 * --slides ambas|frente  frente + perfil de cada modelo (por defecto si entran
 *                    en una publicación) o solo el frente.
 *
 * Instagram acepta HASTA 10 slides por carrusel: si la selección no entra, se
 * parte en varias piezas numeradas (<id>-1, <id>-2, …) y cada una es una
 * publicación. Las placas son las mismas del feed de modelos
 * (feed-modelos-comun.mjs): cabezas alineadas, misma leyenda, sin precio.
 *
 * SALIDA: public/social/<id>/NN.jpg y social/contenido/<id>.json. NO publica
 * ni programa nada: se publica con
 *   node scripts/social/publicar-directo.mjs social/<id> "<caption>" --instagram --facebook
 * o se agrega a social/feed-programacion.json con su fecha.
 */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { ANCHO, ALTO } from './alinear-cara.mjs';
import { cargarSesiones, cargarLogo, renderizarSlide, rolesDe, titulo, alt, LEYENDA, CONDICIONES, OPCIONES_FOTOS } from './feed-modelos-comun.mjs';

const TOPE_SLIDES_INSTAGRAM = 10;
const args = process.argv.slice(2);
const valor = (op) => (args.includes(op) ? args[args.indexOf(op) + 1] : null);
const NOMBRE = valor('--nombre');
const ACETATO = args.includes('--acetato');
const SESION = valor('--sesion');
const SLIDES = valor('--slides') || 'ambas';
if (!NOMBRE && !ACETATO) {
    console.error('Decime qué modelos: --nombre <Nombre> o --acetato.');
    process.exit(1);
}
const normal = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const { sesiones } = cargarSesiones(args.filter((a, i) => OPCIONES_FOTOS.includes(a) || OPCIONES_FOTOS.includes(args[i - 1])));

// ── Qué modelos entran ──────────────────────────────────────────────────────
let generadoDesde = null;
let acetatos = null;
if (ACETATO) {
    const { PrismaClient } = await import('@prisma/client');
    const desdeProduccion = Boolean(process.env.PROD_DATABASE_URL);
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL } } });
    try {
        const fichas = await prisma.webProduct.findMany({ where: { isActive: true }, select: { slug: true, imageAlts: true } });
        // El material sale del alt de la foto, igual que en la ficha
        // (src/lib/catalog/frame-specs.ts: ", en acetato").
        acetatos = new Set(fichas.filter(f => f.imageAlts.some(a => /,\s*en\s+acetato/i.test(a))).map(f => f.slug));
    } finally { await prisma.$disconnect(); }
    generadoDesde = desdeProduccion ? 'produccion' : 'local';
    console.log(`${acetatos.size} fichas activas de acetato (base ${generadoDesde})`);
}

const seleccion = [];
for (const sesion of sesiones) {
    if (SESION && sesion.nombre !== SESION) continue;
    for (const pieza of sesion.piezas) {
        if (NOMBRE && normal(pieza.nombre) !== normal(NOMBRE)) continue;
        if (acetatos && !acetatos.has(pieza.slug)) continue;
        seleccion.push({ sesion, pieza });
    }
}
if (!seleccion.length) { console.error('Ningún modelo coincide con esa selección.'); process.exit(1); }
console.log(`${seleccion.length} modelos: ${seleccion.map(s => titulo(s.pieza)).join(', ')}`);

const roles = SLIDES === 'frente' || seleccion.length * 2 > TOPE_SLIDES_INSTAGRAM && SLIDES !== 'ambas-si-o-si'
    ? ['frente'] : ['frente', 'perfil'];
if (SLIDES === 'ambas' && roles.length === 1) console.log(`Son más de ${TOPE_SLIDES_INSTAGRAM / 2} modelos: va solo el frente de cada uno.`);

const slides = seleccion.flatMap(({ sesion, pieza }) => roles.filter(r => rolesDe(pieza).includes(r)).map(role => ({ sesion, pieza, role })));
const partes = [];
for (let i = 0; i < slides.length; i += TOPE_SLIDES_INSTAGRAM) partes.push(slides.slice(i, i + TOPE_SLIDES_INSTAGRAM));

const base = valor('--id') || (NOMBRE ? `carrusel-${normal(NOMBRE).replace(/[^a-z0-9]+/g, '-')}` : `carrusel-acetato${SESION ? '-' + SESION : ''}`);
const que = NOMBRE ? `Todos los ${NOMBRE}` : 'Armazones de acetato';

// ── Render ──────────────────────────────────────────────────────────────────
const id = await cargarIdentidad();
const identidad = { id, logo: cargarLogo(id) };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: ANCHO, height: ALTO } });

for (const [k, parte] of partes.entries()) {
    const piezaId = partes.length > 1 ? `${base}-${k + 1}` : base;
    const salida = path.join(RAIZ, 'public', 'social', piezaId);
    rmSync(salida, { recursive: true, force: true });
    mkdirSync(salida, { recursive: true });
    for (const [i, { sesion, pieza, role }] of parte.entries()) {
        await renderizarSlide(page, identidad, sesion, pieza, role, path.join(salida, `${String(i + 1).padStart(2, '0')}.jpg`));
    }
    const modelos = [...new Set(parte.map(s => titulo(s.pieza)))];
    const marcas = [...new Set(parte.map(s => s.sesion.marca))];
    const familias = [...new Set(parte.map(s => s.pieza.familia))];
    const pilares = [...new Set(parte.map(s => s.sesion.pilar))];
    const caption = `${que}${partes.length > 1 ? ` (${k + 1}/${partes.length})` : ''} · ${marcas.join(' y ')}\n`
        + `${modelos.join(' · ')}\n${CONDICIONES}`;
    writeFileSync(path.join(RAIZ, 'social', 'contenido', `${piezaId}.json`), JSON.stringify({
        id: piezaId,
        format: '4:5',
        theme: 'dark',
        pilar: pilares.length === 1 ? pilares[0] : 'modelos',
        fuente: pilares.length === 1 ? `fotos-${pilares[0]}` : 'fotos-modelos',   // sin precio: no vence (R6 no aplica)
        ...(generadoDesde ? { generadoDesde, criterio: 'ficha activa cuyo alt dice "en acetato"' } : {}),
        temas: ['armazones', ...familias],
        seleccion: { nombre: NOMBRE || null, acetato: ACETATO, modelos },
        caption,
        slides: parte.map(({ sesion, pieza, role }, i) => ({
            type: 'foto',
            role,
            image: `social/${piezaId}/${String(i + 1).padStart(2, '0')}.jpg`,
            alt: alt(pieza, role, sesion.marca),
        })),
    }, null, 2) + '\n');
    console.log(`✅ ${piezaId}: ${parte.length} slides`);
    console.log(`   publicar: node scripts/social/publicar-directo.mjs social/${piezaId} ${JSON.stringify(caption.split('\n')[0])} --instagram --facebook`);
}
await browser.close();
