#!/usr/bin/env node
/**
 * ⚠️ REESCRIBE las fotos "look" de `public/images/products/` (con --aplicar).
 *
 * Vuelve a generar cada `<modelo>-look-<n>.webp` a partir del JPG ORIGINAL de
 * la sesión de fotos (24 Mpx), recortado en cuadrado para la galería de la
 * ficha, que es cuadrada. Lo que había antes era la foto vertical entera con
 * un tercio de aire arriba de la cabeza; y la edición intermedia (fondo marfil
 * plano con la persona recortada) quedó desprolija en el borde del pelo y se
 * descartó: acá el fondo es el de la foto, no se toca ningún píxel.
 *
 * Con cara (la modelo con el armazón puesto)
 *   El cuadrado EMPIEZA JUSTO DONDE EMPIEZA LA CABEZA (el tope del pelo, con
 *   un respiro chico), centrado en la cara, y con la cara siempre del mismo
 *   tamaño respecto del lado. Cuando la foto se sacó tan cerca que ese
 *   cuadrado no entra en el ancho, se corre lo justo y, si aun así no entra,
 *   se achica: mejor una cara un poco más grande que un borde inventado.
 *
 * Con las manos (el armazón sostenido frente al torso)
 *   Cuadrado cerrado sobre el armazón, centrado en él y con el anteojo a la
 *   MISMA ALTURA en todas, así en la ficha queda siempre en el mismo lugar.
 *   Dónde está el armazón lo dicen las yemas del pulgar y del índice de cada
 *   mano: la modelo lo agarra por las bisagras, así que la línea entre las dos
 *   yemas es el borde superior del frente y la distancia entre ellas, su ancho.
 *   El lado es fijo respecto del alto de la foto, y se agranda solo si el
 *   armazón es tan ancho que no entraría.
 *
 * Dónde está la cabeza, la cara y las manos lo dice Vision (macOS): un binario
 * chico compilado la primera vez. El tope de la cabeza sale del contorno de la
 * persona, no de la caja de la cara, que arranca en la frente y dejaría el
 * pelo afuera.
 *
 * Luz pareja
 *   Algunas tomas salieron un poco más oscuras que el resto. Se mide el brillo
 *   medio de cada recorte y a las que quedan por debajo de la mediana de su
 *   grupo (cara / manos) se les levantan los medios tonos con una curva gamma
 *   hasta emparejarlas. Gamma y no multiplicar: el blanco sigue siendo blanco
 *   (la cortina de fondo no se quema) y sube lo del medio, que es la piel.
 *   Nunca se oscurece ninguna y la subida tiene tope.
 *
 * Las 5 fotos que no vienen de esta sesión (alma-carey, escarlata-ii-oval-negro)
 * no se tocan: no hay original del que partir.
 *
 * Uso:
 *   node scripts/maintenance/encuadrar-fotos-look.mjs                 (simula)
 *   node scripts/maintenance/encuadrar-fotos-look.mjs --salida=<dir>  (a otra carpeta, para revisar)
 *   node scripts/maintenance/encuadrar-fotos-look.mjs --aplicar       (pisa las de public/)
 *   ... --sesion=<carpeta>          (por defecto la de Gutierrez sept/26)
 *   ... --solo=deneb-c2-look-2.webp una sola (o varias separadas por coma)
 *   ... --detalle                   lista qué fotos se iluminaron y cuánto
 *
 * Las intermedias y el análisis de Vision se cachean en el tmp del sistema:
 * la primera corrida tarda ~10 min, las siguientes segundos.
 */
import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const DIR = 'public/images/products';
const SESION_POR_DEFECTO = path.join(os.homedir(), 'Desktop/Pagina web atelier/Fotos-Agos-Gutierrez-2026');
const LADO = 1200;               // el recuadro de la ficha mide 652px; 1200 cubre retina con margen
const LADO_INTERMEDIA = 2400;    // lado largo de la intermedia: el recorte nunca se amplía
const CALIDAD = 80;

