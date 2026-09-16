#!/usr/bin/env node
/**
 * ⚠️ ESCRIBE ARCHIVOS NUEVOS en `public/images/products/` (con --aplicar).
 *   No pisa nada: si el destino ya existe, saltea (salvo --rehacer).
 *
 * Convierte una sesión de fotos de producción a las fotos "de rostro" que van
 * en la galería de la tienda, después de las fotos de producto.
 *
 * Qué espera encontrar en la carpeta de la sesión
 * ------------------------------------------------
 * Archivos numerados con el modelo y el color en el nombre:
 *
 *     215 - HERMES C4.jpg          ← foto usable (frente)
 *     216 - HERMES C4.jpg          ← foto usable (tres cuartos)
 *     217 - HERMES C4.jpg          ← foto usable (el armazón en las manos)
 *     218 - HERMES C4.mp4          ← video, se ignora
 *     214 - HERMES C4 - web.jpg    ← NO es una foto
 *
 * Lo de " - web" es una CAPTURA DE PANTALLA de la ficha del producto abierta en
 * la notebook. La fotógrafa la usa de claqueta para separar un modelo del
 * siguiente. Parece la foto elegida para la web y es justo lo contrario: no
 * tiene ni el anteojo puesto ni nada que sirva. Se descartan todas.
 *
 * Qué produce
 * -----------
 * `public/images/products/<modelo>-look-<n>.webp`, que es el nombre que ya
 * usaban las fotos de rostro anteriores (alma-carey-look-1.webp).
 *
 * WebP y no AVIF a propósito: el archivo de `public/` es solo el original que
 * next/image reencodea a AVIF o WebP según el navegador (ver `images.formats`
 * en next.config.ts). El AVIF con copia `.webp` al lado hace falta únicamente
 * para la foto PRINCIPAL, porque el crawler de WhatsApp no lee AVIF y toma
 * `images[0]`; estas van siempre después, nunca de principal.
 *
 * Uso:
 *   node scripts/maintenance/importar-fotos-sesion.mjs --sesion=<carpeta>            (simula)
 *   node scripts/maintenance/importar-fotos-sesion.mjs --sesion=<carpeta> --detalle
 *   node scripts/maintenance/importar-fotos-sesion.mjs --sesion=<carpeta> --aplicar
 *   ... --salida=<carpeta>   para dejarlas fuera del repo y revisarlas antes
 *   ... --por-modelo=2       cuántas fotos entran por modelo (por defecto 3)
 *   ... --rehacer            regenera las que ya existen
 */

