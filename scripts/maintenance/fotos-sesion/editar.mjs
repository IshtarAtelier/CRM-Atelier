// Edita fotos de sesión al formato "look" de la tienda: 1200×1200 WebP, cara muy cerca,
// luz y color parejos, y el poco fondo que queda llevado a un tono claro uniforme.
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// STORY=1: modo story de Instagram. Se procesa un cuadrado de 1920 y se entrega la franja central 9:16
// (1080×1920), con la cabeza al ~42 % del alto, como las stories de Agos.
const STORY = process.env.STORY === '1';
const LADO = STORY ? 1920 : 1200, CALIDAD = 82;
const LLENADO = 0.84;          // la cabeza (con el armazón) ocupa este ancho del cuadrado
const BAJO_MENTON = 0.14;
const CERCA = process.env.CERCA === '1';
const MEDIO = process.env.MEDIO === '1'; // aprobado: la cabeza casi entera, recorte mínimo de pelo // encuadre cerrado: la cara llena el cuadrado y se recorta el tope del pelo      // debajo del mentón entra este tanto (en altos de cara): nunca se corta el mentón
const CARA_MAX = 0.74;         // la caja de la cara nunca pasa de este ancho (fotos muy cerca)
const AIRE_ARRIBA = 0.0;       // el cuadrado arranca justo en el tope del pelo
const FONDO = [238, 236, 232]; // blanco neutro apenas cálido (Ishtar 15/10: el frío enfriaba la foto)
const PIEL_OBJETIVO = 0.57;    // luminancia de frente y mejillas (0..1)
const BALANCE = 0.7;           // cuánto se corrige el tinte de la cortina (1 = neutro total)
const CALIDEZ = [1.035, 1.0, 0.95];
const TONO_SERIE = [1.322, 0.938, 0.680]; // r/l, g/l, b/l de la piel: mediana de las 130 fotos (15/10) // la cortina queda apenas cálida, no gris: la piel no se enfría
const CONTRASTE = 0.12;        // curva S suave
const RELLENO = Number(process.env.RELLENO ?? 0.75);   // luz de relleno amplia (empareja un lado de la cara con el otro)
const SUAVIZADO = Number(process.env.SUAVIZADO ?? 0.2); // sombras duras del armazón y la nariz, escala media // cuánto se acercan las sombras de la piel al tono de la piel iluminada (0 = nada, 1 = cara plana)
const RELLENO_MAX = 1.7;      // tope de la ganancia en la sombra más profunda
const SOL = process.env.SOL === '1';
const CORREGIR = process.env.CORREGIR !== '0'; // corrector de granitos / puntos rojos (los lunares no se tocan)
const ROJO_UMBRAL = Number(process.env.ROJO_UMBRAL ?? 18); // cuánto más rojo que la piel de alrededor (r−g) para ser un granito
const MARCAR = process.env.MARCAR === '1';
const SIN_SOMBRA_ARMAZON = process.env.SIN_SOMBRA !== '0'; // borra la sombra que el anteojo tira sobre la cara
const R_SOMBRA = Number(process.env.R_SOMBRA ?? 24);           // ancho máximo (px a 1200) de una banda de sombra que se considera "del armazón"
const SOMBRA_MAX = 2.3;
const FUERZA_SOMBRA = Number(process.env.FUERZA_SOMBRA ?? 1); // 1 = sombra borrada; 0.5 = suavizada a la mitad        // tope de cuánto se aclara la sombra más profunda

const [,, dirInter, dirMask, analisisJson, salida, ...nums] = process.argv;
const A = JSON.parse(readFileSync(analisisJson));
mkdirSync(salida, { recursive: true });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

async function raw(img) { const { data, info } = await img.raw().toBuffer({ resolveWithObject: true }); return { data, ...info }; }