// Con cara
const CARA_OBJETIVO = 0.50;      // ancho de la caja de la cara respecto del lado del cuadrado
const RESPIRO_CABEZA = 0.02;     // aire sobre el tope del pelo, como fracción del lado
const CORRIMIENTO_MAX = 0.12;    // cuánto puede descentrarse la cara antes de achicar el lado

// Con las manos
const LADO_MANOS = 0.70;         // lado del cuadrado respecto del ALTO de la foto apaisada
const LADO_MIN_POR_ARMAZON = 1.5;// el lado nunca baja de 1,5 veces el ancho del armazón (no se corta)
const ALTURA_ARMAZON = 0.50;     // dónde queda el centro del armazón, de arriba hacia abajo
const CENTRO_BAJO_YEMAS = 0.12;  // el centro del frente queda por debajo de la línea de las yemas, en anchos de armazón

// Luz
const TOLERANCIA_LUZ = 0.03;     // por debajo de la mediana menos esto, se levanta (fracción de 255)
const GAMMA_MIN = 0.68;          // tope de la subida (1 = sin cambio; menos = más luz)

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const SALIDA = (args.find(a => a.startsWith('--salida=')) || '').split('=')[1] || null;
const SESION = (args.find(a => a.startsWith('--sesion=')) || '').split('=')[1] || SESION_POR_DEFECTO;
const SOLO = (args.find(a => a.startsWith('--solo=')) || '').split('=').slice(1).join('=');
const soloSet = SOLO ? new Set(SOLO.split(',').map(s => s.trim())) : null;

const CACHE = path.join(os.tmpdir(), 'atelier-encuadre');
const INTER = path.join(CACHE, 'intermedias');
const BIN = path.join(CACHE, 'analizar');

const FUENTE_SWIFT = `import Foundation
import Vision
import AppKit
var salida: [String: Any] = [:]
for ruta in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: ruta),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let W = CGFloat(cg.width), H = CGFloat(cg.height)
    var item: [String: Any] = ["W": Int(W), "H": Int(H)]
    let caras = VNDetectFaceRectanglesRequest()
    let manos = VNDetectHumanHandPoseRequest(); manos.maximumHandCount = 2
    let seg = VNGeneratePersonSegmentationRequest()
    seg.qualityLevel = .accurate
    seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([caras, manos, seg])
    if let c = caras.results?.max(by: { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }) {
        let bb = c.boundingBox
        item["cara"] = ["x": Int(bb.minX * W), "y": Int((1 - bb.maxY) * H), "w": Int(bb.width * W), "h": Int(bb.height * H)]
    }
    var listaManos: [[String: Any]] = []
    for m in manos.results ?? [] {
        guard let pts = try? m.recognizedPoints(.all) else { continue }
        let ok = pts.values.filter { $0.confidence > 0.3 }
        if ok.count < 5 { continue }
        let xs = ok.map { $0.location.x * W }, ys = ok.map { (1 - $0.location.y) * H }
        var mano: [String: Any] = ["x": Int(xs.min()!), "y": Int(ys.min()!), "w": Int(xs.max()! - xs.min()!), "h": Int(ys.max()! - ys.min()!)]
        // Las yemas del pulgar y del índice: es donde agarra el armazón, o sea la bisagra.
        for (nombre, j) in [("pulgar", VNHumanHandPoseObservation.JointName.thumbTip), ("indice", .indexTip)] {
            if let p = try? m.recognizedPoint(j), p.confidence > 0.3 { mano[nombre] = [Int(p.location.x * W), Int((1 - p.location.y) * H)] }
        }
        listaManos.append(mano)
    }
    item["manos"] = listaManos
    if let obs = seg.results?.first {
        let pb = obs.pixelBuffer
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        let mw = CVPixelBufferGetWidth(pb), mh = CVPixelBufferGetHeight(pb), stride = CVPixelBufferGetBytesPerRow(pb)
        let base = CVPixelBufferGetBaseAddress(pb)!.assumingMemoryBound(to: UInt8.self)
        var cabeza = -1
        for y in 0..<mh {
            var n = 0
            for x in 0..<mw where base[y * stride + x] > 128 { n += 1 }
            if n > mw / 50 { cabeza = y; break }   // 2% del ancho: un pelo suelto no cuenta
        }
        CVPixelBufferUnlockBaseAddress(pb, .readOnly)
        item["cabezaY"] = cabeza < 0 ? -1 : Int(CGFloat(cabeza) * H / CGFloat(mh))
    }
    salida[(ruta as NSString).lastPathComponent] = item
}
FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: salida))
`;

