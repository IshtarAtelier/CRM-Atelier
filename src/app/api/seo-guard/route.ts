import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Guardián de SEO para monitoreo externo (cron-job.org, como /api/health):
//   200 → todas las URLs legadas (Tienda Nube / índice viejo de Google) siguen
//         redirigiendo a una página real de la tienda nueva.
//   503 → alguna ruta legada quedó rota (404, soft-404 o redirect mal apuntado),
//         para enterarnos por email ANTES de que Google la saque del índice.
// Cada check sigue la cadena de redirects a mano (máx. 6 saltos) y exige:
//   - status final 200
//   - que el destino final empiece con el prefijo esperado (si se especifica)
//   - que una ficha de producto NUNCA sea el soft-404 "Producto no encontrado"
const BASE = process.env.SEO_GUARD_BASE || 'https://atelieroptica.com.ar';

type Check = {
  path: string;          // ruta legada a probar (relativa a BASE) o URL absoluta
  expect?: string[];     // pathname final aceptado: match exacto, o prefijo si no es '/'
  expectHost?: string;   // host final exigido (canonicalización www → apex)
  why: string;           // qué protege, para leer la falla en el JSON de alerta
};

const CHECKS: Check[] = [
  // — Estructura vieja de Tienda Nube —
  { path: '/productos', expect: ['/tienda'], why: 'listado TN /productos → /tienda' },
  { path: '/productos/las-oreiro-7335-c2-lentes-de-sol', why: 'producto TN indexado (redirige a ficha o categoría, jamás soft-404)' },
  { path: '/lentes-de-sol/page/18', expect: ['/lentes-de-sol'], why: 'paginación TN (Soft 404 en GSC 7/2026)' },
  { path: '/vulk-y-rusty', expect: ['/lentes-de-sol'], why: 'landing TN de marcas Vulk/Rusty (404 en GSC 7/2026)' },
  { path: '/blog/posts/legacy-cualquiera-seo-guard', expect: ['/blog'], why: 'posts TN /blog/posts/* → blog nuevo' },
  { path: '/politicas', expect: ['/politicas-de-cambio'], why: 'ruta vieja de políticas' },
  // — Anti soft-404: un slug inexistente debe REDIRIGIR, nunca 200 "no encontrado" —
  { path: '/producto/slug-inexistente-seo-guard', expect: ['/tienda', '/lentes-de-sol'], why: 'producto borrado redirige (fix soft-404)' },
  // — Canonicalización de host: los links viejos con www deben caer en el apex —
  { path: 'https://www.atelieroptica.com.ar/', expect: ['/'], expectHost: 'atelieroptica.com.ar', why: 'www → apex (Instagram/links viejos)' },
];

const MAX_HOPS = 6;
const TIMEOUT_MS = 8000;

async function runCheck(check: Check) {
  let url = check.path.startsWith('http') ? check.path : `${BASE}${check.path}`;
  let hops = 0;
  let res: Response | null = null;

  while (hops <= MAX_HOPS) {
    res = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'AtelierSeoGuard/1.0 (+https://atelieroptica.com.ar)' },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url).toString();
      hops++;
      continue;
    }
    break;
  }

  const finalUrl = new URL(url);
  const fail = (reason: string) => ({ ok: false as const, path: check.path, why: check.why, reason, finalUrl: url, status: res?.status, hops });

  if (!res || res.status !== 200) return fail(`status final ${res?.status ?? 'sin respuesta'}`);
  if (hops > MAX_HOPS) return fail('bucle de redirects (demasiados saltos)');
  if (check.expectHost && finalUrl.hostname !== check.expectHost) {
    return fail(`host final inesperado: ${finalUrl.hostname} (se esperaba ${check.expectHost})`);
  }
  // '/' solo matchea exacto (startsWith('/') daría verde con cualquier destino)
  if (check.expect && !check.expect.some((p) => finalUrl.pathname === p || (p !== '/' && finalUrl.pathname.startsWith(p)))) {
    return fail(`destino inesperado: ${finalUrl.pathname} (se esperaba ${check.expect.join(' | ')})`);
  }
  // Un 200 en /producto/ solo cuenta si es una ficha real (anti soft-404)
  if (finalUrl.pathname.startsWith('/producto/')) {
    const body = await res.text();
    if (body.includes('Producto no encontrado')) return fail('soft-404: 200 con "Producto no encontrado"');
  }

  return { ok: true as const, path: check.path, finalUrl: url, hops };
}

export async function GET() {
  const results = await Promise.allSettled(CHECKS.map(runCheck));
  const failures = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { ok: false as const, path: CHECKS[i].path, why: CHECKS[i].why, reason: `error de red: ${r.reason?.message ?? r.reason}` }
  ).filter((r) => !r.ok);

  if (failures.length > 0) {
    console.error('[SeoGuard] Rutas legadas rotas:', JSON.stringify(failures));
    return NextResponse.json({ status: 'degraded', checks: CHECKS.length, failures }, { status: 503 });
  }
  return NextResponse.json({ status: 'ok', checks: CHECKS.length });
}
