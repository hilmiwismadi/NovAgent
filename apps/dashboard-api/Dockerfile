# Dashboard Backend API Container
# Node.js 20 for Express API

FROM node:20-alpine

# Install basic tools
RUN apk add --no-cache \
    ca-certificates \
    curl

# Create app directory
WORKDIR /app

# Copy package files
COPY apps/dashboard-api/package*.json ./

# Copy shared packages
COPY packages/database/prisma ./prisma/
COPY packages/database/init-sql ./database/
COPY packages/database/src ./src/database

# Install dependencies
RUN npm ci --omit=dev

# Copy application source
COPY apps/dashboard-api/src/backend ./backend

# Generate Prisma Client
RUN npx prisma generate

# Create logs and message queue directories
RUN mkdir -p /app/logs /app/.message-queue

# Expose dashboard API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run dashboard API
CMD ["node", "backend/server.js"]
