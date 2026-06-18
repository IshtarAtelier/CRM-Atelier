FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on package-lock.json
COPY package*.json ./
RUN npm ci --ignore-scripts
# Generate Prisma client explicitly (since we skipped postinstall)
RUN npx prisma generate --schema=node_modules/.prisma/schema.prisma 2>/dev/null || true

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app (without playwright install in build script)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Install Playwright with only Chromium and its system dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN npx playwright install --with-deps chromium

# Production image, copy all the files and run next
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install Chromium system dependencies in the runner image
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    ca-certificates fonts-liberation openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, migrations, and CLI engines for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy Playwright browsers from builder
COPY --from=builder --chown=nextjs:nodejs /app/.playwright-browsers ./.playwright-browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers

USER nextjs

EXPOSE 3000

ENV PORT=3000

# Run migrations and start next standalone server
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && HOSTNAME=0.0.0.0 node server.js"]
