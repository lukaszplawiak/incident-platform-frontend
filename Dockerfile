# ================================================================
# Multi-stage Dockerfile for Angular SPA
#
# Stage 1 (builder) — builds the Angular application
# Stage 2 (runtime) — serves via Nginx
#
# Multi-stage build — the final image does not contain Node.js
# or node_modules — only static HTML/CSS/JS files and Nginx.
# This drastically reduces image size (from ~1GB to ~50MB).
# ================================================================

# Stage 1 — Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json before the rest of the code.
# Docker layer cache — when package.json has not changed,
# npm ci is skipped on subsequent builds.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build -- --configuration production

# ================================================================
# Stage 2 — Runtime
# Only Nginx + static files from Stage 1
# ================================================================
FROM nginx:alpine AS runtime

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy security headers — included by nginx.conf in every location{} block.
# Must be copied before nginx.conf because nginx.conf references it via include.
# Path /etc/nginx/security-headers.conf matches the include directive in nginx.conf.
COPY security-headers.conf /etc/nginx/security-headers.conf

# Copy our main Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular files from Stage 1
COPY --from=builder /app/dist/incident-platform-frontend/browser /usr/share/nginx/html

# Port 80 — Nginx listens on this port
EXPOSE 80

# Run Nginx in the foreground (not as a daemon).
# Docker requires a foreground process to keep the container alive.
CMD ["nginx", "-g", "daemon off;"]