export async function editar(n) {
  const a = A[`${n}.jpg`]; const W = a.W, H = a.H;
  const inter = path.join(dirInter, `${n}.jpg`);
  const m = await raw(sharp(path.join(dirMask, `${n}.png`)).greyscale().resize(W, H, { kernel: 'linear', fit: 'fill' }));
  const alfa = (x, y) => m.data[y * W + x] / 255;
  const c = a.cara;
  // 1) Ancho de la cabeza con el armazón: la silueta en la franja de los ojos
  const yOjos = Math.round(c.y + c.h * 0.42);
  let L = W, R = 0;
  for (let y = Math.round(yOjos - c.h * 0.12); y <= Math.round(yOjos + c.h * 0.12); y += 2) {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) if (alfa(x, y) > 0.5) { if (l < 0) l = x; r = x; }
    if (l >= 0) { L = Math.min(L, l); R = Math.max(R, r); }
  }
  const perfil = Math.abs(c.yaw || 0) > 0.35;
  const tope0 = a.cabezaY > 0 ? a.cabezaY : c.y - c.h * 0.45;
  const rsg = a.rasgos || {};
  // rasgos coherentes = los labios debajo de la nariz y a una distancia razonable; con anteojos envolventes
  // Vision a veces los ubica mal (la 105 los puso por encima de la nariz) y ahí se usa la proporción de la cabeza
  const rasgosOk = rsg.labios && rsg.nariz && rsg.labios[1] >= rsg.nariz[3] - c.h * 0.02 && rsg.labios[3] - rsg.nariz[3] > c.h * 0.08
    && (rsg.labios[2] - rsg.labios[0]) > c.w * (Math.abs(c.yaw || 0) > 0.35 ? 0.12 : 0.22); // una boca de verdad ocupa ~1/3 del ancho de la cara
  const tope00 = a.cabezaY > 0 ? a.cabezaY : c.y - c.h * 0.45;
  const mentonY = rasgosOk ? Math.max(c.y + c.h * 1.02, rsg.labios[3] + (rsg.labios[3] - rsg.nariz[3]) * 1.45)
    : Math.max(c.y + c.h * 1.05, tope00 + (R - L) * (Math.abs(c.yaw || 0) > 0.35 ? 1.36 : 1.68)); // medianas medidas: 1,62 de frente (68 fotos), 1,29 de perfil (58)
  const RECORTE_PELO = 0.15;      // del pelo (tope → cejas) se recorta solo esta fracción de arriba
  const MENTON = 1.05;            // el cuadrado termina apenas debajo del mentón (en altos de cara)
  const arribaMedio = tope0 + (c.y - tope0) * RECORTE_PELO;
  let side = CERCA ? Math.max((R - L) / 0.80, c.h * 1.30)
    : MEDIO ? Math.max((mentonY - arribaMedio) * 1.04, c.y + c.h * MENTON - arribaMedio, (R - L) / 0.92)
    : Math.max((R - L) / LLENADO, c.w / CARA_MAX, c.y + c.h * (1 + BAJO_MENTON) - tope0);
  // Caja de la CABEZA entera (de arriba al mentón, orejas incluidas): en los perfiles la oreja y la patilla
  // quedaban afuera porque el ancho se medía solo a la altura de los ojos (auditoría: Perséfone 67).
  let HL = W, HR = 0;
  for (let y = Math.round(tope0); y <= Math.min(H - 1, Math.round(mentonY)); y += 6) {
    let l = -1, r = -1; for (let x = 0; x < W; x += 2) if (alfa(x, y) > 0.5) { if (l < 0) l = x; r = x; }
    if (l >= 0 && r - l < W * 0.95) { HL = Math.min(HL, l); HR = Math.max(HR, r); }
  }
  // hacia dónde mira: el frente del anteojo sobresale de la nariz y tiene que entrar (Deméter 75)
  let xMin = HL, xMax = HR;
  // girado = la nariz está corrida del centro de la cabeza (el giro que estima Vision no es confiable: la 67
  // de tres cuartos le dio 0,06); entonces se deja lugar para el frente del anteojo hacia ese lado
  const nx = rsg.nariz ? (rsg.nariz[0] + rsg.nariz[2]) / 2 : c.x + c.w / 2;
  const girado = Math.abs(nx - (HL + HR) / 2) > (HR - HL) * 0.12;
  if (girado) { if (nx > (HL + HR) / 2) xMax = Math.max(xMax, nx + c.w * 0.45); else xMin = Math.min(xMin, nx - c.w * 0.45); }
  side = Math.max(side, (xMax - xMin) / 0.94);
  side = Math.round(Math.min(side, W, H));
  const cx = perfil || girado ? (xMin + xMax) / 2 : c.x + c.w / 2;
  let left = clamp(Math.round(cx - side / 2), 0, W - side);
  if (side >= xMax - xMin) left = clamp(left, Math.round(xMax - side), Math.round(xMin)); // la cabeza entera adentro
  left = clamp(left, 0, W - side);
  if (process.env.DEBUG_ENC) console.error(n, { girado, W, H, HL, HR, xMin: Math.round(xMin), xMax: Math.round(xMax), L, R, side, left, cx: Math.round(cx), tope0, mentonY: Math.round(mentonY), perfil, yaw: c.yaw });
  const tope = a.cabezaY > 0 ? a.cabezaY : c.y - c.h * 0.45;
  let top = clamp(Math.round(tope - side * AIRE_ARRIBA), 0, H - side);
  if (MEDIO) top = clamp(Math.round(arribaMedio), 0, H - side);
  if (CERCA) { const abajo = c.y + c.h * 1.07; top = clamp(Math.round(Math.max(abajo - side, tope)), 0, H - side); }
  let stripLeft = 0;
  if (STORY) {
    side = Math.round(Math.min(W, H, (mentonY - tope0) / 0.42));
    const cxS = perfil || girado ? (xMin + xMax) / 2 : c.x + c.w / 2;
    left = clamp(Math.round(cxS - side / 2), 0, W - side);
    top = clamp(Math.round(tope0 - 0.07 * side), 0, H - side);
    stripLeft = clamp(Math.round((cxS - left) / side * LADO - 540), 0, LADO - 1080);
    if (perfil || girado) { // el frente del anteojo siempre adentro, con aire: la franja se apoya del lado al que mira
      const aire = 70, kx = LADO / side, xa = (xMin - left) * kx, xb = (xMax - left) * kx;
      if (nx > (HL + HR) / 2) stripLeft = clamp(Math.max(stripLeft, Math.round(xb + aire - 1080)), 0, LADO - 1080);
      else stripLeft = clamp(Math.min(stripLeft, Math.round(xa - aire)), 0, LADO - 1080);
    }
  }
  // 2) Tinte de la cortina (fondo de toda la foto, sin la mesa de abajo) → balance de blancos
  const full = await raw(sharp(inter).removeAlpha());
  let sr = 0, sg = 0, sb = 0, k = 0;
  for (let y = 0; y < H * 0.75; y += 6) for (let x = 0; x < W; x += 6) if (alfa(x, y) < 0.05) { const i = (y * W + x) * 3; sr += full.data[i]; sg += full.data[i + 1]; sb += full.data[i + 2]; k++; }
  // el tinte de la cortina se toma con tope: en los planos abiertos la cortina queda en sombra y muy azul
  // (la 8: azul/rojo 1,17 contra 0,94 de mediana), y corregir todo ese azul pasaba la piel a naranja
  const c0 = [sr / k, sg / k, sb / k];
  const cort = [c0[0], c0[0] * clamp(c0[1] / c0[0], 0.93, 1.03), c0[0] * clamp(c0[2] / c0[0], 0.86, 1.02)], gris = (cort[0] + cort[1] + cort[2]) / 3;
  const gan = cort.map((v, i) => 1 + BALANCE * (gris / v - 1)); // la calidez va después, sobre todo en la piel
  // 3) Recorte a 1200 (foto y máscara)
  const ext = { left, top, width: side, height: side };
  const img = await raw(sharp(inter).removeAlpha().extract(ext).resize(LADO, LADO, { kernel: 'lanczos3' }));
  const mascaraW = await sharp(path.join(dirMask, `${n}.png`)).greyscale().resize(W, H, { kernel: 'linear', fit: 'fill' }).png().toBuffer();
  const mk = await raw(sharp(await sharp(mascaraW).extract(ext).resize(LADO, LADO).png().toBuffer()).greyscale().blur(2.5).extractChannel(0));
  const s = LADO / side, fx = (x) => (x - left) * s, fy = (y) => (y - top) * s;
  // 4) Piel (frente y mejillas, sin el armazón) después del balance → gamma hasta el objetivo
  const ls = [];
  for (let y = Math.round(fy(c.y)); y < fy(c.y + c.h); y += 3) for (let x = Math.round(fx(c.x)); x < fx(c.x + c.w); x += 3) {
    if (x < 0 || y < 0 || x >= LADO || y >= LADO) continue; const i = (y * LADO + x) * 3;
    const r = img.data[i] * gan[0], g = img.data[i + 1] * gan[1], b = img.data[i + 2] * gan[2];
    if (r > g && g > b && r - b > 18 && r < 250) ls.push(lum(r, g, b) / 255);
  }
  ls.sort((p, q) => p - q);
  const piel = ls[Math.floor(ls.length * 0.6)];
  // Exposición por GANANCIA (no gamma): aclarar con gamma levanta las sombras y lava la foto.
  // Los altos se frenan con un hombro suave para que la camisa y los brillos no se quemen.
  const gamma = clamp(PIEL_OBJETIVO / piel, 0.85, 1.35);
  const HOMBRO = 0.82;
  const lut = new Float32Array(256 * 3);
  for (let ch = 0; ch < 3; ch++) for (let v = 0; v < 256; v++) {
    // sin compresión por canal (lavaba los colores claros: la patilla amarilla de Kalishta salía blanca);
    // los altos se comprimen al final por LUMINANCIA, conservando el tono
    let x = Math.max(0, v * gan[ch] * gamma / 255);
    x = x <= 1 ? x * (1 - CONTRASTE) + CONTRASTE * (x * x * (3 - 2 * x)) : x;
    lut[ch * 256 + v] = x * 255;
  }
  // 4b) OBJETO: en la franja de los ojos, todo lo que no es cortina (armazón, patilla vista a través del
  //     cristal, logos grabados, aros finos) aunque la silueta de Vision no lo cuente como persona. Se
  //     protege del reemplazo de fondo y de los retoques de piel. (Auditoría 15/10: en los perfiles se
  //     borraban la patilla lejana y los logos, y el metal fino tomaba el color de la piel.)
  const objeto = new Float32Array(LADO * LADO);
  let bandaY0 = 0, bandaY1 = -1;
  {
    const rs0 = a.rasgos || {};
    const cejasY = ['cejaIzq', 'cejaDer'].filter(k => rs0[k]).map(k => fy(rs0[k][1]));
    const ojosY = ['ojoIzq', 'ojoDer'].filter(k => rs0[k]).map(k => fy(rs0[k][3]));
    const y0 = Math.max(0, Math.round((cejasY.length ? Math.min(...cejasY) : fy(c.y + c.h * 0.12)) - c.h * s * 0.1));
    const y1 = Math.min(LADO - 1, Math.round((ojosY.length ? Math.max(...ojosY) : fy(c.y + c.h * 0.4)) + c.h * s * 0.32));
    bandaY0 = y0; bandaY1 = y1;
    // color local de la cortina: promedio de lo que es fondo seguro, muy desenfocado
    const fondoSeg = Buffer.alloc(LADO * LADO), cortCh = [0, 1, 2].map(() => Buffer.alloc(LADO * LADO));
    for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) if (mk.data[p] < 15) { fondoSeg[p] = 255; for (let ch = 0; ch < 3; ch++) cortCh[ch][p] = img.data[i + ch]; }
    const dF = (await raw(sharp(fondoSeg, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(28).extractChannel(0))).data;
    const cF = [];
    for (let ch = 0; ch < 3; ch++) cF.push((await raw(sharp(cortCh[ch], { raw: { width: LADO, height: LADO, channels: 1 } }).blur(28).extractChannel(0))).data);
    const obj8 = Buffer.alloc(LADO * LADO);
    // detalle fino de la imagen (para reconocer contornos y logos aunque sean más claros que la cortina)
    const imgFino = [];
    for (let ch = 0; ch < 3; ch++) { const b8 = Buffer.alloc(LADO * LADO); for (let q = 0; q < LADO * LADO; q++) b8[q] = img.data[q * 3 + ch];
      imgFino.push((await raw(sharp(b8, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(4).extractChannel(0))).data); }
    for (let y = y0; y <= y1; y++) for (let x = 0; x < LADO; x++) {
      const p = y * LADO + x, i = p * 3; if (mk.data[p] > 200 || dF[p] < 10) continue;
      // de perfil, detrás de la cabeza no hay armazón contra el fondo, solo pelo suelto: ahí no es "objeto"
      if (girado && (nx > (HL + HR) / 2 ? x < fx((HL + HR) / 2) : x > fx((HL + HR) / 2))) continue;
      let dif = 0, osc = 0, fino = 0;
      for (let ch = 0; ch < 3; ch++) { const dc = img.data[i + ch] - cF[ch][p] / dF[p] * 255; dif = Math.max(dif, Math.abs(dc)); osc = Math.min(osc, dc); fino = Math.max(fino, Math.abs(img.data[i + ch] - imgFino[ch][p])); }
      // objeto = más OSCURO que la cortina (armazón, cristal, logo) o un detalle fino; una zona ancha más clara es cortina iluminada
      if (dif > 20 && (osc < -20 || fino > 12)) obj8[p] = 255;
    }
    const objS = (await raw(sharp(obj8, { raw: { width: LADO, height: LADO, channels: 1 } }).dilate(2).blur(2.5).extractChannel(0))).data;
    const FADE = 30; // la franja no corta en seco: se esfuma arriba y abajo (si no, deja un escalón recto)
    for (let p = 0; p < LADO * LADO; p++) { const y = (p / LADO) | 0; const borde = Math.min(1, Math.max(0, Math.min(y - y0, y1 - y) / FADE));
      objeto[p] = Math.min(1, objS[p] / 255 * 1.4) * borde; }
  }
  // 5) Color
  const col = new Float32Array(LADO * LADO * 3);
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) for (let ch = 0; ch < 3; ch++) col[i + ch] = lut[ch * 256 + img.data[i + ch]];
  // CALIDEZ plena en la piel y suave en el resto: el armazón tiene que verse de su color real (auditoría
  // 15/10: con la calidez pareja, el negro mate de Odiseo salía amarronado)
  {
    const pielC = Buffer.alloc(LADO * LADO);
    for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) { const r = col[i], g = col[i + 1], b = col[i + 2], l = lum(r, g, b) / 255, cr = (r - b) / Math.max(r, 1);
      pielC[p] = r > g && g >= b * 0.85 && cr > 0.1 && cr < 0.7 && l > 0.2 && mk.data[p] > 128 && objeto[p] < 0.5 ? 255 : 0; }
    const pS = (await raw(sharp(pielC, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(4).extractChannel(0))).data;
    for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) { const w = 0.3 + 0.7 * pS[p] / 255; for (let ch = 0; ch < 3; ch++) col[i + ch] *= Math.pow(CALIDEZ[ch], w); }
    // MISMO TONO DE PIEL EN TODA LA SERIE: proporción de cada canal sobre la luminancia de la piel, llevada a
    // la mediana medida en las 130 fotos (auditoría: la 8, la 34 y la 100 salían más naranjas u oscuras)
    let sr = 0, sg = 0, sb = 0, sl = 0, k = 0;
    for (let p = 0, i = 0; p < LADO * LADO; p += 3, i += 9) { if (pielC[p] !== 255) continue; const r = col[i], g = col[i + 1], b = col[i + 2], l = lum(r, g, b);
      if (l < 70 || l > 235) continue; sr += r; sg += g; sb += b; sl += l; k++; }
    if (k > 800) {
      const real = [sr / sl, sg / sl, sb / sl], objetivo = TONO_SERIE, F = 0.75;
      const g3 = real.map((v, ch) => Math.pow(objetivo[ch] / v, F));
      const lg = lum(g3[0] * real[0], g3[1] * real[1], g3[2] * real[2]); // que la corrección de tono no cambie la luz
      for (let i = 0; i < col.length; i += 3) for (let ch = 0; ch < 3; ch++) col[i + ch] *= g3[ch] / lg;
    }
  }
  // densidad de pelo: el degradé rapado deja ver piel entre los pelitos y el relleno lo aclaraba hasta parecer
  // una calvicie (auditoría 2). Lo oscuro dentro de la persona, desenfocado: frena el relleno de a poco.
  const pelo8 = Buffer.alloc(LADO * LADO);
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) if (mk.data[p] > 128 && lum(col[i], col[i + 1], col[i + 2]) < 0.36 * 255) pelo8[p] = 255;
  const peloD = (await raw(sharp(pelo8, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(18).extractChannel(0))).data;
  const sinPelo = (p) => 1 - clamp((peloD[p] / 255 - 0.08) * 4, 0, 1);
  // 6) Relleno de luz sobre la PIEL: la luz de la sesión entra de un costado y deja la otra mitad de la
  //    cara oscura, más las sombras duras del armazón y la nariz. Se estima la luz local (luminancia muy
  //    desenfocada) y cada zona de piel sube hacia el tono de la piel bien iluminada. Pelo, armazón,
  //    cristales y ropa no se tocan: no tienen color de piel.
  const LUM = new Float32Array(LADO * LADO), piel01 = new Uint8Array(LADO * LADO);
  const yLente0 = fy(c.y + c.h * 0.08), yLente1 = fy(c.y + c.h * 0.58);
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) {
    const r = col[i], g = col[i + 1], b = col[i + 2]; const l = lum(r, g, b) / 255; LUM[p] = l;
    const y = Math.floor(p / LADO);
    const croma = (r - b) / Math.max(r, 1);
    const esPiel = r > g && g >= b * 0.96 && croma > 0.12 && croma < 0.55 && l > 0.27 && l < 0.97 && mk.data[p] > 128;
    piel01[p] = esPiel ? 255 : 0;
  }
  // Luz local estimada SOLO con piel (convolución normalizada): si entraran el pelo o el armazón, la piel
  // pegada a ellos parecería en sombra y quedaría con un brillo alrededor.
  const conPiel = Buffer.alloc(LADO * LADO);
  for (let p = 0; p < LADO * LADO; p++) conPiel[p] = piel01[p] ? Math.round(LUM[p] * 255) : 0;
  const desenfocar = async (buf, sigma) => (await raw(sharp(buf, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(sigma).extractChannel(0))).data;
  const normalizada = async (sigma) => {
    const num = await desenfocar(conPiel, sigma), den = await desenfocar(Buffer.from(piel01), sigma);
    const r = new Float32Array(LADO * LADO);
    for (let p = 0; p < LADO * LADO; p++) r[p] = den[p] > 8 ? num[p] / den[p] : 1;
    return r;
  };
  const base = { data: (await normalizada(48)).map(v => v * 255) };
  const media = { data: (await normalizada(Number(process.env.SIGMA_MEDIA ?? 18))).map(v => v * 255) };
  const pielEstricta = await raw(sharp(Buffer.from(piel01), { raw: { width: LADO, height: LADO, channels: 1 } }).blur(1.2).extractChannel(0));
  const pesoPiel = await raw(sharp(Buffer.from(piel01), { raw: { width: LADO, height: LADO, channels: 1 } }).blur(Number(process.env.SIGMA_PIEL ?? 16)).extractChannel(0));
  // tono de referencia: la piel bien iluminada (percentil 75 de la luz local sobre piel)
  const ref = []; for (let p = 0; p < LADO * LADO; p += 7) if (piel01[p]) ref.push(base.data[p] / 255);
  ref.sort((u, v) => u - v); const pielLuz = ref.length ? ref[Math.floor(ref.length * 0.8)] : PIEL_OBJETIVO;
  let rellenoMedio = 0, nRelleno = 0;
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) {
    let w = pesoPiel.data[p] / 255 * (1 - objeto[p]) * sinPelo(p); if (w < 0.01) continue;
    if (SOL) { // cristal de sol: lo que se ve a través es mucho más oscuro que la piel; ahí no se aclara (cambiaría el color del cristal)
      const yy = (p / LADO) | 0, banda = Math.min(1, Math.max(0, Math.min(yy - yLente0, yLente1 - yy) / 40));
      if (banda > 0) { const lp = lum(col[i], col[i + 1], col[i + 2]) / 255; w *= 1 - banda * (1 - clamp((lp - pielLuz * 0.55) / (pielLuz * 0.25), 0, 1)); }
    } // peso SUAVE: un peso por píxel dejaba parches (barba, cuello)
    const bl = Math.max(base.data[p] / 255, 0.05), md = Math.max(media.data[p] / 255, 0.05);
    // amplia: la zona hacia la piel iluminada; media: la sombra dura hacia su entorno (la luz amplia)
    const gA = bl < pielLuz ? 1 + RELLENO * (pielLuz / bl - 1) : 1;
    const gM = md < bl ? 1 + SUAVIZADO * (bl / md - 1) : 1;
    const gnc = Math.min(RELLENO_MAX, gA * gM);
    if (gnc <= 1.001) continue;
    const gg = 1 + (gnc - 1) * w;
    rellenoMedio += gg; nRelleno++;
    // aclarar sin saturar: la oreja a contraluz y la piel muy saturada casi no suben (salían rojas)
    const r0 = col[i], b0 = col[i + 2], cr0 = (r0 - b0) / Math.max(r0, 1), rj0 = (r0 - col[i + 1]) / Math.max(r0, 1), freno = Math.max(clamp((cr0 - 0.45) / 0.2, 0, 1), clamp((rj0 - 0.4) / 0.15, 0, 1));
    const gg2 = 1 + (gg - 1) * (1 - 0.75 * freno);
    const l0 = lum(col[i], col[i + 1], col[i + 2]), l1 = Math.min(l0 * gg2, Math.max(l0, pielLuz * 255 * 1.04));
    for (let ch = 0; ch < 3; ch++) col[i + ch] = l1 + (col[i + ch] - l0) * (1 + (l1 / Math.max(l0, 1) - 1) * 0.5);
  }


  // 6b) Sombras del ARMAZÓN sobre la cara. La luz dura de la sesión hace que el frente y las patillas
  //     tiren bandas oscuras sobre mejillas, nariz y ojeras. Técnica de retoque: se estima la luz que
  //     tendría la piel SIN la banda (un "cierre" morfológico: las bandas angostas se rellenan con la piel
  //     de los costados) y se le devuelve a la banda la luz que le falta. Se trabaja sobre la luz
  //     suavizada, así la textura (poros, pecas) queda intacta. Ojos, párpados, cejas, labios, fosas
  //     nasales y lunares no se tocan: los rasgos van protegidos y lo chico no cuenta como sombra.
  let sombrasBorradas = 0;
  if (SIN_SOMBRA_ARMAZON && a.rasgos) {
    const rs = a.rasgos, N = LADO * LADO;
    const suave = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const desenfF = async (arr, sigma) => { // desenfoque de un mapa 0..1 (float) vía 8 bits
      const b8 = Buffer.alloc(N); for (let p = 0; p < N; p++) b8[p] = clamp(Math.round(arr[p] * 255), 0, 255);
      const d = await desenfocar(b8, sigma); const o = new Float32Array(N); for (let p = 0; p < N; p++) o[p] = d[p] / 255; return o;
    };
    // (1) cuánto es piel cada punto (suave): color de piel × luz mínima × persona × óvalo de la cara
    const cxF = fx(c.x + c.w / 2), cyF = fy(c.y + c.h * 0.58), rxF = c.w * s * 0.7, ryF = c.h * s * 0.62;
    const W0 = new Float32Array(N);
    for (let p = 0, i = 0; p < N; p++, i += 3) {
      const r = col[i], g = col[i + 1], b = col[i + 2], l = lum(r, g, b) / 255, croma = (r - b) / Math.max(r, 1);
      const x = p % LADO, y = (p / LADO) | 0, el = Math.hypot((x - cxF) / rxF, (y - cyF) / ryF);
      const rojez = (r - g) / Math.max(r, 1); // el interior de la oreja a contraluz es rojo puro: no es piel en sombra
      W0[p] = suave(0.05, 0.15, croma) * (1 - suave(0.6, 0.72, croma)) * (1 - suave(0.42, 0.55, rojez)) * suave(0, 8, r - g) * suave(0.03, 0.1, l) * (mk.data[p] / 255) * (1 - suave(0.8, 1.25, el));
    }
    // (2) rasgos protegidos: óvalos esfumados
    const P0 = new Float32Array(N);
    const ovalo = (b, ex, ey) => { if (!b) return; const x0 = fx(b[0]), x1 = fx(b[2]), y0 = fy(b[1]), y1 = fy(b[3]);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 * ex + 4, ry = (y1 - y0) / 2 * ey + 4;
      for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(LADO - 1, cy + ry); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(LADO - 1, cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) P0[y * LADO + x] = 1; };
    ovalo(rs.ojoIzq, 1.5, 2.6); ovalo(rs.ojoDer, 1.5, 2.6); ovalo(rs.cejaIzq, 1.15, 1.8); ovalo(rs.cejaDer, 1.15, 1.8); ovalo(rs.labios, 1.12, 1.35);
    if (rs.nariz) { const nb = rs.nariz, h = nb[3] - nb[1]; ovalo([nb[0], nb[1] + h * 0.66, nb[2], nb[3] + h * 0.05], 1.05, 1.3); }
    const Pr = await desenfF(P0, 7);
    const Wsk = await desenfF(W0, 1.5);
    const W = new Float32Array(N); for (let p = 0; p < N; p++) W[p] = Wsk[p] * (1 - Pr[p]) * (1 - objeto[p]) * sinPelo(p);
    // (3) frecuencia baja (luz y color) por convolución normalizada con W
    const SIG_BAJA = Number(process.env.SIG_BAJA ?? 2.5);
    const dW = await desenfF(W, SIG_BAJA);
    const bajaC = [0, 1, 2].map(() => new Float32Array(N));
    let maxC = 0; for (let i = 0; i < N * 3; i++) maxC = Math.max(maxC, col[i]);
    for (let ch = 0; ch < 3; ch++) {
      const t = new Float32Array(N); for (let p = 0; p < N; p++) t[p] = W[p] * clamp(col[p * 3 + ch], 0, 255) / 255;
      const nt = await desenfF(t, SIG_BAJA);
      for (let p = 0; p < N; p++) bajaC[ch][p] = dW[p] > 0.06 ? nt[p] / dW[p] * 255 : -1;
    }
    const Lb = new Float32Array(N); for (let p = 0; p < N; p++) Lb[p] = bajaC[0][p] < 0 ? -1 : lum(bajaC[0][p], bajaC[1][p], bajaC[2][p]);
    // luz "gruesa" (escala de 8 px): un lunar, un poro o la barba son puntos oscuros CHICOS; se los detecta
    // porque su luz fina queda bastante por debajo de la gruesa, y se aclaran solo como su entorno
    const tG = new Float32Array(N), dG0 = new Float32Array(N);
    for (let p = 0; p < N; p++) if (Lb[p] > 0) { tG[p] = Lb[p] / 255 * W[p]; dG0[p] = W[p]; }
    const nGr = await desenfF(tG, 8), dGr = await desenfF(dG0, 8);
    const Lgr = new Float32Array(N); for (let p = 0; p < N; p++) Lgr[p] = dGr[p] > 0.05 ? nGr[p] / dGr[p] * 255 : -1;
    // (4) luz "sin la banda": cierre morfológico (máx y después mín) de la luz baja
    const filtro = (src, esMax) => {
      const tmp = new Float32Array(N), out = new Float32Array(N);
      for (const [a0, dst, pas] of [[src, tmp, 'h'], [tmp, out, 'v']]) {
        for (let u = 0; u < LADO; u++) for (let v = 0; v < LADO; v++) {
          const p = pas === 'h' ? u * LADO + v : v * LADO + u;
          if (src[p] < 0) { dst[p] = -1; continue; }
          let m = esMax ? -1 : 1e9;
          for (let d = -R_SOMBRA; d <= R_SOMBRA; d++) { const w = v + d; if (w < 0 || w >= LADO) continue;
            const q = pas === 'h' ? u * LADO + w : w * LADO + u, val = a0[q]; if (val < 0) continue; if (esMax ? val > m : val < m) m = val; }
          dst[p] = m === 1e9 ? a0[p] : m;
        }
      }
      return out;
    };
    const env0 = filtro(filtro(Lb, true), false);
    const envN = new Float32Array(N), envD = new Float32Array(N);
    for (let p = 0; p < N; p++) if (env0[p] > 0) { envN[p] = env0[p] / 255 * W[p]; envD[p] = W[p]; }
    const eN = await desenfF(envN, 6), eD = await desenfF(envD, 6);
    const obj = new Float32Array(N).fill(-1);
    for (let p = 0; p < N; p++) if (Lb[p] > 0 && eD[p] > 0.05) obj[p] = Math.max(Lb[p], Math.min(env0[p] > 0 ? env0[p] : 255, eN[p] / eD[p] * 255) * 0.97);
    // (5) el lado DERECHO como ejemplo (de frente): luz a gran escala del punto espejo
    if (process.env.ESPEJO === '1' && Math.abs(c.yaw || 0) < 0.3) {
      const grande = new Float32Array(N), gD = new Float32Array(N);
      for (let p = 0; p < N; p++) if (obj[p] > 0) { grande[p] = obj[p] / 255 * W[p]; gD[p] = W[p]; }
      const gN = await desenfF(grande, 22), gDD = await desenfF(gD, 22);
      const eje = rs.nariz ? (fx(rs.nariz[0]) + fx(rs.nariz[2])) / 2 : cxF;
      for (let p = 0; p < N; p++) {
        if (obj[p] < 0) continue; const x = p % LADO, y = (p / LADO) | 0, xm = Math.round(2 * eje - x);
        if (xm < 0 || xm >= LADO) continue; const q = y * LADO + xm;
        if (gDD[q] > 0.2 && gDD[p] > 0.2) { const espejo = gN[q] / gDD[q] * 255, propio = gN[p] / gDD[p] * 255;
          if (espejo > propio) obj[p] = Math.max(obj[p], obj[p] * Math.min(1.5, espejo / propio)); }
      }
    }
    // (6) cuánto subir (suave) y sin manchitas chicas: apertura (erosión + dilatación) del mapa de sombra
    const cand = new Float32Array(N);
    for (let p = 0; p < N; p++) if (obj[p] > 0 && Lb[p] > 0 && obj[p] > Lb[p] * 1.035) cand[p] = 1;
    const erosion = (m, r) => { const o = new Float32Array(N); for (let y = 0; y < LADO; y++) for (let x = 0; x < LADO; x++) { let ok = 1; for (let d = -r; d <= r && ok; d++) { const xx = x + d, yy = y + d;
      if (xx < 0 || xx >= LADO || !m[y * LADO + xx] || yy < 0 || yy >= LADO || !m[yy * LADO + x]) ok = 0; } o[y * LADO + x] = ok; } return o; };
    const dil = await desenfF(erosion(cand, 4), 6); // la dilatación va dentro del desenfoque
    let gTot = 0, nTot = 0;
    const lift = new Float32Array(N), zona = new Float32Array(N);
    const rasgoOscuro = new Float32Array(N);
    for (let p = 0; p < N; p++) { const m = clamp(dil[p] * 2.2, 0, 1); zona[p] = m; if (m <= 0 || obj[p] < 0) continue;
      let gp = Math.min(SOMBRA_MAX, obj[p] / Lb[p]);
      if (Lgr[p] > 0 && Lb[p] < Lgr[p] * 0.85) { gp = Math.min(gp, Math.min(SOMBRA_MAX, obj[p] / Lgr[p])); rasgoOscuro[p] = clamp((Lgr[p] * 0.85 - Lb[p]) / (Lgr[p] * 0.15), 0, 1); }
      lift[p] = m * gp + (1 - m); if (lift[p] > 1.01) { gTot += lift[p]; nTot++; } }
    sombrasBorradas = nTot;
    // tono de la piel bien iluminada
    let tr = 0, tg = 0, tb = 0, tn = 0;
    for (let p = 0; p < N; p += 2) if (Lb[p] > 0 && obj[p] > 0 && Lb[p] >= obj[p] * 0.98 && W[p] > 0.6) { tr += bajaC[0][p] / Lb[p]; tg += bajaC[1][p] / Lb[p]; tb += bajaC[2][p] / Lb[p]; tn++; }
    const tono = tn ? [tr / tn, tg / tn, tb / tn] : null;
    // (7) nueva frecuencia baja y suma de la textura: col' = col + W · (bajaNueva − baja).
    //     Dentro de la zona de sombra el COLOR pasa a ser el de la piel iluminada: la penumbra de la luz
    //     dura es más anaranjada que la piel, y aclararla sola deja rayas naranjas.
    for (let p = 0, i = 0; p < N; p++, i += 3) {
      const g0 = Math.max(lift[p], 1), z = zona[p]; if ((g0 <= 1.001 && z < 0.02) || W[p] < 0.01 || Lb[p] <= 0) continue;
      const Lnueva = Math.min(Lb[p] * g0, Math.max(Lb[p], 222)), g = Lnueva / Lb[p], k = tono ? z * 0.85 * (1 - rasgoOscuro[p]) : 0; // tope: nada se quema; a un lunar no se le cambia el color
      for (let ch = 0; ch < 3; ch++) {
        const b0 = bajaC[ch][p], esc = b0 * g, ref = tono ? tono[ch] * Lnueva : esc;
        const nueva = esc * (1 - k) + ref * k;
        col[i + ch] += FUERZA_SOMBRA * W[p] * (nueva - b0);
      }
    }
  }
  // 7) Corrector de imperfecciones: granitos y puntos ROJOS sobre la piel. Se detectan por cuánto más rojos
  //    son que la piel de alrededor (r−g contra su promedio local), se descartan los grandes (labios, orejas)
  //    y cada uno se tapa con piel limpia de al lado (como el pincel corrector), con el color emparejado y
  //    el borde fundido. Los lunares (marrones, no rojos) quedan.
  const granitos = [];
  if (CORREGIR) {
    // piel "amplia" para buscar el granito: un granito es más saturado que la piel y la regla normal lo deja afuera
    const pielG = new Uint8Array(LADO * LADO);
    const rojo = new Float32Array(LADO * LADO), rojoPiel = Buffer.alloc(LADO * LADO);
    for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) {
      const r = col[i], g = col[i + 1], b = col[i + 2], l = lum(r, g, b) / 255, croma = (r - b) / Math.max(r, 1);
      rojo[p] = (r - g) + 0.8 * (b - g); // magenta: el granito es rosado, la piel anaranjada
      pielG[p] = r > g && g >= b * 0.75 && croma > 0.08 && croma < 0.8 && l > 0.2 && l < 0.97 && mk.data[p] > 128 && objeto[p] < 0.5 ? 255 : 0;
      rojoPiel[p] = pielG[p] ? clamp(Math.round(rojo[p] + 60), 0, 255) : 0;
    }
    const num = await desenfocar(rojoPiel, 14), den = await desenfocar(Buffer.from(pielG), 14);
    // EL granito de la frente (Ishtar: "solo el de la frente"): el punto con más exceso de rojo sobre la
    // piel de alrededor, dentro de la frente. Uno solo; un segundo únicamente si es igual de marcado.
    const rojoSuave = await desenfocar(Buffer.from(rojo.map(v => clamp(Math.round(v + 60), 0, 255))), 1.5);
    const exceso = new Float32Array(LADO * LADO).fill(-99);
    const ancho = (x, y) => x >= 0 && y >= 0 && x < LADO && y < LADO;
    const cejas0 = ['cejaIzq', 'cejaDer'].filter(k => a.rasgos?.[k]).map(k => fy(a.rasgos[k][1]));
    // bien por ENCIMA de las cejas: a la altura de las cejas puede estar el puente o el borde del armazón
    const fy1 = (cejas0.length ? Math.min(...cejas0) : fy(c.y + c.h * 0.1)) - 32;
    const fx0 = Math.max(0, fx(L) + 10), fx1 = Math.min(LADO - 1, fx(R) - 10);
    for (let y = 0; y < fy1; y++) for (let x = Math.round(fx0); x < fx1; x++) {
      const p = y * LADO + x;
      if (!pielG[p] || den[p] < 70) continue;
      exceso[p] = (rojoSuave[p] - 60) - (num[p] / den[p] * 255 - 60);
    }
    if (process.env.DEBUG_GRANITO) { const [dx, dy] = process.env.DEBUG_GRANITO.split(',').map(Number); let mx = { e: -99 };
      for (let y = dy - 25; y <= dy + 25; y++) for (let x = dx - 25; x <= dx + 25; x++) { const q = y * LADO + x; if (exceso[q] > mx.e) mx = { e: exceso[q], x, y }; }
      const q = mx.y * LADO + mx.x; console.error('zona', { fy1: Math.round(fy1), fx0: Math.round(fx0), fx1: Math.round(fx1) }, 'máx cerca', mx, { pesoPiel: pesoPiel.data[q], den: den[q], piel: piel01[q], rojo: rojo[q] });
      const q2 = dy * LADO + dx; console.error('en el punto', { pesoPiel: pesoPiel.data[q2], den: den[q2], piel: piel01[q2], rojo: rojo[q2], local: num[q2] / den[q2] * 255 - 60, exceso: exceso[q2] }); }
    const spot = new Uint8Array(LADO * LADO);
    const picos = [];
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      let mejor = -1, pm = -1;
      for (let p = 0; p < LADO * LADO; p++) if (exceso[p] > mejor && !picos.some(q => Math.hypot(q.x - p % LADO, q.y - ((p / LADO) | 0)) < 60)) { mejor = exceso[p]; pm = p; }
      if (pm < 0 || mejor < (vuelta === 0 ? 9 : 24)) break;
      const cx0 = pm % LADO, cy0 = (pm / LADO) | 0, corte = Math.max(5, mejor * 0.45);
      let n = 0, x0 = cx0, x1 = cx0, y0 = cy0, y1 = cy0;
      for (let y = cy0 - 22; y <= cy0 + 22; y++) for (let x = cx0 - 22; x <= cx0 + 22; x++) {
        if (!ancho(x, y) || Math.hypot(x - cx0, y - cy0) > 22) continue; const q = y * LADO + x;
        if (exceso[q] > corte) { spot[q] = 1; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      picos.push({ x: cx0, y: cy0 });
      const gr = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) / 2 + 5, n, exceso: +mejor.toFixed(1) };
      if (gr.cy + gr.r * 1.6 > fy1 + 26) continue; // el parche tocaría la zona del armazón
      granitos.push(gr);
    }
    // tapar cada uno con piel de al lado
    for (const g of granitos) {
      const R = Math.ceil(g.r * 1.6), dist = Math.ceil(g.r * 2.4 + 6);
      const anillo = (cx, cy) => { let s = [0, 0, 0], k = 0; for (let a = 0; a < 24; a++) { const x = Math.round(cx + Math.cos(a / 24 * 6.283) * R), y = Math.round(cy + Math.sin(a / 24 * 6.283) * R); if (!ancho(x, y)) continue; const i = (y * LADO + x) * 3; s[0] += col[i]; s[1] += col[i + 1]; s[2] += col[i + 2]; k++; } return k ? s.map(v => v / k) : null; };
      const dest = anillo(g.cx, g.cy); if (!dest) continue;
      const lumDest = lum(dest[0], dest[1], dest[2]);
      let mejor = null;
      // piel de origen: 16 direcciones a 3 distancias; vale la piel "amplia" (la del granito) y hasta 12 % de
      // otra cosa (pelos sueltos). Pegado al flequillo, la piel limpia suele estar abajo o al costado.
      for (const dist of [Math.ceil(g.r * 1.9 + 4), Math.ceil(g.r * 2.4 + 6), Math.ceil(g.r * 3.2 + 8)]) for (let a = 0; a < 16; a++) {
        const ox = Math.round(Math.cos(a / 16 * 6.283) * dist), oy = Math.round(Math.sin(a / 16 * 6.283) * dist);
        let malos = 0, total = 0, fuera = false;
        for (let y = -R; y <= R; y += 2) for (let x = -R; x <= R; x += 2) { if (x * x + y * y > R * R) continue; const sx = Math.round(g.cx + x + ox), sy = Math.round(g.cy + y + oy); if (!ancho(sx, sy)) { fuera = true; continue; } total++; const q = sy * LADO + sx; if (!pielG[q] || spot[q] || lum(col[q * 3], col[q * 3 + 1], col[q * 3 + 2]) < lumDest * 0.82) malos++; }
        if (fuera || malos > total * 0.04) continue;
        const src = anillo(g.cx + ox, g.cy + oy); if (!src) continue;
        const d = Math.abs(src[0] - dest[0]) + Math.abs(src[1] - dest[1]) + Math.abs(src[2] - dest[2]) + malos * 2 + dist * 0.05;
        if (!mejor || d < mejor.d) mejor = { ox, oy, src, d };
      }
      if (!mejor) { g.tapado = false; continue; }
      g.tapado = true;
      // pincel corrector: BAJA (tono y luz) = la del entorno del granito sin el granito; ALTA (textura) = la del origen
      const S2 = Math.max(4, R * 0.45), RR = R + Math.ceil(S2 * 3);
      const bx0 = Math.max(0, Math.floor(g.cx - RR)), by0 = Math.max(0, Math.floor(g.cy - RR)), bx1 = Math.min(LADO - 1, Math.ceil(g.cx + RR)), by1 = Math.min(LADO - 1, Math.ceil(g.cy + RR));
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
      const gauss = (arr, ancho, alto, sig) => { // desenfoque gaussiano separable de un float array
        const k = Math.ceil(sig * 3), w = []; let sw = 0; for (let i = -k; i <= k; i++) { const v = Math.exp(-i * i / (2 * sig * sig)); w.push(v); sw += v; }
        const t = new Float32Array(ancho * alto), o = new Float32Array(ancho * alto);
        for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) { let a2 = 0; for (let i = -k; i <= k; i++) { const xx = Math.min(ancho - 1, Math.max(0, x + i)); a2 += arr[y * ancho + xx] * w[i + k]; } t[y * ancho + x] = a2 / sw; }
        for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) { let a2 = 0; for (let i = -k; i <= k; i++) { const yy = Math.min(alto - 1, Math.max(0, y + i)); a2 += t[yy * ancho + x] * w[i + k]; } o[y * ancho + x] = a2 / sw; }
        return o;
      };
      // peso del entorno: piel, fuera del granito (agrandado), y no pelo
      const peso = new Float32Array(bw * bh);
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const q = y * LADO + x, d = Math.hypot(x - g.cx, y - g.cy);
        peso[(y - by0) * bw + x - bx0] = pielG[q] && d > g.r + 2 && lum(col[q * 3], col[q * 3 + 1], col[q * 3 + 2]) >= lumDest * 0.82 ? 1 : 0; }
      const pS = gauss(peso, bw, bh, S2);
      const bajaEnt = [0, 1, 2].map(ch => { const t = new Float32Array(bw * bh); for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const j = (y - by0) * bw + x - bx0; t[j] = peso[j] * col[(y * LADO + x) * 3 + ch]; } const n2 = gauss(t, bw, bh, S2); for (let j = 0; j < n2.length; j++) n2[j] = pS[j] > 0.02 ? n2[j] / pS[j] : dest[ch]; return n2; });
      // baja del origen (desplazado)
      const sx0 = Math.max(0, bx0 + mejor.ox), sy0 = Math.max(0, by0 + mejor.oy);
      const bajaSrc = [0, 1, 2].map(ch => { const t = new Float32Array(bw * bh); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const xx = Math.min(LADO - 1, Math.max(0, bx0 + x + mejor.ox)), yy = Math.min(LADO - 1, Math.max(0, by0 + y + mejor.oy)); t[y * bw + x] = col[(yy * LADO + xx) * 3 + ch]; } return gauss(t, bw, bh, S2); });
      const nuevo = [];
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        const tx = Math.round(g.cx + x), ty = Math.round(g.cy + y); if (!ancho(tx, ty)) continue;
        const r01 = Math.hypot(x, y) / R; if (r01 >= 1) continue;
        const alfa = r01 < 0.55 ? 1 : (1 - (r01 - 0.55) / 0.45) ** 1.5;
        const j = (ty - by0) * bw + tx - bx0, ti = (ty * LADO + tx) * 3, si = ((ty + mejor.oy) * LADO + tx + mejor.ox) * 3;
        const v = [0, 1, 2].map(ch => bajaEnt[ch][j] + (col[si + ch] - bajaSrc[ch][j]));
        nuevo.push([ti, alfa, v]);
      }
      for (const [ti, alfa, v] of nuevo) for (let ch = 0; ch < 3; ch++) col[ti + ch] = col[ti + ch] * (1 - alfa) + v[ch] * alfa;
    }
  }
  // 8) Fondo uniforme donde no hay persona (borde suave por la máscara desenfocada).
  //    En la franja de los ojos, lo que se ve A TRAVÉS de un cristal al aire (contorno, logo grabado) no es
  //    cortina: ahí el fondo nuevo conserva la diferencia con la cortina local y solo cambia su tono
  //    (auditoría 2: a Isis y Cratos de perfil se les borraban el logo y parte del contorno del cristal lejano).
  const cortCol = [0, 1, 2].map(() => Buffer.alloc(LADO * LADO)), segF = Buffer.alloc(LADO * LADO);
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) if (mk.data[p] < 15) { segF[p] = 255; for (let ch = 0; ch < 3; ch++) cortCol[ch][p] = clamp(Math.round(col[i + ch] * 0.65), 0, 255); }
  const dCF = (await raw(sharp(segF, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(14).extractChannel(0))).data;
  const nCF = []; for (let ch = 0; ch < 3; ch++) nCF.push(Float32Array.from((await raw(sharp(cortCol[ch], { raw: { width: LADO, height: LADO, channels: 1 } }).blur(14).extractChannel(0))).data, v => v / 0.65));
  // color del frente (persona) extendido hacia el borde: promedio local de lo que es persona segura
  const segP = Buffer.alloc(LADO * LADO), fgCol = [0, 1, 2].map(() => Buffer.alloc(LADO * LADO));
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) if (mk.data[p] > 235) { segP[p] = 255; for (let ch = 0; ch < 3; ch++) fgCol[ch][p] = clamp(Math.round(col[i + ch] * 0.65), 0, 255); }
  const dFG = (await raw(sharp(segP, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(5).extractChannel(0))).data;
  const nFG = []; for (let ch = 0; ch < 3; ch++) nFG.push(Float32Array.from((await raw(sharp(fgCol[ch], { raw: { width: LADO, height: LADO, channels: 1 } }).blur(5).extractChannel(0))).data, v => v / 0.65));
  const finoBlur = [];
  const ESC = 0.65; // los valores intermedios pueden pasar de 255 (el tope va al final): se guardan escalados
  for (let ch = 0; ch < 3; ch++) { const b8 = Buffer.alloc(LADO * LADO); for (let p = 0; p < LADO * LADO; p++) b8[p] = clamp(Math.round(col[p * 3 + ch] * ESC), 0, 255);
    const bl = (await raw(sharp(b8, { raw: { width: LADO, height: LADO, channels: 1 } }).blur(4).extractChannel(0))).data;
    finoBlur.push(Float32Array.from(bl, v => v / ESC)); }
  const out = Buffer.alloc(LADO * LADO * 3);
  for (let p = 0, i = 0; p < LADO * LADO; p++, i += 3) {
    const y = (p / LADO) | 0;
    const xq = p % LADO, centroH = fx((HL + HR) / 2);
    const ladoFrente = girado ? (nx > (HL + HR) / 2 ? xq >= centroH : xq <= centroH) : true;
    const enBanda = bandaY1 > bandaY0 && ladoFrente ? Math.min(1, Math.max(0, Math.min(y - bandaY0, bandaY1 - y) / 30)) : 0;
    let det = [0, 0, 0];
    if (process.env.DEBUG_PX && process.env.DEBUG_PX === String(p)) console.error('px', { mk: mk.data[p], objeto: objeto[p], col: [col[i], col[i + 1], col[i + 2]].map(Math.round), enBanda, ladoFrente });
    if (enBanda > 0 && mk.data[p] < 140) {
      // solo detalle FINO y OSCURO (contorno de un cristal al aire, logo grabado): diferencia contra el entorno
      // inmediato. Las variaciones anchas de la cortina no pasan (dejaban rectángulos claros) y lo más claro que
      // el entorno tampoco (es el borde luminoso que deja todo filtro de detalle: un halo alrededor del armazón)
      const d = [0, 1, 2].map(ch => col[i + ch] - finoBlur[ch][p]);
      const dl = lum(d[0], d[1], d[2]);
      const keep = clamp((-dl - 4) / 10, 0, 1) * enBanda;
      det = d.map(v => v * keep);
    }
    const bgA = 1 - mk.data[p] / 255;
    const t = (bgA <= 0.04 ? 0 : bgA >= 0.6 ? 1 : ((bgA - 0.04) / 0.56) ** 1.5) * (1 - objeto[p]);
    // descontaminar el borde: en los pelos sueltos y el contorno semitransparente se ve la cortina a través
    // (quedaba un halo gris azulado en la nuca). Se le resta la cortina local según la opacidad.
    const aF = mk.data[p] / 255;
    const desc = aF > 0.04 && aF < 0.995 && dCF[p] > 8 && objeto[p] < 0.5;
    let kDesc = 0;
    const enBandaY = bandaY1 > bandaY0 && y > bandaY0 - 30 && y < bandaY1 + 30;
    if (desc && dFG[p] > 10 && !(enBandaY && ladoFrente)) {
      // cuánto se parece a la cortina de al lado (en color y luz): un pelito que deja ver la cortina
      const dB = Math.hypot(col[i] - nCF[0][p] / dCF[p] * 255, col[i + 1] - nCF[1][p] / dCF[p] * 255, col[i + 2] - nCF[2][p] / dCF[p] * 255);
      const pareceCortina = 1 - clamp(dB / 45, 0, 1);
      kDesc = clamp((1 - aF) * 1.5 + pareceCortina * 0.9, 0, 1);
    }
    // hombro por luminancia: se comprime la luz y se conserva el tono; si un canal igual se pasa, se lo
    // acerca al gris de su misma luz (sin cambiar el tono)
    const lq = lum(col[i], col[i + 1], col[i + 2]) / 255;
    const lqs = lq > HOMBRO ? HOMBRO + (1 - HOMBRO) * (1 - Math.exp(-(lq - HOMBRO) / (1 - HOMBRO))) : lq;
    const kq = lq > 0 ? lqs / lq : 1;
    let mx = 0; for (let ch = 0; ch < 3; ch++) mx = Math.max(mx, col[i + ch] * kq);
    const sat = mx > 255 ? (255 - lqs * 255) / Math.max(mx - lqs * 255, 1) : 1;
    for (let ch = 0; ch < 3; ch++) {
      let v = lqs * 255 + (col[i + ch] * kq - lqs * 255) * sat;
      if (kDesc > 0) { const F = nFG[ch][p] / dFG[p] * 255; v = v * (1 - kDesc) + F * kDesc; } // la parte "de cortina" del píxel toma el color del pelo de al lado
      out[i + ch] = clamp(Math.round(v * (1 - t) + (FONDO[ch] + det[ch]) * t), 0, 255);
    }
  }
  if (MARCAR) for (const g of granitos) for (let a = 0; a < 90; a++) { const x = Math.round(g.cx + Math.cos(a / 90 * 6.283) * (g.r + 6)), y = Math.round(g.cy + Math.sin(a / 90 * 6.283) * (g.r + 6)); if (x >= 0 && y >= 0 && x < LADO && y < LADO) { const i = (y * LADO + x) * 3; out[i] = 0; out[i + 1] = 255; out[i + 2] = 0; } }
  const destino = path.join(salida, `${n}.webp`);
  if (STORY) await sharp(out, { raw: { width: LADO, height: LADO, channels: 3 } }).extract({ left: stripLeft, top: 0, width: 1080, height: 1920 }).sharpen({ sigma: 0.6 }).jpeg({ quality: 92 }).toFile(destino.replace(/\.webp$/, '.jpg'));
  else await sharp(out, { raw: { width: LADO, height: LADO, channels: 3 } }).sharpen({ sigma: 0.6 }).webp({ quality: CALIDAD, effort: 5 }).toFile(destino);
  return { n, sombraPx: sombrasBorradas, granitos: granitos.length, tapados: granitos.filter(g => g.tapado).length, relleno: nRelleno ? +(rellenoMedio / nRelleno).toFixed(2) : 1, pielLuz: +pielLuz.toFixed(2), side, cara: +(c.w / side).toFixed(2), cabeza: +((R - L) / side).toFixed(2), perfil, piel: +piel.toFixed(2), gamma: +gamma.toFixed(2), cortina: cort.map(Math.round) };
}

for (const n of nums) console.log(JSON.stringify(await editar(n)));
