#!/usr/bin/env node
/**
 * Carruseles del FEED con las fotos de Agostina y de Massaru: frente + perfil.
 *
 *   node scripts/social/generar-feed-modelos.mjs                 # todos
 *   node scripts/social/generar-feed-modelos.mjs helena-c4       # uno solo
 *   node scripts/social/generar-feed-modelos.mjs --fotos-agos <carpeta> --fotos-massaru <carpeta>
 *   node scripts/social/generar-feed-modelos.mjs --vista /tmp/feed   # hojas de vista previa
 *
 * POR QUÉ EXISTE. Ishtar, 16/10/2026: "lanzá en feed alternados imágenes de
 * Agostina frente/perfil y alternadas de Massaru". El cron del feed
 * (/api/cron/social-feed?que=modelo) publica UN modelo por día, un día
 * Agostina y el otro Massaru, leyendo `social/feed-modelos.json`; este script
 * arma las placas y reescribe ese carril.
 *
 * MISMA PLACA QUE LAS STORIES (aprobada el 29/9/2026), en 4:5: Instagram no
 * acepta una 9:16 en un carrusel del feed. Cada carrusel son 2 slides: frente
 * y perfil. Sin precio: `fuente: "fotos-*"`, no vence (R6 no aplica).
 *
 * TODAS LAS CABEZAS A LA MISMA ALTURA Y DEL MISMO TAMAÑO (Ishtar, 16/10: "en
 * el feed se nota mucho"): el recorte lo hace `alinear-cara.mjs` con Vision,
 * fijando la línea de los ojos y el alto de la cara en el mismo punto de todas
 * las placas. Por eso se parte de las fotos ORIGINALES de las dos sesiones (hay
 * aire para encuadrar) y no de las fotos cuadradas de la tienda ni de las
 * stories, que ya vienen recortadas. Las dos sesiones llevan el mismo retoque
 * (`retoque-foto.mjs`), el de las stories de Agos.
 *
 * Las fotos fuente NO viven en el repo: la carpeta de Agos y la de originales
 * de Massaru se pasan con `--fotos-agos` / `--fotos-massaru` o se toman del
 * escritorio de Ishtar. Un modelo sin foto se salta y se avisa.
 *
 * SALIDA: public/social/feed-<agos|massaru>-<modelo>/01.jpg y 02.jpg (JPEG
 * real), social/contenido/feed-<...>.json y social/feed-modelos.json entero.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { ANCHO, ALTO } from './alinear-cara.mjs';
import { cargarSesiones, cargarLogo, renderizarSlide, titulo, alt, LEYENDA, CONDICIONES, RECETA, OPCIONES_FOTOS } from './feed-modelos-comun.mjs';

const sharp = createRequire(import.meta.url)('sharp');

const args = process.argv.slice(2);
const OPCIONES = [...OPCIONES_FOTOS, '--vista'];
const valor = (op) => (args.includes(op) ? args[args.indexOf(op) + 1] : null);
const soloUno = args.find((a, i) => !a.startsWith('--') && !OPCIONES.includes(args[i - 1]));
const VISTA = valor('--vista');

const { sesiones: SESIONES, salteados } = cargarSesiones(args);

// ── 2. Renderizar ───────────────────────────────────────────────────────────
const id = await cargarIdentidad();
const identidad = { id, logo: cargarLogo(id) };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: ANCHO, height: ALTO } });

const generadas = [];
for (const sesion of SESIONES) {
    for (const pieza of sesion.piezas) {
        const { piezaId, slug, nombre, color, familia } = pieza;
        if (soloUno && slug !== soloUno) continue;
        if (pieza.fotos.length < 2) { salteados.push(`${piezaId}: tiene una sola foto y un carrusel necesita dos`); continue; }
        const salida = path.join(RAIZ, 'public', 'social', piezaId);
        rmSync(salida, { recursive: true, force: true });
        mkdirSync(salida, { recursive: true });
        for (const [i, role] of ['frente', 'perfil'].entries()) {
            await renderizarSlide(page, identidad, sesion, pieza, role, path.join(salida, `${String(i + 1).padStart(2, '0')}.jpg`));
        }
        writeFileSync(path.join(RAIZ, 'social', 'contenido', `${piezaId}.json`), JSON.stringify({
            id: piezaId,
            format: '4:5',
            theme: 'dark',
            pilar: sesion.pilar,
            fuente: sesion.fuente,   // sin precio adentro: no vence (R6 no aplica)
            temas: ['armazones', familia],
            producto: { nombre, color, familia },
            caption: `${titulo(pieza)} · ${sesion.marca}\n${LEYENDA[familia]}. ${CONDICIONES}`,
            slides: ['frente', 'perfil'].map((role, i) => ({
                type: 'foto',
                role,
                image: `social/${piezaId}/${String(i + 1).padStart(2, '0')}.jpg`,
                alt: alt(pieza, role, sesion.marca),
            })),
        }, null, 2) + '\n');
        generadas.push(piezaId);
        console.log(`✅ ${piezaId}`);
    }
}
await browser.close();

/**
 * El carril de cada sesión, intercalando familias: receta es la mayoría, así
 * que entre cada tanto de receta cae una de sol o clip-on y no salen cinco
 * de sol seguidas (mismo criterio que el carril de stories de Agostina).
 */
