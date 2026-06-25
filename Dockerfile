FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# ── Install dependencies ──
FROM base AS deps
WORKDIR /app
COPY package*.json ./
# --ignore-scripts evita instalar Playwright browsers en esta etapa (se hace en builder)
RUN npm ci --ignore-scripts

# ── Build ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

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
