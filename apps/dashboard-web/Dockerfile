# Dashboard Frontend Container
# Multi-stage build: Vite build → Nginx serve

# Stage 1: Build React app with Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arg for API URL
ARG VITE_API_URL=https://novabot.izcy.tech/api/dashboard

# Copy frontend package files
COPY apps/dashboard-web/src/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY apps/dashboard-web/src ./

# Build production bundle with environment variable
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx config
COPY infra/nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck using curl (more reliable)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ > /dev/null 2>&1 || exit 1

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
