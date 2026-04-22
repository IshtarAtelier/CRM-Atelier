FROM node:20-slim

# Install Chromium for whatsapp-web.js (Puppeteer)
RUN apt-get update && \
    apt-get install -y chromium --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy Prisma schema from parent (needed for prisma generate)
COPY prisma/ ./prisma/

# Copy wa-service files
COPY wa-service/package*.json ./
RUN npm ci --production

# Generate Prisma client
RUN npx prisma generate

COPY wa-service/ ./

EXPOSE 3100

CMD ["node", "index.js"]
