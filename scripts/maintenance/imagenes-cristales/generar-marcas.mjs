/**
 * IMÁGENES DE MARCA para los cristales: una pieza cuadrada por familia, para
 * que cada producto de la tienda y cada presupuesto salga con su imagen.
 *
 * Pedido de Ishtar (31/8/2026): "una imagen que represente cada una, o un logo
 * pero que diga Stellest, así todos los presupuestos salen con el detalle" ·
 * "la idea es que sirvan para la tienda, que todo tenga imagen representativa"
 * · las que no haya oficiales, "rediseñar del tipo" de su foto de referencia:
 * una lente apoyada en madera, con las luces cálidas de la óptica desenfocadas
 * detrás.
 *
 * CÓMO: HTML + CSS renderizado con Playwright — la misma técnica que las piezas
 * de redes (scripts/social), y con los MISMOS colores de identidad, leídos de
 * globals.css vía identidad.mjs. Acá no se dibuja ninguna foto ajena: la escena
 * (madera, bokeh, la lente de vidrio) está construida en CSS, así no dependemos
 * de derechos de nadie y todas las familias salen con la misma estética.
 *
 * SALIDA: public/images/cristales/marcas/<slug>.jpg (1200×1200, JPEG real).
 * La asignación a los productos es un paso aparte, después del OK de Ishtar.
 *
 *   node scripts/maintenance/imagenes-cristales/generar-marcas.mjs           # todas
 *   node scripts/maintenance/imagenes-cristales/generar-marcas.mjs stellest  # una
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarIdentidad, RAIZ } from '../../social/identidad.mjs';

const SALIDA = path.join(RAIZ, 'public', 'images', 'cristales', 'marcas');

/**
 * Las familias. `nombre` es lo que se lee grande; `linea` la bajada corta.
 * El texto es descriptivo nuestro — no se reproducen logotipos ajenos.
 */
export const FAMILIAS = [
    { slug: 'varilux-comfort', nombre: 'Varilux Comfort', linea: 'Progresivos Essilor' },
    { slug: 'varilux-comfort-max', nombre: 'Varilux Comfort Max', linea: 'Progresivos Essilor' },
    { slug: 'varilux-physio', nombre: 'Varilux Physio', linea: 'Progresivos Essilor' },
    { slug: 'varilux-physio-3-0', nombre: 'Varilux Physio 3.0', linea: 'Progresivos Essilor' },
    { slug: 'varilux-xr-design', nombre: 'Varilux XR Design', linea: 'Progresivos Essilor' },
    { slug: 'varilux-digitime', nombre: 'Varilux Digitime', linea: 'Ocupacional Essilor' },
    { slug: 'varilux-liberty', nombre: 'Varilux Liberty 3.0', linea: 'Progresivos Essilor' },
    { slug: 'mi-primer-varilux', nombre: 'Mi Primer Varilux', linea: '50% para tu primer multifocal' },
    { slug: 'mi-primer-kodak', nombre: 'Mi Primer Kodak', linea: '50% para tu primer multifocal' },
    { slug: 'kodak-precise', nombre: 'Kodak Precise', linea: 'Progresivos digitales' },
    { slug: 'kodak-unique-dro', nombre: 'Kodak Unique DRO', linea: 'Progresivos digitales' },
    { slug: 'kodak-softwear', nombre: 'Kodak Softwear', linea: 'Progresivos digitales' },
    { slug: 'kodak-sv-digital', nombre: 'Kodak SV Digital', linea: 'Monofocales digitales' },
    { slug: 'eyezen-start', nombre: 'Eyezen Start', linea: 'Monofocales optimizados Essilor' },
    { slug: 'eyezen-boost', nombre: 'Eyezen Boost', linea: 'Monofocales optimizados Essilor' },
    { slug: 'eyezen-kids', nombre: 'Eyezen Kids', linea: 'Visión sencilla para chicos' },
    { slug: 'stellest', nombre: 'Stellest', linea: 'Control de miopía infantil' },
    { slug: 'myopilux', nombre: 'Myopilux', linea: 'Control de miopía infantil' },
    { slug: 'sygnus-new-editions', nombre: 'Sygnus New Editions', linea: 'Progresivos digitales' },
    { slug: 'sygnus-monofocal-one', nombre: 'Sygnus ONE', linea: 'Monofocal digital' },
    { slug: 'sygnus-bifocal', nombre: 'Sygnus Bifocal', linea: 'Bifocal digital' },
    { slug: 'sygnus-driver', nombre: 'Sygnus Driver', linea: 'Lentes para conducir' },
    { slug: 'interview', nombre: 'Interview', linea: 'Ocupacional Essilor' },
    { slug: 'espace-plus', nombre: 'Espace Plus Digital', linea: 'Ocupacional digital' },
    { slug: 'blue-uv', nombre: 'Blue UV Filter System', linea: 'Filtro de luz azul' },
    { slug: 'transitions-gen-s', nombre: 'Transitions Gen S', linea: 'Fotocromáticos' },
    { slug: 'xperio', nombre: 'Xperio', linea: 'Polarizados' },
    { slug: 'crizal', nombre: 'Crizal', linea: 'Antirreflejos Essilor' },
];