function prepararBinario() {
  mkdirSync(CACHE, { recursive: true });
  if (existsSync(BIN)) return;
  const src = path.join(CACHE, 'analizar.swift');
  writeFileSync(src, FUENTE_SWIFT);
  console.log('Compilando el ayudante de Vision (una sola vez)…');
  execFileSync('swiftc', ['-O', '-o', BIN, src], { stdio: 'inherit' });
}

const clave = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** `<modelo>-look-<n>.webp` → archivo de la sesión. Misma regla que
 *  importar-fotos-sesion.mjs: por modelo, las fotos usables en orden de rollo. */
function mapearOriginales(looks) {
  const grupos = new Map();
  for (const a of readdirSync(SESION)) {
    const m = a.match(/^(\d+)\s*-\s*(.+?)(\s+-\s+web)?\.(jpe?g|mp4|mov)$/i);
    if (!m || m[3] || /^(mp4|mov)$/i.test(m[4])) continue;
    const k = clave(m[2]);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push({ a, n: Number(m[1]) });
  }
  for (const g of grupos.values()) g.sort((x, y) => x.n - y.n);
  const mapa = new Map(), sinOriginal = [];
  for (const f of looks) {
    const [, k, i] = f.match(/^(.+)-look-(\d+)\.webp$/);
    const g = grupos.get(k);
    if (g && g[i - 1]) mapa.set(f, path.join(SESION, g[i - 1].a));
    else sinOriginal.push(f);
  }
  return { mapa, sinOriginal };
}

async function intermedia(f, original) {
  mkdirSync(INTER, { recursive: true });
  const d = path.join(INTER, f.replace(/\.webp$/, '.jpg'));
  if (!existsSync(d)) {
    await sharp(original).rotate()
      .resize({ width: LADO_INTERMEDIA, height: LADO_INTERMEDIA, fit: 'inside' })
      .keepIccProfile().jpeg({ quality: 95 }).toFile(d);
  }
  return d;
}

