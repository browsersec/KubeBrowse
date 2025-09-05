# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and lock file
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code (excluding node_modules via .dockerignore)
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM caddy:alpine

ARG CADDYFILE=Caddyfile

# Copy built application
COPY --from=builder /app/dist /srv

# Copy Caddyfile
COPY ${CADDYFILE} /etc/caddy/Caddyfile

# Expose port 80
EXPOSE 80

# Start Caddy
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
