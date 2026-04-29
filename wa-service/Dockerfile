FROM node:20-slim

# Install Chromium for whatsapp-web.js (Puppeteer)
RUN apt-get update && \
    apt-get install -y chromium --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy Prisma schema from parent project root (context = .)
COPY prisma/ ./prisma/

# Copy wa-service package files and install dependencies
COPY wa-service/package*.json ./
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy wa-service source code
COPY wa-service/ ./

EXPOSE 3100

CMD ["node", "index.js"]
