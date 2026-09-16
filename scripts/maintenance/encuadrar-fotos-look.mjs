#!/usr/bin/env node
/**
 * ⚠️ REESCRIBE las fotos "look" de `public/images/products/` (con --aplicar).
 *   Guarda el original en `<archivo>.original` la primera vez, así se puede
 *   volver atrás sin depender de git.
 *
 * Empareja el encuadre de las fotos de la modelo para que la ficha las muestre
 * todas iguales. Hoy no lo están: la cara más grande ocupa 3,1 veces lo que la
 * más chica, la altura va del 8% al 68%, y la galería —que es CUADRADA— recorta
 * el 32,6% de cada foto centrándose en el ARCHIVO y no en la cara, así que
 * muchas quedan descentradas (hueco arriba, mentón cortado abajo).
 *
 * Qué hace, según el tipo de foto
 * --------------------------------
 * CON CARA (224): recorta un cuadrado anclado en la cara, con la cara siempre
 *   al mismo tamaño y a la misma altura, y reemplaza el fondo por un marfil
 *   liso. El fondo plano no es solo estético: es lo que permite AGRANDAR el
 *   encuadre de las fotos que se sacaron muy cerca (141 de 224 necesitan más
 *   ancho del que tiene el archivo). Sin él habría que dejarlas como están.
 *
 * SIN CARA (82): son las del armazón en las manos. Acá el fondo NO se toca.
 *   Verificado: la segmentación de personas de macOS no reconoce el anteojo
 *   como parte de la persona y lo borra junto con el fondo. Solo se recorta
 *   cuadrado al centro, que es donde está el armazón.
 *
 * La detección de cara y la máscara de persona las hacen dos binarios chicos
 * compilados contra Vision (el framework nativo de macOS). Se compilan solos
 * la primera vez.
 *
 * Uso:
 *   node scripts/maintenance/encuadrar-fotos-look.mjs                 (simula)
 *   node scripts/maintenance/encuadrar-fotos-look.mjs --salida=<dir>  (a otra carpeta, para revisar)
 *   node scripts/maintenance/encuadrar-fotos-look.mjs --aplicar       (pisa las de public/)
 *   ... --solo=deneb-c2-look-2.webp   una sola
 *   ... --revertir                    vuelve a los .original
 */
import sharp from 'sharp';
import { readdirSync, existsSync, copyFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const DIR = 'public/images/products';
const LADO = 1000;               // el recuadro de la ficha mide 652px; 1000 cubre pantallas retina
const CARA_OBJETIVO = 0.45;      // ancho de la cara respecto del lado del cuadrado
const ALTURA_OBJETIVO = 0.44;    // dónde queda el centro de la cara, de arriba hacia abajo
const MARFIL = { r: 244, g: 240, b: 233 };
const CALIDAD = 82;

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const REVERTIR = args.includes('--revertir');
const SALIDA = (args.find(a => a.startsWith('--salida=')) || '').split('=')[1] || null;
const SOLO = (args.find(a => a.startsWith('--solo=')) || '').split('=')[1] || null;

const BIN = path.join(os.tmpdir(), 'atelier-vision');

/** Compila los dos ayudantes de Vision si no están. Tardan ~10s la primera vez. */
function prepararBinarios() {
  mkdirSync(BIN, { recursive: true });
  const fuentes = {
    caras: `import Foundation
import Vision
import AppKit
var salida: [String: Any] = [:]
for ruta in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: ruta),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let W = CGFloat(cg.width), H = CGFloat(cg.height)
    let req = VNDetectFaceRectanglesRequest()
    var item: [String: Any] = ["W": Int(W), "H": Int(H)]
    do {
        try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
        if let caras = req.results, !caras.isEmpty {
            let c = caras.max(by: { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height })!
            let bb = c.boundingBox
            item["x"] = Int(bb.minX * W); item["y"] = Int((1 - bb.maxY) * H)
            item["w"] = Int(bb.width * W); item["h"] = Int(bb.height * H)
        } else { item["sinCara"] = true }
    } catch { item["sinCara"] = true }
    salida[(ruta as NSString).lastPathComponent] = item
}
FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: salida))`,
    mascara: `import Foundation
import Vision
import AppKit
import CoreImage
let ruta = CommandLine.arguments[1], destino = CommandLine.arguments[2]
guard let img = NSImage(contentsOfFile: ruta),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let req = VNGeneratePersonSegmentationRequest()
req.qualityLevel = .accurate
req.outputPixelFormat = kCVPixelFormatType_OneComponent8
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
guard let obs = req.results?.first else { exit(2) }
let m = CIImage(cvPixelBuffer: obs.pixelBuffer)
let ajustada = m.transformed(by: CGAffineTransform(scaleX: CGFloat(cg.width)/m.extent.width, y: CGFloat(cg.height)/m.extent.height))
guard let out = CIContext().createCGImage(ajustada, from: CGRect(x: 0, y: 0, width: cg.width, height: cg.height)),
      let png = NSBitmapImageRep(cgImage: out).representation(using: .png, properties: [:]) else { exit(3) }
try png.write(to: URL(fileURLWithPath: destino))`,
  };
  for (const [nombre, fuente] of Object.entries(fuentes)) {
    const bin = path.join(BIN, nombre);
    if (existsSync(bin)) continue;
    const src = path.join(BIN, `${nombre}.swift`);
    require('node:fs').writeFileSync(src, fuente);
    execFileSync('swiftc', ['-O', '-o', bin, src], { stdio: 'inherit' });
  }
}

/** Pega la máscara como canal alfa. Hay que armar el RGBA a mano: joinChannel
 *  sobre una imagen que ya tiene alfa agrega un canal de más y el fondo
 *  original sobrevive. */
async function recortarPersona(ruta, rutaMascara, W, H) {
  const { data: rgb } = await sharp(ruta).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = await sharp(rutaMascara).resize(W, H).greyscale().blur(1.1).raw().toBuffer();
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i*4] = rgb[i*3]; rgba[i*4+1] = rgb[i*3+1]; rgba[i*4+2] = rgb[i*3+2]; rgba[i*4+3] = m[i];
  }
  return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

