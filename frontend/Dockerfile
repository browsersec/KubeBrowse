# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files and lock file
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code (excluding node_modules via .dockerignore)
COPY . .

# Build the application
RUN npm run build

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
