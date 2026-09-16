FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# ── Install dependencies ──
FROM base AS deps
WORKDIR /app
COPY package*.json ./
# -- Evita descargar navegadores de Playwright durante npm ci, pero permite otros postinstalls (como sharp)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# ── Build ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── Variables de MEDICIÓN en el build ──
# Next hornea `process.env.NEXT_PUBLIC_*` en el bundle y en las páginas
# prerenderizadas (landings, home) EN EL BUILD. Docker no ve las variables del
# servicio si no se declaran como ARG, así que hasta el 16/9/2026 salían vacías:
# las páginas prerenderizadas se servían SIN Google ni Meta hasta que ISR las
# regeneraba (primera visita pasados 5 min) — o sea, tras cada deploy los
# primeros visitantes no se medían. Verificado en producción: `x-nextjs-cache:
# STALE` con `gaId: $undefined`, y recién la siguiente lectura con el ID.
# Railway pasa todas las variables del servicio como build args; acá se
# declaran las que la medición necesita y se exponen como ENV para `next build`.
# Las etiquetas de conversión (GOOGLE_ADS_*_LABEL) no son NEXT_PUBLIC pero el
# layout las lee en el prerender: mismo problema, misma solución.
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GA_ID_SECONDARY
ARG NEXT_PUBLIC_GOOGLE_ADS_TAG_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG GOOGLE_ADS_WHATSAPP_LABEL
ARG GOOGLE_ADS_CALL_LABEL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GA_ID_SECONDARY=$NEXT_PUBLIC_GA_ID_SECONDARY \
    NEXT_PUBLIC_GOOGLE_ADS_TAG_ID=$NEXT_PUBLIC_GOOGLE_ADS_TAG_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    GOOGLE_ADS_WHATSAPP_LABEL=$GOOGLE_ADS_WHATSAPP_LABEL \
    GOOGLE_ADS_CALL_LABEL=$GOOGLE_ADS_CALL_LABEL

# Build Next.js (standalone output)
# El guardián de medición corre ANTES del build: un build sin las variables de
# arriba publica un sitio que no mide nada y no avisa. Con `npx next build`
# directo nunca corría (solo está en `npm run build`).
ENV NEXT_TELEMETRY_DISABLED=1
RUN node scripts/checks/medicion-en-build.mjs && npx prisma generate && npx next build

# Install Playwright Chromium + ALL system deps in builder
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install --with-deps chromium

# ── Production runner ──
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Instalar dependencias del sistema para Chromium de forma robusta:
# Copiamos playwright temporalmente para usar su herramienta install-deps
COPY --from=builder /app/node_modules/playwright-core /tmp/playwright-core
COPY --from=builder /app/node_modules/playwright /tmp/playwright
RUN apt-get update \
    && npx /tmp/playwright-core install-deps chromium \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* /tmp/playwright-core /tmp/playwright

COPY --from=builder /app/public ./public

# Prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Next.js standalone output (incluye server.js + node_modules mínimos)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma para migrations en runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Playwright: copiar browsers del builder y el paquete playwright para que el servicio lo use
COPY --from=builder --chown=nextjs:nodejs /app/.playwright-browsers ./.playwright-browsers
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core

USER nextjs

EXPOSE 3000
ENV PORT=3000

# Migrations + start
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && HOSTNAME=0.0.0.0 node server.js"]
