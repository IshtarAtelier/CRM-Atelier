# Checklist de lanzamiento — Tienda nueva en atelieroptica.com.ar

Guía para publicar la app nueva (Railway) en el dominio real y que arranque **rápida**.
El dominio ya está en Cloudflare; el problema hoy es que **Cloudflare no cachea** (pasa
todo al servidor lento). Esta checklist lo arregla.

> Regla de oro: hacé estos pasos **fuera de horario laboral** y avisá antes por si algo falla.

---

## 1. Conectar el dominio a la app nueva (Railway)

- [ ] En **Railway** → tu servicio → *Settings* → *Networking* → **Add Custom Domain**
      → agregar `atelieroptica.com.ar` y `www.atelieroptica.com.ar`. Railway te da un
      destino (algo como `xxxx.up.railway.app`).
- [ ] En **Cloudflare** → *DNS* → apuntar los registros a ese destino de Railway:
      - `atelieroptica.com.ar` → CNAME al destino de Railway
      - `www` → CNAME al destino de Railway
      - **Proxy ACTIVADO** (nube 🟠 naranja, no gris) — así pasa por Cloudflare.
- [ ] En **Cloudflare** → *SSL/TLS* → modo **Full (strict)**.

## 2. Arreglar el redirect www → sin www (que sea instantáneo)

Hoy `www` redirige a sin-`www` sumando ~1.3s por visita.

- [ ] Elegir un dominio canónico. Recomendado: **sin www** (`atelieroptica.com.ar`).
- [ ] Cloudflare → *Rules* → *Redirect Rules* → crear:
      `www.atelieroptica.com.ar/*` → `https://atelieroptica.com.ar/$1` (301).
      Así lo hace Cloudflare en el borde, sin ir al servidor.
- [ ] ⚠️ En el código hay una inconsistencia: el `canonical` del sitio dice **con www**
      (`src/app/page.tsx`) pero el dominio redirige **sin www**. Alinear los dos al
      canónico elegido (avisame y lo cambio).

## 3. ⭐ Activar el caché de Cloudflare (LO MÁS IMPORTANTE)

Esto es lo que hace rápido el sitio. Sin esto, el CDN no sirve de nada.

- [ ] Cloudflare → *Caching* → *Cache Rules* → crear una regla **"Cachear tienda pública"**:
      - **Si** la URL es `/`, `/tienda`, `/producto/*`, `/blog/*`, `/cristales-opticos/*`,
        `/landing/*`, `/_next/static/*`, `/images/*`, `/assets/*`
      - **Entonces**: *Eligible for cache* = ON, *Edge TTL* = respetar el header del origen
        (o 5 min para el HTML).
- [ ] Crear una regla **"NO cachear privado"** (más prioritaria):
      - **Si** la URL empieza con `/admin`, `/api`, `/checkout`, `/login`
      - **Entonces**: *Bypass cache*.
- [ ] Verificar que la tienda pública **no muestra datos por usuario en el HTML** del
      servidor (el carrito y el login son del lado del cliente, así que es seguro cachear).

## 4. Optimizaciones extra de Cloudflare (gratis, 1 clic cada una)

- [ ] *Speed* → **Brotli**: ON (comprime mejor que gzip; el servidor hoy usa gzip).
- [ ] *Network* → **HTTP/3 (QUIC)**: ON.
- [ ] *SSL/TLS* → **Always Use HTTPS**: ON.
- [ ] *Speed* → **Early Hints**: ON (opcional, ayuda al primer pintado).

## 5. Verificar después del lanzamiento

- [ ] Que carga bien: abrir `https://atelieroptica.com.ar` y navegar.
- [ ] Que Cloudflare cachea: en terminal
      `curl -I https://atelieroptica.com.ar` → buscar `cf-cache-status: HIT`
      (la 2ª visita debe dar HIT, no BYPASS).
- [ ] Correr **PageSpeed** de nuevo (pagespeed.web.dev) → el TTFB debería bajar de
      ~1-2.3s a ~0.15s y el puntaje subir bastante.
- [ ] Probar el **checkout y el admin** (que NO estén cacheados y funcionen normal).

---

## Qué esperar

| | Hoy (sin caché) | Después (con caché CF) |
|---|---|---|
| TTFB | 0.7 – 2.3s (variable) | ~0.15s (estable) |
| Puntaje PageSpeed móvil | 74 | ~85-95 (estimado) |

El salto grande viene del **paso 3** (caché). Los pasos 1-2 son para conectar bien y
sacar la vuelta extra del `www`. El resto son mejoras chicas.

> Cuando lo vayas a hacer, avisame y te acompaño paso a paso + verifico que quedó bien.
