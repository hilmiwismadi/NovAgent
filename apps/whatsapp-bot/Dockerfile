# WhatsApp Bot Container
# Node.js 20 with Puppeteer dependencies for whatsapp-web.js

FROM node:20-bullseye-slim

# Install Chromium and dependencies for Puppeteer/whatsapp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy package files
COPY apps/whatsapp-bot/package*.json ./

# Copy shared packages (needed for Prisma)
COPY packages/database/prisma ./prisma/
COPY packages/database/init-sql ./database/

# Install dependencies
RUN npm install --omit=dev

# Copy application source
COPY apps/whatsapp-bot/src ./src
COPY packages/database/src ./src/database
COPY packages/database/utils ./src/utils
COPY packages/knowledge/src ./src/knowledge
COPY packages/calendar/src ./packages/calendar/src
COPY apps/dashboard-api/src/backend/services ./src/services

# Generate Prisma Client
RUN npx prisma generate

# Create directory for WhatsApp session (will be mounted as volume)
RUN mkdir -p /app/.wwebjs_auth && \
    mkdir -p /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "import('./src/database/prisma.js').then(({prisma}) => prisma.\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1)))" || exit 1

# Run WhatsApp bot
CMD ["node", "src/wa-bot.js"]