import { readdir, stat, mkdir, writeFile, rename, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SALIDA_POR_DEFECTO = 'public/images/products';

// Lado largo, en px. La galería muestra estas fotos a `51vw` en escritorio y a
// `100vw` en celular, y next.config corta los anchos servidos en 1600. Con el
// lado largo en 1400 no falta resolución en ningún tamaño que el sitio pida, y
// sobra poco: subir a 1600 engorda ~30% cada archivo sin que se vea distinto.
const LADO_LARGO = 1400;

// WebP 72: en estas fotos —piel y cortina blanca desenfocada, sin texturas
// finas— no se distingue de 85 al 100%, y pesa casi la mitad.
const CALIDAD = 72;

// sharp suelta el hilo de node mientras comprime, pero decodificar un JPEG de
// 24 megapíxeles son ~700 ms de CPU: sin tope, 300 en paralelo cuelgan la máquina.
const CONCURRENCIA = 4;

const POR_MODELO_POR_DEFECTO = 3;

// ────────────────────────────────────────────────────────────────────────────

function parsearArgumentos(argv) {
  const opciones = {
    aplicar: false,
    detalle: false,
    rehacer: false,
    sesion: null,
    salida: SALIDA_POR_DEFECTO,
    porModelo: POR_MODELO_POR_DEFECTO,
    soloModelos: null,
  };

  for (const arg of argv) {
    if (arg === '--aplicar') opciones.aplicar = true;
    else if (arg === '--detalle') opciones.detalle = true;
    else if (arg === '--rehacer') opciones.rehacer = true;
    else if (arg.startsWith('--sesion=')) opciones.sesion = arg.slice('--sesion='.length);
    else if (arg.startsWith('--salida=')) opciones.salida = arg.slice('--salida='.length);
    else if (arg.startsWith('--por-modelo=')) opciones.porModelo = Number(arg.slice('--por-modelo='.length));
    else if (arg.startsWith('--solo=')) opciones.soloModelos = new Set(arg.slice('--solo='.length).split(',').map((s) => s.trim()).filter(Boolean));
    else {
      console.error(`Argumento desconocido: ${arg}`);
      process.exit(2);
    }
  }

  if (!opciones.sesion) {
    console.error('Falta --sesion=<carpeta con las fotos>');
    process.exit(2);
  }
  if (!Number.isInteger(opciones.porModelo) || opciones.porModelo < 1) {
    console.error(`--por-modelo tiene que ser un entero >= 1 (recibí "${opciones.porModelo}")`);
    process.exit(2);
  }

  return opciones;
}

/** Nombre de archivo a partir del modelo: "ANDRÓMEDA C6" → "andromeda-c6". */
export function claveDeModelo(etiqueta) {
  return etiqueta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Agrupa los archivos de la sesión por modelo.
 *
 * El número de adelante es el orden del rollo, no un identificador: el mismo
 * modelo puede aparecer en tramos separados (ATENEA arranca la sesión y vuelve
 * a salir más adelante). Por eso se agrupa por la ETIQUETA del nombre y se
 * ordena por número dentro del grupo, en vez de cortar por las claquetas.
 */
export function agruparSesion(archivos) {
  const grupos = new Map();

  for (const archivo of archivos) {
    const m = archivo.match(/^(\d+)\s*-\s*(.+?)(\s+-\s+web)?\.(jpe?g|mp4|mov)$/i);
    if (!m) continue;
    const [, numero, etiqueta, esClaqueta, extension] = m;

    const grupo = grupos.get(etiqueta) ?? { etiqueta, clave: claveDeModelo(etiqueta), fotos: [], claquetas: 0, videos: 0 };
    if (esClaqueta) grupo.claquetas++;
    else if (/^(mp4|mov)$/i.test(extension)) grupo.videos++;
    else grupo.fotos.push({ archivo, numero: Number(numero) });
    grupos.set(etiqueta, grupo);
  }

  for (const grupo of grupos.values()) grupo.fotos.sort((a, b) => a.numero - b.numero);
  return [...grupos.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

async function existe(ruta) {
  try {
    await access(ruta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica que lo generado sea una imagen usable: que abra, que sea WebP, que
 * no pase del lado largo pedido y que decodifique entera. `stats()` fuerza la
 * decodificación completa — leer el encabezado no detecta un archivo truncado.
 */
async function verificarImagen(origen, ladoLargo) {
  const metadata = await sharp(origen).metadata();
  if (metadata.format !== 'webp') throw new Error(`quedó en ${metadata.format}, esperaba webp`);
  if (!metadata.width || !metadata.height) throw new Error('quedó sin dimensiones');
  if (Math.max(metadata.width, metadata.height) > ladoLargo) {
    throw new Error(`quedó de ${metadata.width}x${metadata.height}, el lado largo máximo es ${ladoLargo}`);
  }
  await sharp(origen).stats();
}

async function convertir(origen, destino, opciones) {
  const relativo = path.relative(RAIZ, destino);
  const bytesAntes = (await stat(origen)).size;

  if (!opciones.rehacer && (await existe(destino))) {
    return { relativo, estado: 'ya-estaba', bytesAntes };
  }

  let salida;
  let metadata;
  try {
    metadata = await sharp(origen).metadata();
    salida = await sharp(origen)
      // Aplica al píxel la orientación del EXIF. Es no-op si no hay EXIF, pero
      // sin esto una foto tomada de costado sale rotada: hoy la endereza el
      // navegador leyendo el EXIF, y el reencode descarta ese EXIF.
      .rotate()
      .resize({ width: LADO_LARGO, height: LADO_LARGO, fit: 'inside', withoutEnlargement: true })
      // Conserva el perfil de color. Sin el ICC, las fotos tomadas en un
      // espacio ancho salen desaturadas: en piel se nota enseguida.
      .keepIccProfile()
      .webp({ quality: CALIDAD, effort: 5 })
      .toBuffer();
  } catch (error) {
    return { relativo, estado: 'error', motivo: `falló el reencode: ${error.message}`, bytesAntes };
  }

  const resultado = {
    relativo,
    estado: opciones.aplicar ? 'escrita' : 'a-escribir',
    origen: path.basename(origen),
    anchoAntes: metadata.width,
    altoAntes: metadata.height,
    bytesAntes,
    bytesDespues: salida.length,
  };

  if (!opciones.aplicar) {
    // En simulación también se verifica: si el resultado no abre, queremos
    // saberlo ahora y no el día que alguien corra --aplicar a ciegas.
    try {
      await verificarImagen(salida, LADO_LARGO);
    } catch (error) {
      return { relativo, estado: 'error', motivo: `el resultado no verifica: ${error.message}`, bytesAntes };
    }
    return resultado;
  }

  // Escribir al lado y renombrar: el rename es atómico dentro del mismo
  // filesystem, así que nunca queda un archivo a medias si se corta la corrida.
  // Y se verifica el archivo YA ESCRITO EN DISCO, no el buffer en memoria — es
  // lo único que prueba que lo que va a quedar sirve.
  const temporal = `${destino}.importando`;
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(temporal, salida);
    await verificarImagen(temporal, LADO_LARGO);
    await rename(temporal, destino);
  } catch (error) {
    await unlink(temporal).catch(() => {});
    return { relativo, estado: 'error', motivo: `no se escribió: ${error.message}`, bytesAntes };
  }

  return resultado;
}

// ────────────────────────────────────────────────────────────────────────────

function kb(bytes) {
  return `${Math.round(bytes / 1000)} KB`;
}

function mb(bytes) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

async function conLimite(items, limite, tarea) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const indice = siguiente++;
      resultados[indice] = await tarea(items[indice], indice);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}

async function main() {
  const opciones = parsearArgumentos(process.argv.slice(2));
  const dirSesion = path.resolve(RAIZ, opciones.sesion);
  const dirSalida = path.resolve(RAIZ, opciones.salida);

  console.log(`Sesión:      ${dirSesion}`);
  console.log(`Salida:      ${path.relative(RAIZ, dirSalida) || '.'}`);
  console.log(`Lado largo:  ${LADO_LARGO}px · WebP calidad ${CALIDAD}`);
  console.log(`Por modelo:  hasta ${opciones.porModelo} foto/s`);
  console.log(`Modo:        ${opciones.aplicar ? '⚠️  APLICAR (escribe archivos)' : 'simulación'}`);

  const archivos = await readdir(dirSesion);
  let grupos = agruparSesion(archivos);
  if (opciones.soloModelos) grupos = grupos.filter((g) => opciones.soloModelos.has(g.clave));

  const claquetas = grupos.reduce((a, g) => a + g.claquetas, 0);
  const videos = grupos.reduce((a, g) => a + g.videos, 0);
  const fotos = grupos.reduce((a, g) => a + g.fotos.length, 0);
  console.log(`\nModelos: ${grupos.length} · fotos: ${fotos} · claquetas descartadas: ${claquetas} · videos ignorados: ${videos}`);

  const sinFotos = grupos.filter((g) => g.fotos.length === 0);
  if (sinFotos.length) {
    console.log(`\n⚠️  Modelos sin ninguna foto usable: ${sinFotos.length}`);
    for (const g of sinFotos) console.log(`   ${g.etiqueta} (${g.claquetas} claqueta/s, ${g.videos} video/s)`);
  }

  const tareas = [];
  for (const grupo of grupos) {
    grupo.fotos.slice(0, opciones.porModelo).forEach((foto, i) => {
      tareas.push({
        grupo,
        origen: path.join(dirSesion, foto.archivo),
        destino: path.join(dirSalida, `${grupo.clave}-look-${i + 1}.webp`),
      });
    });
  }

  console.log(`\nA convertir: ${tareas.length} imágenes. Esto tarda un rato…`);

  let hechas = 0;
  const resultados = await conLimite(tareas, CONCURRENCIA, async (tarea) => {
    const resultado = await convertir(tarea.origen, tarea.destino, opciones);
    hechas++;
    if (hechas % 25 === 0) console.log(`  … ${hechas}/${tareas.length}`);
    return { ...resultado, etiqueta: tarea.grupo.etiqueta };
  });

  const hechasOk = resultados.filter((r) => r.estado === 'a-escribir' || r.estado === 'escrita');
  const yaEstaban = resultados.filter((r) => r.estado === 'ya-estaba');
  const errores = resultados.filter((r) => r.estado === 'error');

  if (opciones.detalle) {
    console.log('');
    for (const r of hechasOk) {
      console.log(`  ${r.relativo}\n    ${r.origen} · ${r.anchoAntes}x${r.altoAntes} · ${mb(r.bytesAntes)} → ${kb(r.bytesDespues)}`);
    }
  }

  if (errores.length) {
    console.log('\nErrores (no se escribió nada de estas):');
    for (const r of errores) console.log(`  ${r.relativo} — ${r.motivo}`);
  }

  const antes = hechasOk.reduce((a, r) => a + r.bytesAntes, 0);
  const despues = hechasOk.reduce((a, r) => a + r.bytesDespues, 0);
  const pesos = hechasOk.map((r) => r.bytesDespues).sort((a, b) => a - b);

  console.log('\n' + '─'.repeat(70));
  console.log(`Modelos:            ${grupos.length}`);
  console.log(`${opciones.aplicar ? 'Escritas:' : 'A escribir:'}         ${hechasOk.length}`);
  console.log(`Ya estaban:         ${yaEstaban.length}`);
  console.log(`Errores:            ${errores.length}`);
  if (pesos.length) {
    console.log(`Peso por foto:      ${kb(pesos[0])} la más liviana · ${kb(pesos[Math.floor(pesos.length / 2)])} la mediana · ${kb(pesos[pesos.length - 1])} la más pesada`);
    console.log(`Peso total:         ${mb(antes)} de originales → ${mb(despues)}`);
  }
  console.log('─'.repeat(70));

  if (!opciones.aplicar) {
    console.log('\nSIMULACIÓN — no se escribió ningún archivo.');
    console.log('Para aplicarlo de verdad: agregá --aplicar');
  }

  process.exitCode = errores.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('Falló la corrida:', error);
  process.exit(1);
});
