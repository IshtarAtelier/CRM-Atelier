#!/usr/bin/env node
/**
 * ⚠️ ESTE SCRIPT REEMPLAZA ARCHIVOS DE `public/` (con --aplicar).
 *
 * Baja las imágenes gigantes de `public/` a un ancho máximo razonable (1600px
 * por defecto), manteniendo el formato de cada una.
 *
 * Por qué existe: `public/` tenía 324 imágenes de más de 1600px de ancho —
 * varias de 6160x4640, la resolución cruda que sale de la cámara del catálogo.
 * Ningún lugar de la tienda las muestra a más de ~800px, así que cada visita
 * desde un celular en 4G descarga y decodifica píxeles que nadie ve. El costo
 * no son solo los MB: decodificar un JPEG de 28 megapíxeles pide ~114 MB de RAM
 * en el navegador y congela el scroll en un teléfono barato.
 *
 * Reglas que el script respeta siempre:
 *   · SIMULA por defecto. Sin --aplicar no escribe un solo byte.
 *   · NUNCA agranda: una imagen de 900px de ancho no se toca (doble guarda —
 *     se saltea antes de procesar y además va `withoutEnlargement`).
 *   · NUNCA cambia de formato: un JPEG sale JPEG, un AVIF sale AVIF.
 *   · NUNCA reemplaza sin verificar antes que el resultado abre y decodifica.
 *   · NUNCA deja el archivo más pesado de lo que estaba: si el reencode engorda
 *     (pasa con PNG chicos ya optimizados), se descarta y queda el original.
 *
 * Uso:
 *   node scripts/maintenance/achicar-imagenes-public.mjs             (simula)
 *   node scripts/maintenance/achicar-imagenes-public.mjs --detalle   (simula, lista todo)
 *   node scripts/maintenance/achicar-imagenes-public.mjs --ancho=1200
 *   node scripts/maintenance/achicar-imagenes-public.mjs --aplicar   (reemplaza)
 *
 * Después de --aplicar: las imágenes están commiteadas en git, así que el
 * `git diff` va a ser enorme y binario. Revisar unas cuantas a ojo antes de
 * commitear, y tener en cuenta que cualquier `<Image width= height= />` con las
 * medidas viejas hardcodeadas hay que actualizarlo.
 */