function intercalar(entradas) {
    const receta = entradas.filter(e => e.tipo === RECETA);
    const otras = entradas.filter(e => e.tipo !== RECETA);
    if (!receta.length || !otras.length) return entradas;
    const [mayor, menor] = receta.length >= otras.length ? [receta, otras] : [otras, receta];
    const paso = Math.max(1, Math.floor(mayor.length / menor.length));
    const out = [];
    let k = 0;
    for (const e of mayor) {
        out.push(e);
        if (++k % paso === 0 && menor.length) out.push(menor.shift());
    }
    return [...out, ...menor];
}

if (!soloUno) {
    const ruta = path.join(RAIZ, 'social', 'feed-modelos.json');
    const previo = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf-8')) : {};
    const carriles = Object.fromEntries(SESIONES.map(s => [s.pilar, intercalar(s.piezas.filter(p => p.fotos.length >= 2).map(p => ({ id: p.piezaId, tipo: p.familia })))]));
    writeFileSync(ruta, JSON.stringify({ _comentario: previo._comentario || [], carriles }, null, 2) + '\n');
    for (const [p, c] of Object.entries(carriles)) console.log(`📋 carril "${p}": ${c.length} modelos`);
}
if (salteados.length) {
    console.log(`\n⚠ ${salteados.length} modelo(s) sin carrusel:`);
    for (const s of salteados) console.log(`   ${s}`);
}

// Vista previa: una fila por modelo, para mostrar ANTES de que salga nada.
if (VISTA) {
    const filas = [];
    for (const g of generadas) {
        filas.push(await Promise.all([1, 2].map(i =>
            sharp(path.join(RAIZ, 'public', 'social', g, `${String(i).padStart(2, '0')}.jpg`)).resize(216, 270).toBuffer())));
    }
    const porHoja = 20;
    for (let h = 0; h * porHoja < filas.length; h++) {
        const tanda = filas.slice(h * porHoja, (h + 1) * porHoja), comp = [];
        tanda.forEach((celdas, k) => celdas.forEach((input, c) => comp.push({ input, left: (k % 4) * 456 + c * 224, top: Math.floor(k / 4) * 278 })));
        await sharp({ create: { width: 4 * 456, height: Math.ceil(tanda.length / 4) * 278, channels: 3, background: '#fff' } })
            .composite(comp).jpeg({ quality: 80 }).toFile(`${VISTA}-${h + 1}.jpg`);
    }
    console.log(`🖼  vista previa en ${VISTA}-N.jpg`);
}