async function procesar(archivo, cara, destino) {
  const origen = path.join(DIR, archivo);
  const base = existsSync(`${origen}.original`) ? `${origen}.original` : origen;
  const { width: W, height: H } = await sharp(base).metadata();

  // Sin cara = el armazón en las manos. El fondo NO se toca: la segmentación
  // no reconoce el anteojo y lo borraría. Solo cuadrado al centro.
  if (!cara || cara.sinCara) {
    const lado = Math.min(W, H);
    await sharp(base)
      .extract({ left: Math.round((W - lado) / 2), top: Math.round((H - lado) / 2), width: lado, height: lado })
      .resize(LADO, LADO).webp({ quality: CALIDAD, effort: 5 }).toFile(destino);
    return { tipo: 'manos' };
  }

  const mascara = path.join(BIN, '_m.png');
  execFileSync(path.join(BIN, 'mascara'), [base, mascara]);
  const persona = await recortarPersona(base, mascara, W, H);
  const plano = await sharp({ create: { width: W, height: H, channels: 3, background: MARFIL } })
    .composite([{ input: persona }]).png().toBuffer();

  const lado = Math.round(cara.w / CARA_OBJETIVO);
  const cx = cara.x + cara.w / 2, cy = cara.y + cara.h / 2;
  let left = Math.round(cx - lado / 2);
  let top = Math.round(cy - lado * ALTURA_OBJETIVO);
  // El borde de abajo nunca baja del final de la foto: si se extendiera por
  // abajo, el torso quedaría cortado flotando sobre el marfil.
  if (top + lado > H) top = H - lado;

  const eI = Math.max(0, -left), eA = Math.max(0, -top);
  const eD = Math.max(0, left + lado - W), eB = Math.max(0, top + lado - H);
  const conBorde = await sharp(plano)
    .extend({ left: eI, top: eA, right: eD, bottom: eB, background: MARFIL }).png().toBuffer();

  await sharp(conBorde)
    .extract({ left: left + eI, top: top + eA, width: lado, height: lado })
    .resize(LADO, LADO).webp({ quality: CALIDAD, effort: 5 }).toFile(destino);
  return { tipo: 'cara', extendido: eI + eD + eA + eB > 0 };
}

async function main() {
  let archivos = readdirSync(DIR).filter(f => /-look-\d+\.webp$/.test(f)).sort();
  if (SOLO) archivos = archivos.filter(f => f === SOLO);

  if (REVERTIR) {
    let n = 0;
    for (const f of archivos) {
      const o = path.join(DIR, `${f}.original`);
      if (existsSync(o)) { renameSync(o, path.join(DIR, f)); n++; }
    }
    console.log(`Revertidas: ${n}`);
    return;
  }

  prepararBinarios();
  console.log(`Fotos: ${archivos.length}`);
  console.log(`Encuadre: cuadrado de ${LADO}px · cara al ${CARA_OBJETIVO * 100}% del lado, centro al ${ALTURA_OBJETIVO * 100}% de la altura`);
  console.log(`Modo: ${APLICAR ? '⚠️  PISA las de public/' : SALIDA ? `escribe en ${SALIDA}` : 'simulación'}\n`);

  const crudo = execFileSync(path.join(BIN, 'caras'), archivos.map(f => path.join(DIR, f)), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const caras = JSON.parse(crudo);

  const dirSalida = SALIDA || (APLICAR ? DIR : null);
  if (dirSalida && dirSalida !== DIR) mkdirSync(dirSalida, { recursive: true });

  let conCara = 0, manos = 0, extendidas = 0, errores = 0, antes = 0, despues = 0, hechas = 0;
  for (const f of archivos) {
    const origen = path.join(DIR, f);
    try {
      if (APLICAR && !existsSync(`${origen}.original`)) copyFileSync(origen, `${origen}.original`);
      antes += statSync(existsSync(`${origen}.original`) ? `${origen}.original` : origen).size;
      const destino = dirSalida ? path.join(dirSalida, f) : path.join(os.tmpdir(), `_sim_${f}`);
      const r = await procesar(f, caras[f], destino);
      if (r.tipo === 'cara') { conCara++; if (r.extendido) extendidas++; } else manos++;
      despues += statSync(destino).size;
      hechas++;
      if (hechas % 40 === 0) console.log(`  … ${hechas}/${archivos.length}`);
    } catch (e) {
      errores++;
      console.error(`  ✗ ${f}: ${e.message.split('\n')[0]}`);
    }
  }

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`Con cara (fondo marfil + centrado):  ${conCara}   (${extendidas} necesitaron ensanchar el fondo)`);
  console.log(`En las manos (solo cuadrado):        ${manos}`);
  console.log(`Errores:                             ${errores}`);
  console.log(`Peso: ${(antes / 1048576).toFixed(1)} MB → ${(despues / 1048576).toFixed(1)} MB  (${despues < antes ? '-' : '+'}${Math.abs(Math.round((1 - despues / antes) * 100))}%)`);
  console.log('─'.repeat(64));
  if (!APLICAR && !SALIDA) console.log('\nSIMULACIÓN — no se escribió nada.');
}

main().catch(e => { console.error('Falló:', e); process.exit(1); });