import { readdir, stat, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ANCHO_POR_DEFECTO = 1600;

// Cuántas imágenes se procesan a la vez. sharp libera el hilo de node mientras
// comprime, pero un AVIF de 6000px come ~700ms de CPU: sin tope, 324 en
// paralelo dejan la máquina inutilizable.
const CONCURRENCIA = 4;

// Calidades elegidas para que el reencode no se note a simple vista. AVIF 55
// equivale más o menos a JPEG 85; es la escala del códec, no un descuido.
const CODIFICADORES = {
  jpeg: (img) => img.jpeg({ quality: 85, mozjpeg: true }),
  png: (img) => img.png({ compressionLevel: 9, effort: 8 }),
  webp: (img) => img.webp({ quality: 85, effort: 5 }),
  avif: (img) => img.avif({ quality: 55, effort: 4 }),
};

// Carpetas que no se tocan aunque tengan imágenes grandes.
const EXCLUIDAS = [
  // Las piezas de redes las genera scripts/social/ y las consume Meta bajándolas
  // por URL pública. Si una pieza tiene que pesar menos, se cambia la plantilla
  // y se vuelve a renderizar — reescribir el JPEG publicado a mano lo desincroniza
  // del PNG master (que ni siquiera está en git).
  'public/social',
];

const EXTENSIONES = /\.(jpe?g|png|webp|avif)$/i;

// ────────────────────────────────────────────────────────────────────────────

function parsearArgumentos(argv) {
  const opciones = {
    aplicar: false,
    detalle: false,
    ancho: ANCHO_POR_DEFECTO,
    dir: 'public',
  };

  for (const arg of argv) {
    if (arg === '--aplicar') opciones.aplicar = true;
    else if (arg === '--detalle') opciones.detalle = true;
    else if (arg.startsWith('--ancho=')) opciones.ancho = Number(arg.slice('--ancho='.length));
    else if (arg.startsWith('--dir=')) opciones.dir = arg.slice('--dir='.length);
    else {
      console.error(`Argumento desconocido: ${arg}`);
      process.exit(2);
    }
  }

  if (!Number.isInteger(opciones.ancho) || opciones.ancho < 100) {
    console.error(`--ancho tiene que ser un entero >= 100 (recibí "${opciones.ancho}")`);
    process.exit(2);
  }

  return opciones;
}

async function listarImagenes(dirAbsoluto) {
  const encontradas = [];

  async function recorrer(dir) {
    const entradas = await readdir(dir, { withFileTypes: true });
    for (const entrada of entradas) {
      const completo = path.join(dir, entrada.name);
      const relativo = path.relative(RAIZ, completo);
      if (EXCLUIDAS.some((ex) => relativo === ex || relativo.startsWith(`${ex}${path.sep}`))) continue;
      if (entrada.isDirectory()) await recorrer(completo);
      else if (entrada.isFile() && EXTENSIONES.test(entrada.name)) encontradas.push(completo);
    }
  }

  await recorrer(dirAbsoluto);
  return encontradas.sort();
}

/**
 * Traduce lo que reporta sharp al codificador que corresponde. Ojo con dos cosas:
 *  · sharp llama 'heif' a todo el contenedor; el AVIF se distingue por compression 'av1'.
 *  · mandan los BYTES, no la extensión. En public/ hay 9 archivos .png que por
 *    dentro son JPEG; reencodearlos como PNG los haría pesar el triple.
 */
function formatoDeSalida(metadata) {
  if (metadata.format === 'heif' && metadata.compression === 'av1') return 'avif';
  if (metadata.format === 'jpeg') return 'jpeg';
  if (metadata.format === 'png') return 'png';
  if (metadata.format === 'webp') return 'webp';
  return null;
}

/**
 * Verifica que el resultado (un buffer en simulación, el archivo temporal en
 * --aplicar) sea una imagen usable: que abra, que mantenga el formato, que no
 * pase del ancho pedido y que decodifique entera. `stats()` fuerza la
 * decodificación completa de los píxeles — leer el header no alcanza para
 * detectar un archivo truncado.
 */
async function verificarImagen(origen, formatoEsperado, anchoMaximo) {
  const metadata = await sharp(origen).metadata();
  const formato = formatoDeSalida(metadata);
  if (formato !== formatoEsperado) {
    throw new Error(`quedó en formato ${formato ?? metadata.format}, esperaba ${formatoEsperado}`);
  }
  // Se compara con <= y no con == porque una foto con orientación EXIF que
  // rota 90° termina más angosta que el ancho pedido: sigue siendo correcta.
  if (!metadata.width || metadata.width > anchoMaximo) {
    throw new Error(`quedó de ${metadata.width}px de ancho, el máximo es ${anchoMaximo}`);
  }
  await sharp(origen).stats();
}

async function procesarImagen(archivo, opciones) {
  const relativo = path.relative(RAIZ, archivo);
  const bytesAntes = (await stat(archivo)).size;

  let metadata;
  try {
    metadata = await sharp(archivo).metadata();
  } catch (error) {
    return { relativo, estado: 'error', motivo: `no se pudo leer: ${error.message}`, bytesAntes };
  }

  const formato = formatoDeSalida(metadata);
  if (!formato) {
    return { relativo, estado: 'salteada', motivo: `formato no soportado (${metadata.format})`, bytesAntes };
  }

  // GIF/WebP animados: reencodearlos sin `animated: true` se queda con el primer
  // cuadro y mata la animación en silencio. Hoy no hay ninguna en public/, pero
  // el día que entre una no la queremos romper.
  if (metadata.pages > 1) {
    return { relativo, estado: 'salteada', motivo: `animada (${metadata.pages} cuadros)`, bytesAntes };
  }

  // Primera guarda contra agrandar: si ya entra en el ancho objetivo, no se toca.
  // Reencodearla "por las dudas" sería perder calidad a cambio de nada.
  if (!metadata.width || metadata.width <= opciones.ancho) {
    return { relativo, estado: 'ya-chica', ancho: metadata.width, bytesAntes };
  }

  const alturaNueva = Math.round((metadata.height * opciones.ancho) / metadata.width);

  let salida;
  try {
    const pipeline = sharp(archivo)
      // Aplica la orientación del EXIF a los píxeles. Es no-op si no hay EXIF,
      // pero sin esto una foto tomada de costado saldría rotada: el navegador
      // hoy la endereza leyendo el EXIF, y el reencode descarta ese EXIF.
      .rotate()
      .resize({ width: opciones.ancho, withoutEnlargement: true }) // segunda guarda contra agrandar
      // Conserva el perfil de color y tira el resto de los metadatos. Sin el ICC,
      // las fotos de catálogo tomadas en un espacio ancho se ven desaturadas.
      .keepIccProfile();

    salida = await CODIFICADORES[formato](pipeline).toBuffer();
  } catch (error) {
    return { relativo, estado: 'error', motivo: `falló el reencode: ${error.message}`, bytesAntes };
  }

  const bytesDespues = salida.length;

  if (bytesDespues >= bytesAntes) {
    return {
      relativo,
      estado: 'sin-ganancia',
      motivo: `el reencode pesa ${mb(bytesDespues)} contra ${mb(bytesAntes)} del original`,
      bytesAntes,
      bytesDespues,
    };
  }

  const resultado = {
    relativo,
    estado: opciones.aplicar ? 'reemplazada' : 'a-reemplazar',
    anchoAntes: metadata.width,
    anchoDespues: opciones.ancho,
    altoDespues: alturaNueva,
    formato,
    bytesAntes,
    bytesDespues,
  };

  if (!opciones.aplicar) {
    // En simulación también se verifica: si el resultado no abre, queremos
    // saberlo ahora y no el día que alguien corra --aplicar a ciegas.
    try {
      await verificarImagen(salida, formato, opciones.ancho);
    } catch (error) {
      return { relativo, estado: 'error', motivo: `el resultado no verifica: ${error.message}`, bytesAntes };
    }
    return resultado;
  }

  // Escribir al lado y renombrar encima: el rename es atómico dentro del mismo
  // filesystem, así que la original nunca queda pisada a medias si se corta la
  // corrida. Y se verifica el archivo YA ESCRITO EN DISCO, no el buffer en
  // memoria — es lo único que prueba que lo que va a quedar sirve.
  const temporal = `${archivo}.achicando`;
  try {
    await writeFile(temporal, salida);
    await verificarImagen(temporal, formato, opciones.ancho);
    await rename(temporal, archivo);
  } catch (error) {
    await unlink(temporal).catch(() => {});
    return { relativo, estado: 'error', motivo: `no se reemplazó (original intacta): ${error.message}`, bytesAntes };
  }

  return resultado;
}

// ────────────────────────────────────────────────────────────────────────────

function mb(bytes) {
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
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

function informar(resultados, opciones) {
  const tocadas = resultados.filter((r) => r.estado === 'a-reemplazar' || r.estado === 'reemplazada');
  const errores = resultados.filter((r) => r.estado === 'error');
  const salteadas = resultados.filter((r) => r.estado === 'salteada');
  const sinGanancia = resultados.filter((r) => r.estado === 'sin-ganancia');
  const yaChicas = resultados.filter((r) => r.estado === 'ya-chica');

  const antes = tocadas.reduce((acc, r) => acc + r.bytesAntes, 0);
  const despues = tocadas.reduce((acc, r) => acc + r.bytesDespues, 0);

  const aMostrar = opciones.detalle ? tocadas : tocadas.slice(0, 20);
  if (aMostrar.length) {
    console.log('');
    console.log(opciones.detalle ? 'Imágenes:' : 'Las 20 de mayor ahorro:');
    for (const r of [...aMostrar].sort((a, b) => b.bytesAntes - b.bytesDespues - (a.bytesAntes - a.bytesDespues))) {
      const ahorro = ((1 - r.bytesDespues / r.bytesAntes) * 100).toFixed(0);
      console.log(
        `  ${r.relativo}\n` +
          `    ${r.anchoAntes}px → ${r.anchoDespues}x${r.altoDespues}px · ` +
          `${mb(r.bytesAntes)} → ${mb(r.bytesDespues)} (−${ahorro}%)`,
      );
    }
    if (!opciones.detalle && tocadas.length > aMostrar.length) {
      console.log(`  … y ${tocadas.length - aMostrar.length} más (--detalle para verlas todas)`);
    }
  }

  if (salteadas.length) {
    console.log('');
    console.log('Salteadas:');
    for (const r of salteadas) console.log(`  ${r.relativo} — ${r.motivo}`);
  }

  if (sinGanancia.length) {
    console.log('');
    console.log(`Sin ganancia (se dejan como están): ${sinGanancia.length}`);
    for (const r of sinGanancia.slice(0, 5)) console.log(`  ${r.relativo} — ${r.motivo}`);
    if (sinGanancia.length > 5) console.log(`  … y ${sinGanancia.length - 5} más`);
  }

  if (errores.length) {
    console.log('');
    console.log('Errores (ninguna original se tocó):');
    for (const r of errores) console.log(`  ${r.relativo} — ${r.motivo}`);
  }

  console.log('');
  console.log('─'.repeat(70));
  console.log(`Revisadas:        ${resultados.length}`);
  console.log(`Ya ≤ ${opciones.ancho}px:     ${yaChicas.length}`);
  console.log(`${opciones.aplicar ? 'Reemplazadas:' : 'A reemplazar: '}    ${tocadas.length}`);
  console.log(`Sin ganancia:     ${sinGanancia.length}`);
  console.log(`Salteadas:        ${salteadas.length}`);
  console.log(`Errores:          ${errores.length}`);
  console.log('');
  console.log(`Peso de esas ${tocadas.length}:  ${mb(antes)} → ${mb(despues)}`);
  const ahorro = antes - despues;
  const pct = antes ? ((ahorro / antes) * 100).toFixed(1) : '0.0';
  console.log(`Se ahorran:       ${mb(ahorro)}  (−${pct}%)`);
  console.log('─'.repeat(70));

  if (!opciones.aplicar) {
    console.log('');
    console.log('SIMULACIÓN — no se escribió ningún archivo.');
    console.log('Para aplicarlo de verdad: agregá --aplicar');
  }

  return errores.length;
}

async function main() {
  const opciones = parsearArgumentos(process.argv.slice(2));
  const dirAbsoluto = path.resolve(RAIZ, opciones.dir);

  console.log(`Carpeta:  ${path.relative(RAIZ, dirAbsoluto) || '.'}`);
  console.log(`Ancho máx: ${opciones.ancho}px`);
  console.log(`Modo:     ${opciones.aplicar ? '⚠️  APLICAR (reemplaza archivos)' : 'simulación'}`);

  const archivos = await listarImagenes(dirAbsoluto);
  console.log(`Imágenes encontradas: ${archivos.length}`);
  console.log('Procesando (comprimir para medir tarda un rato)…');

  let hechas = 0;
  const resultados = await conLimite(archivos, CONCURRENCIA, async (archivo) => {
    const resultado = await procesarImagen(archivo, opciones);
    hechas++;
    if (hechas % 50 === 0) console.log(`  … ${hechas}/${archivos.length}`);
    return resultado;
  });

  const errores = informar(resultados, opciones);
  process.exitCode = errores > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('Falló la corrida:', error);
  process.exit(1);
});
