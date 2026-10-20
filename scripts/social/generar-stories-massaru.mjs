#!/usr/bin/env node
/**
 * Stories de catálogo con las fotos de Massaru (sesión del 6/10/2026).
 *
 *   node scripts/social/generar-stories-massaru.mjs --fotos <carpeta>          # todas
 *   node scripts/social/generar-stories-massaru.mjs --fotos <carpeta> hermes-c1
 *   ... --vista /tmp/vista   hojas de vista previa para mostrar ANTES de subir
 *
 * MISMO FORMATO que las de Agostina (Ishtar, 16/10/2026: "armá las stories con
 * el formato que te envío"): la placa sale de placa-story-modelo.mjs, la misma
 * función que usa generar-stories-agostina.mjs.
 *
 * DIFERENCIA CON LAS DE AGOS: acá la foto ya viene EDITADA (luz cálida, granito
 * corregido, sombras del armazón suavizadas a la mitad, fondo limpio) por
 * scripts/maintenance/fotos-sesion/editar.mjs con STORY=1, que entrega la franja
 * 9:16 de 1080×1920 con la cabeza al ~42 % del alto. Este script solo le pone la
 * placa. `--fotos` es la carpeta con esas fotos, nombradas por el número de la
 * foto original (`147.jpg`).
 *
 * SECUENCIA por modelo: frente → perfil (las de Massaru no tienen foto del
 * anteojo en manos salvo 4 especiales, que no van a stories).
 *
 * PARA QUÉ: subirlas con publicar-stories-directo.mjs y pasarlas a destacados.
 * NO tocan el carril diario (social/stories-diarias.json).
 *
 * QUÉ MODELOS: los de la sesión con ficha activa en la tienda (16/10/2026).
 * Afuera hasta que Ishtar confirme: Saturno (en la foto es blanco con celeste y
 * la ficha es negra), Isis (cristal hexagonal; la ficha, redondo) y el armazón
 * azul jaspeado que no está cargado.
 *
 * SALIDA: public/social/story-massaru-<modelo>/NN.jpg (JPEG real, Instagram no
 * acepta PNG renombrado) y social/contenido/story-massaru-<modelo>.json.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { cargarIdentidad, RAIZ } from './identidad.mjs';
import { renderizarPlaca } from './placa-story-modelo.mjs';
import { MODELOS as M, RECETA, SOL } from './modelos-massaru.mjs';

const sharp = createRequire(import.meta.url)('sharp');

const args = process.argv.slice(2);
const valor = (op) => (args.includes(op) ? args[args.indexOf(op) + 1] : null);
const FOTOS = valor('--fotos');
const VISTA = valor('--vista');
const soloUno = args.find((a, i) => !a.startsWith('--') && !['--fotos', '--vista'].includes(args[i - 1]));
if (!FOTOS || !existsSync(FOTOS)) {
    console.error('Falta --fotos <carpeta con las fotos 9:16 editadas (147.jpg, …)>.');
    process.exit(1);
}

// La lista de modelos y sus fotos vive en modelos-massaru.mjs (la comparte
// con generar-feed-modelos.mjs).
const LEYENDA = { [RECETA]: 'Armazón de receta', [SOL]: 'Lentes de sol' };
const ROLES = ['frente', 'perfil'];

const id = await cargarIdentidad();
const logo = 'data:image/png;base64,' + readFileSync(id.logo).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

const generadas = [];
for (const [slug, nombre, color, familia, numeros] of M) {
    if (soloUno && slug !== soloUno) continue;
    const piezaId = `story-massaru-${slug}`;
    const salida = path.join(RAIZ, 'public', 'social', piezaId);
    rmSync(salida, { recursive: true, force: true });
    mkdirSync(salida, { recursive: true });
    for (const [i, n] of numeros.entries()) {
        const fuente = path.join(FOTOS, `${n}.jpg`);
        if (!existsSync(fuente)) throw new Error(`Falta la foto editada ${fuente}`);
        const fotoJpg = await sharp(fuente).resize(1080, 1920).jpeg({ quality: 92 }).toBuffer();
        const destino = path.join(salida, `${String(i + 1).padStart(2, '0')}.jpg`);
        await renderizarPlaca(page, { id, logo, fotoJpg, leyenda: LEYENDA[familia], nombre, color, destino });
    }
    writeFileSync(path.join(RAIZ, 'social', 'contenido', `${piezaId}.json`), JSON.stringify({
        id: piezaId,
        format: '9:16',
        theme: 'dark',
        pilar: 'massaru',
        fuente: 'fotos-massaru',   // sin precio adentro: no vence (R6 no aplica)
        temas: ['armazones', familia],
        producto: { nombre, color, familia },
        caption: `${nombre}${color ? ' ' + color : ''} · Atelier Óptica`,
        slides: numeros.map((_, i) => ({ type: 'foto', role: ROLES[i] || 'foto', image: `social/${piezaId}/${String(i + 1).padStart(2, '0')}.jpg` })),
    }, null, 2) + '\n');
    generadas.push({ id: piezaId, slides: numeros.length });
    console.log(`✅ ${piezaId} (${numeros.length} slides)`);
}
await browser.close();

if (VISTA) {
    const filas = [];
    for (const g of generadas) {
        const celdas = [];
        for (let i = 1; i <= g.slides; i++) celdas.push(await sharp(path.join(RAIZ, 'public', 'social', g.id, `${String(i).padStart(2, '0')}.jpg`)).resize(216, 384).toBuffer());
        filas.push(celdas);
    }
    const porHoja = 10;
    for (let h = 0; h * porHoja < filas.length; h++) {
        const tanda = filas.slice(h * porHoja, (h + 1) * porHoja), comp = [];
        tanda.forEach((celdas, k) => celdas.forEach((input, c) => comp.push({ input, left: (k % 5) * 456 + c * 224, top: Math.floor(k / 5) * 392 })));
        await sharp({ create: { width: 5 * 456, height: Math.ceil(tanda.length / 5) * 392, channels: 3, background: '#fff' } })
            .composite(comp).jpeg({ quality: 80 }).toFile(`${VISTA}-${h + 1}.jpg`);
    }
    console.log(`🖼  vista previa en ${VISTA}-N.jpg`);
}
