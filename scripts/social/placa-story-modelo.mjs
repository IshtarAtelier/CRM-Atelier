/**
 * La placa de story de un modelo: foto a pantalla completa + degradado oscuro
 * abajo + leyenda chica dorada + nombre grande + color + logo.
 *
 * FORMATO APROBADO por Ishtar el 29/9/2026 (stories de Agostina) y pedido
 * igual para las de Massaru el 16/10. No cambiarlo sin mostrarle antes. Vive
 * acá para que todas las sesiones de fotos salgan con la MISMA placa: antes
 * el HTML estaba copiado dentro de generar-stories-agostina.mjs.
 *
 * `page` es una página de Playwright de 1080×1920; `fotoJpg`, el Buffer de
 * la foto ya recortada a 9:16.
 */
export async function renderizarPlaca(page, { id, logo, fotoJpg, leyenda, nombre, color, destino }) {
    const oro = id.colores.marcaClara;
    const img = fotoJpg.toString('base64');
    await page.setContent(`<html><head><link href="${id.googleFonts}" rel="stylesheet"><style>
body{margin:0;width:1080px;height:1920px;overflow:hidden;position:relative;background:${id.oscuro};font-family:${id.fuentes.titulo}}
.f{position:absolute;inset:0;background:url(data:image/jpeg;base64,${img}) center/cover}
.g{position:absolute;left:0;right:0;bottom:0;height:700px;background:linear-gradient(transparent,${id.oscuro})}
.t{position:absolute;left:0;right:0;bottom:170px;text-align:center;color:#fff}
.k{font-size:30px;letter-spacing:10px;color:${oro};text-transform:uppercase;margin-bottom:10px}
.n{font-size:130px;font-weight:700;letter-spacing:4px;line-height:1}
.c{font-size:40px;color:${oro};letter-spacing:6px;margin-top:8px}
.l{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);height:54px;filter:brightness(0) invert(1)}
</style></head><body><div class="f"></div><div class="g"></div>
<div class="t"><div class="k">${leyenda}</div><div class="n">${nombre}</div>${color ? `<div class="c">${color}</div>` : ''}</div>
<img class="l" src="${logo}"></body></html>`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: destino, type: 'jpeg', quality: 88 });
}