function analizar(rutas) {
  const cachePath = path.join(CACHE, 'analisis.json');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const faltan = rutas.filter(r => !cache[path.basename(r)]);
  if (faltan.length) {
    console.log(`Vision: analizando ${faltan.length} foto/s…`);
    for (let i = 0; i < faltan.length; i += 40) {
      const parte = JSON.parse(execFileSync(BIN, faltan.slice(i, i + 40), { maxBuffer: 64 << 20 }));
      Object.assign(cache, parte);
    }
    writeFileSync(cachePath, JSON.stringify(cache));
  }
  return cache;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Cuadrado {left, top, side} sobre la intermedia, o null si no se puede decidir. */
function encuadre(a) {
  const { W, H, cara, manos = [], cabezaY } = a;
  // Dos manos con yemas mandan: en las fotos del armazón en las manos la cara
  // sale desenfocada al fondo y Vision igual la detecta (Diana C4, Frida C3,
  // Victoria C1). En las fotos con el armazón puesto no se ven las manos.
  const conManos = manos.length === 2 && manos.some(m => m.pulgar || m.indice);
  const conCara = !conManos && cara && cara.w > W * 0.12;
  if (conCara) {
    let side = Math.round(cara.w / CARA_OBJETIVO);
    const cx = cara.x + cara.w / 2;
    const tope = cabezaY > 0 && cabezaY < cara.y ? cabezaY : cara.y - cara.h * 0.45; // sin contorno, el pelo se estima
    // el cuadrado no puede pasarse del ancho ni del alto
    side = Math.min(side, W, H - Math.max(0, Math.round(tope - side * RESPIRO_CABEZA)));
    let left = Math.round(cx - side / 2);
    const corrimientoMax = side * CORRIMIENTO_MAX;
    if (left < 0 || left + side > W) {
      // primero se corre (la cara queda un poco descentrada), después se achica
      const necesario = left < 0 ? -left : left + side - W;
      if (necesario <= corrimientoMax) left = clamp(left, 0, W - side);
      else {
        side = Math.round(Math.min(2 * (cx + corrimientoMax), 2 * (W - cx + corrimientoMax), side));
        left = clamp(Math.round(cx - side / 2), 0, W - side);
      }
    }
    const top = clamp(Math.round(tope - side * RESPIRO_CABEZA), 0, H - side);
    return { left, top, side, tipo: 'cara', caraFrac: cara.w / side, descentre: (cx - (left + side / 2)) / side };
  }
  if (manos.length === 2) {
    // agarre de cada mano: promedio de sus yemas; si no se vieron, el centro de la mano
    const agarres = manos.map(m => {
      const yemas = [m.pulgar, m.indice].filter(Boolean);
      if (yemas.length) return { x: yemas.reduce((s, p) => s + p[0], 0) / yemas.length, y: yemas.reduce((s, p) => s + p[1], 0) / yemas.length, conYemas: true };
      return { x: m.x + m.w / 2, y: m.y + m.h / 2, conYemas: false };
    });
    const conYemas = agarres.filter(a => a.conYemas);
    const anchoArmazon = Math.abs(agarres[0].x - agarres[1].x);
    const cx = (agarres[0].x + agarres[1].x) / 2;
    // la altura la fijan solo las yemas: el centro de una mano sin yemas cae en la palma, más abajo
    const lineaYemas = (conYemas.length ? conYemas : agarres).reduce((s, a) => s + a.y, 0) / (conYemas.length || 2);
    const cy = lineaYemas + anchoArmazon * CENTRO_BAJO_YEMAS;
    const side = Math.round(Math.min(Math.min(W, H), Math.max(Math.min(W, H) * LADO_MANOS, anchoArmazon * LADO_MIN_POR_ARMAZON)));
    const left = clamp(Math.round(cx - side / 2), 0, W - side);
    const top = clamp(Math.round(cy - side * ALTURA_ARMAZON), 0, H - side);
    return { left, top, side, tipo: 'manos', separacion: anchoArmazon / side, sinYemas: 2 - conYemas.length };
  }
  return null;
}

/** Brillo medio (0..1) del recorte, medido chico: alcanza para comparar. */
async function brilloDe(inter, e) {
  const st = await sharp(inter).extract({ left: e.left, top: e.top, width: e.side, height: e.side }).resize(200, 200).stats();
  const [r, g, b] = st.channels.map(c => c.mean);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Exponente gamma que lleva el brillo `actual` a `objetivo` (1 = no tocar). */
function gammaPara(actual, objetivo) {
  if (actual >= objetivo - TOLERANCIA_LUZ) return 1;
  return Math.max(GAMMA_MIN, Math.log(objetivo) / Math.log(actual));
}

async function renderizar(inter, e, gamma, destino) {
  let img = sharp(inter).extract({ left: e.left, top: e.top, width: e.side, height: e.side }).resize(LADO, LADO);
  if (gamma < 1) {
    const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.pow(v / 255, gamma));
    for (let i = 0; i < data.length; i++) data[i] = lut[data[i]];
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  }
  await img.keepIccProfile().webp({ quality: CALIDAD, effort: 5 }).toFile(destino);
}

const mediana = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };

