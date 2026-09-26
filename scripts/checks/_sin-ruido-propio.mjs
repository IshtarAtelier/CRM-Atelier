// Los navegadores automáticos de los checks no le cuentan nada a Meta.
//
// `/api/web/track` espeja el embudo a Meta por el Conversions API, y un check
// que recorre fichas contra producción era, para Meta, un visitante más: el
// 25/9/2026 hubo 81 cargas de Lighthouse y 15 recorridos ficha → carrito →
// checkout que el píxel contó como 21 AddToCart y 16 InitiateCheckout, con
// "Ventas | Tienda online" optimizando sobre eso.
//
// Por qué se contesta el beacon ACÁ y no con la cookie `ate_interno`
// (src/lib/trafico-interno.ts): la cookie también apaga el píxel y gtag, y
// check:velocidad mide justamente cuánto pesan. Contestar el beacon en el
// navegador de prueba deja la página idéntica a la de un cliente y el servidor
// no se entera. Y sirve igual contra un producción sin el filtro deployado.
//
// Uso:  await sinRuidoPropio(contexto)   // un BrowserContext de Playwright

export const RUTA_BEACON_PROPIO = '**/api/web/track';

export async function sinRuidoPropio(contexto) {
  await contexto.route(RUTA_BEACON_PROPIO, (ruta) => ruta.fulfill({ status: 204, body: '' }));
}
