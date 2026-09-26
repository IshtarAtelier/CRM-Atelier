import { NextResponse } from 'next/server';
import {
  COOKIE_TRAFICO_INTERNO,
  esTraficoInterno,
  opcionesCookieMarca,
} from '@/lib/trafico-interno';

/**
 * Marca este navegador como del equipo (ver src/lib/trafico-interno.ts).
 *
 *   /interno            → marcado: no le cuenta nada a Meta ni a Google.
 *   /interno?quitar=1   → vuelve a contar como un cliente, por 24 h.
 *   /interno?ver=1      → solo muestra cómo está, sin cambiar nada.
 *
 * Es un link y no un botón a propósito: se abre una vez en cada celular y en
 * cada compu, y listo. Una página suelta (sin el layout del sitio) para que no
 * cargue ni el píxel ni la analítica mientras se marca.
 *
 * Por qué el "quitar" dura 24 h y no para siempre: quien usa el CRM en ese
 * navegador vuelve a quedar marcado solo al entrar a /admin, salvo que tenga
 * esta excepción puesta. Alcanza para probar el píxel un rato; si se olvida,
 * se cura sola al día siguiente.
 */
export const dynamic = 'force-dynamic';

const UN_DIA_S = 24 * 60 * 60;

type Estado = 'interno' | 'cliente';

function pagina(estado: Estado, cambio: boolean): string {
  const titulo =
    estado === 'interno'
      ? cambio
        ? 'Listo: este navegador es del equipo'
        : 'Este navegador es del equipo'
      : cambio
        ? 'Este navegador vuelve a contar como cliente'
        : 'Este navegador cuenta como cliente';
  const detalle =
    estado === 'interno'
      ? 'Lo que mires, cargues al carrito o toques acá no se le informa a Meta ni a Google, y no entra en las estadísticas de la tienda. Una compra de verdad igual se registra y le llega a Meta.'
      : cambio
        ? 'Por 24 horas lo que hagas acá se mide como si fueras un cliente. Si en este navegador usás el CRM, mañana se vuelve a marcar solo.'
        : 'Lo que hagas acá se mide como si fueras un cliente.';
  const accion =
    estado === 'interno'
      ? '<a href="/interno?quitar=1">Desmarcar (para probar el píxel)</a>'
      : '<a href="/interno">Marcar como del equipo</a>';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Navegador del equipo · Atelier</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #1a1a1a; }
  main { max-width: 32rem; margin: 0 auto; padding: 3rem 1.25rem; }
  h1 { font-size: 1.6rem; line-height: 1.3; margin: 0 0 1rem; }
  p { font-size: 1.15rem; line-height: 1.55; margin: 0 0 1.5rem; }
  a { display: block; font-size: 1.1rem; color: #8a6d3b; font-weight: 600; padding: .75rem 0; }
</style>
</head>
<body>
<main>
  <h1>${titulo}</h1>
  <p>${detalle}</p>
  ${accion}
  <a href="/">Ir a la tienda</a>
</main>
</body>
</html>`;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const soloVer = params.get('ver') === '1';
  const quitar = params.get('quitar') === '1';

  const estadoActual: Estado = esTraficoInterno(req.headers.get('cookie')) ? 'interno' : 'cliente';
  const estado: Estado = soloVer ? estadoActual : quitar ? 'cliente' : 'interno';

  const res = new NextResponse(pagina(estado, !soloVer), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

  if (!soloVer) {
    // "0" y no borrarla: así el middleware no la vuelve a poner al entrar a
    // /admin durante esas 24 h (solo marca a quien NO tiene la cookie).
    res.cookies.set(
      COOKIE_TRAFICO_INTERNO,
      quitar ? '0' : '1',
      opcionesCookieMarca(quitar ? UN_DIA_S : undefined),
    );
  }
  return res;
}
