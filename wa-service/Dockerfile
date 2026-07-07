FROM node:20-slim

# Chromium runtime libraries for Puppeteer. NOTE: Debian's packaged chromium binary
# itself is unreliable on Railway's host (crashes with SIGTRAP even as non-root), so we
# don't use it to launch — we only need the shared libs it pulls in. The actual browser
# used is Chrome for Testing, installed below.
RUN apt-get update && \
    apt-get install -y chromium --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy Prisma schema from parent project root (context = .)
COPY prisma/ ./prisma/

# Copy wa-service package files and install dependencies
COPY wa-service/package*.json ./
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Chrome refuses to run --no-sandbox as root ("Running as root without --no-sandbox is
# not supported"), so the browser must run as a non-root user. Chrome for Testing (unlike
# Debian's packaged chromium) launches reliably as that user on this host.
RUN npx --yes @puppeteer/browsers install chrome@stable --path /opt/chrome && \
    ln -s "$(find /opt/chrome -maxdepth 4 -type f -name chrome)" /usr/local/bin/chrome-for-testing
ENV PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chrome-for-testing

# Copy wa-service source code
COPY wa-service/ ./

RUN chown -R node:node /app /opt/chrome

EXPOSE 3100

# The wwebjs session volume is mounted fresh (owned by root) at container start, so we
# start as root just long enough to hand it to `node`, then drop privileges for the app
# and its Chrome child processes.
CMD ["sh", "-c", "if [ -n \"$RAILWAY_VOLUME_MOUNT_PATH\" ]; then mkdir -p \"$RAILWAY_VOLUME_MOUNT_PATH\" && chown -R node:node \"$RAILWAY_VOLUME_MOUNT_PATH\"; fi; exec su -s /bin/sh node -c 'exec node index.js'"]