async function main() {
  const looks = readdirSync(DIR).filter(f => /-look-\d+\.webp$/.test(f) && (!soloSet || soloSet.has(f))).sort();
  const { mapa, sinOriginal } = mapearOriginales(looks);
  console.log(`Fotos look: ${looks.length} · con original en la sesión: ${mapa.size} · modo: ${APLICAR ? '⚠️  APLICA' : SALIDA ? `a ${SALIDA}` : 'simulación'}`);
  if (sinOriginal.length) console.log(`Sin original (no se tocan): ${sinOriginal.join(', ')}`);

  prepararBinario();
  const inters = new Map();
  let n = 0;
  for (const [f, o] of mapa) { inters.set(f, await intermedia(f, o)); if (++n % 50 === 0) console.log(`  intermedias ${n}/${mapa.size}`); }
  const analisis = analizar([...inters.values()]);

  if (SALIDA) mkdirSync(SALIDA, { recursive: true });
  const resumen = { cara: 0, manos: 0, sinDecidir: [] };
  const caraFracs = [], descentres = [], separaciones = [];

  // Primera pasada: encuadre y brillo de cada una
  const fichas = [];
  for (const [f, inter] of inters) {
    const a = analisis[path.basename(inter)];
    const e = a && encuadre(a);
    if (!e) { resumen.sinDecidir.push(f); continue; }
    resumen[e.tipo]++;
    if (e.tipo === 'cara') { caraFracs.push(e.caraFrac); descentres.push(Math.abs(e.descentre)); }
    else { separaciones.push(e.separacion); if (e.sinYemas) resumen.sinYemas = (resumen.sinYemas || 0) + 1; }
    fichas.push({ f, inter, e, brillo: await brilloDe(inter, e) });
  }
  // La mediana de brillo de cada grupo es el objetivo: las que están por debajo suben
  const objetivo = { cara: mediana(fichas.filter(x => x.e.tipo === 'cara').map(x => x.brillo)), manos: mediana(fichas.filter(x => x.e.tipo === 'manos').map(x => x.brillo)) };
  const iluminadas = [];
  let peso = 0;
  for (const x of fichas) {
    x.gamma = gammaPara(x.brillo, objetivo[x.e.tipo]);
    if (x.gamma < 1) iluminadas.push(x);
    if (APLICAR || SALIDA) {
      const destino = path.join(SALIDA || DIR, x.f);
      await renderizar(x.inter, x.e, x.gamma, destino);
      peso += statSync(destino).size;
    }
  }
  console.log(`\nBrillo objetivo: cara ${objetivo.cara.toFixed(2)} · manos ${objetivo.manos.toFixed(2)} · iluminadas ${iluminadas.length}` +
    (iluminadas.length ? ` (gamma mín ${Math.min(...iluminadas.map(x => x.gamma)).toFixed(2)})` : ''));
  if (args.includes('--detalle')) for (const x of iluminadas.sort((a, b) => a.gamma - b.gamma)) console.log(`  ${x.f}  brillo ${x.brillo.toFixed(2)} → gamma ${x.gamma.toFixed(2)}`);
  const q = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? `mín ${s[0].toFixed(2)} · mediana ${s[s.length >> 1].toFixed(2)} · máx ${s.at(-1).toFixed(2)}` : '—'; };
  console.log(`\nCon cara:   ${resumen.cara}   (cara/lado ${q(caraFracs)} · descentre ${q(descentres)})`);
  console.log(`Con manos:  ${resumen.manos}   (armazón/lado ${q(separaciones)} · con alguna mano sin yemas: ${resumen.sinYemas || 0})`);
  if (resumen.sinDecidir.length) console.log(`Sin decidir (ni cara ni dos manos): ${resumen.sinDecidir.length}\n  ${resumen.sinDecidir.join('\n  ')}`);
  if (APLICAR || SALIDA) console.log(`Peso total: ${(peso / 1048576).toFixed(1)} MB`);
  if (!APLICAR && !SALIDA) console.log('\nSIMULACIÓN — no se escribió nada.');
}

main().catch(e => { console.error('Falló:', e); process.exit(1); });