/** La escena: lente de vidrio sobre madera, bokeh cálido detrás, nombre al pie. */
function html(fam, id) {
    const bronce = id.colores.primario ?? '#7d6249';
    return `<!doctype html><html><head><meta charset="utf-8">
<link href="${id.googleFonts}" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:1200px;overflow:hidden;font-family:${id.fuentes.titulo};position:relative;background:#171310}

/* Fondo: la óptica desenfocada — pared cálida y puntos de luz */
.fondo{position:absolute;inset:0;background:
  radial-gradient(circle at 18% 22%, rgba(255,196,120,.16), transparent 24%),
  radial-gradient(circle at 82% 16%, rgba(255,214,150,.13), transparent 22%),
  radial-gradient(circle at 68% 38%, rgba(255,190,110,.10), transparent 18%),
  radial-gradient(circle at 30% 44%, rgba(255,205,140,.08), transparent 16%),
  linear-gradient(180deg,#221a13 0%,#2c2118 46%,#191310 100%)}
.bokeh{position:absolute;border-radius:50%;filter:blur(14px);opacity:.5}
.b1{width:110px;height:110px;left:8%;top:12%;background:#ffcf8f}
.b2{width:70px;height:70px;left:88%;top:24%;background:#ffd9a0}
.b3{width:54px;height:54px;left:74%;top:10%;background:#ffc887}
.b4{width:88px;height:88px;left:22%;top:30%;background:#f5bd7f;opacity:.32}
.b5{width:46px;height:46px;left:52%;top:16%;background:#ffe0b0;opacity:.4}

/* Estantes desenfocados insinuados */
.estante{position:absolute;height:7px;background:rgba(255,210,150,.10);filter:blur(9px);border-radius:4px}
.e1{width:300px;left:4%;top:26%}.e2{width:260px;left:78%;top:34%}.e3{width:220px;left:66%;top:20%}

/* La mesa de madera */
.mesa{position:absolute;left:0;right:0;bottom:0;height:34%;
  background:linear-gradient(180deg,#4a3622 0%,#3c2c1c 30%,#241a11 100%)}
.veta{position:absolute;left:0;right:0;height:2px;background:rgba(0,0,0,.25);filter:blur(1px)}

/* La lente: vidrio de canto, apoyada */
.lente{position:absolute;left:50%;bottom:31%;transform:translateX(-50%);
  width:480px;height:520px;border-radius:50%;
  background:radial-gradient(ellipse at 36% 30%, rgba(255,255,255,.38), rgba(255,250,240,.14) 40%, rgba(255,240,220,.07) 62%, rgba(255,230,200,.16) 88%, rgba(255,255,255,.22) 100%);
  border:16px solid rgba(255,250,242,.42);
  box-shadow:
    inset 0 0 110px rgba(255,235,205,.28),
    inset -34px -10px 70px rgba(255,255,255,.14),
    inset 26px 18px 60px rgba(255,255,255,.10),
    0 34px 70px rgba(0,0,0,.5)}
.lente:before{content:'';position:absolute;inset:12px;border-radius:50%;
  border:7px solid rgba(255,255,255,.26);
  background:radial-gradient(ellipse at 64% 66%, rgba(255,215,165,.14), transparent 58%)}
.lente:after{content:'';position:absolute;right:10%;bottom:12%;width:120px;height:200px;border-radius:50%;
  background:linear-gradient(320deg,rgba(255,240,215,.30),transparent 70%);filter:blur(10px);transform:rotate(18deg)}
.apoyo{position:absolute;left:50%;bottom:30%;transform:translateX(-50%);
  width:360px;height:44px;border-radius:50%;background:rgba(0,0,0,.45);filter:blur(16px)}
.brillo{position:absolute;left:16%;top:9%;width:150px;height:290px;border-radius:50%;
  background:linear-gradient(160deg,rgba(255,255,255,.34),transparent 70%);filter:blur(9px);transform:rotate(24deg)}

/* Reflejo sobre la madera */
.reflejo{position:absolute;left:50%;bottom:16%;transform:translateX(-50%) scaleY(-.42);
  width:520px;height:300px;border-radius:50%;
  background:radial-gradient(ellipse at 50% 20%, rgba(255,235,205,.16), transparent 65%);
  filter:blur(10px);opacity:.7}

/* El nombre */
.placa{position:absolute;left:0;right:0;bottom:5.2%;text-align:center;color:#f6efe6}
.marca{font-size:92px;font-weight:900;letter-spacing:.5px;line-height:1.04;
  text-shadow:0 4px 26px rgba(0,0,0,.6)}
.linea{margin-top:14px;font-size:33px;font-weight:500;letter-spacing:6px;text-transform:uppercase;color:#cbb6a0}
.filete{width:120px;height:3px;background:${bronce};margin:26px auto 0;border-radius:2px}
.atelier{position:absolute;top:4.6%;left:0;right:0;text-align:center;font-size:26px;
  letter-spacing:10px;color:rgba(246,239,230,.55);font-weight:500}
</style></head><body>
<div class="fondo"></div>
<div class="bokeh b1"></div><div class="bokeh b2"></div><div class="bokeh b3"></div>
<div class="bokeh b4"></div><div class="bokeh b5"></div>
<div class="estante e1"></div><div class="estante e2"></div><div class="estante e3"></div>
<div class="mesa"><div class="veta" style="top:22%"></div><div class="veta" style="top:47%"></div><div class="veta" style="top:71%"></div></div>
<div class="reflejo"></div>
<div class="apoyo"></div>
<div class="lente"><div class="brillo"></div></div>
<div class="atelier">ATELIER ÓPTICA</div>
<div class="placa">
  <div class="marca">${fam.nombre}</div>
  <div class="linea">${fam.linea}</div>
  <div class="filete"></div>
</div>
</body></html>`;
}

const soloSlug = process.argv[2];
const id = await cargarIdentidad();
await mkdir(SALIDA, { recursive: true });

const { chromium } = await import('playwright');
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 2 });
const sharp = (await import('sharp')).default;

const lista = soloSlug ? FAMILIAS.filter(f => f.slug === soloSlug) : FAMILIAS;
for (const fam of lista) {
    await pagina.setContent(html(fam, id), { waitUntil: 'networkidle' });
    const png = await pagina.screenshot({ type: 'png' });
    const destino = path.join(SALIDA, `${fam.slug}.jpg`);
    // JPEG real (Instagram y la tienda rechazan PNG renombrado) y 1200px netos.
    await sharp(png).resize(1200, 1200).jpeg({ quality: 88 }).toFile(destino);
    console.log(`  ✅ ${fam.slug}.jpg`);
}
await navegador.close();
console.log(`\n${lista.length} imagen(es) en public/images/cristales/marcas/`);
